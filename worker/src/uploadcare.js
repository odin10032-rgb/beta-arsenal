// =============================================================
// Bêta Arsenal - Génération de liens Uploadcare temporaires
// -------------------------------------------------------------
// Les liens de téléchargement sont générés côté Worker uniquement
// (UPLOADCARE_SECRET_KEY jamais exposé côté frontend).
// Durée de validité par défaut : 1 heure (configurable).
// =============================================================

const DEFAULT_TTL_SECONDS = 3600; // 1 heure

// =============================================================
// Génère un lien CDN Uploadcare signé avec expiration
// -------------------------------------------------------------
// Format : https://ucarecdn.com/{uuid}/?expire={expire}&signature={sig}
// signature = HMAC-SHA256(secret_key, expire + uuid)  (hex minuscules)
// Ce format est compatible avec la "secure delivery" Uploadcare.
// =============================================================
export async function generateSignedUploadcareUrl(env, uuid, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!uuid) throw new Error('Missing Uploadcare UUID');
  if (!env.UPLOADCARE_SECRET_KEY) throw new Error('UPLOADCARE_SECRET_KEY not configured');

  const expire = Math.floor(Date.now() / 1000) + ttlSeconds;
  const message = `${expire}${uuid}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(env.UPLOADCARE_SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const signature = bufferToHex(sigBuf);

  return {
    url: `https://ucarecdn.com/${uuid}/?expire=${expire}&signature=${signature}`,
    expires_at: new Date(expire * 1000).toISOString(),
  };
}

function bufferToHex(buf) {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export { DEFAULT_TTL_SECONDS };
