// =============================================================
// Bêta Arsenal - Configuration Firebase (CÔTÉ FRONTEND)
// -------------------------------------------------------------
// ⚠️ IMPORTANT : seules les clés PUBLIQUES Firebase sont ici.
// Ces clés sont conçues pour être exposées côté client (Firebase Web Config).
// NE JAMAIS mettre ici : private key, client email du service account,
// clés secrètes FedaPay/Uploadcare. Ces secrets restent côté Worker.
// =============================================================

// --- Remplacez ces valeurs par celles de votre projet Firebase ---
export const firebaseConfig = {
  apiKey: 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-firebase-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abcdef123456',
};

// --- URL du backend (Cloudflare Worker) ---
// En production, remplacez par l'URL de votre Worker.
export const WORKER_API_URL =
  (typeof window !== 'undefined' && window.location.hostname === 'localhost')
    ? 'http://localhost:8787'
    : 'https://beta-arsenal-api.your-subdomain.workers.dev';

// --- Charge dynamiquement le SDK Firebase Auth (modular) ---
let _auth = null;
let _app = null;
let _db = null;

export async function getFirebaseApp() {
  if (_app) return _app;
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  _app = initializeApp(firebaseConfig);
  return _app;
}

export async function getFirebaseAuth() {
  if (_auth) return _auth;
  const app = await getFirebaseApp();
  const { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');

  _auth = getAuth(app);
  _auth._signIn = signInWithEmailAndPassword;
  _auth._signOut = signOut;
  _auth._onAuthStateChanged = onAuthStateChanged;
  return _auth;
}

export async function getFirestore() {
  if (_db) return _db;
  const app = await getFirebaseApp();
  const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  _db = getFirestore(app);
  return _db;
}

// Re-export specific firestore functions for convenience if needed later, 
// but we will import them directly in app.js and admin.js from the CDN.

// Email admin attendu (réservé à la connexion admin ; la vérification
// finale côté Worker vérifie aussi ADMIN_EMAIL).
export const ADMIN_EMAIL = 'admin@beta-arsenal.com';
