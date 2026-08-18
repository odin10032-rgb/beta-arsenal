// =============================================================
// Bêta Arsenal - Routeur principal (Cloudflare Worker ESM)
// -------------------------------------------------------------
// Base de données : Cloudflare D1 (binding env.DB)
// Authentification : JWT HS256 maison (PBKDF2 pour les mots de passe)
// Médias : upload d'images sur GitHub (API Contents), démos TikTok (URL)
//
// Routes PUBLIQUES :
//   GET  /api/offers                       -> offres actives (catalogue)
//   GET  /api/offers/:id                   -> détail offre (page produit)
//   POST /api/create-transaction           -> crée une transaction FedaPay
//   GET  /api/transaction-status?token=    -> statut par public_token
//   POST /api/fedapay-webhook              -> webhook FedaPay (HMAC vérifié)
//   GET  /api/health                       -> santé
//
// Routes ADMIN (Bearer <JWT> vérifié via requireAdmin) :
//   POST   /api/admin/login                -> authentifie et renvoie un JWT
//   GET    /api/admin/offers               -> toutes les offres
//   POST   /api/admin/offers               -> crée une offre
//   PUT    /api/admin/offers/:id           -> modifie une offre
//   DELETE /api/admin/offers/:id           -> supprime une offre
//   GET    /api/admin/transactions         -> toutes les transactions
//   GET    /api/admin/stats                -> statistiques simples
//   POST   /api/admin/transactions/:id/regenerate-link -> régénère lien
//   POST   /api/admin/upload-image         -> upload image sur GitHub
// =============================================================

import {
  getOfferById,
  listActiveOffers,
  listAllOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  getTransactionByToken,
  getTransactionById,
  getTransactionByFedapayId,
  createTransaction,
  updateTransaction,
  listAllTransactions,
  getStats,
  getAdminByEmail,
  touchAdminLogin,
  SELLER_ID,
} from './db.js';
import {
  verifyPassword,
  createJwt,
  requireAdmin,
  JWT_TTL_SECONDS,
} from './auth.js';
import {
  createFedapayTransaction,
  verifyFedapayWebhookSignature,
  parseFedapayWebhook,
} from './fedapay.js';
import { uploadImageToGitHub } from './github.js';

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

      // -------- ROUTE SANTÉ --------
      if (pathname === '/api/health') {
        return jsonResponse({ ok: true, time: new Date().toISOString() });
      }

      // -------- ROUTES PUBLIQUES --------
      if (pathname === '/api/offers' && method === 'GET') {
        return handleGetPublicOffers(env);
      }

      // GET /api/offers/:id (page produit)
      const offerDetailMatch = pathname.match(/^\/api\/offers\/([^/]+)$/);
      if (offerDetailMatch && method === 'GET') {
        return handleGetPublicOffer(env, offerDetailMatch[1]);
      }

      if (pathname === '/api/create-transaction' && method === 'POST') {
        return handleCreateTransaction(request, env);
      }

      if (pathname === '/api/transaction-status' && method === 'GET') {
        return handleTransactionStatus(url, env);
      }

      if (pathname === '/api/fedapay-webhook' && method === 'POST') {
        return handleFedapayWebhook(request, env);
      }

      // -------- ROUTES ADMIN --------
      if (pathname.startsWith('/api/admin/')) {
        return handleAdminRoute(request, env, pathname, method);
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
  const offers = await listActiveOffers(env);
  return jsonResponse({ offers: offers.map(serializeOfferCatalog) });
}

// =============================================================
// ROUTE : GET /api/offers/:id  (page produit publique)
// Renvoie TOUS les champs de présentation + média
// =============================================================
async function handleGetPublicOffer(env, id) {
  const offer = await getOfferById(env, id);
  if (!offer || !offer.is_active || offer.seller_id !== SELLER_ID) {
    return jsonErrorResponse(404, 'Offre introuvable ou inactive');
  }
  return jsonResponse({ offer: serializeOfferDetail(offer) });
}

// =============================================================
// ROUTE : POST /api/create-transaction
// Body : { offer_id, buyer_email }
// =============================================================
async function handleCreateTransaction(request, env) {
  const body = await readJsonBody(request);
  const { offer_id, buyer_email } = body;

  if (!offer_id || !buyer_email) {
    return jsonErrorResponse(400, 'offer_id et buyer_email sont requis');
  }
  if (!isValidEmail(buyer_email)) {
    return jsonErrorResponse(400, 'Email invalide');
  }

  const offer = await getOfferById(env, offer_id);
  if (!offer || !offer.is_active || offer.seller_id !== SELLER_ID) {
    return jsonErrorResponse(404, 'Offre introuvable ou inactive');
  }

  const publicToken = await generateOpaqueToken();
  const successUrl = `${env.PUBLIC_SITE_URL}/success.html?token=${publicToken}`;

  const title = offer.title_fr || offer.title_en || 'Commande Bêta Arsenal';
  let fedapayResult;
  try {
    fedapayResult = await createFedapayTransaction(env, {
      amount: offer.price,
      currency: offer.currency,
      description: `${title} (${offer.type})`,
      buyerEmail: buyer_email,
      callbackUrl: successUrl,
    });
  } catch (err) {
    console.error('FedaPay error:', err);
    return jsonErrorResponse(502, 'Impossible de créer le paiement: ' + err.message);
  }

  // Enregistre la transaction en base (statut pending)
  // Le download_link est figé au moment de l'achat : c'est le lien du
  // tunnel de vente (service_private_link) pour les produits numériques.
  const created = await createTransaction(env, {
    public_token: publicToken,
    offer_id: offer.id,
    offer_title: title,
    offer_type: offer.type,
    seller_id: SELLER_ID,
    buyer_email: buyer_email,
    amount: offer.price,
    currency: offer.currency,
    status: 'pending',
    fedapay_payment_id: fedapayResult.fedapay_payment_id,
    // Lien de livraison figé : tunnel de vente (produit) ou lien privé (service)
    download_link: offer.service_private_link || null,
    download_link_expires_at: null, // pas d'expiration (lien du site annexe)
  });

  return jsonResponse({
    public_token: publicToken,
    payment_url: fedapayResult.payment_url,
    transaction_id: created.id,
  });
}

// =============================================================
// ROUTE : GET /api/transaction-status?token=PUBLIC_TOKEN
// =============================================================
async function handleTransactionStatus(url, env) {
  const token = url.searchParams.get('token');
  if (!token) return jsonErrorResponse(400, 'Token manquant');

  const tx = await getTransactionByToken(env, token);
  if (!tx) {
    return jsonErrorResponse(404, 'Transaction introuvable');
  }

  const response = {
    status: tx.status,
    offer_type: tx.offer_type,
  };

  if (tx.status === 'approved') {
    if (tx.offer_type === 'digital_product') {
      // Lien du tunnel de vente (figé à l'achat)
      response.download_link = tx.download_link;
      response.download_link_expires_at = tx.download_link_expires_at;
    } else {
      // Service : instructions + liens (depuis l'offre courante)
      const offer = await getOfferById(env, tx.offer_id);
      if (offer) {
        response.service_instructions_fr = offer.service_instructions_fr;
        response.service_instructions_en = offer.service_instructions_en;
        response.service_private_link = offer.service_private_link;
        response.service_booking_link = offer.service_booking_link;
        response.service_contact = offer.service_contact;
      }
    }
  }

  return jsonResponse(response);
}

// =============================================================
// ROUTE : POST /api/fedapay-webhook  (vérification HMAC)
// =============================================================
async function handleFedapayWebhook(request, env) {
  const rawBody = await request.text();

  const signature =
    request.headers.get('X-Fedapay-Signature') ||
    request.headers.get('X-FedaPay-Signature') ||
    request.headers.get('FEDAPAY-SIGNATURE') ||
    '';

  const valid = await verifyFedapayWebhookSignature(env, rawBody, signature);
  if (!valid) {
    return jsonErrorResponse(401, 'Signature webhook invalide');
  }

  const event = parseFedapayWebhook(rawBody);
  if (!event) {
    return jsonErrorResponse(400, 'Webhook illisible');
  }

  const fedapayId = String(event.entity && (event.entity.id || event.entity.transaction_id) || '');
  const newStatus = mapFedapayStatus(event.entity && event.entity.status);

  if (!fedapayId) {
    return jsonErrorResponse(400, 'ID transaction FedaPay manquant');
  }

  const tx = await getTransactionByFedapayId(env, fedapayId);
  if (!tx) {
    return jsonResponse({ received: true, matched: false });
  }

  // IDEMPOTENCE
  if (tx.status === 'approved' && newStatus === 'approved') {
    return jsonResponse({ received: true, idempotent: true });
  }

  const now = new Date().toISOString();
  await updateTransaction(env, tx.id, {
    status: newStatus,
    webhook_received_at: now,
  });
  // Note : le download_link est déjà figé à la création de la transaction
  // (lien du tunnel de vente), pas besoin de le régénérer ici.

  return jsonResponse({ received: true, status: newStatus });
}

// =============================================================
// ROUTES ADMIN
// =============================================================
async function handleAdminRoute(request, env, pathname, method) {
  // POST /api/admin/login (public, pas de JWT)
  if (pathname === '/api/admin/login' && method === 'POST') {
    return handleAdminLogin(request, env);
  }

  // Toutes les autres routes admin : JWT requis
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  // POST /api/admin/upload-image (upload GitHub)
  if (pathname === '/api/admin/upload-image' && method === 'POST') {
    return handleUploadImage(request, env);
  }

  // ---- GET /api/admin/offers ----
  if (pathname === '/api/admin/offers' && method === 'GET') {
    const offers = await listAllOffers(env);
    return jsonResponse({ offers: offers.map(serializeOfferAdmin) });
  }

  // ---- POST /api/admin/offers ----
  if (pathname === '/api/admin/offers' && method === 'POST') {
    const body = await readJsonBody(request);
    const data = buildOfferData(body);
    const created = await createOffer(env, data);
    return jsonResponse({ offer: serializeOfferAdmin(created) });
  }

  // ---- PUT / DELETE /api/admin/offers/:id ----
  const offerMatch = pathname.match(/^\/api\/admin\/offers\/([^/]+)$/);
  if (offerMatch) {
    const id = offerMatch[1];
    if (method === 'PUT') {
      const body = await readJsonBody(request);
      const data = buildOfferData(body);
      const updated = await updateOffer(env, id, data);
      if (!updated) return jsonErrorResponse(404, 'Offre introuvable');
      return jsonResponse({ offer: serializeOfferAdmin(updated) });
    }
    if (method === 'DELETE') {
      await deleteOffer(env, id);
      return jsonResponse({ deleted: true });
    }
  }

  // ---- GET /api/admin/transactions ----
  if (pathname === '/api/admin/transactions' && method === 'GET') {
    const txs = await listAllTransactions(env);
    return jsonResponse({ transactions: txs.map(serializeTransaction) });
  }

  // ---- GET /api/admin/stats ----
  if (pathname === '/api/admin/stats' && method === 'GET') {
    const stats = await getStats(env);
    return jsonResponse(stats);
  }

  // ---- POST /api/admin/transactions/:id/regenerate-link ----
  // (Utile si l'admin veut mettre à jour le lien de livraison d'une
  // transaction avec le tunnel de vente courant de l'offre.)
  const regenMatch = pathname.match(/^\/api\/admin\/transactions\/([^/]+)\/regenerate-link$/);
  if (regenMatch && method === 'POST') {
    const id = regenMatch[1];
    const tx = await getTransactionById(env, id);
    if (!tx) return jsonErrorResponse(404, 'Transaction introuvable');
    const offer = await getOfferById(env, tx.offer_id);
    const newLink = offer?.service_private_link || null;
    await updateTransaction(env, tx.id, {
      download_link: newLink,
      download_link_expires_at: null,
    });
    return jsonResponse({ ok: true, download_link: newLink });
  }

  return jsonErrorResponse(404, 'Route admin inconnue');
}

// =============================================================
// POST /api/admin/login
// =============================================================
async function handleAdminLogin(request, env) {
  const body = await readJsonBody(request);
  const email = String(body.email || '').toLowerCase().trim();
  const password = String(body.password || '');

  if (!email || !password) {
    return jsonErrorResponse(400, 'Email et mot de passe requis');
  }

  const admin = await getAdminByEmail(env, email);
  const dummyHash = 'pbkdf2$600000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';
  const valid = admin
    ? await verifyPassword(password, admin.password_hash)
    : await verifyPassword(password, dummyHash);

  if (!admin || !valid) {
    return jsonErrorResponse(401, 'Email ou mot de passe incorrect');
  }

  const token = await createJwt({ sub: admin.id, email: admin.email }, env.JWT_SECRET);
  await touchAdminLogin(env, admin.id);

  return jsonResponse({
    token,
    token_type: 'Bearer',
    expires_in: JWT_TTL_SECONDS,
    expires_at: new Date(Date.now() + JWT_TTL_SECONDS * 1000).toISOString(),
    email: admin.email,
  });
}

// =============================================================
// POST /api/admin/upload-image
// -------------------------------------------------------------
// Reçoit multipart/form-data avec un champ "file" (image)
// Renvoie { url } (URL brute raw.githubusercontent.com)
// =============================================================
async function handleUploadImage(request, env) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return jsonErrorResponse(400, 'Content-Type doit être multipart/form-data');
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return jsonErrorResponse(400, 'Fichier image manquant');
  }

  // Valide le type MIME (images uniquement)
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  if (!allowedTypes.includes(file.type)) {
    return jsonErrorResponse(400, `Type de fichier non autorisé: ${file.type}. Formats acceptés: ${allowedTypes.join(', ')}`);
  }

  // Limite de taille : 5 Mo
  const arrayBuf = await file.arrayBuffer();
  if (arrayBuf.byteLength > 5 * 1024 * 1024) {
    return jsonErrorResponse(400, 'Image trop volumineuse (max 5 Mo)');
  }

  // Convertit en base64
  const bytes = new Uint8Array(arrayBuf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  const base64 = btoa(binary);

  // Upload vers GitHub
  try {
    const result = await uploadImageToGitHub(env, {
      filename: file.name || `image.${(file.type.split('/')[1] || 'png')}`,
      base64Content: base64,
    });
    return jsonResponse(result);
  } catch (err) {
    console.error('Upload error:', err);
    return jsonErrorResponse(502, 'Upload échoué: ' + err.message);
  }
}

// =============================================================
// Helpers de sérialisation
// =============================================================

// Construit l'objet offre à partir du body admin
function buildOfferData(body) {
  return {
    seller_id: SELLER_ID,
    type: body.type || 'digital_product',
    title_fr: body.title_fr || '',
    title_en: body.title_en || '',
    description_fr: body.description_fr || '',
    description_en: body.description_en || '',
    price: Number(body.price) || 0,
    currency: body.currency || 'XOF',
    is_active: !!body.is_active,
    // Détails de l'offre (communs aux deux types)
    service_mode: body.service_mode || null,
    service_instructions_fr: body.service_instructions_fr || null,
    service_instructions_en: body.service_instructions_en || null,
    service_private_link: body.service_private_link || null,
    service_booking_link: body.service_booking_link || null,
    service_contact: body.service_contact || null,
    // Média
    media_type: body.media_type || null,
    media_demo_url: body.media_demo_url || null,
    media_images: Array.isArray(body.media_images) ? body.media_images : [],
    // Présentation
    presentation_summary_fr: body.presentation_summary_fr || null,
    presentation_summary_en: body.presentation_summary_en || null,
    presentation_highlights_fr: Array.isArray(body.presentation_highlights_fr) ? body.presentation_highlights_fr : [],
    presentation_highlights_en: Array.isArray(body.presentation_highlights_en) ? body.presentation_highlights_en : [],
    presentation_excerpts_fr: Array.isArray(body.presentation_excerpts_fr) ? body.presentation_excerpts_fr : [],
    presentation_excerpts_en: Array.isArray(body.presentation_excerpts_en) ? body.presentation_excerpts_en : [],
    // Social
    social_links: body.social_links || {},
  };
}

// Sérialisation pour le catalogue (champs publics limités)
function serializeOfferCatalog(o) {
  const lang = null; // on renvoie FR + EN, le frontend choisit
  return {
    id: o.id,
    type: o.type,
    title_fr: o.title_fr,
    title_en: o.title_en,
    description_fr: o.description_fr,
    description_en: o.description_en,
    price: o.price,
    currency: o.currency,
    is_active: o.is_active,
    // Pour la carte : on prend la 1ère image si media_type=image
    cover_image: (o.media_type === 'image' && Array.isArray(o.media_images) && o.media_images.length > 0)
      ? o.media_images[0]
      : null,
    has_demo: o.media_type === 'demo' && !!o.media_demo_url,
    social_links: o.social_links || {},
  };
}

// Sérialisation pour la page produit (tous les champs de présentation)
function serializeOfferDetail(o) {
  return {
    ...serializeOfferCatalog(o),
    // Média complet
    media_type: o.media_type,
    media_demo_url: o.media_demo_url,
    media_images: o.media_images || [],
    // Présentation complète
    presentation_summary_fr: o.presentation_summary_fr,
    presentation_summary_en: o.presentation_summary_en,
    presentation_highlights_fr: o.presentation_highlights_fr || [],
    presentation_highlights_en: o.presentation_highlights_en || [],
    presentation_excerpts_fr: o.presentation_excerpts_fr || [],
    presentation_excerpts_en: o.presentation_excerpts_en || [],
  };
}

// Sérialisation pour l'admin (tous les champs, y compris service_*)
function serializeOfferAdmin(o) {
  return {
    ...serializeOfferDetail(o),
    id: o.id,
    seller_id: o.seller_id,
    is_active: o.is_active,
    // Détails de l'offre
    service_mode: o.service_mode,
    service_instructions_fr: o.service_instructions_fr,
    service_instructions_en: o.service_instructions_en,
    service_private_link: o.service_private_link,
    service_booking_link: o.service_booking_link,
    service_contact: o.service_contact,
    created_at: o.created_at,
    updated_at: o.updated_at,
  };
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

function mapFedapayStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'complete') return 'approved';
  if (s === 'declined' || s === 'failed' || s === 'canceled') return 'declined';
  if (s === 'refunded') return 'refunded';
  return 'pending';
}

async function generateOpaqueToken() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  let hex = '';
  for (const b of buf) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

function corsResponse(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}
