// =============================================================
// Bêta Arsenal - Couche d'accès Cloudflare D1 (SQLite)
// -------------------------------------------------------------
// Schéma V3 : offers a une section média (démo TikTok OU images
// GitHub) et une section présentation (résumé + points forts +
// extraits), configurables par l'admin.
// =============================================================

const SELLER_ID = 'florian';

function uuid() {
  return crypto.randomUUID();
}

// =============================================================
// OFFRES
// =============================================================

export async function getOfferById(env, id) {
  const row = await env.DB.prepare('SELECT * FROM offers WHERE id = ?').bind(id).first();
  return row ? deserializeOffer(row) : null;
}

export async function listActiveOffers(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM offers WHERE is_active = 1 AND seller_id = ? ORDER BY created_at DESC'
  ).bind(SELLER_ID).all();
  return results.map(deserializeOffer);
}

export async function listAllOffers(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM offers ORDER BY created_at DESC'
  ).all();
  return results.map(deserializeOffer);
}

export async function createOffer(env, data) {
  const id = uuid();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO offers (
      id, seller_id, type, title_fr, title_en, description_fr, description_en,
      price, currency, is_active,
      service_mode, service_instructions_fr, service_instructions_en,
      service_private_link, service_booking_link, service_contact,
      media_type, media_demo_url, media_images,
      presentation_summary_fr, presentation_summary_en,
      presentation_highlights_fr, presentation_highlights_en,
      presentation_excerpts_fr, presentation_excerpts_en,
      social_links, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, data.seller_id || SELLER_ID, data.type, data.title_fr || '', data.title_en || '',
    data.description_fr || '', data.description_en || '',
    Number(data.price) || 0, data.currency || 'XOF', data.is_active ? 1 : 0,
    data.service_mode || null, data.service_instructions_fr || null, data.service_instructions_en || null,
    data.service_private_link || null, data.service_booking_link || null, data.service_contact || null,
    data.media_type || null, data.media_demo_url || null,
    JSON.stringify(data.media_images || []),
    data.presentation_summary_fr || null, data.presentation_summary_en || null,
    JSON.stringify(data.presentation_highlights_fr || []),
    JSON.stringify(data.presentation_highlights_en || []),
    JSON.stringify(data.presentation_excerpts_fr || []),
    JSON.stringify(data.presentation_excerpts_en || []),
    JSON.stringify(data.social_links || {}),
    now, now
  ).run();
  return getOfferById(env, id);
}

export async function updateOffer(env, id, data) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE offers SET
      type = ?, title_fr = ?, title_en = ?, description_fr = ?, description_en = ?,
      price = ?, currency = ?, is_active = ?,
      service_mode = ?, service_instructions_fr = ?, service_instructions_en = ?,
      service_private_link = ?, service_booking_link = ?, service_contact = ?,
      media_type = ?, media_demo_url = ?, media_images = ?,
      presentation_summary_fr = ?, presentation_summary_en = ?,
      presentation_highlights_fr = ?, presentation_highlights_en = ?,
      presentation_excerpts_fr = ?, presentation_excerpts_en = ?,
      social_links = ?, updated_at = ?
    WHERE id = ?`
  ).bind(
    data.type, data.title_fr || '', data.title_en || '',
    data.description_fr || '', data.description_en || '',
    Number(data.price) || 0, data.currency || 'XOF', data.is_active ? 1 : 0,
    data.service_mode || null, data.service_instructions_fr || null, data.service_instructions_en || null,
    data.service_private_link || null, data.service_booking_link || null, data.service_contact || null,
    data.media_type || null, data.media_demo_url || null,
    JSON.stringify(data.media_images || []),
    data.presentation_summary_fr || null, data.presentation_summary_en || null,
    JSON.stringify(data.presentation_highlights_fr || []),
    JSON.stringify(data.presentation_highlights_en || []),
    JSON.stringify(data.presentation_excerpts_fr || []),
    JSON.stringify(data.presentation_excerpts_en || []),
    JSON.stringify(data.social_links || {}),
    now, id
  ).run();
  return getOfferById(env, id);
}

export async function deleteOffer(env, id) {
  await env.DB.prepare('DELETE FROM offers WHERE id = ?').bind(id).run();
  return true;
}

// =============================================================
// TRANSACTIONS (inchangé)
// =============================================================

export async function getTransactionByToken(env, publicToken) {
  const row = await env.DB.prepare(
    'SELECT * FROM transactions WHERE public_token = ?'
  ).bind(publicToken).first();
  return row ? deserializeTransaction(row) : null;
}

export async function getTransactionById(env, id) {
  const row = await env.DB.prepare(
    'SELECT * FROM transactions WHERE id = ?'
  ).bind(id).first();
  return row ? deserializeTransaction(row) : null;
}

export async function getTransactionByFedapayId(env, fedapayId) {
  const row = await env.DB.prepare(
    'SELECT * FROM transactions WHERE fedapay_payment_id = ?'
  ).bind(String(fedapayId)).first();
  return row ? deserializeTransaction(row) : null;
}

export async function createTransaction(env, data) {
  const id = data.id || uuid();
  const publicToken = data.public_token || (await generateOpaqueToken());
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO transactions (
      id, public_token, offer_id, offer_title, offer_type, seller_id,
      buyer_email, amount, currency, status, fedapay_payment_id,
      download_link, download_link_expires_at, webhook_received_at,
      created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, publicToken, data.offer_id, data.offer_title || '', data.offer_type, data.seller_id || SELLER_ID,
    data.buyer_email, Number(data.amount) || 0, data.currency, data.status || 'pending',
    data.fedapay_payment_id || null,
    data.download_link || null, data.download_link_expires_at || null, null,
    now, now
  ).run();
  return getTransactionById(env, id);
}

export async function updateTransaction(env, id, updates) {
  const current = await getTransactionById(env, id);
  if (!current) throw new Error('Transaction introuvable');
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE transactions SET
      status = ?, fedapay_payment_id = ?,
      download_link = ?, download_link_expires_at = ?,
      webhook_received_at = ?, updated_at = ?
    WHERE id = ?`
  ).bind(
    updates.status !== undefined ? updates.status : current.status,
    updates.fedapay_payment_id !== undefined ? updates.fedapay_payment_id : current.fedapay_payment_id,
    updates.download_link !== undefined ? updates.download_link : current.download_link,
    updates.download_link_expires_at !== undefined ? updates.download_link_expires_at : current.download_link_expires_at,
    updates.webhook_received_at !== undefined ? updates.webhook_received_at : current.webhook_received_at,
    now, id
  ).run();
  return getTransactionById(env, id);
}

export async function listAllTransactions(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM transactions ORDER BY created_at DESC'
  ).all();
  return results.map(deserializeTransaction);
}

// =============================================================
// STATISTIQUES
// =============================================================
export async function getStats(env) {
  const totalRow = await env.DB.prepare('SELECT COUNT(*) as c FROM transactions').first();
  const approvedRow = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM transactions WHERE status = 'approved'"
  ).first();
  const pendingRow = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM transactions WHERE status = 'pending'"
  ).first();
  const { results: revRows } = await env.DB.prepare(
    "SELECT currency, SUM(amount) as total FROM transactions WHERE status = 'approved' GROUP BY currency"
  ).all();
  const revenue = {};
  for (const r of revRows) {
    revenue[r.currency] = Number(r.total) || 0;
  }
  return {
    total: totalRow?.c || 0,
    approved: approvedRow?.c || 0,
    pending: pendingRow?.c || 0,
    revenue,
  };
}

// =============================================================
// ADMIN USERS
// =============================================================
export async function getAdminByEmail(env, email) {
  const row = await env.DB.prepare(
    'SELECT * FROM admin_users WHERE email = ?'
  ).bind(String(email).toLowerCase().trim()).first();
  return row || null;
}

export async function getAdminById(env, id) {
  const row = await env.DB.prepare(
    'SELECT * FROM admin_users WHERE id = ?'
  ).bind(Number(id)).first();
  return row || null;
}

export async function touchAdminLogin(env, id) {
  await env.DB.prepare(
    'UPDATE admin_users SET last_login_at = ? WHERE id = ?'
  ).bind(new Date().toISOString(), Number(id)).run();
}

// =============================================================
// Sérialisation DB row -> objet JS
// =============================================================

function deserializeOffer(row) {
  if (!row) return null;
  let socialLinks = {};
  try { socialLinks = JSON.parse(row.social_links || '{}'); } catch (_) { socialLinks = {}; }
  let mediaImages = [];
  try { mediaImages = JSON.parse(row.media_images || '[]'); } catch (_) { mediaImages = []; }
  let highlightsFr = [];
  try { highlightsFr = JSON.parse(row.presentation_highlights_fr || '[]'); } catch (_) { highlightsFr = []; }
  let highlightsEn = [];
  try { highlightsEn = JSON.parse(row.presentation_highlights_en || '[]'); } catch (_) { highlightsEn = []; }
  let excerptsFr = [];
  try { excerptsFr = JSON.parse(row.presentation_excerpts_fr || '[]'); } catch (_) { excerptsFr = []; }
  let excerptsEn = [];
  try { excerptsEn = JSON.parse(row.presentation_excerpts_en || '[]'); } catch (_) { excerptsEn = []; }

  return {
    id: row.id,
    seller_id: row.seller_id,
    type: row.type,
    title_fr: row.title_fr,
    title_en: row.title_en,
    description_fr: row.description_fr,
    description_en: row.description_en,
    price: row.price,
    currency: row.currency,
    is_active: !!row.is_active,
    // Détails de l'offre
    service_mode: row.service_mode,
    service_instructions_fr: row.service_instructions_fr,
    service_instructions_en: row.service_instructions_en,
    service_private_link: row.service_private_link,
    service_booking_link: row.service_booking_link,
    service_contact: row.service_contact,
    // Média
    media_type: row.media_type,
    media_demo_url: row.media_demo_url,
    media_images: mediaImages,
    // Présentation
    presentation_summary_fr: row.presentation_summary_fr,
    presentation_summary_en: row.presentation_summary_en,
    presentation_highlights_fr: highlightsFr,
    presentation_highlights_en: highlightsEn,
    presentation_excerpts_fr: excerptsFr,
    presentation_excerpts_en: excerptsEn,
    // Commun
    social_links: socialLinks,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function deserializeTransaction(row) {
  if (!row) return null;
  return {
    id: row.id,
    public_token: row.public_token,
    offer_id: row.offer_id,
    offer_title: row.offer_title,
    offer_type: row.offer_type,
    seller_id: row.seller_id,
    buyer_email: row.buyer_email,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    fedapay_payment_id: row.fedapay_payment_id,
    download_link: row.download_link,
    download_link_expires_at: row.download_link_expires_at,
    webhook_received_at: row.webhook_received_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function generateOpaqueToken() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  let hex = '';
  for (const b of buf) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export { SELLER_ID };
