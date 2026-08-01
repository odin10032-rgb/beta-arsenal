// =============================================================
// Bêta Arsenal - Routeur principal (Cloudflare Worker ESM)
// -------------------------------------------------------------
// Routes PUBLIQUES :
//   GET  /api/offers                       -> offres actives (catalogue)
//
// Routes ADMIN (Bearer <Firebase ID Token> vérifié + email == ADMIN_EMAIL) :
//   GET    /api/admin/offers               -> toutes les offres
//   POST   /api/admin/offers               -> crée une offre
//   PUT    /api/admin/offers/:id           -> modifie une offre
//   DELETE /api/admin/offers/:id           -> supprime une offre
//   GET    /api/admin/transactions         -> toutes les transactions
//   GET    /api/admin/stats                -> statistiques simples
// =============================================================

import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  queryDocuments,
} from './firestore.js';
import { generateSignedUploadcareUrl } from './uploadcare.js';

const SELLER_ID = 'florian';
const COLLECTION_OFFERS = 'offers';
const COLLECTION_TRANSACTIONS = 'transactions';

// =============================================================
// Point d'entrée du Worker
// =============================================================
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const { pathname } = url;
      const method = request.method.toUpperCase();

      // CORS préflight + headers
      if (method === 'OPTIONS') return corsResponse(new Response(null, { status: 204 }));

      // -------- ROUTES PUBLIQUES --------
      if (pathname === '/api/offers' && method === 'GET') {
        return handleGetPublicOffers(env);
      }

      // -------- ROUTES ADMIN --------
      if (pathname.startsWith('/api/admin/')) {
        return handleAdminRoute(request, env, pathname, method);
      }

      // Route santé
      if (pathname === '/api/health') {
        return jsonResponse({ ok: true, time: new Date().toISOString() });
      }

      return jsonErrorResponse(404, 'Not found');
    } catch (err) {
      console.error('Worker error:', err);
      return jsonErrorResponse(500, err.message || 'Internal server error');
    }
  },
};

// =============================================================
// ROUTE : GET /api/offers  (catalogue public - offres actives)
// =============================================================
async function handleGetPublicOffers(env) {
  const offers = await listDocuments(env, COLLECTION_OFFERS);
  const active = offers
    .filter((o) => o.is_active === true && o.seller_id === SELLER_ID)
    .map(serializeOffer);
  return jsonResponse({ offers: active });
}

// =============================================================
// ROUTES ADMIN (Firebase ID token vérifié + email == ADMIN_EMAIL)
// =============================================================
async function handleAdminRoute(request, env, pathname, method) {
  // Vérifie le token Firebase ID
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return jsonErrorResponse(401, 'Authentification requise');
  }
  const idToken = match[1];

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(idToken, env);
  } catch (err) {
    return jsonErrorResponse(401, 'Token invalide: ' + err.message);
  }

  // Vérifie que l'email correspond à ADMIN_EMAIL
  if (decoded.email !== env.ADMIN_EMAIL) {
    return jsonErrorResponse(403, 'Email non autorisé');
  }

  // ---- GET /api/admin/offers ----
  if (pathname === '/api/admin/offers' && method === 'GET') {
    const offers = await listDocuments(env, COLLECTION_OFFERS);
    return jsonResponse({ offers: offers.map(serializeOffer) });
  }

  // ---- POST /api/admin/offers ----
  if (pathname === '/api/admin/offers' && method === 'POST') {
    const body = await readJsonBody(request);
    const data = buildOfferData(body);
    const created = await createDocument(env, COLLECTION_OFFERS, data);
    return jsonResponse({ offer: serializeOffer(created) });
  }

  // ---- PUT /api/admin/offers/:id ----
  const offerMatch = pathname.match(/^\/api\/admin\/offers\/([^/]+)$/);
  if (offerMatch) {
    const id = offerMatch[1];
    if (method === 'PUT') {
      const body = await readJsonBody(request);
      const data = buildOfferData(body);
      const updated = await updateDocument(env, COLLECTION_OFFERS, id, data);
      return jsonResponse({ offer: serializeOffer(updated) });
    }
    if (method === 'DELETE') {
      await deleteDocument(env, COLLECTION_OFFERS, id);
      return jsonResponse({ deleted: true });
    }
  }

  // ---- GET /api/admin/transactions ----
  if (pathname === '/api/admin/transactions' && method === 'GET') {
    const txs = await listDocuments(env, COLLECTION_TRANSACTIONS);
    // Trie par created_at desc
    txs.sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
    return jsonResponse({ transactions: txs.map(serializeTransaction) });
  }

  // ---- GET /api/admin/stats ----
  if (pathname === '/api/admin/stats' && method === 'GET') {
    const txs = await listDocuments(env, COLLECTION_TRANSACTIONS);
    const total = txs.length;
    const approved = txs.filter((t) => t.status === 'approved').length;
    const pending = txs.filter((t) => t.status === 'pending').length;
    // CA par devise (somme des montants approved)
    const revenue = {};
    for (const t of txs) {
      if (t.status === 'approved') {
        const cur = t.currency || 'XXX';
        revenue[cur] = (revenue[cur] || 0) + (Number(t.amount) || 0);
      }
    }
    return jsonResponse({ total, approved, pending, revenue });
  }

  // ---- POST /api/admin/transactions/:id/regenerate-link ----
  // (Supprimé car lié à FedaPay/produits numériques)

  return jsonErrorResponse(404, 'Route admin inconnue');
}

// =============================================================
// Régénère le lien de téléchargement d'une transaction
// =============================================================
async function regenerateDownloadLink(env, tx) {
  const offer = await getDocument(env, COLLECTION_OFFERS, tx.offer_id);
  if (!offer || !offer.uploadcare_uuid) {
    throw new Error('Aucun fichier numérique associé à cette offre');
  }
  const signed = await generateSignedUploadcareUrl(env, offer.uploadcare_uuid);
  await updateDocument(env, COLLECTION_TRANSACTIONS, tx.id, {
    download_link: signed.url,
    download_link_expires_at: signed.expires_at,
    updated_at: new Date().toISOString(),
  });
}

// =============================================================
// Vérification d'un token Firebase ID (JWKS Google + RS256)
// =============================================================
let _jwksCache = null;
let _jwksCacheExpiry = 0;

async function getGoogleJwks() {
  const now = Date.now();
  if (_jwksCache && _jwksCacheExpiry > now) return _jwksCache;
  const resp = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!resp.ok) throw new Error('JWKS fetch error: ' + resp.status);
  const data = await resp.json();
  _jwksCache = data;
  _jwksCacheExpiry = now + 60 * 60 * 1000; // cache 1h
  return data;
}

async function verifyFirebaseIdToken(idToken, env) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Format token invalide');
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(b64urlDecode(headerB64));
  const payload = JSON.parse(b64urlDecode(payloadB64));

  // Vérifie l'issuer et l'audience
  const expectedIssuer = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`;
  if (payload.iss !== expectedIssuer) throw new Error('Issuer invalide');
  if (payload.aud !== env.FIREBASE_PROJECT_ID) throw new Error('Audience invalide');
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expiré');
  }
  if (header.alg !== 'RS256') throw new Error('Algorithme non supporté');

  // Récupère la clé JWKS par kid
  const jwks = await getGoogleJwks();
  const jwk = jwks.keys && jwks.keys[header.kid];
  if (!jwk) throw new Error('Clé de signature introuvable');

  // Importe la clé publique
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Vérifie la signature
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = b64urlDecodeToBytes(signatureB64);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signature,
    signingInput
  );
  if (!valid) throw new Error('Signature invalide');

  return payload; // contient email, user_id, email_verified, etc.
}

function b64urlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

function b64urlDecodeToBytes(str) {
  const binary = b64urlDecode(str);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// =============================================================
// Helpers de sérialisation & validation
// =============================================================

// Construit l'objet offre à partir du body admin (normalisation)
function buildOfferData(body) {
  const now = new Date().toISOString();
  const data = {
    seller_id: 'florian',
    type: body.type || 'digital_product',
    title_fr: body.title_fr || '',
    title_en: body.title_en || '',
    description_fr: body.description_fr || '',
    description_en: body.description_en || '',
    price: Number(body.price) || 0,
    currency: body.currency || 'XOF',
    is_active: !!body.is_active,
    social_links: body.social_links || {},
    updated_at: now,
  };

  if (data.type === 'digital_product') {
    data.uploadcare_uuid = body.uploadcare_uuid || null;
    data.file_name = body.file_name || null;
    data.file_size_bytes = Number(body.file_size_bytes) || 0;
    data.sales_link = body.sales_link || null;
  } else {
    data.service_mode = body.service_mode || 'instructions';
    data.service_instructions_fr = body.service_instructions_fr || '';
    data.service_instructions_en = body.service_instructions_en || '';
    data.service_private_link = body.service_private_link || null;
    data.service_booking_link = body.service_booking_link || null;
    data.service_contact = body.service_contact || null;
    data.sales_link = body.sales_link || null;
  }
  return data;
}

// Sérialise une offre pour la réponse API
function serializeOffer(o) {
  const out = {
    id: o.id,
    seller_id: o.seller_id,
    type: o.type,
    title_fr: o.title_fr,
    title_en: o.title_en,
    description_fr: o.description_fr,
    description_en: o.description_en,
    price: o.price,
    currency: o.currency,
    is_active: o.is_active,
    social_links: o.social_links || {},
  };
  if (o.type === 'digital_product') {
    out.uploadcare_uuid = o.uploadcare_uuid;
    out.file_name = o.file_name;
    out.file_size_bytes = o.file_size_bytes;
    out.sales_link = o.sales_link;
  } else {
    out.service_mode = o.service_mode;
    out.service_instructions_fr = o.service_instructions_fr;
    out.service_instructions_en = o.service_instructions_en;
    out.service_private_link = o.service_private_link;
    out.service_booking_link = o.service_booking_link;
    out.service_contact = o.service_contact;
    out.sales_link = o.sales_link;
  }
  return out;
}

// Sérialise une transaction pour la réponse admin
function serializeTransaction(t) {
  return {
    id: t.id,
    public_token: t.public_token,
    offer_id: t.offer_id,
    offer_title: t.offer_title,
    offer_type: t.offer_type,
    seller_id: t.seller_id,
    buyer_email: t.buyer_email,
    amount: t.amount,
    currency: t.currency,
    status: t.status,
    fedapay_payment_id: t.fedapay_payment_id,
    download_link: t.download_link,
    download_link_expires_at: t.download_link_expires_at,
    created_at: t.created_at,
    updated_at: t.updated_at,
    webhook_received_at: t.webhook_received_at,
  };
}

// Mappe les statuts FedaPay -> statuts internes
function mapFedapayStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'complete') return 'approved';
  if (s === 'declined' || s === 'failed' || s === 'canceled') return 'declined';
  if (s === 'refunded') return 'refunded';
  return 'pending';
}

// Génère un token opaque (32 octets aléatoires -> hex 64 chars)
async function generateOpaqueToken() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  let hex = '';
  for (const b of buf) hex += b.toString(16).padStart(2, '0');
  return hex;
}

// Validation email simple
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Lit et parse un body JSON
async function readJsonBody(request) {
  const text = await request.text();
  try {
    return JSON.parse(text || '{}');
  } catch (_) {
    return {};
  }
}

// =============================================================
// Helpers de réponse
// =============================================================
function jsonResponse(data, status = 200) {
  return corsResponse(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  );
}

function jsonErrorResponse(status, message) {
  return corsResponse(
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  );
}

// Ajoute les headers CORS à toute réponse
function corsResponse(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}
