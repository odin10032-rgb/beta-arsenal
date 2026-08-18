# Bêta Arsenal - Schéma de Fonctionnement

## 🏗️ Architecture Globale

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UTILISATEUR FINAL                                │
│                    (Navigateur web - Desktop / Mobile)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CÔTÉ FRONTEND (Pages + Worker)                      │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  index.html  │  │product.html  │  │success.html  │  │ admin/       │    │
│  │  (catalogue) │  │  (détail)    │  │  (statut)    │  │ login.html   │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                │                │                │            │
│         └────────────────┴────────────────┴────────────────┘            │
│                              │                                            │
│                              ▼                                            │
│         ┌─────────────────────────────────────────────────────┐          │
│         │          public/js/                                 │          │
│         │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │          │
│         │  │ app.js   │  │product.js│  │i18n.js   │          │          │
│         │  └────┬─────┘  └────┬─────┘  └────┬─────┘          │          │
│         │       │             │             │                 │          │
│         │       └─────────────┴─────────────┘                 │          │
│         │                       │                              │          │
│         │                       ▼                              │          │
│         │         ┌─────────────────────────┐                 │          │
│         │         │     config.js           │                 │          │
│         │         │  - WORKER_API_URL       │                 │          │
│         │         │  - ADMIN_EMAIL          │                 │          │
│         │         └───────────┬─────────────┘                 │          │
│         └─────────────────────┼───────────────────────────────┘          │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              CÔTÉ BACKEND (Cloudflare Worker)                               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        worker/src/index.js                           │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │  Middleware & Routing                                        │    │    │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │    │    │
│  │  │  │ auth.js      │  │ db.js        │  │ fedapay.js   │      │    │    │
│  │  │  │ (JWT)        │  │ (D1)         │  │ (Paiement)   │      │    │    │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘      │    │    │
│  │  │  ┌─────────────────────────────────────────────────────┐    │    │    │
│  │  │  │ Routes API                                            │    │    │    │
│  │  │  │  GET  /api/offers          → catalogue public        │    │    │    │
│  │  │  │  GET  /api/offers/:id      → détails produit         │    │    │    │
│  │  │  │  POST /api/create-transaction  → créer paiement FedaPay│   │    │    │
│  │  │  │  GET  /api/transaction-status?token=... → statut      │    │    │    │
│  │  │  │  POST /api/admin/login         → auth admin (JWT)    │    │    │    │
│  │  │  │  GET  /api/admin/offers         → liste offres admin  │    │    │    │
│  │  │  │  POST /api/admin/offers         → créer offre         │    │    │    │
│  │  │  │  PUT  /api/admin/offers/:id     → modifier offre      │    │    │    │
│  │  │  │  DELETE /api/admin/offers/:id   → supprimer offre     │    │    │    │
│  │  │  │  GET  /api/admin/transactions  → liste transactions  │    │    │    │
│  │  │  │  GET  /api/admin/stats         → stats simples       │    │    │    │
│  │  │  │  POST /api/admin/upload-image  → upload GitHub       │    │    │    │
│  │  │  └─────────────────────────────────────────────────────┘    │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│  D1 Database      │  │ FedaPay           │  │ GitHub            │
│  (SQLite)         │  │ (Sandbox)         │  │ (Images produits) │
│  - admin_users    │  │ - Payment API     │  │ - Contents API     │
│  - offers         │  │ - Webhooks        │  │ - Upload          │
│  - transactions   │  │ - Sandbox Mode    │  │ - Private repo    │
│  - settings       │  │                   │  │                   │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

---

## 🛒 FLOW D'ACHAT (CLIENT)

```
1. UTILISATEUR VISITE LA PAGE PRODUIT
   ↓
2. browser → GET /product.html?id=123
   ↓
3. product.js → api('/api/offers/123')
   ↓
4. Worker → GET /api/offers/123
   ↓
5. Worker → SELECT * FROM offers WHERE id = '123'
   ↓
6. Worker → JSON: { offer: { id, title_fr, title_en, price, ... } }
   ↓
7. browser → product.js → renderProduct(offer)
   ↓
8. user clique sur "Acheter"
   ↓
9. browser → openBuyModal(offer)
   ↓
10. user remplit email → handleBuySubmit()
   ↓
11. browser → POST /api/create-transaction
   ↓
12. Worker → INSERT INTO transactions (offer_id, buyer_email, status='pending')
   ↓
13. Worker → FedaPay API → créer un paiement (sandbox)
   ↓
14. Worker → FedaPay → renvoie payment_url
   ↓
15. Worker → JSON: { payment_url: 'https://sandbox.fedapay.com/...' }
   ↓
16. browser → window.location.href = payment_url
   ↓
17. user → sur page FedaPay → complète paiement
   ↓
18. user → FedaPay → webhook vers Worker
   ↓
19. Worker → POST /api/webhook/fedapay
   ↓
20. Worker → UPDATE transactions SET status='approved'
   ↓
21. Worker → FedaPay → renvoie redirect_url avec token
   ↓
22. browser → redirect vers /success.html?token=ABC123
   ↓
23. browser → success.html → api('/api/transaction-status?token=ABC123')
   ↓
24. Worker → SELECT * FROM transactions WHERE token = 'ABC123'
   ↓
25. Worker → JSON: { status: 'approved', download_link, ... }
   ↓
26. browser → renderStatus('approved')
```

---

## 🔐 FLOW AUTH ADMIN

```
1. UTILISATEUR VA SUR /admin/login.html
   ↓
2. user remplit email + password → POST /api/admin/login
   ↓
3. browser → POST /api/admin/login
   ↓
4. Worker → SELECT * FROM admin_users WHERE email = 'admin@beta-arsenal.com'
   ↓
5. Worker → compare hash avec PBKDF2-SHA256 (600k itérations)
   ↓
6. Si OK → Worker → JWT (payload: { email, exp: timestamp })
   ↓
7. Worker → HTTP 200 + JWT
   ↓
8. browser → localStorage.setItem('ba_admin_token', jwt)
   ↓
9. browser → localStorage.setItem('ba_admin_email', email)
   ↓
10. browser → window.location.href = '/admin/dashboard.html'
   ↓
11. browser → dashboard.html → checkAdminSession()
   ↓
12. browser → localStorage.getItem('ba_admin_token')
   ↓
13. browser → api('/api/admin/stats') avec JWT dans headers
   ↓
14. Worker → vérifie JWT (signature + expiration)
   ↓
15. Worker → SELECT * FROM offers + transactions
   ↓
16. Worker → JSON: { stats: { totalOffers, totalSales, revenue } }
   ↓
17. browser → renderDashboard(stats)
```

---

## 📊 BASE DE DONNÉES (D1)

```sql
-- Table admin_users
CREATE TABLE admin_users (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,  -- pbkdf2$600000$<salt>$<hash>
  created_at TEXT NOT NULL
);

-- Table offers
CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- 'digital_product' | 'service'
  title_fr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_fr TEXT,
  description_en TEXT,
  presentation_summary_fr TEXT,
  presentation_summary_en TEXT,
  presentation_highlights_fr TEXT,  -- JSON array
  presentation_highlights_en TEXT,  -- JSON array
  presentation_excerpts_fr TEXT,    -- JSON array
  presentation_excerpts_en TEXT,    -- JSON array
  price REAL NOT NULL,
  currency TEXT NOT NULL,  -- 'XOF', 'XAF', 'GHS', 'EUR', 'USD'
  media_type TEXT,         -- 'demo' | 'image'
  media_demo_url TEXT,     -- TikTok URL
  media_images TEXT,       -- JSON array d'URLs
  cover_image TEXT,
  has_demo BOOLEAN DEFAULT 0,
  social_links TEXT,       -- JSON { tiktok, instagram, youtube, ... }
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Table transactions
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,      -- token pour vérification
  offer_id TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  status TEXT NOT NULL,            -- 'pending' | 'approved' | 'declined'
  payment_url TEXT,                -- URL FedaPay (sandbox)
  redirect_url TEXT,               -- URL de retour après paiement
  fedapay_reference TEXT,          -- ID FedaPay
  fedapay_payment_status TEXT,     -- 'paid', 'failed', 'cancelled'
  download_link TEXT,              -- URL téléchargement produit
  download_link_expires_at TEXT,   -- date expiration
  service_instructions_fr TEXT,
  service_instructions_en TEXT,
  service_private_link TEXT,
  service_booking_link TEXT,
  service_contact TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 🔑 CLES ET VARIABLES

### Frontend (config.js)
```javascript
WORKER_API_URL = 'https://beta-arsenal-api.aimane-project-api.workers.dev'
ADMIN_EMAIL = 'admin@beta-arsenal.com'
```

### Backend (wrangler.toml)
```toml
[vars]
ADMIN_EMAIL = "admin@beta-arsenal.com"
PUBLIC_SITE_URL = "https://beta-arsenal.pages.dev"
FEDAPAY_PUBLIC_KEY = "pk_sandbox_xxxxx"
FEDAPAY_MODE = "sandbox"

[env.production]
ADMIN_EMAIL = "admin@beta-arsenal.com"
PUBLIC_SITE_URL = "https://beta-arsenal.pages.dev"
FEDAPAY_PUBLIC_KEY = "pk_prod_xxxxx"
FEDAPAY_MODE = "production"
```

### Secrets (npx wrangler secret put)
```
JWT_SECRET              → mot de passe pour signer les JWT admin
FEDAPAY_SECRET_KEY      → clé secrète FedaPay (sandbox)
FEDAPAY_WEBHOOK_SECRET  → secret pour vérifier les webhooks
GITHUB_TOKEN            → token GitHub (repo privé) pour upload images
```

---

## 🌐 URLs DE DÉPLOIEMENT

| Composant | URL |
|-----------|-----|
| Site Frontend (Pages) | https://beta-arsenal.pages.dev |
| API Backend (Worker) | https://beta-arsenal-api.aimane-project-api.workers.dev |
| Admin Login | https://beta-arsenal.pages.dev/admin/login.html |
| Admin Dashboard | https://beta-arsenal.pages.dev/admin/dashboard.html |
| Catalogue | https://beta-arsenal.pages.dev/ |
| Page Produit | https://beta-arsenal.pages.dev/product.html?id=123 |
| Page Succès | https://beta-arsenal.pages.dev/success.html?token=ABC123 |

---

## 🛠️ COMMANDES UTILES

### Développement
```bash
# Démarrer le Worker en local
cd worker && npm run dev

# Démarrer le site en local (serveur HTTP)
npx serve public

# Lister les migrations D1
npx wrangler d1 migrations list beta-arsenal

# Appliquer migrations localement
cd worker && npm run db:migrate:local

# Appliquer migrations en production
cd worker && npm run db:migrate:remote
```

### Déploiement
```bash
# Déployer le Worker
cd worker && npx wrangler deploy --env=""

# Déployer le site (GitHub + Cloudflare Pages)
git add .
git commit -m "..."
git push origin main
# Cloudflare Pages se déclenche automatiquement
```

### Base de données
```bash
# Créer un compte admin
node scripts/create-admin.mjs <email> <password>

# Exemple : créer admin@beta-arsenal.com / monpassword123
node scripts/create-admin.mjs admin@beta-arsenal.com monpassword123

# Interrogation locale
npx wrangler d1 execute beta-arsenal --local --command "SELECT * FROM offers"

# Interrogation distante
npx wrangler d1 execute beta-arsenal --remote --command "SELECT * FROM offers"
```

---

## 🎯 COORDONNÉES ADMIN

**Email admin par défaut :** `admin@beta-arsenal.com`

**Mot de passe :** ❌ À créer avec le script :

```bash
cd C:\Users\HomePC\TOUTMESPROJETS\BETAarsenal-GLM\beta-arsenal
node scripts/create-admin.mjs admin@beta-arsenal.com <TON_MOT_DE_PASSE>
```

**Lien d'accès :** https://beta-arsenal.pages.dev/admin/login.html

**Pour tester en local :**
- Worker : `http://localhost:8787`
- Site : `http://localhost:3000` (avec `npx serve public`)

---

## 📦 MODULES FRONTEND

| Fichier | Fonction |
|---------|----------|
| `app.js` | Logique catalogue (index.html) + tunnel d'achat + page succès |
| `product.js` | Logique page produit (product.html?id=...) |
| `i18n.js` | Internationalisation FR/EN |
| `config.js` | Configuration publique (URL Worker, ADMIN_EMAIL) |
| `admin.js` | Authentification admin + gestion dashboard |
| `auth.js` (Worker) | Middleware JWT pour protéger les routes admin |

---

## 📦 MODULES BACKEND

| Fichier | Fonction |
|---------|----------|
| `index.js` | Point d'entrée, routing, middleware |
| `auth.js` | Authentification JWT admin |
| `db.js` | Abstraction D1 (queries CRUD) |
| `fedapay.js` | Intégration FedaPay (sandbox/production) |
| `github.js` | Upload d'images sur GitHub Contents API |
| `migrations/0001_init.sql` | Schema base de données |

---

## 🔄 WEBHOOK FEDAPAY

```
FedaPay → POST /api/webhook/fedapay
        → Headers: x-fedapay-signature, x-fedapay-event
        → Body: { reference, amount, currency, status, ... }

Worker → Vérifier signature avec FEDAPAY_WEBHOOK_SECRET
Worker → UPDATE transactions SET
          status = 'approved',
          fedapay_reference = reference,
          fedapay_payment_status = status
        WHERE token = extracted_from_payload

Worker → Si status = 'approved':
          - Générer download_link (lien temporaire)
          - Définir download_link_expires_at
```

---

## 📝 FLOWS DE CRÉATION D'OFFRE

### Via Admin Dashboard
```
1. Admin → GET /api/admin/offers
2. Admin → POST /api/admin/offers
   Body: {
     type: 'digital_product' | 'service',
     title_fr, title_en,
     description_fr, description_en,
     price, currency,
     media_type, media_demo_url, media_images,
     social_links: { tiktok, instagram, ... },
     ...
   }
3. Worker → INSERT INTO offers
4. Worker → Si media_type = 'image' → upload GitHub
5. Worker → JSON: { offer: { id, ... } }
6. Admin → Rendu de l'offre dans dashboard
```

### Via API directe (optionnel)
```
curl -X POST https://beta-arsenal-api.aimane-project-api.workers.dev/api/admin/offers \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "digital_product",
    "title_fr": "Produit Test",
    "title_en": "Test Product",
    "description_fr": "Description FR",
    "description_en": "Description EN",
    "price": 1000,
    "currency": "XOF",
    "media_type": "image",
    "media_images": ["https://..."]
  }'
```

---

## 🎨 THEMES & LANGUES

- **Langues :** Français (FR), Anglais (EN)
- **Thèmes :** Dark (par défaut)
- **i18n :** Chargé depuis `i18n.js`, balises `data-i18n="key"` dans le HTML

---

## 🔒 SÉCURITÉ

### Frontend
- Aucune clé secrète exposée
- JWT stocké dans localStorage (accessible côté admin)
- CORS activé pour le Worker

### Backend
- JWT signé avec `JWT_SECRET` (PBKDF2-SHA256)
- Routes admin protégées par middleware JWT
- Fédapay : signature webhook vérifiée
- GitHub : token en secret (wrangler secret)
- Input sanitization (escapeHtml) pour éviter XSS

---

## 🚀 DÉPLOIEMENT PRODUCTION

1. ✅ Base de données D1 créée (`85276859-8854-4fd7-aeef-44ac800184ea`)
2. ✅ Worker déployé → `https://beta-arsenal-api.aimane-project-api.workers.dev`
3. ⏳ Site Pages en cours de déploiement (GitHub → Cloudflare)
4. ⏳ Secrets à définir :
   ```bash
   npx wrangler secret put JWT_SECRET
   npx wrangler secret put FEDAPAY_SECRET_KEY
   npx wrangler secret put FEDAPAY_WEBHOOK_SECRET
   npx wrangler secret put GITHUB_TOKEN
   ```

---

## 📞 SUPPORT

- **Email admin :** `admin@beta-arsenal.com`
- **Worker logs :** `npx wrangler tail`
- **Dashboard Cloudflare :** https://dash.cloudflare.com/
- **GitHub repo :** https://github.com/odin10032-rgb/beta-arsenal
