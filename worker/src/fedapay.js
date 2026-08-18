// =============================================================
// Bêta Arsenal - Intégration FedaPay (CÔTÉ WORKER)
// -------------------------------------------------------------
// - Crée une transaction via l'API REST FedaPay.
// - Vérifie la signature HMAC-SHA-256 des webhooks (timing-safe).
// - Récupère le statut d'une transaction par son ID FedaPay.
// =============================================================

const FEDAPAY_API_BASE = (env) =>
  (env.FEDAPAY_MODE === 'live' ? 'https://api.fedapay.com' : 'https://sandbox-api.fedapay.com') + '/v1';

// Authentification : Bearer <SECRET_KEY>
function authHeaders(env) {
  return {
    Authorization: `Bearer ${env.FEDAPAY_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
}

// =============================================================
// Crée une transaction FedaPay + récupère l'URL de paiement
// =============================================================
export async function createFedapayTransaction(env, { amount, currency, description, buyerEmail, callbackUrl }) {
  const url = `${FEDAPAY_API_BASE(env)}/transactions`;
  const body = {
    transaction: {
      amount: Number(amount),
      currency: { iso: currency },
      description,
      callback_url: callbackUrl,
      customer: { email: buyerEmail },
    },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(env),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`FedaPay create error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  // L'API FedaPay renvoie { transaction: { id, reference, ... } }
  const tx = data.transaction || data;
  const fedapayId = tx.id;

  // Génère l'URL de paiement via /transactions/:id/payment
  const paymentUrl = await getPaymentUrl(env, fedapayId, callbackUrl);

  return {
    fedapay_payment_id: String(fedapayId),
    payment_url: paymentUrl,
  };
}

// Récupère l'URL de paiement d'une transaction
async function getPaymentUrl(env, transactionId, callbackUrl) {
  const url = `${FEDAPAY_API_BASE(env)}/transactions/${transactionId}/payment`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(env),
    body: JSON.stringify({
      payment: {
        callback_url: callbackUrl,
      },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`FedaPay payment URL error: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  // Réponse : { payment: { url: "https://..." } } (selon version API)
  if (data.payment && data.payment.url) return data.payment.url;
  if (data.url) return data.url;
  // Fallback : page de paiement FedaPay standard
  return `${FEDAPAY_API_BASE(env).replace('/v1', '')}/pay/${transactionId}`;
}

// =============================================================
// Récupère le statut d'une transaction FedaPay
// =============================================================
export async function getFedapayTransactionStatus(env, fedapayTransactionId) {
  const url = `${FEDAPAY_API_BASE(env)}/transactions/${fedapayTransactionId}`;
  const resp = await fetch(url, { headers: authHeaders(env) });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`FedaPay status error: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  const tx = data.transaction || data;
  // Statuts FedaPay : pending, approved, declined, refunded, canceled
  return {
    status: mapFedapayStatus(tx.status),
    raw_status: tx.status,
  };
}

// Mappe les statuts FedaPay vers nos statuts internes
function mapFedapayStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'complete') return 'approved';
  if (s === 'declined' || s === 'failed' || s === 'canceled') return 'declined';
  if (s === 'refunded') return 'refunded';
  return 'pending'; // pending, started, etc.
}

// =============================================================
// Vérification de signature webhook FedaPay (HMAC-SHA-256)
// -------------------------------------------------------------
// FedaPay signe le corps brut de la requête avec le secret webhook.
// L'en-tête contenant la signature peut varier selon la config :
//   - "X-Fedapay-Signature"
// Comparaison timing-safe via comparaison constante.
// =============================================================
export function verifyFedapayWebhookSignature(env, rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  // Utilise crypto.subtle pour calculer le HMAC-SHA-256
  // Note : on doit faire une version synchrone-compatible, donc on
  // exporte une fonction async.
  return verifyHmacSha256Hex(env.FEDAPAY_WEBHOOK_SECRET, rawBody, signatureHeader);
}

async function verifyHmacSha256Hex(secret, message, expectedHex) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const sigHex = bufferToHex(sigBuf);

  // Comparaison timing-safe (longueur égale)
  return timingSafeEqualHex(sigHex, expectedHex);
}

function bufferToHex(buf) {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

// Comparaison constante de deux chaînes hex (minuscules)
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

// Parse l'événement webhook FedaPay
export function parseFedapayWebhook(body) {
  // Le corps peut contenir { event: "...", data: { ... } } ou directement l'objet
  try {
    const parsed = JSON.parse(body);
    return {
      event: parsed.event || 'transaction.updated',
      entity: parsed.data || parsed.transaction || parsed,
    };
  } catch (_) {
    return null;
  }
}
