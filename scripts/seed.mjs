// =============================================================
// Bêta Arsenal - Script de seed Cloudflare D1
// -------------------------------------------------------------
// Crée :
//   1. Le compte admin bootstrappé (hash PBKDF2-SHA256 600k itérations)
//   2. 3 offres fictives (1 produit numérique + 1 service RDV +
//      1 service lien privé/groupe)
//
// Le script génère scripts/seed.sql puis l'exécute via
// `wrangler d1 execute` (local par défaut, --remote pour la prod).
//
// Utilisation :
//   1. cp .env.example .env  (renseignez ADMIN_BOOTSTRAP_EMAIL,
//      ADMIN_BOOTSTRAP_PASSWORD, JWT_SECRET)
//   2. node scripts/seed.mjs            (base locale)
//   3. node scripts/seed.mjs --remote   (base distante)
//
// Dépendances : Node.js 18+ (crypto natif). Aucun paquet externe.
// =============================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PBKDF2_ITERATIONS = 600000;
const PBKDF2_KEYLEN = 32;
const SALT_LEN = 16;

// -------------------------------------------------------------
// Lecture manuelle du fichier .env
// -------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Aucun fichier .env trouvé. Copiez .env.example vers .env et renseignez les valeurs.');
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
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnv();
const useRemote = process.argv.includes('--remote');
const dbName = env.D1_DATABASE_NAME || 'beta-arsenal';

const ADMIN_EMAIL = env.ADMIN_BOOTSTRAP_EMAIL;
const ADMIN_PASSWORD = env.ADMIN_BOOTSTRAP_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('❌ ADMIN_BOOTSTRAP_EMAIL et ADMIN_BOOTSTRAP_PASSWORD doivent être définis dans .env');
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 8) {
  console.error('❌ Le mot de passe admin doit faire au moins 8 caractères.');
  process.exit(1);
}

// -------------------------------------------------------------
// Hash PBKDF2-SHA256 (compatible Worker crypto.subtle.deriveBits)
// -------------------------------------------------------------
// Format stocké : pbkdf2$<iterations>$<salt_hex>$<hash_hex>
function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, 'sha256');
  return ['pbkdf2', String(PBKDF2_ITERATIONS), salt.toString('hex'), hash.toString('hex')].join('$');
}

// -------------------------------------------------------------
// Échappement SQL (sécurité : ne jamais interpoler de valeurs
// brutes dans une requête SQL générée)
// -------------------------------------------------------------
function sqlEscape(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

// -------------------------------------------------------------
// Génération du SQL
// -------------------------------------------------------------
function generateSeedSql() {
  const now = new Date().toISOString();
  const passwordHash = hashPassword(ADMIN_PASSWORD);

  // IDs UUID v4 pour les offres
  const offerIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];

  const lines = [];

  // 1. Compte admin (INSERT OR IGNORE pour ne pas écraser un admin existant)
  lines.push('-- Compte admin bootstrappé');
  lines.push(
    `INSERT OR IGNORE INTO admin_users (email, password_hash, created_at) ` +
    `VALUES (${sqlEscape(ADMIN_EMAIL.toLowerCase())}, ${sqlEscape(passwordHash)}, ${sqlEscape(now)});`
  );
  lines.push('');

  // 2. Offres (INSERT OR REPLACE pour pouvoir re-seeder)
  // V3 : formulaire unifié + média (démo TikTok OU images) + présentation
  const offers = [
    {
      id: offerIds[0],
      type: 'digital_product',
      title_fr: 'Guide PDF : Lancer son business digital',
      title_en: 'PDF Guide: Launch your digital business',
      description_fr: 'Un guide complet de 60 pages pour démarrer un business en ligne de zéro. Livraison immédiate après paiement.',
      description_en: 'A complete 60-page guide to start an online business from scratch. Instant delivery after payment.',
      price: 5000,
      currency: 'XOF',
      // Détails de l'offre
      service_mode: 'private_link',
      service_instructions_fr: "Après votre paiement, vous serez redirigé vers le site annexe où vous pourrez télécharger votre guide PDF.",
      service_instructions_en: 'After your payment, you will be redirected to the external site where you can download your PDF guide.',
      service_private_link: 'https://example.com/tunnel-vente-guide-pdf',
      // Média : démo TikTok
      media_type: 'demo',
      media_demo_url: 'https://www.tiktok.com/@betaarsenal/video/7123456789012345678',
      // Présentation
      presentation_summary_fr: "Ce guide de 60 pages est le fruit de 3 années d'expérience en business digital. Il couvre toutes les étapes : idée, validation, création du produit, marketing, vente, et livraison automatisée. Inclus : 5 templates prêts à l'emploi, 3 checklists, et l'accès à une communauté privée.",
      presentation_summary_en: "This 60-page guide is the result of 3 years of digital business experience. It covers every step: idea, validation, product creation, marketing, sales, and automated delivery. Includes: 5 ready-to-use templates, 3 checklists, and access to a private community.",
      presentation_highlights_fr: [
        '60 pages de contenu actionnable',
        '5 templates prêts à l\'emploi',
        '3 checklists de validation',
        'Accès communauté privée Discord',
        'Mises à jour à vie incluses',
      ],
      presentation_highlights_en: [
        '60 pages of actionable content',
        '5 ready-to-use templates',
        '3 validation checklists',
        'Private Discord community access',
        'Lifetime updates included',
      ],
      presentation_excerpts_fr: [
        { title: 'Chapitre 1 : Trouver son idée', content: "La plupart des entrepreneurs bloquent à cette étape. Je vous partage ma méthode en 3 questions pour identifier une idée rentable en moins de 30 minutes." },
        { title: 'Chapitre 4 : Le système de vente', content: "Un tunnel de vente simple en 3 pages : page d\'atterrissage, page de paiement, page de remerciement. Modèle inclus." },
      ],
      presentation_excerpts_en: [
        { title: 'Chapter 1: Finding your idea', content: "Most entrepreneurs get stuck at this step. I share my 3-question method to identify a profitable idea in under 30 minutes." },
        { title: 'Chapter 4: The sales system', content: "A simple 3-page sales funnel: landing page, checkout page, thank you page. Template included." },
      ],
      social_links: { whatsapp: 'https://wa.me/22500000000', telegram: 'https://t.me/betaarsenal' },
    },
    {
      id: offerIds[1],
      type: 'service',
      title_fr: 'Coaching individuel (1h en visio)',
      title_en: 'Individual coaching (1h video call)',
      description_fr: 'Une heure de coaching personnalisé en visio. Lien de réservation envoyé après achat.',
      description_en: 'One hour of personalized video coaching. Booking link sent after purchase.',
      price: 15000,
      currency: 'XOF',
      service_mode: 'rdv',
      service_instructions_fr: "Après votre achat, utilisez le lien de réservation pour choisir votre créneau. Vous recevrez un email de confirmation avec le lien de la visio.",
      service_instructions_en: 'After your purchase, use the booking link to choose your slot. You will receive a confirmation email with the video call link.',
      service_booking_link: 'https://calendly.com/beta-arsenal/coaching',
      service_contact: 'https://wa.me/22500000000',
      // Média : images (placeholders GitHub — à remplacer par de vraies images uploadées)
      media_type: 'image',
      media_images: [
        'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800',
      ],
      presentation_summary_fr: "Un coaching 1-to-1 d'une heure pour faire le point sur votre business digital. On analysera votre situation actuelle, on identifiera les points de blocage, et on construira ensemble un plan d'action sur 30 jours.",
      presentation_summary_en: "A 1-to-1 one-hour coaching session to review your digital business. We'll analyze your current situation, identify bottlenecks, and build a 30-day action plan together.",
      presentation_highlights_fr: [
        '1h de visio personnalisée',
        'Analyse complète de votre situation',
        'Plan d\'action sur 30 jours',
        'Suivi par email pendant 7 jours',
        'Replay de la session fourni',
      ],
      presentation_highlights_en: [
        '1h personalized video call',
        'Complete situation analysis',
        '30-day action plan',
        'Email follow-up for 7 days',
        'Session replay provided',
      ],
      presentation_excerpts_fr: [
        { title: 'Déroulé de la séance', content: "1. Tour de table (10 min)\n2. Analyse de votre situation (20 min)\n3. Identification des priorités (15 min)\n4. Plan d'action (15 min)" },
      ],
      presentation_excerpts_en: [
        { title: 'Session outline', content: "1. Introduction (10 min)\n2. Situation analysis (20 min)\n3. Priority identification (15 min)\n4. Action plan (15 min)" },
      ],
      social_links: { whatsapp: 'https://wa.me/22500000000' },
    },
    {
      id: offerIds[2],
      type: 'service',
      title_fr: 'Accès groupe privé Telegram (mensuel)',
      title_en: 'Private Telegram group access (monthly)',
      description_fr: 'Rejoignez un groupe privé Telegram avec contenu exclusif et échanges quotidiens pendant 1 mois.',
      description_en: 'Join a private Telegram group with exclusive content and daily chats for 1 month.',
      price: 3000,
      currency: 'XOF',
      service_mode: 'private_group',
      service_instructions_fr: "Après votre achat, cliquez sur le lien privé pour rejoindre le groupe Telegram. L'accès est valable 30 jours.",
      service_instructions_en: 'After your purchase, click the private link to join the Telegram group. Access is valid for 30 days.',
      service_private_link: 'https://t.me/+abcdef123456',
      service_contact: 'https://t.me/betaarsenal',
      // Média : démo TikTok
      media_type: 'demo',
      media_demo_url: 'https://www.tiktok.com/@betaarsenal/video/7234567890123456789',
      presentation_summary_fr: "Un groupe Telegram privé où je partage chaque jour mes analyses, mes coulisses, et où vous pouvez poser vos questions. Accès mensuel renouvelable.",
      presentation_summary_en: "A private Telegram group where I share daily analyses, behind-the-scenes content, and where you can ask your questions. Renewable monthly access.",
      presentation_highlights_fr: [
        'Contenu exclusif quotidien',
        'Questions-réponses en direct',
        'Partage de coulisses',
        'Accès aux outils que j\'utilise',
        'Communauté d\'entrepreneurs',
      ],
      presentation_highlights_en: [
        'Daily exclusive content',
        'Live Q&A',
        'Behind-the-scenes sharing',
        'Access to my tools stack',
        'Community of entrepreneurs',
      ],
      presentation_excerpts_fr: [],
      presentation_excerpts_en: [],
      social_links: { telegram: 'https://t.me/betaarsenal' },
    },
  ];

  lines.push('-- Offres fictives (INSERT OR REPLACE pour permettre le re-seed)');
  for (const o of offers) {
    const cols = [
      'id', 'seller_id', 'type', 'title_fr', 'title_en', 'description_fr', 'description_en',
      'price', 'currency', 'is_active',
      'service_mode', 'service_instructions_fr', 'service_instructions_en',
      'service_private_link', 'service_booking_link', 'service_contact',
      'media_type', 'media_demo_url', 'media_images',
      'presentation_summary_fr', 'presentation_summary_en',
      'presentation_highlights_fr', 'presentation_highlights_en',
      'presentation_excerpts_fr', 'presentation_excerpts_en',
      'social_links', 'created_at', 'updated_at',
    ];
    const vals = [
      sqlEscape(o.id), sqlEscape('florian'), sqlEscape(o.type),
      sqlEscape(o.title_fr), sqlEscape(o.title_en),
      sqlEscape(o.description_fr), sqlEscape(o.description_en),
      Number(o.price), sqlEscape(o.currency), 1,
      o.service_mode ? sqlEscape(o.service_mode) : 'NULL',
      o.service_instructions_fr ? sqlEscape(o.service_instructions_fr) : 'NULL',
      o.service_instructions_en ? sqlEscape(o.service_instructions_en) : 'NULL',
      o.service_private_link ? sqlEscape(o.service_private_link) : 'NULL',
      o.service_booking_link ? sqlEscape(o.service_booking_link) : 'NULL',
      o.service_contact ? sqlEscape(o.service_contact) : 'NULL',
      o.media_type ? sqlEscape(o.media_type) : 'NULL',
      o.media_demo_url ? sqlEscape(o.media_demo_url) : 'NULL',
      sqlEscape(JSON.stringify(o.media_images || [])),
      o.presentation_summary_fr ? sqlEscape(o.presentation_summary_fr) : 'NULL',
      o.presentation_summary_en ? sqlEscape(o.presentation_summary_en) : 'NULL',
      sqlEscape(JSON.stringify(o.presentation_highlights_fr || [])),
      sqlEscape(JSON.stringify(o.presentation_highlights_en || [])),
      sqlEscape(JSON.stringify(o.presentation_excerpts_fr || [])),
      sqlEscape(JSON.stringify(o.presentation_excerpts_en || [])),
      sqlEscape(JSON.stringify(o.social_links || {})),
      sqlEscape(now), sqlEscape(now),
    ];
    lines.push(
      `INSERT OR REPLACE INTO offers (${cols.join(', ')}) VALUES (${vals.join(', ')});`
    );
  }

  return lines.join('\n') + '\n';
}

// -------------------------------------------------------------
// Exécution via wrangler d1 execute
// -------------------------------------------------------------
function main() {
  const sql = generateSeedSql();
  const sqlPath = path.join(__dirname, 'seed.sql');
  fs.writeFileSync(sqlPath, sql, 'utf-8');
  console.log(`📝 Fichier SQL généré : ${sqlPath}`);

  const flag = useRemote ? '--remote' : '--local';
  const cmd = `npx wrangler d1 execute ${dbName} ${flag} --file="${sqlPath}"`;

  console.log(`\n🚀 Exécution : ${cmd}`);
  console.log(`   (base ${useRemote ? 'DISTANTE' : 'LOCALE'})\n`);

  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..', 'worker') });
    console.log('\n✅ Seed terminé avec succès !');
    console.log(`   Compte admin : ${ADMIN_EMAIL}`);
    console.log(`   Mot de passe : ${'*'.repeat(ADMIN_PASSWORD.length)} (configuré dans .env)`);
    console.log(`   3 offres créées dans la base D1.`);
    if (!useRemote) {
      console.log('\n💡 Pour seed la base de production : node scripts/seed.mjs --remote');
    }
  } catch (err) {
    console.error('\n❌ Erreur lors de l\'exécution du seed.');
    console.error('   Vérifiez que :');
    console.error('   - wrangler.toml contient le bon database_id D1');
    console.error('   - la migration 0001_init.sql a été appliquée');
    console.error('     (cd worker && npm run db:migrate:local)');
    process.exit(1);
  }
}

main();
