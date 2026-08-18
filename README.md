# Bêta Arsenal

Boutique mono-vendeur (vendeur fixe : `sellerId = "florian"`) pour la vente de **produits numériques** (via tunnel de vente externe) et de **services** (RDV, lien privé, groupe privé, instructions après achat).

- **Frontend statique** : HTML / CSS / JavaScript vanilla (Cloudflare Pages).
- **Backend sécurisé** : Cloudflare Workers (ESM).
- **Base de données** : Cloudflare D1 (SQLite natif, gratuit, sans carte bancaire).
- **Auth admin** : Authentification maison (PBKDF2 + JWT HS256) dans le Worker.
- **Médias produits** : upload d'images sur GitHub (API Contents) OU démo vidéo TikTok (URL).
- **Paiement** : FedaPay (V1).
- **i18n** : Français (par défaut) / Anglais.
- **Page produit** : chaque produit a sa page `/product.html?id=...` configurable en no-code.

> ⚠️ Aucune clé secrète n'est exposée côté frontend. Toutes les opérations sensibles passent par le Worker.

> ℹ️ **100% gratuit, zéro carte bancaire** : toute la stack (Pages + Workers + D1 + GitHub) reste gratuite.

---

## 1. Contenu du projet (V3)

```
beta-arsenal/
├── public/                      # Frontend statique (Cloudflare Pages)
│   ├── index.html               # Catalogue public (cartes cliquables)
│   ├── product.html             # Page de présentation produit (NOUVEAU V3)
│   ├── success.html             # Page de succès (vérification paiement)
│   ├── legal.html               # Mentions légales / CGV / confidentialité
│   ├── css/style.css            # Styles (mobile-first, responsive)
│   ├── js/
│   │   ├── config.js            # Config publique + gestion JWT localStorage
│   │   ├── i18n.js              # Système FR/EN + localStorage
│   │   ├── app.js               # Logique catalogue + tunnel d'achat
│   │   └── product.js           # Logique page produit (NOUVEAU V3)
│   └── admin/
│       ├── login.html           # Connexion admin
│       ├── dashboard.html       # Tableau de bord (formulaire unifié V3)
│       └── admin.js             # Logique admin (offres, transactions, upload images)
├── worker/                      # Backend (Cloudflare Workers)
│   ├── src/
│   │   ├── index.js             # Routeur + middleware auth
│   │   ├── db.js                # Couche D1 (CRUD offres/transactions/admins)
│   │   ├── auth.js              # PBKDF2 + JWT HS256 + middleware requireAdmin
│   │   ├── fedapay.js           # API FedaPay + vérification webhook HMAC
│   │   └── github.js            # Upload images via API GitHub (NOUVEAU V3)
│   ├── migrations/
│   │   └── 0001_init.sql        # Schéma D1 (offers avec média + présentation)
│   ├── wrangler.toml
│   ├── package.json
│   └── .dev.vars.example
├── scripts/
│   ├── seed.mjs                 # Seed D1 (admin + 3 offres avec média + présentation)
│   └── create-admin.mjs         # Création/réinit d'un compte admin
├── .env.example
├── .gitignore
└── README.md
```

---

## 2. Pré-requis

- Un compte **Cloudflare** (Pages + Workers + D1, plan gratuit OK, **sans carte bancaire**).
- Un compte **GitHub** (pour stocker les images produits — gratuit).
- Un compte **FedaPay** (sandbox gratuit).
- Node.js 18+ et npm.

---

## 3. Configuration de Cloudflare D1

```bash
cd worker
npx wrangler login
npx wrangler d1 create beta-arsenal
# -> copier le database_id dans wrangler.toml (2 sections)
```

Appliquer la migration :
```bash
npm run db:migrate:local      # local
npm run db:migrate:remote     # production
```

---

## 4. Configuration des secrets Worker

### 4.1 Développement local

```bash
cd worker
cp .dev.vars.example .dev.vars
# Éditez .dev.vars : JWT_SECRET, FEDAPAY_*, GITHUB_*
```

Générez un `JWT_SECRET` fort :
```bash
openssl rand -base64 48
```

### 4.2 Production

```bash
cd worker
npx wrangler secret put JWT_SECRET
npx wrangler secret put FEDAPAY_SECRET_KEY
npx wrangler secret put FEDAPAY_WEBHOOK_SECRET
npx wrangler secret put GITHUB_TOKEN
```

Variables non secrètes dans `wrangler.toml` → `[vars]` : `ADMIN_EMAIL`, `PUBLIC_SITE_URL`, `FEDAPAY_PUBLIC_KEY`, `FEDAPAY_MODE`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `GITHUB_BRANCH`, `GITHUB_IMAGE_PATH`.

---

## 5. Configuration de l'authentification admin

Auth maison : PBKDF2-SHA256 (600k itérations) + JWT HS256 (24h).

```bash
cp .env.example .env   # renseignez ADMIN_BOOTSTRAP_* + JWT_SECRET
node scripts/seed.mjs            # local
node scripts/seed.mjs --remote   # production
```

Le seed crée le compte admin **et** 3 offres de démo (avec média + présentation).

---

## 6. Configuration de GitHub (stockage images produits)

Les images uploadées depuis le formulaire admin sont stockées directement dans votre dépôt GitHub via l'API Contents.

### 6.1 Créer un Personal Access Token (PAT) fine-grained

1. Allez sur <https://github.com/settings/personal-access-tokens/new>
2. **Token name** : `Bêta Arsenal image upload`
3. **Repository access** : *Only select repositories* → sélectionnez votre dépôt `beta-arsenal`
4. **Permissions** : *Contents* → **Read and write**
5. Générez le token (`github_pat_...`) → `GITHUB_TOKEN` (secret Worker)

### 6.2 Configurer les vars

Dans `worker/wrangler.toml` :
```toml
[vars]
GITHUB_REPO_OWNER = "votre-username-github"
GITHUB_REPO_NAME = "beta-arsenal"
GITHUB_BRANCH = "main"
GITHUB_IMAGE_PATH = "public/uploads/products"
```

Les images seront accessibles via :
```
https://raw.githubusercontent.com/<owner>/<repo>/main/public/uploads/products/<filename>
```

> 💡 Comme les images sont dans `public/uploads/products`, elles sont aussi servies par Cloudflare Pages (double accès).

---

## 7. Configuration de FedaPay

1. Créez un compte sur <https://fedapay.com/> (mode sandbox).
2. **Paramètres → Clés API** : `FEDAPAY_PUBLIC_KEY`, `FEDAPAY_SECRET_KEY`.
3. **Paramètres → Webhooks** : endpoint `https://<WORKER_URL>/api/fedapay-webhook` → `FEDAPAY_WEBHOOK_SECRET`.

---

## 8. Développement local

```bash
cd worker
npm install
npm run db:migrate:local
cd ..
node scripts/seed.mjs
cd worker
npm run dev      # wrangler dev --local (http://localhost:8787)
```

---

## 9. Déploiement

### Worker
```bash
cd worker
npm run db:migrate:remote
npm run deploy
npx wrangler secret put JWT_SECRET
npx wrangler secret put FEDAPAY_SECRET_KEY
npx wrangler secret put FEDAPAY_WEBHOOK_SECRET
npx wrangler secret put GITHUB_TOKEN
cd ..
node scripts/seed.mjs --remote
```

### Frontend (Cloudflare Pages)
1. Poussez le projet sur GitHub.
2. Cloudflare Pages → Connect to Git → sélectionnez le dépôt.
3. Build settings :
   - Framework preset : None
   - Build command : *(vide)*
   - Build output directory : `public`
4. Save and Deploy.

---

## 10. Fonctionnalités V3

### Formulaire admin unifié
- Un seul formulaire pour les 2 types (produit numérique + service).
- Champs communs : mode de livraison, instructions FR/EN, lien de tunnel de vente, lien de réservation, contact.

### Section Média (au choix)
- **Démo** : collez une URL TikTok → intégrée (embed) sur la page produit.
- **Images** : upload multiple directement sur GitHub (drag & drop supporté).

### Page produit (/product.html?id=...)
Chaque produit a sa page de présentation complète :
- Média (vidéo TikTok ou galerie d'images avec thumbnails)
- Titre, description, prix
- Résumé long (configurable FR/EN)
- Points forts (liste dynamique FR/EN)
- Extraits (titre + contenu, liste dynamique FR/EN)
- Bouton acheter + liens sociaux

### Configuration no-code
L'admin configure toute la page produit via le formulaire :
- Zones de texte pour résumés
- Listes dynamiques "points forts" (bouton + Ajouter)
- Listes dynamiques "extraits" (titre + contenu par extrait)
- Upload d'images par drag & drop

---

## 11. Schéma D1 (V3)

### Table `offers` (champs clés)

| Champ | Type | Description |
|---|---|---|
| `id` | TEXT (UUID) | Clé primaire |
| `type` | TEXT | `digital_product` ou `service` |
| `title_fr` / `title_en` | TEXT | Titre |
| `description_fr` / `description_en` | TEXT | Description courte |
| `price` / `currency` | INTEGER / TEXT | Prix |
| `is_active` | INTEGER (0/1) | Visibilité |
| `service_mode` | TEXT | `instructions`/`rdv`/`private_link`/`private_group` |
| `service_private_link` | TEXT | Lien du tunnel de vente (site annexe) |
| `service_booking_link` | TEXT | Lien de réservation |
| `service_contact` | TEXT | Contact |
| `media_type` | TEXT | `demo` / `image` / NULL |
| `media_demo_url` | TEXT | URL TikTok |
| `media_images` | TEXT (JSON) | Array d'URLs GitHub |
| `presentation_summary_fr` / `_en` | TEXT | Résumé long |
| `presentation_highlights_fr` / `_en` | TEXT (JSON) | Array de strings |
| `presentation_excerpts_fr` / `_en` | TEXT (JSON) | Array de `{title, content}` |
| `social_links` | TEXT (JSON) | `{whatsapp, telegram, ...}` |

### Table `transactions` et `admin_users` : voir V2 (inchangées).

---

## 12. Bonnes pratiques de sécurité

- ✅ Aucune clé secrète côté frontend (JWT secret, FedaPay secret, GitHub token = Worker uniquement).
- ✅ Webhook FedaPay vérifié HMAC-SHA-256 + idempotent.
- ✅ Mots de passe admin hashés PBKDF2-SHA256 (600k itérations).
- ✅ JWT HS256 (24h) + lookup base pour révocation.
- ✅ `public_token` opaque dans l'URL de succès.
- ✅ Sécurité D1 dans le Worker : lecture publique offres actives uniquement, transactions jamais exposées.
- ✅ Upload GitHub via le Worker (le token GitHub n'est jamais côté frontend).
- ✅ Validation type MIME + taille max 5 Mo pour les images uploadées.

---

## 13. Commandes principales

```bash
# Setup
cd worker && npm install
npx wrangler d1 create beta-arsenal   # -> copier database_id dans wrangler.toml
npm run db:migrate:local

# Config
cp .dev.vars.example .dev.vars        # dev local
cp ../.env.example ../.env            # scripts Node

# Seed (admin + 3 offres)
cd .. && node scripts/seed.mjs

# Dev
cd worker && npm run dev

# Deploy
cd worker && npm run db:migrate:remote
npm run deploy
npx wrangler secret put JWT_SECRET
npx wrangler secret put FEDAPAY_SECRET_KEY
npx wrangler secret put FEDAPAY_WEBHOOK_SECRET
npx wrangler secret put GITHUB_TOKEN
cd .. && node scripts/seed.mjs --remote
```

---

## 14. Limites du plan gratuit

| Service | Limite approx. |
|---|---|
| Cloudflare Workers | 100 000 requêtes/jour |
| Cloudflare Pages | 500 builds/mois, bande passante illimitée |
| Cloudflare D1 | 5 bases, 5 M lignes lues/jour, 100 k écritures/jour, 5 Go |
| GitHub | 1 Go/dépôt (images), 100 Mo/fichier |
| FedaPay | Sandbox gratuit ; commissions en production |

---

© Bêta Arsenal — Vendeur : Florian. Projet MVP V3 (Cloudflare D1 + auth maison + médias GitHub).
