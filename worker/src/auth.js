// =============================================================
// Bêta Arsenal - Authentification maison (PBKDF2 + JWT HS256)
// -------------------------------------------------------------
// - Hash de mot de passe : PBKDF2-SHA256, 600 000 itérations,
//   sel 16 octets aléatoire, sortie 32 octets.
//   Format stocké : pbkdf2$<iterations>$<salt_hex>$<hash_hex>
//   Compatible Node (node:crypto.pbkdf2Sync) <-> Worker (crypto.subtle).
// - JWT : HS256, secret dans JWT_SECRET (secret Worker), 24h.
// - Middleware requireAdmin(request, env) vérifie le Bearer token.
// =============================================================

const PBKDF2_ITERATIONS = 600000;
const PBKDF2_KEYLEN = 32; // 256 bits
const SALT_LEN = 16; // 128 bits
const JWT_TTL_SECONDS = 24 * 60 * 60; // 24 heures

// =============================================================
// Base64url (compatible Workers : btoa/atob)
// =============================================================
function b64urlEncode(input) {
  let str;
  if (typeof input === 'string') {
    str = btoa(input);
  } else {
    const bytes = new Uint8Array(input);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    str = btoa(binary);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecodeToString(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

function b64urlDecodeToBytes(str) {
  const binary = b64urlDecodeToString(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToHex(buf) {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// =============================================================
// Hash de mot de passe (PBKDF2-SHA256)
// =============================================================

// Hash un mot de passe -> renvoie la chaîne "pbkdf2$<iter>$<salt_hex>$<hash_hex>"
export async function hashPassword(password) {
  const salt = new Uint8Array(SALT_LEN);
  crypto.getRandomValues(salt);

  const hash = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN);
  // Format auto-descriptif : pbkdf2$<iterations>$<salt_hex>$<hash_hex>
  return ['pbkdf2', String(PBKDF2_ITERATIONS), bytesToHex(salt), bytesToHex(hash)].join('$');
}

// Vérifie un mot de passe contre la chaîne stockée
export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  // Format attendu : pbkdf2$<iter>$<salt_hex>$<hash_hex>
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = hexToBytes(parts[2]);
  const expectedHash = parts[3];
  if (!iterations || !salt || !expectedHash) return false;

  const actualHash = await derivePbkdf2(password, salt, iterations, PBKDF2_KEYLEN);
  const actualHex = bytesToHex(actualHash);
  return timingSafeEqualHex(actualHex, expectedHash);
}

// Dérivation PBKDF2 via crypto.subtle (dispo nativement Workers)
async function derivePbkdf2(password, salt, iterations, keylenBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    keylenBytes * 8
  );
  return bits; // ArrayBuffer
}

// Comparaison timing-safe de deux chaînes hex (minuscules)
function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aLow = a.toLowerCase();
  const bLow = b.toLowerCase();
  if (aLow.length !== bLow.length) return false;
  let diff = 0;
  for (let i = 0; i < aLow.length; i++) {
    diff |= aLow.charCodeAt(i) ^ bLow.charCodeAt(i);
  }
  return diff === 0;
}

// =============================================================
// JWT HS256
// =============================================================

// Crée un JWT signé HS256
export async function createJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + JWT_TTL_SECONDS };

  const encodedHeader = b64urlEncode(JSON.stringify(header));
  const encodedPayload = b64urlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importHmacKey(secret);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const signature = b64urlEncode(sigBuf);

  return `${signingInput}.${signature}`;
}

// Vérifie un JWT HS256 (signature + expiration) -> renvoie le payload ou null
export async function verifyJwt(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  try {
    header = JSON.parse(b64urlDecodeToString(headerB64));
  } catch (_) {
    return null;
  }
  if (header.alg !== 'HS256') return null;

  // Vérifie la signature
  const key = await importHmacKey(secret);
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const expectedSig = b64urlDecodeToBytes(signatureB64);
  const valid = await crypto.subtle.verify('HMAC', key, expectedSig, signingInput);
  if (!valid) return null;

  // Vérifie l'expiration
  let payload;
  try {
    payload = JSON.parse(b64urlDecodeToString(payloadB64));
  } catch (_) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;

  return payload;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// =============================================================
// Middleware : extrait et vérifie le JWT d'une requête admin
// -------------------------------------------------------------
// Retourne { ok: true, admin } si valide, ou { ok: false, response } sinon.
// =============================================================
export async function requireAdmin(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      response: jsonError(401, 'Authentification requise'),
    };
  }
  const token = match[1];
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) {
    return {
      ok: false,
      response: jsonError(401, 'Token invalide ou expiré'),
    };
  }
  // Lookup l'admin en base (permet la révocation)
  const { getAdminById } = await import('./db.js');
  const admin = await getAdminById(env, payload.sub);
  if (!admin) {
    return {
      ok: false,
      response: jsonError(403, 'Compte admin introuvable'),
    };
  }
  return { ok: true, admin };
}

// Helper de réponse JSON d'erreur
function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export { PBKDF2_ITERATIONS, JWT_TTL_SECONDS };
