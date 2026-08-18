// =============================================================
// Bêta Arsenal - Création / réinitialisation d'un compte admin
// -------------------------------------------------------------
// Ce script hash un mot de passe avec PBKDF2-SHA256 (600k itérations,
// compatible avec le Worker) et génère une commande SQL prête à
// exécuter via wrangler d1 execute.
//
// Utilisation :
//   node scripts/create-admin.mjs <email> <password>
//   node scripts/create-admin.mjs <email> <password> --remote
//
// Le script affiche et exécute la requête SQL :
//   INSERT OR REPLACE INTO admin_users (email, password_hash, created_at)
//   VALUES ('...', 'pbkdf2$600000$...', '...');
// =============================================================

import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PBKDF2_ITERATIONS = 600000;
const PBKDF2_KEYLEN = 32;
const SALT_LEN = 16;

const args = process.argv.slice(2);
const useRemote = args.includes('--remote');
const positional = args.filter((a) => !a.startsWith('--'));

if (positional.length < 2) {
  console.error('Usage : node scripts/create-admin.mjs <email> <password> [--remote]');
  process.exit(1);
}

const email = positional[0].toLowerCase().trim();
const password = positional[1];

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('❌ Email invalide.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('❌ Le mot de passe doit faire au moins 8 caractères.');
  process.exit(1);
}

// Hash PBKDF2-SHA256 (compatible Worker)
function hashPassword(pwd) {
  const salt = crypto.randomBytes(SALT_LEN);
  const hash = crypto.pbkdf2Sync(pwd, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, 'sha256');
  return ['pbkdf2', String(PBKDF2_ITERATIONS), salt.toString('hex'), hash.toString('hex')].join('$');
}

function sqlEscape(str) {
  return "'" + String(str).replace(/'/g, "''") + "'";
}

const passwordHash = hashPassword(password);
const now = new Date().toISOString();

// INSERT OR REPLACE : si l'email existe déjà, on écrase le mot de passe
const sql =
  `INSERT OR REPLACE INTO admin_users (email, password_hash, created_at) ` +
  `VALUES (${sqlEscape(email)}, ${sqlEscape(passwordHash)}, ${sqlEscape(now)});`;

console.log('='.repeat(60));
console.log('Compte admin généré :');
console.log('='.repeat(60));
console.log(`Email            : ${email}`);
console.log(`Hash             : ${passwordHash.substring(0, 40)}...`);
console.log(`Itérations       : ${PBKDF2_ITERATIONS}`);
console.log('\nRequête SQL :');
console.log(sql);
console.log('='.repeat(60));

// Lecture du nom de base depuis .env si dispo
let dbName = 'beta-arsenal';
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  const match = content.match(/^D1_DATABASE_NAME=(.+)$/m);
  if (match) dbName = match[1].trim();
}

const flag = useRemote ? '--remote' : '--local';
const cmd = `npx wrangler d1 execute ${dbName} ${flag} --command "${sql.replace(/"/g, '\\"')}"`;

console.log(`\n🚀 Exécution : ${cmd}`);
console.log(`   (base ${useRemote ? 'DISTANTE' : 'LOCALE'})\n`);

try {
  execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..', 'worker') });
  console.log('\n✅ Compte admin créé / mis à jour avec succès !');
} catch (err) {
  console.error('\n❌ Erreur. Vérifiez que la migration a été appliquée.');
  process.exit(1);
}
