// =============================================================
// Bêta Arsenal - Configuration publique (CÔTÉ FRONTEND)
// -------------------------------------------------------------
// ⚠️ Ce fichier ne contient QUE des valeurs publiques.
// Aucune clé secrète (JWT secret, FedaPay secret, GitHub token,
// mots de passe) ne doit apparaître ici.
// =============================================================

// --- URL du backend (Cloudflare Worker) ---
export const WORKER_API_URL =
  (typeof window !== 'undefined' && window.location.hostname === 'localhost')
    ? 'http://localhost:8787'
    : 'https://beta-arsenal-api.aimane-project-api.workers.dev';

// --- Email admin (information uniquement) ---
export const ADMIN_EMAIL = 'admin@beta-arsenal.com';

// =============================================================
// Gestion du JWT admin côté frontend (localStorage)
// =============================================================
const TOKEN_KEY = 'ba_admin_token';
const EMAIL_KEY = 'ba_admin_email';
const EXP_KEY = 'ba_admin_exp';

export function saveAdminSession(token, email, expiresAtIso) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EMAIL_KEY, email);
    localStorage.setItem(EXP_KEY, expiresAtIso || '');
  } catch (_) { /* localStorage indisponible */ }
}

export function getAdminToken() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const exp = localStorage.getItem(EXP_KEY);
    if (!token) return null;
    if (exp) {
      const expMs = new Date(exp).getTime();
      if (Date.now() > expMs) {
        clearAdminSession();
        return null;
      }
    }
    return token;
  } catch (_) {
    return null;
  }
}

export function getAdminEmail() {
  try {
    return localStorage.getItem(EMAIL_KEY) || '';
  } catch (_) {
    return '';
  }
}

export function clearAdminSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(EXP_KEY);
  } catch (_) { /* noop */ }
}
