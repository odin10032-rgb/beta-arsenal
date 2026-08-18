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




 Mentions légales

Les textes fournis dans `public/legal.html` sont des **modèles**. Ils doivent être vérifiés et adaptés par le vendeur avant lancement (statut juridique, SIRET, hébergeur, email de contact, etc.).

---

© Bêta Arsenal — Vendeur : Florian. Projet MVP V1.
