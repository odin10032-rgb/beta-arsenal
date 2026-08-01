# Bêta Arsenal

Boutique mono-vendeur (vendeur fixe : `sellerId = "florian"`) pour la vente de **produits numériques** (PDF, ZIP hébergés sur Uploadcare) et de **services** (RDV, lien privé, groupe privé, instructions après achat).

- **Frontend statique** : HTML / CSS / JavaScript vanilla (Cloudflare Pages).
- **Backend sécurisé** : Cloudflare Workers (ESM).
- **Base de données** : Firebase Firestore (plan gratuit).
- **Auth admin** : Firebase Auth (email / mot de passe).
- **Stockage fichiers** : Uploadcare (plan gratuit).
- **Paiement** : FedaPay (V1).
- **i18n** : Français (par défaut) / Anglais.
- **Marché international** : structure multi-devise.

> ⚠️ Aucune clé secrète n'est exposée côté frontend. Toutes les opérations sensibles (création de transaction, vérification webhook, génération de liens temporaires, gestion des offres/transactions) passent par le Worker.

---

## 1. Contenu du projet

```
beta-arsenal/
├── public/                      # Frontend statique (Cloudflare Pages)
│   ├── index.html               # Catalogue public
│   ├── success.html             # Page de succès (vérification paiement)
│   ├── legal.html               # Mentions légales / CGV / confidentialité
│   ├── css/style.css            # Styles (mobile-first, responsive)
│   ├── js/
│   │   ├── firebase-config.js   # Initialisation Firebase (clés publiques)
│   │   ├── i18n.js              # Système FR/EN + localStorage
│   │   ├── app.js               # Logique catalogue + tunnel d'achat
│   │   ├── fedapay.js           # Chargement du SDK FedaPay
│   │   └── uploadcare-config.js # Config publique Uploadcare
│   └── admin/
│       ├── login.html           # Connexion admin (Firebase Auth)
│       ├── dashboard.html       # Tableau de bord admin
│       └── admin.js             # Logique admin (offres, transactions, stats)
├── worker/                      # Backend (Cloudflare Workers)
│   ├── src/
│   │   ├── index.js             # Routeur principal + middleware
│   │   ├── firestore.js         # Accès Firestore via REST + JWT service account
│   │   ├── fedapay.js           # API FedaPay + vérification webhook HMAC
│   │   └── uploadcare.js        # Génération liens temporaires signés
│   ├── wrangler.toml            # Configuration Wrangler
│   ├── package.json
│   ├── .dev.vars.example        # Exemple de secrets pour `wrangler dev`
│   └── .gitignore
├── scripts/seed.mjs             # Seed Firestore (3 offres fictives)
├── firestore.rules              # Règles Firestore strictes
├── .env.example                 # Toutes les variables d'environnement
├── .gitignore
└── README.md
```

---

## 2. Pré-requis

- Un compte **Cloudflare** (Pages + Workers, plan gratuit OK).
- Un compte **Firebase** (plan Spark/gratuit OK) avec Firestore + Auth.
- Un compte **Uploadcare** (plan gratuit OK).
- Un compte **FedaPay** (sandbox gratuit).
- Node.js 18+ et npm (ou `bun`).

---

## 3. Configuration de Firebase

1. Allez sur <https://console.firebase.google.com/>, créez un projet (ex: `beta-arsenal`).
2. **Firestore Database** : activez la base en mode production, puis déployez `firestore.rules` (section 5).
3. **Authentication** : activez le fournisseur *Email/Mot de passe*.
   - Créez un utilisateur admin avec l'email défini dans `ADMIN_EMAIL` (ex: `admin@beta-arsenal.com`).
4. **Compte de service** :
   - Paramètres du projet → Comptes de service → *Génération d'une nouvelle clé privée* (JSON).
   - Récupérez `project_id`, `client_email` et `private_key` → placez-les dans `.env` / `worker/.dev.vars`.
5. **Config Web** (clés publiques) :
   - Paramètres du projet → Vos applications → Ajoutez une app Web.
   - Récupérez `apiKey`, `authDomain`, `projectId`, `appId` → placez-les dans `public/js/firebase-config.js` (variables publiques uniquement).

---

## 4. Configuration de Firestore

1. Activez Firestore en mode **production**.
2. Dans l'onglet *Règles*, collez le contenu de `firestore.rules` et publiez.
   - Lecture publique des offres **actives** uniquement.
   - Aucune écriture côté client.
   - Transactions totalement interdites au client.

### Collections attendues

- **`offers`** : voir le schéma dans le README (section Schéma).
- **`transactions`** : voir le schéma.

---

## 5. Déploiement des règles Firestore

Option A — Console Firebase : collez `firestore.rules` dans l'onglet Règles.

Option B — Firebase CLI :
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # sélectionnez Firestore + le fichier firestore.rules
firebase deploy --only firestore:rules
```

---

## 6. Configuration de Firebase Auth

1. Console Firebase → Authentication → Sign-in method → activez **Email/Mot de passe**.
2. Ajoutez l'utilisateur admin (email = `ADMIN_EMAIL`).
3. Aucune autre config n'est nécessaire : la vérification du token côté Worker contrôle que l'email correspond à `ADMIN_EMAIL`.

---

## 7. Configuration d'Uploadcare

1. Créez un projet sur <https://uploadcare.com/>.
2. Dashboard → API keys :
   - **Public key** → `UPLOADCARE_PUBLIC_KEY` (frontend + Worker).
   - **Secret key** → `UPLOADCARE_SECRET_KEY` (Worker uniquement).
3. Renseignez `UPLOADCARE_PUBLIC_KEY` dans `public/js/uploadcare-config.js`.
4. Les UUID Uploadcare sont stockés en base (jamais l'URL publique directe). Les liens de téléchargement sont générés côté Worker avec expiration (1 heure par défaut).

---

## 8. Configuration de FedaPay

1. Créez un compte sur <https://fedapay.com/> (mode sandbox pour les tests).
2. Dashboard → Paramètres → API keys :
   - **Public key** → `FEDAPAY_PUBLIC_KEY`.
   - **Secret key** → `FEDAPAY_SECRET_KEY`.
3. Dashboard → Webhooks → créez un endpoint pointant vers :
   `https://<WORKER_URL>/api/fedapay-webhook`
   - Récupérez le **secret webhook** → `FEDAPAY_WEBHOOK_SECRET`.
4. Pour les tests, utilisez les cartes bancaires sandbox de FedaPay (voir leur documentation).

---

## 9. Configuration de Cloudflare Workers

### 9.1 Variables non secrètes

Éditez `worker/wrangler.toml` → section `[vars]` :
- `FIREBASE_PROJECT_ID`
- `ADMIN_EMAIL`
- `PUBLIC_SITE_URL`
- `FEDAPAY_PUBLIC_KEY`
- `UPLOADCARE_PUBLIC_KEY`
- `FEDAPAY_MODE` (`sandbox` ou `live`)

### 9.2 Secrets (jamais commités)

```bash
cd worker
npx wrangler login

npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
npx wrangler secret put FEDAPAY_SECRET_KEY
npx wrangler secret put FEDAPAY_WEBHOOK_SECRET
npx wrangler secret put UPLOADCARE_SECRET_KEY
```

### 9.3 Développement local

```bash
cd worker
cp .dev.vars.example .dev.vars   # renseignez les valeurs
npm install
npm run dev                      # wrangler dev (http://localhost:8787)
```

### 9.4 Déploiement

```bash
cd worker
npm run deploy                   # wrangler deploy
```

Notez l'URL du Worker → `WORKER_API_URL` (à reporter dans le frontend si besoin, et comme endpoint webhook FedaPay).

---

## 10. Configuration de Cloudflare Pages

1. Console Cloudflare → Pages → Create a project → Connect to Git.
2. Sélectionnez votre dépôt GitHub.
3. Build settings :
   - **Framework preset** : None
   - **Build command** : *(vide)*
   - **Build output directory** : `public`
   - **Root directory** : `/` (racine du dépôt)
4. Environment variables (Production + Preview) :
   - Aucune obligatoire : les clés publiques sont déjà dans `public/js/firebase-config.js` et `public/js/uploadcare-config.js`.
5. Save and Deploy.

> L'URL Pages devient `PUBLIC_SITE_URL` (à reporter dans `wrangler.toml`).

---

## 11. Déploiement via GitHub

1. Poussez le dossier `beta-arsenal/` à la racine d'un dépôt GitHub.
2. Connectez le dépôt à **Cloudflare Pages** (section 10).
3. Pour le Worker, soit :
   - Déployez en local avec `wrangler deploy` (section 9.4).
   - Soit ajoutez une GitHub Action (voir modèle ci-dessous).

### GitHub Action (optionnelle)

Créez `.github/workflows/deploy-worker.yml` :
```yaml
name: Deploy Worker
on:
  push:
    branches: [main]
    paths: ['worker/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: 'worker'
```

---

## 12. Lancer le seed Firestore

Le seed crée 3 offres fictives (1 produit numérique + 1 service RDV + 1 service lien privé).

```bash
npm install                       # à la racine du projet
cp .env.example .env              # renseignez FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
node scripts/seed.mjs
```

---

## 13. Tester le paiement en sandbox

1. Configurez `FEDAPAY_MODE=sandbox` et vos clés sandbox.
2. Démarrez le Worker (`npm run dev` dans `worker/`).
3. Configurez le webhook FedaPay sandbox vers votre Worker (utilisez un tunnel type `cloudflared` ou `ngrok` en local).
4. Achetez une offre depuis le catalogue.
5. Utilisez une carte de test FedaPay (ex: `4242 4242 4242 4242`).
6. Vérifiez que `/success.html` passe de *pending* à *approved* et affiche le lien de téléchargement / les instructions.

---

## 14. Limites du plan gratuit

| Service | Limite approx. (plan gratuit) |
|---|---|
| Cloudflare Workers | 100 000 requêtes/jour |
| Cloudflare Pages | 500 builds/mois, bande passante illimitée |
| Firestore | 1 GiB stockage, 50 000 lectures/j, 20 000 écritures/j |
| Firebase Auth | SMS phone auth payant ; email/password gratuit |
| Uploadcare | ~1 000 fichiers / bande passante limitée selon plan |
| FedaPay | Sandbox gratuit ; commissions par transaction en production |

---

## 15. Bonnes pratiques de sécurité

- ✅ Aucune clé secrète côté frontend (Uploadcare secret, FedaPay secret, Firebase private key, webhook secret = **Worker uniquement**).
- ✅ Webhook FedaPay vérifié par HMAC-SHA-256 + comparaison *timing-safe*.
- ✅ Webhook idempotent : une transaction déjà approuvée n'est pas retraitée.
- ✅ Liens Uploadcare générés côté Worker avec expiration (1 h).
- ✅ `public_token` opaque dans l'URL de succès (jamais l'ID Firestore).
- ✅ Transactions non créables/modifiables depuis le frontend.
- ✅ Règles Firestore strictes (lecture publique des offres actives uniquement).
- ✅ Vérification du token Firebase ID côté Worker (JWKS Google) + contrôle `email == ADMIN_EMAIL`.

---

## 16. Schéma Firestore

### Collection `offers`

| Champ | Type | Description |
|---|---|---|
| `sellerId` | string | `"florian"` (vendeur fixe) |
| `type` | string | `"digital_product"` ou `"service"` |
| `title_fr` / `title_en` | string | Titre multilingue |
| `description_fr` / `description_en` | string | Description multilingue |
| `price` | number | Montant entier (ex: 5000 pour 50,00) |
| `currency` | string | ISO 4217 (ex: `XOF`, `EUR`, `USD`) |
| `is_active` | boolean | Offre visible publiquement si `true` |
| `social_links` | map | `{ whatsapp, telegram, facebook, ... }` (optionnel) |
| `created_at` / `updated_at` | timestamp | Dates de gestion |

**Champs produit numérique (en plus)** : `uploadcare_uuid`, `file_name`, `file_size_bytes`.

**Champs service (en plus)** : `service_mode` (`rdv`/`private_link`/`private_group`/`instructions`), `service_instructions_fr`, `service_instructions_en`, `service_private_link`, `service_booking_link`, `service_contact`.

### Collection `transactions`

| Champ | Type | Description |
|---|---|---|
| `public_token` | string | Jeton opaque utilisé dans l'URL `/success.html` |
| `offer_id` | string | Référence vers `offers` |
| `seller_id` | string | `"florian"` |
| `buyer_email` | string | Email de l'acheteur |
| `amount` | number | Montant |
| `currency` | string | Devise |
| `status` | string | `pending` / `approved` / `declined` / `refunded` |
| `fedapay_payment_id` | string | ID paiement FedaPay |
| `download_link` | string | Lien Uploadcare temporaire (produit numérique) |
| `download_link_expires_at` | timestamp | Expiration du lien |
| `created_at` / `updated_at` | timestamp | Dates |
| `webhook_received_at` | timestamp | Date de réception du webhook |

---

## 17. Commandes principales

```bash
# 1. Installer les dépendances Worker
cd worker && npm install

# 2. Configurer les secrets Worker
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
npx wrangler secret put FEDAPAY_SECRET_KEY
npx wrangler secret put FEDAPAY_WEBHOOK_SECRET
npx wrangler secret put UPLOADCARE_SECRET_KEY

# 3. Déployer le Worker
npm run deploy

# 4. Lancer le seed Firestore (depuis la racine du projet)
cp .env.example .env   # renseignez les valeurs Firebase
node scripts/seed.mjs

# 5. Frontend : pousser sur GitHub, Cloudflare Pages se déploie automatiquement
```

---

## 18. Mentions légales

Les textes fournis dans `public/legal.html` sont des **modèles**. Ils doivent être vérifiés et adaptés par le vendeur avant lancement (statut juridique, SIRET, hébergeur, email de contact, etc.).

---

© Bêta Arsenal — Vendeur : Florian. Projet MVP V1.
