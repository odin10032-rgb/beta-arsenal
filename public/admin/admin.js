// =============================================================
// Bêta Arsenal - Logique administration
// -------------------------------------------------------------
// - Page login.html : connexion Firebase Auth + contrôle ADMIN_EMAIL.
// - Page dashboard.html : CRUD offres, liste transactions, stats,
//   régénération des liens de téléchargement expirés.
// - Toutes les opérations sensibles passent par le Worker avec le
//   token Firebase ID dans l'en-tête Authorization: Bearer <token>.
// =============================================================

import { getFirebaseAuth, ADMIN_EMAIL, WORKER_API_URL } from '../js/firebase-config.js';
import { UPLOADCARE_PUBLIC_KEY, loadUploadcareWidget } from '../js/uploadcare-config.js';

// Détection de la page courante
const path = window.location.pathname;

// =============================================================
// PAGE LOGIN
// =============================================================
if (path.endsWith('/admin/login.html') || path.endsWith('/admin/login')) {
  initLoginPage();
}

// =============================================================
// PAGE DASHBOARD
// =============================================================
if (path.endsWith('/admin/dashboard.html') || path.endsWith('/admin/dashboard')) {
  initDashboardPage();
}

// =============================================================
// LOGIN
// =============================================================
async function initLoginPage() {
  const auth = await getFirebaseAuth();
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  // Si déjà connecté ET autorisé -> redirige
  auth._onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (user.email === ADMIN_EMAIL) {
        window.location.href = 'dashboard.html';
      } else {
        errorEl.textContent = window.i18n.t('admin.notAuthorized');
        errorEl.classList.remove('hidden');
        await auth._signOut(auth);
      }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = window.i18n.t('admin.signingIn');

    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    try {
      const cred = await auth._signIn(auth, email, password);
      if (cred.user.email !== ADMIN_EMAIL) {
        await auth._signOut(auth);
        throw new Error('not_authorized');
      }
      window.location.href = 'dashboard.html';
    } catch (err) {
      console.error(err);
      const msg = err.message === 'not_authorized'
        ? window.i18n.t('admin.notAuthorized')
        : window.i18n.t('admin.loginError');
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = window.i18n.t('admin.signIn');
    }
  });
}

// =============================================================
// DASHBOARD
// =============================================================
let _auth = null;
let _currentUser = null;

async function initDashboardPage() {
  _auth = await getFirebaseAuth();

  // Garde d'authentification
  _auth._onAuthStateChanged(_auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    if (user.email !== ADMIN_EMAIL) {
      await _auth._signOut(_auth);
      window.location.href = 'login.html';
      return;
    }
    _currentUser = user;
    document.getElementById('admin-email-display').textContent = user.email;
    await loadDashboardData();
    bindDashboardEvents();
  });

  // Déconnexion
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await _auth._signOut(_auth);
    window.location.href = 'login.html';
  });

  // Année footer
  document.getElementById('year').textContent = new Date().getFullYear();
}

// Récupère un token Firebase ID frais pour les appels admin
async function getIdToken() {
  if (!_currentUser) throw new Error('Not authenticated');
  return await _currentUser.getIdToken();
}

// Appel admin vers le Worker
async function adminApi(path, options = {}) {
  const token = await getIdToken();
  const res = await fetch(`${WORKER_API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && data.error) || `HTTP ${res.status}`);
  }
  return data;
}

// Charge offres + transactions + stats
async function loadDashboardData() {
  await Promise.all([loadOffers(), loadTransactions(), loadStats()]);
}

// ---------- Statistiques ----------
async function loadStats() {
  try {
    const stats = await adminApi('/api/admin/stats');
    document.getElementById('stat-total').textContent = stats.total ?? '—';
    document.getElementById('stat-approved').textContent = stats.approved ?? '—';
    document.getElementById('stat-pending').textContent = stats.pending ?? '—';
    // CA par devise
    const revEl = document.getElementById('stat-revenue');
    if (stats.revenue && Object.keys(stats.revenue).length > 0) {
      revEl.innerHTML = Object.entries(stats.revenue)
        .map(([cur, amt]) => `<div>${formatAdminPrice(amt, cur)}</div>`)
        .join('');
      revEl.style.fontSize = '16px';
    } else {
      revEl.textContent = '—';
    }
  } catch (err) {
    console.error('stats error', err);
  }
}

function formatAdminPrice(amount, currency) {
  try {
    return new Intl.NumberFormat(window.i18n.lang === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'XOF' || currency === 'XAF' ? 0 : 2,
    }).format(Number(amount) || 0);
  } catch (_) {
    return `${amount} ${currency}`;
  }
}

// ---------- Offres ----------
async function loadOffers() {
  const listEl = document.getElementById('offers-list');
  try {
    const { offers } = await adminApi('/api/admin/offers');
    listEl.innerHTML = '';
    if (offers.length === 0) {
      listEl.innerHTML = `<p style="color:var(--text-muted)">${window.i18n.t('home.empty')}</p>`;
      return;
    }
    for (const o of offers) {
      listEl.appendChild(renderOfferRow(o));
    }
  } catch (err) {
    console.error('loadOffers error', err);
    listEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

function renderOfferRow(offer) {
  const row = document.createElement('div');
  row.className = 'admin-offer-row';
  const lang = window.i18n.lang;
  const title = lang === 'fr' ? offer.title_fr : offer.title_en;
  const typeLabel = window.i18n.t(
    offer.type === 'digital_product' ? 'admin.typeDigital' : 'admin.typeService'
  );
  row.innerHTML = `
    <div class="ar-main">
      <div class="ar-title">${escapeHtml(title)} <span class="badge ${offer.is_active ? 'badge-active' : 'badge-inactive'}">${offer.is_active ? '●' : '○'}</span></div>
      <div class="ar-meta">${escapeHtml(typeLabel)} · ${formatAdminPrice(offer.price, offer.currency)}</div>
    </div>
    <div class="ar-actions">
      <button class="btn btn-secondary btn-sm" data-edit="${offer.id}">${window.i18n.t('admin.edit')}</button>
      <button class="btn btn-danger btn-sm" data-delete="${offer.id}">${window.i18n.t('admin.delete')}</button>
    </div>
  `;
  row.querySelector('[data-edit]').addEventListener('click', () => openOfferModal(offer));
  row.querySelector('[data-delete]').addEventListener('click', async () => {
    if (!confirm(window.i18n.t('admin.deleteConfirm'))) return;
    try {
      await adminApi(`/api/admin/offers/${offer.id}`, { method: 'DELETE' });
      await loadOffers();
      await loadStats();
    } catch (err) {
      alert(err.message);
    }
  });
  return row;
}

// ---------- Modale offre (création / édition) ----------
function openOfferModal(offer = null) {
  const modal = document.getElementById('offer-modal');
  const form = document.getElementById('offer-form');
  form.reset();
  document.getElementById('offer-id').value = offer ? offer.id : '';

  // Pré-remplissage
  if (offer) {
    document.getElementById('offer-type').value = offer.type;
    document.getElementById('offer-title-fr').value = offer.title_fr || '';
    document.getElementById('offer-title-en').value = offer.title_en || '';
    document.getElementById('offer-desc-fr').value = offer.description_fr || '';
    document.getElementById('offer-desc-en').value = offer.description_en || '';
    document.getElementById('offer-price').value = offer.price || '';
    document.getElementById('offer-currency').value = offer.currency || 'XOF';
    document.getElementById('offer-sales-link').value = offer.sales_link || '';
    document.getElementById('offer-active').checked = !!offer.is_active;

    if (offer.type === 'digital_product') {
      document.getElementById('offer-uuid').value = offer.uploadcare_uuid || '';
      document.getElementById('offer-file-name').value = offer.file_name || '';
      document.getElementById('offer-file-size').value = offer.file_size_bytes || '';
      updateUploadcareInfo();
    } else {
      document.getElementById('offer-service-mode').value = offer.service_mode || 'instructions';
      document.getElementById('offer-instructions-fr').value = offer.service_instructions_fr || '';
      document.getElementById('offer-instructions-en').value = offer.service_instructions_en || '';
      document.getElementById('offer-private-link').value = offer.service_private_link || '';
      document.getElementById('offer-booking-link').value = offer.service_booking_link || '';
      document.getElementById('offer-contact').value = offer.service_contact || '';
    }
    const sl = offer.social_links || {};
    document.getElementById('offer-social-whatsapp').value = sl.whatsapp || '';
    document.getElementById('offer-social-telegram').value = sl.telegram || '';
    document.getElementById('offer-social-facebook').value = sl.facebook || '';
    document.getElementById('offer-social-instagram').value = sl.instagram || '';
  }

  toggleOfferFields();
  modal.classList.remove('hidden');
}

function closeOfferModal() {
  document.getElementById('offer-modal').classList.add('hidden');
}

// Affiche/masque les champs selon le type d'offre
function toggleOfferFields() {
  const type = document.getElementById('offer-type').value;
  document.getElementById('digital-fields').classList.toggle('hidden', type !== 'digital_product');
  document.getElementById('service-fields').classList.toggle('hidden', type !== 'service');
}

// Met à jour l'affichage du fichier sélectionné
function updateUploadcareInfo() {
  const name = document.getElementById('offer-file-name').value;
  const size = document.getElementById('offer-file-size').value;
  const info = document.getElementById('uploadcare-info');
  if (name) {
    info.classList.remove('hidden');
    info.innerHTML = `
      <div class="uc-name">${escapeHtml(name)}</div>
      <div class="uc-size">${window.i18n.t('admin.size')}: ${formatFileSize(size)}</div>
    `;
  } else {
    info.classList.add('hidden');
  }
}

function formatFileSize(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ---------- Soumission formulaire offre ----------
async function handleOfferSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById('offer-form-error');
  const saveBtn = e.target.querySelector('button[type="submit"]');
  errorEl.classList.add('hidden');
  saveBtn.disabled = true;
  saveBtn.textContent = window.i18n.t('admin.saving');

  const type = document.getElementById('offer-type').value;
  const payload = {
    seller_id: 'florian',
    type,
    title_fr: document.getElementById('offer-title-fr').value.trim(),
    title_en: document.getElementById('offer-title-en').value.trim(),
    description_fr: document.getElementById('offer-desc-fr').value.trim(),
    description_en: document.getElementById('offer-desc-en').value.trim(),
    price: Number(document.getElementById('offer-price').value),
    currency: document.getElementById('offer-currency').value,
    sales_link: document.getElementById('offer-sales-link').value.trim() || null,
    is_active: document.getElementById('offer-active').checked,
    social_links: {
      whatsapp: document.getElementById('offer-social-whatsapp').value.trim() || null,
      telegram: document.getElementById('offer-social-telegram').value.trim() || null,
      facebook: document.getElementById('offer-social-facebook').value.trim() || null,
      instagram: document.getElementById('offer-social-instagram').value.trim() || null,
    },
  };

  // Champs spécifiques au type
  if (type === 'digital_product') {
    payload.uploadcare_uuid = document.getElementById('offer-uuid').value.trim();
    payload.file_name = document.getElementById('offer-file-name').value.trim();
    payload.file_size_bytes = Number(document.getElementById('offer-file-size').value) || 0;
    if (!payload.uploadcare_uuid) {
      errorEl.textContent = window.i18n.t('admin.noFile');
      errorEl.classList.remove('hidden');
      saveBtn.disabled = false;
      saveBtn.textContent = window.i18n.t('admin.save');
      return;
    }
  } else {
    payload.service_mode = document.getElementById('offer-service-mode').value;
    payload.service_instructions_fr = document.getElementById('offer-instructions-fr').value.trim();
    payload.service_instructions_en = document.getElementById('offer-instructions-en').value.trim();
    payload.service_private_link = document.getElementById('offer-private-link').value.trim() || null;
    payload.service_booking_link = document.getElementById('offer-booking-link').value.trim() || null;
    payload.service_contact = document.getElementById('offer-contact').value.trim() || null;
  }

  try {
    const id = document.getElementById('offer-id').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/offers/${id}` : '/api/admin/offers';
    await adminApi(url, {
      method,
      body: JSON.stringify(payload),
    });
    closeOfferModal();
    await loadOffers();
    await loadStats();
  } catch (err) {
    console.error(err);
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
    saveBtn.disabled = false;
    saveBtn.textContent = window.i18n.t('admin.save');
  }
}

// ---------- Uploadcare widget ----------
async function setupUploadcare() {
  try {
    const uploadcare = await loadUploadcareWidget();
    // Configuration globale (clé publique uniquement)
    if (window.UPLOADCARE_CONFIG) {
      window.UPLOADCARE_CONFIG.publicKey = UPLOADCARE_PUBLIC_KEY;
    } else {
      window.UPLOADCARE_CONFIG = { publicKey: UPLOADCARE_PUBLIC_KEY, tabs: 'file url' };
    }
    const widget = uploadcare.Widget('[id=uploadcare-trigger]');
    widget.on('uploadcomplete', (info) => {
      // info est un objet fichier Uploadcare
      const uuid = info.uuid;
      const name = info.name;
      const size = info.size;
      document.getElementById('offer-uuid').value = uuid;
      document.getElementById('offer-file-name').value = name;
      document.getElementById('offer-file-size').value = size;
      updateUploadcareInfo();
    });
  } catch (err) {
    console.error('Uploadcare setup error', err);
  }
}

// ---------- Transactions ----------
async function loadTransactions() {
  const body = document.getElementById('transactions-body');
  try {
    const { transactions: txs } = await adminApi('/api/admin/transactions');
    body.innerHTML = '';
    if (txs.length === 0) {
      body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">${window.i18n.t('admin.noTransactions')}</td></tr>`;
      return;
    }
    for (const tx of txs) {
      body.appendChild(renderTransactionRow(tx));
    }
  } catch (err) {
    console.error('loadTransactions error', err);
    body.innerHTML = `<tr><td colspan="6" style="color:var(--danger)">${err.message}</td></tr>`;
  }
}

function renderTransactionRow(tx) {
  const row = document.createElement('tr');
  const lang = window.i18n.lang;
  const date = tx.created_at
    ? new Date(tx.created_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')
    : '—';
  const statusClass = `status-${tx.status}`;
  const offerTitle = tx.offer_title || tx.offer_id || '—';

  row.innerHTML = `
    <td>${escapeHtml(date)}</td>
    <td>${escapeHtml(offerTitle)}</td>
    <td>${escapeHtml(tx.buyer_email || '—')}</td>
    <td>${formatAdminPrice(tx.amount, tx.currency)}</td>
    <td><span class="status-pill ${statusClass}">${escapeHtml(tx.status)}</span></td>
    <td>
      ${tx.offer_type === 'digital_product' && tx.status === 'approved'
        ? `<button class="btn btn-secondary btn-sm" data-regen="${tx.id}">${window.i18n.t('admin.regenerate')}</button>`
        : ''}
    </td>
  `;

  const regenBtn = row.querySelector('[data-regen]');
  if (regenBtn) {
    regenBtn.addEventListener('click', async () => {
      try {
        regenBtn.disabled = true;
        await adminApi(`/api/admin/transactions/${tx.id}/regenerate-link`, { method: 'POST' });
        await loadTransactions();
        alert(window.i18n.t('admin.linkRegenerated'));
      } catch (err) {
        alert(err.message);
        regenBtn.disabled = false;
      }
    });
  }

  return row;
}

// =============================================================
// Événements du dashboard
// =============================================================
function bindDashboardEvents() {
  // Onglets
  document.querySelectorAll('[data-admin-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-admin-tab]').forEach((t) => t.classList.remove('tab-active'));
      document.querySelectorAll('.admin-section').forEach((s) => s.classList.add('hidden'));
      tab.classList.add('tab-active');
      const target = tab.dataset.adminTab;
      const section = document.getElementById(`admin-${target}`);
      if (section) section.classList.remove('hidden');
      // Force la visibilité de la première section via classe tab-content
      section.classList.add('tab-content-active');
    });
  });

  // Nouvelle offre
  document.getElementById('new-offer-btn').addEventListener('click', () => openOfferModal());

  // Fermeture modale offre
  document.querySelectorAll('[data-close-offer-modal]').forEach((el) =>
    el.addEventListener('click', closeOfferModal)
  );

  // Changement de type -> affichage champs
  document.getElementById('offer-type').addEventListener('change', toggleOfferFields);

  // Soumission formulaire
  document.getElementById('offer-form').addEventListener('submit', handleOfferSubmit);

  // Uploadcare
  setupUploadcare();

  // Rafraîchir transactions
  document.getElementById('refresh-tx-btn').addEventListener('click', () => {
    loadTransactions();
    loadStats();
  });
}

// ---------- Utilitaire ----------
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
