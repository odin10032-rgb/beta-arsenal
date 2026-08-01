// =============================================================
// Bêta Arsenal - Script de seed Firestore
// -------------------------------------------------------------
// Crée 3 offres fictives (1 produit numérique + 1 service RDV +
// 1 service lien privé) dans la collection `offers`.
//
// Utilisation :
//   1. cp .env.example .env  (renseignez FIREBASE_PROJECT_ID,
//      FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
//   2. node scripts/seed.mjs
//
// Dépendances : Node.js 18+ (fetch global, crypto natif). Aucun paquet
// externe requis : on lit .env manuellement et on signe le JWT avec
// node:crypto.
// =============================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -------------------------------------------------------------
// Lecture manuelle du fichier .env (pas de dépendance dotenv)
// -------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Aucun fichier .env trouvé. Copiez .env.example vers .env et renseignez les valeurs Firebase.');
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Retire les guillemets englobants
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnv();

const PROJECT_ID = env.FIREBASE_PROJECT_ID;
const CLIENT_EMAIL = env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!PROJECT_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error('❌ Variables Firebase manquantes dans .env (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).');
  process.exit(1);
}

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// -------------------------------------------------------------
// Signature RS256 du JWT du compte de service
// -------------------------------------------------------------
function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createServiceAccountJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(PRIVATE_KEY, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${signingInput}.${signature}`;
}

async function getAccessToken() {
  const jwt = createServiceAccountJwt();
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!resp.ok) {
    throw new Error(`Erreur OAuth2: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  return data.access_token;
}

// -------------------------------------------------------------
// Conversion JS -> Firestore
// -------------------------------------------------------------
function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function toFirestoreDocument(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

async function createOffer(token, data) {
  const url = `${FIRESTORE_BASE}/offers`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(toFirestoreDocument(data)),
  });
  if (!resp.ok) {
    throw new Error(`Erreur création offre: ${resp.status} ${await resp.text()}`);
  }
  return resp.json();
}

// -------------------------------------------------------------
// Données de seed : 3 offres
// -------------------------------------------------------------
async function main() {
  console.log('🔐 Obtention du token Google...');
  const token = await getAccessToken();

  const now = new Date().toISOString();

  const offers = [
    // 1. Produit numérique (PDF guide)
    {
      seller_id: 'florian',
      type: 'digital_product',
      title_fr: 'Guide PDF : Lancer son business digital',
      title_en: 'PDF Guide: Launch your digital business',
      description_fr: 'Un guide complet de 60 pages pour démarrer un business en ligne de zéro. Livraison immédiate après paiement.',
      description_en: 'A complete 60-page guide to start an online business from scratch. Instant delivery after payment.',
      price: 5000,
      currency: 'XOF',
      is_active: true,
      uploadcare_uuid: '00000000-0000-0000-0000-000000000000',
      file_name: 'guide-business-digital.pdf',
      file_size_bytes: 2400000,
      sales_link: 'https://systeme.io/votre-tunnel-de-vente',
      social_links: {
        whatsapp: 'https://wa.me/22500000000',
        telegram: 'https://t.me/betaarsenal',
      },
      created_at: now,
      updated_at: now,
    },
    // 2. Service de type RDV
    {
      seller_id: 'florian',
      type: 'service',
      title_fr: 'Coaching individuel (1h en visio)',
      title_en: 'Individual coaching (1h video call)',
      description_fr: 'Une heure de coaching personnalisé en visio. Lien de réservation envoyé après achat.',
      description_en: 'One hour of personalized video coaching. Booking link sent after purchase.',
      price: 15000,
      currency: 'XOF',
      is_active: true,
      service_mode: 'rdv',
      service_instructions_fr: 'Après votre achat, utilisez le lien de réservation pour choisir votre créneau. Vous recevrez un email de confirmation avec le lien de la visio.',
      service_instructions_en: 'After your purchase, use the booking link to choose your slot. You will receive a confirmation email with the video call link.',
      service_private_link: null,
      service_booking_link: 'https://calendly.com/beta-arsenal/coaching',
      service_contact: 'https://wa.me/22500000000',
      sales_link: 'https://systeme.io/votre-tunnel-de-vente',
      social_links: {
        whatsapp: 'https://wa.me/22500000000',
      },
      created_at: now,
      updated_at: now,
    },
    // 3. Service de type lien privé / groupe
    {
      seller_id: 'florian',
      type: 'service',
      title_fr: 'Accès groupe privé Telegram (mensuel)',
      title_en: 'Private Telegram group access (monthly)',
      description_fr: 'Rejoignez un groupe privé Telegram avec contenu exclusif et échanges quotidiens pendant 1 mois.',
      description_en: 'Join a private Telegram group with exclusive content and daily chats for 1 month.',
      price: 3000,
      currency: 'XOF',
      is_active: true,
      service_mode: 'private_group',
      service_instructions_fr: 'Après votre achat, cliquez sur le lien privé pour rejoindre le groupe Telegram. L\'accès est valable 30 jours.',
      service_instructions_en: 'After your purchase, click the private link to join the Telegram group. Access is valid for 30 days.',
      service_private_link: 'https://t.me/+abcdef123456',
      service_booking_link: null,
      service_contact: 'https://t.me/betaarsenal',
      sales_link: 'https://systeme.io/votre-tunnel-de-vente',
      social_links: {
        telegram: 'https://t.me/betaarsenal',
      },
      created_at: now,
      updated_at: now,
    },
  ];

  console.log(`🌱 Création de ${offers.length} offres dans Firestore...`);
  for (const offer of offers) {
    const created = await createOffer(token, offer);
    const id = created.name.split('/').pop();
    console.log(`  ✅ Offre créée : ${offer.title_fr} (id=${id})`);
  }

  console.log('\n🎉 Seed terminé ! Vos offres sont visibles dans Firestore et sur le catalogue public.');
}

main().catch((err) => {
  console.error('❌ Erreur seed:', err);
  process.exit(1);
});
