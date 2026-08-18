// =============================================================
// Bêta Arsenal - Logique administration (V3)
// -------------------------------------------------------------
// - Auth maison JWT (POST /api/admin/login)
// - Formulaire unifié produit + service
// - Section média : démo TikTok OU upload images GitHub
// - Section présentation : résumé + points forts + extraits
//   (listes dynamiques no-code)
// =============================================================

import {
  WORKER_API_URL,
  saveAdminSession,
  getAdminToken,
  getAdminEmail,
  clearAdminSession,
} from '../js/config.js';

const path = window.location.pathname;

if (path.endsWith('/admin/login.html')) {
  initLoginPage();
}
if (path.endsWith('/admin/dashboard.html')) {
  initDashboardPage();
}

// =============================================================
// LOGIN
// =============================================================
async function initLoginPage() {
  const existingToken = getAdminToken();
  if (existingToken) {
    window.location.href = 'dashboard.html';
    return;
  }

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = window.i18n.t('admin.signingIn');

    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    try {
      const res = await fetch(`${WORKER_API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      saveAdminSession(data.token, data.email, data.expires_at);
      window.location.href = 'dashboard.html';
    } catch (err) {
      console.error('Login error:', err);
      errorEl.textContent = err.message || window.i18n.t('admin.loginError');
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = window.i18n.t('admin.signIn');
    }
  });
}

// =============================================================
// DASHBOARD
// =============================================================
async function initDashboardPage() {
  const token = getAdminToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const email = getAdminEmail();
  document.getElementById('admin-email-display').textContent = email || 'admin';

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearAdminSession();
    window.location.href = 'login.html';
  });

  document.getElementById('year').textContent = new Date().getFullYear();

  await loadDashboardData();
  bindDashboardEvents();
}

async function adminApi(path, options = {}) {
  const token = getAdminToken();
  if (!token) {
    clearAdminSession();
    window.location.href = 'login.html';
    throw new Error('Session expirée');
  }
  const res = await fetch(`${WORKER_API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    ...options,
  });

  if (res.status === 401 || res.status === 403) {
    clearAdminSession();
    window.location.href = 'login.html';
    throw new Error('Session invalide');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && data.error) || `HTTP ${res.status}`);
  }
  return data;
}

// Upload d'image (multipart) — ne passe pas par adminApi car Content-Type différent
async function uploadImage(file) {
  const token = getAdminToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${WORKER_API_URL}/api/admin/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && data.error) || `HTTP ${res.status}`);
  }
  return data;
}

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
    const data = await adminApi('/api/admin/offers');
    const offers = data.offers || data;
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
  const cover = (offer.media_type === 'image' && Array.isArray(offer.media_images) && offer.media_images.length > 0)
    ? `<img src="${escapeHtml(offer.media_images[0])}" class="ar-thumb" alt="" />`
    : '';
  row.innerHTML = `
    ${cover ? `<div class="ar-cover">${cover}</div>` : ''}
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
// État temporaire pour les images uploadées (array d'URLs)
let _currentMediaImages = [];

function openOfferModal(offer = null) {
  const modal = document.getElementById('offer-modal');
  const form = document.getElementById('offer-form');
  form.reset();
  document.getElementById('offer-id').value = offer ? offer.id : '';
  _currentMediaImages = [];

  // Vide les listes dynamiques
  ['highlights-fr', 'highlights-en', 'excerpts-fr', 'excerpts-en'].forEach((key) => {
    const list = document.getElementById(`${key}-list`);
    if (list) list.innerHTML = '';
  });

  if (offer) {
    document.getElementById('offer-type').value = offer.type;
    document.getElementById('offer-title-fr').value = offer.title_fr || '';
    document.getElementById('offer-title-en').value = offer.title_en || '';
    document.getElementById('offer-desc-fr').value = offer.description_fr || '';
    document.getElementById('offer-desc-en').value = offer.description_en || '';
    document.getElementById('offer-price').value = offer.price || '';
    document.getElementById('offer-currency').value = offer.currency || 'XOF';
    document.getElementById('offer-active').checked = !!offer.is_active;

    document.getElementById('offer-service-mode').value = offer.service_mode || 'instructions';
    document.getElementById('offer-instructions-fr').value = offer.service_instructions_fr || '';
    document.getElementById('offer-instructions-en').value = offer.service_instructions_en || '';
    document.getElementById('offer-private-link').value = offer.service_private_link || '';
    document.getElementById('offer-booking-link').value = offer.service_booking_link || '';
    document.getElementById('offer-contact').value = offer.service_contact || '';

    // Média
    document.getElementById('offer-media-type').value = offer.media_type || '';
    document.getElementById('offer-media-demo-url').value = offer.media_demo_url || '';
    _currentMediaImages = Array.isArray(offer.media_images) ? [...offer.media_images] : [];
    renderImagePreviews();

    // Présentation
    document.getElementById('offer-summary-fr').value = offer.presentation_summary_fr || '';
    document.getElementById('offer-summary-en').value = offer.presentation_summary_en || '';

    // Listes dynamiques
    addDynamicRows('highlights-fr', offer.presentation_highlights_fr || [], 'text');
    addDynamicRows('highlights-en', offer.presentation_highlights_en || [], 'text');
    addDynamicRows('excerpts-fr', offer.presentation_excerpts_fr || [], 'excerpt');
    addDynamicRows('excerpts-en', offer.presentation_excerpts_en || [], 'excerpt');

    const sl = offer.social_links || {};
    document.getElementById('offer-social-whatsapp').value = sl.whatsapp || '';
    document.getElementById('offer-social-telegram').value = sl.telegram || '';
    document.getElementById('offer-social-facebook').value = sl.facebook || '';
    document.getElementById('offer-social-instagram').value = sl.instagram || '';
  }

  toggleMediaSections();
  modal.classList.remove('hidden');
}

function closeOfferModal() {
  document.getElementById('offer-modal').classList.add('hidden');
  _currentMediaImages = [];
}

// Affiche/masque les sous-sections média selon le type choisi
function toggleMediaSections() {
  const mediaType = document.getElementById('offer-media-type').value;
  document.getElementById('media-demo-section').classList.toggle('hidden', mediaType !== 'demo');
  document.getElementById('media-image-section').classList.toggle('hidden', mediaType !== 'image');
}

// =============================================================
// Listes dynamiques (points forts + extraits)
// =============================================================

// Ajoute des rows existantes (édition)
function addDynamicRows(listKey, items, type) {
  const listEl = document.getElementById(`${listKey}-list`);
  if (!listEl) return;
  listEl.innerHTML = '';
  for (const item of items) {
    if (type === 'text') {
      addDynamicTextRow(listKey, item);
    } else if (type === 'excerpt') {
      addDynamicExcerptRow(listKey, item);
    }
  }
}

// Ajoute une row "texte simple" (points forts)
function addDynamicTextRow(listKey, value = '') {
  const listEl = document.getElementById(`${listKey}-list`);
  const row = document.createElement('div');
  row.className = 'dyn-row';
  row.innerHTML = `
    <input type="text" class="form-input dyn-input" value="${escapeHtml(value)}" placeholder="..." />
    <button type="button" class="btn btn-danger btn-sm dyn-remove">×</button>
  `;
  row.querySelector('.dyn-remove').addEventListener('click', () => row.remove());
  listEl.appendChild(row);
}

// Ajoute une row "extrait" (titre + contenu)
function addDynamicExcerptRow(listKey, value = {}) {
  const listEl = document.getElementById(`${listKey}-list`);
  const row = document.createElement('div');
  row.className = 'dyn-row dyn-row-excerpt';
  row.innerHTML = `
    <div class="dyn-excerpt-fields">
      <input type="text" class="form-input dyn-excerpt-title" value="${escapeHtml(value.title || '')}" placeholder="Titre de l'extrait" />
      <textarea class="form-input dyn-excerpt-content" rows="2" placeholder="Contenu de l'extrait...">${escapeHtml(value.content || '')}</textarea>
    </div>
    <button type="button" class="btn btn-danger btn-sm dyn-remove">×</button>
  `;
  row.querySelector('.dyn-remove').addEventListener('click', () => row.remove());
  listEl.appendChild(row);
}

// Récupère les valeurs d'une liste dynamique
function getDynamicValues(listKey, type) {
  const listEl = document.getElementById(`${listKey}-list`);
  if (!listEl) return [];
  const rows = listEl.querySelectorAll('.dyn-row');
  if (type === 'text') {
    return Array.from(rows)
      .map((r) => r.querySelector('.dyn-input')?.value.trim())
      .filter((v) => v);
  } else if (type === 'excerpt') {
    return Array.from(rows)
      .map((r) => ({
        title: r.querySelector('.dyn-excerpt-title')?.value.trim() || '',
        content: r.querySelector('.dyn-excerpt-content')?.value.trim() || '',
      }))
      .filter((e) => e.title || e.content);
  }
  return [];
}

// =============================================================
// Upload d'images vers GitHub
// =============================================================

function setupImageUpload() {
  const uploadBtn = document.getElementById('image-upload-btn');
  const input = document.getElementById('image-input');
  if (!uploadBtn || !input) return;

  uploadBtn.addEventListener('click', () => input.click());
  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (const file of files) {
      await uploadOneImage(file);
    }
    input.value = ''; // reset pour permettre re-upload du même fichier
  });

  // Drag & drop
  const zone = document.getElementById('image-upload-zone');
  if (zone) {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'));
      for (const file of files) {
        await uploadOneImage(file);
      }
    });
  }
}

async function uploadOneImage(file) {
  // Ajoute une preview "uploading"
  const previewList = document.getElementById('image-preview-list');
  const previewItem = document.createElement('div');
  previewItem.className = 'image-preview-item uploading';
  previewItem.innerHTML = `
    <div class="preview-thumb"><div class="spinner"></div></div>
    <div class="preview-name">${escapeHtml(file.name)}</div>
  `;
  previewList.appendChild(previewItem);

  try {
    const result = await uploadImage(file);
    _currentMediaImages.push(result.url);
    previewItem.classList.remove('uploading');
    previewItem.innerHTML = `
      <img src="${escapeHtml(result.url)}" class="preview-thumb" alt="" />
      <div class="preview-name">${escapeHtml(file.name)}</div>
      <button type="button" class="btn btn-danger btn-sm preview-remove" data-url="${escapeHtml(result.url)}">×</button>
    `;
    previewItem.querySelector('.preview-remove').addEventListener('click', () => {
      _currentMediaImages = _currentMediaImages.filter((u) => u !== result.url);
      previewItem.remove();
    });
  } catch (err) {
    console.error('Upload error:', err);
    previewItem.classList.remove('uploading');
    previewItem.classList.add('error');
    previewItem.innerHTML = `
      <div class="preview-thumb">✕</div>
      <div class="preview-name">Échec: ${escapeHtml(err.message)}</div>
      <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">×</button>
    `;
  }
}

function renderImagePreviews() {
  const previewList = document.getElementById('image-preview-list');
  if (!previewList) return;
  previewList.innerHTML = '';
  for (const url of _currentMediaImages) {
    const item = document.createElement('div');
    item.className = 'image-preview-item';
    item.innerHTML = `
      <img src="${escapeHtml(url)}" class="preview-thumb" alt="" />
      <div class="preview-name">${escapeHtml(url.split('/').pop() || 'image')}</div>
      <button type="button" class="btn btn-danger btn-sm preview-remove">×</button>
    `;
    item.querySelector('.preview-remove').addEventListener('click', () => {
      _currentMediaImages = _currentMediaImages.filter((u) => u !== url);
      item.remove();
    });
    previewList.appendChild(item);
  }
}

// =============================================================
// Soumission formulaire offre
// =============================================================
async function handleOfferSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById('offer-form-error');
  const saveBtn = e.target.querySelector('button[type="submit"]');
  errorEl.classList.add('hidden');
  saveBtn.disabled = true;
  saveBtn.textContent = window.i18n.t('admin.saving');

  const payload = {
    seller_id: 'florian',
    type: document.getElementById('offer-type').value,
    title_fr: document.getElementById('offer-title-fr').value.trim(),
    title_en: document.getElementById('offer-title-en').value.trim(),
    description_fr: document.getElementById('offer-desc-fr').value.trim(),
    description_en: document.getElementById('offer-desc-en').value.trim(),
    price: Number(document.getElementById('offer-price').value),
    currency: document.getElementById('offer-currency').value,
    is_active: document.getElementById('offer-active').checked,

    // Détails de l'offre
    service_mode: document.getElementById('offer-service-mode').value,
    service_instructions_fr: document.getElementById('offer-instructions-fr').value.trim(),
    service_instructions_en: document.getElementById('offer-instructions-en').value.trim(),
    service_private_link: document.getElementById('offer-private-link').value.trim() || null,
    service_booking_link: document.getElementById('offer-booking-link').value.trim() || null,
    service_contact: document.getElementById('offer-contact').value.trim() || null,

    // Média
    media_type: document.getElementById('offer-media-type').value || null,
    media_demo_url: document.getElementById('offer-media-demo-url').value.trim() || null,
    media_images: _currentMediaImages,

    // Présentation
    presentation_summary_fr: document.getElementById('offer-summary-fr').value.trim() || null,
    presentation_summary_en: document.getElementById('offer-summary-en').value.trim() || null,
    presentation_highlights_fr: getDynamicValues('highlights-fr', 'text'),
    presentation_highlights_en: getDynamicValues('highlights-en', 'text'),
    presentation_excerpts_fr: getDynamicValues('excerpts-fr', 'excerpt'),
    presentation_excerpts_en: getDynamicValues('excerpts-en', 'excerpt'),

    // Social
    social_links: {
      whatsapp: document.getElementById('offer-social-whatsapp').value.trim() || null,
      telegram: document.getElementById('offer-social-telegram').value.trim() || null,
      facebook: document.getElementById('offer-social-facebook').value.trim() || null,
      instagram: document.getElementById('offer-social-instagram').value.trim() || null,
    },
  };

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

// =============================================================
// Transactions
// =============================================================
async function loadTransactions() {
  const body = document.getElementById('transactions-body');
  try {
    const data = await adminApi('/api/admin/transactions');
    const txs = data.transactions || data;
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
      section.classList.add('tab-content-active');
    });
  });

  // Nouvelle offre
  document.getElementById('new-offer-btn').addEventListener('click', () => openOfferModal());

  // Fermeture modale offre
  document.querySelectorAll('[data-close-offer-modal]').forEach((el) =>
    el.addEventListener('click', closeOfferModal)
  );

  // Changement type de média
  document.getElementById('offer-media-type').addEventListener('change', toggleMediaSections);

  // Boutons "+ ajouter" des listes dynamiques
  document.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.add;
      if (key.startsWith('excerpts')) {
        addDynamicExcerptRow(key, {});
      } else {
        addDynamicTextRow(key, '');
      }
    });
  });

  // Soumission formulaire
  document.getElementById('offer-form').addEventListener('submit', handleOfferSubmit);

  // Upload images
  setupImageUpload();

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
