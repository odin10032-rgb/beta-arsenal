// =============================================================
// Bêta Arsenal - Logique principale (catalogue + tunnel d'achat + succès)
// -------------------------------------------------------------
// - Charge les offres actives via le Worker.
// - Affiche le catalogue avec filtres FR/EN.
// - Gère la modale d'achat (email) et la création de transaction.
// - Gère la page success.html : vérification du statut + polling.
// =============================================================

import { getFirestore, WORKER_API_URL } from './firebase-config.js';

// ---- Vendeur fixe ----
const SELLER_ID = 'florian';

// ---- Devises supportées par FedaPay (V1) ----
// Si une offre utilise une devise non supportée, le paiement est désactivé.
const FEDAPAY_SUPPORTED_CURRENCIES = ['XOF', 'XAF', 'GHS', 'EUR', 'USD'];

// =============================================================
// Utilitaires
// =============================================================

// Formate un prix selon la langue et la devise
function formatPrice(amount, currency, lang) {
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'XOF' || currency === 'XAF' ? 0 : 2,
    }).format(value);
  } catch (_) {
    return `${value} ${currency}`;
  }
}

// Échappe le HTML pour éviter les injections XSS dans le rendu catalogue
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Appel JSON vers le Worker
async function api(path, options = {}) {
  const url = `${WORKER_API_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.error) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// =============================================================
// PAGE CATALOGUE (index.html)
// =============================================================

async function initCatalog() {
  const catalogEl = document.getElementById('catalog');
  const emptyEl = document.getElementById('catalog-empty');
  if (!catalogEl) return;

  let offers = [];
  let activeFilter = 'all';

  try {
    const db = await getFirestore();
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const q = query(collection(db, 'offers'), where('is_active', '==', true));
    const snapshot = await getDocs(q);
    offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Erreur chargement offres:', err);
    catalogEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    emptyEl.querySelector('p').textContent = window.i18n.t('home.empty');
    return;
  }

  // Filtres
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach((c) => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      activeFilter = chip.dataset.filter;
      render();
    });
  });

  function render() {
    const lang = window.i18n.lang;
    const filtered = offers.filter((o) => activeFilter === 'all' || o.type === activeFilter);
    catalogEl.innerHTML = '';

    if (filtered.length === 0) {
      emptyEl.classList.remove('hidden');
      catalogEl.classList.add('hidden');
      return;
    }
    emptyEl.classList.add('hidden');
    catalogEl.classList.remove('hidden');

    for (const offer of filtered) {
      catalogEl.appendChild(renderOfferCard(offer, lang));
    }
  }

  render();
  // Re-render quand la langue change
  window.addEventListener('langchange', render);
}

// Construit la carte d'une offre
function renderOfferCard(offer, lang) {
  const isDigital = offer.type === 'digital_product';
  const title = lang === 'fr' ? offer.title_fr : offer.title_en;
  const description = lang === 'fr' ? offer.description_fr : offer.description_en;
  const typeLabel = window.i18n.t(isDigital ? 'home.typeDigital' : 'home.typeService');
  const supported = FEDAPAY_SUPPORTED_CURRENCIES.includes(offer.currency);

  const card = document.createElement('article');
  card.className = 'offer-card';

  // Liens sociaux (optionnels)
  const socials = offer.social_links || {};
  const socialsHtml = Object.entries(socials)
    .filter(([, v]) => v)
    .map(([k, v]) => `<a href="${escapeHtml(v)}" target="_blank" rel="noopener noreferrer">${escapeHtml(k)}</a>`)
    .join('');

    card.innerHTML = `
    <span class="offer-type ${isDigital ? '' : 'service'}">${escapeHtml(typeLabel)}</span>
    <h3 class="offer-title">${escapeHtml(title)}</h3>
    <p class="offer-desc">${escapeHtml(description)}</p>
    <div class="offer-price">${formatPrice(offer.price, offer.currency, lang)}</div>
    ${socialsHtml ? `<div class="offer-socials">${socialsHtml}</div>` : ''}
    <div class="offer-foot">
      <a href="${escapeHtml(offer.sales_link || '#')}" ${offer.sales_link ? 'target="_blank" rel="noopener noreferrer"' : ''} class="btn btn-primary btn-block">
        ${window.i18n.t('home.buy')}
      </a>
    </div>
  `;
  return card;
}

const POLL_INTERVAL = 10000; // 10 secondes
const POLL_DURATION = 5 * 60 * 1000; // 5 minutes
let _pollTimer = null;
let _pollStart = 0;

async function initSuccessPage() {
  const card = document.getElementById('status-card');
  if (!card) return;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    renderStatus('not_found');
    return;
  }

  _pollStart = Date.now();
  await checkStatus(token);

  // Bouton "Vérifier maintenant"
  document.addEventListener('click', (e) => {
    if (e.target && e.target.dataset && e.target.dataset.action === 'check-now') {
      checkStatus(token);
    }
    if (e.target && e.target.dataset && e.target.dataset.action === 'retry') {
      // Retente un achat : retour accueil
      window.location.href = '/';
    }
    if (e.target && e.target.dataset && e.target.dataset.action === 'back-home') {
      window.location.href = '/';
    }
  });
}

async function checkStatus(token) {
  const card = document.getElementById('status-card');
  try {
    const data = await api(`/api/transaction-status?token=${encodeURIComponent(token)}`);
    renderStatus(data.status, data);
    if (data.status === 'pending') {
      scheduleNextPoll(token);
    }
  } catch (err) {
    console.error('checkStatus error:', err);
    renderStatus('error');
  }
}

function scheduleNextPoll(token) {
  if (_pollTimer) clearTimeout(_pollTimer);
  // Arrête après POLL_DURATION
  if (Date.now() - _pollStart > POLL_DURATION) {
    return;
  }
  // Compte à rebours affiché
  updateRetryCountdown(POLL_INTERVAL / 1000);
  _pollTimer = setTimeout(() => checkStatus(token), POLL_INTERVAL);
}

let _countdownTimer = null;
function updateRetryCountdown(sec) {
  if (_countdownTimer) clearInterval(_countdownTimer);
  let remaining = sec;
  const update = () => {
    const el = document.getElementById('retry-timer');
    if (el && remaining > 0) {
      el.textContent = window.i18n.t('success.retryIn', { sec: remaining });
    }
    remaining--;
    if (remaining < 0) clearInterval(_countdownTimer);
  };
  update();
  _countdownTimer = setInterval(update, 1000);
}

// Rendu des états : pending / approved / declined / not_found / error
function renderStatus(state, data) {
  const card = document.getElementById('status-card');
  if (!card) return;
  const lang = window.i18n.lang;

  if (state === 'pending') {
    card.innerHTML = `
      <div class="status-icon pending">⏳</div>
      <h1>${window.i18n.t('success.pendingTitle')}</h1>
      <p>${window.i18n.t('success.pendingText')}</p>
      <div class="spinner"></div>
      <button class="btn btn-secondary" data-action="check-now">${window.i18n.t('success.checkNow')}</button>
      <p class="retry-timer" id="retry-timer"></p>
    `;
    return;
  }

  if (state === 'approved') {
    const isDigital = data && data.offer_type === 'digital_product';
    const icon = '✓';
    let body = '';

    if (isDigital) {
      const expiry = data.download_link_expires_at
        ? new Date(data.download_link_expires_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')
        : '';
      body = `
        <p>${window.i18n.t('success.approvedTextDigital')}</p>
        ${data.download_link
          ? `<a class="download-btn" href="${escapeHtml(data.download_link)}" target="_blank" rel="noopener noreferrer">⬇ ${window.i18n.t('success.download')}</a>`
          : ''}
        ${expiry ? `<p class="expiry-note">${window.i18n.t('success.linkExpires', { time: escapeHtml(expiry) })}</p>` : ''}
      `;
    } else {
      // Service : instructions + liens
      const instructions = lang === 'fr' ? (data.service_instructions_fr || '') : (data.service_instructions_en || '');
      const links = [];
      if (data.service_private_link) {
        links.push(`<a class="service-link" href="${escapeHtml(data.service_private_link)}" target="_blank" rel="noopener">${window.i18n.t('success.privateLink')}</a>`);
      }
      if (data.service_booking_link) {
        links.push(`<a class="service-link" href="${escapeHtml(data.service_booking_link)}" target="_blank" rel="noopener">${window.i18n.t('success.bookingLink')}</a>`);
      }
      if (data.service_contact) {
        links.push(`<a class="service-link" href="${escapeHtml(data.service_contact)}" target="_blank" rel="noopener">${window.i18n.t('success.contact')}</a>`);
      }
      body = `
        <p>${window.i18n.t('success.approvedTextService')}</p>
        ${instructions ? `<div class="service-instructions"><h3>${window.i18n.t('success.serviceInstructions')}</h3><p>${escapeHtml(instructions).replace(/\n/g, '<br>')}</p></div>` : ''}
        ${links.length ? `<div>${links.join('')}</div>` : ''}
      `;
    }

    card.innerHTML = `
      <div class="status-icon approved">${icon}</div>
      <h1>${window.i18n.t('success.approvedTitle')}</h1>
      ${body}
      <p><a href="/" class="back-link">← ${window.i18n.t('success.backHome')}</a></p>
    `;
    return;
  }

  if (state === 'declined') {
    card.innerHTML = `
      <div class="status-icon declined">✕</div>
      <h1>${window.i18n.t('success.declinedTitle')}</h1>
      <p>${window.i18n.t('success.declinedText')}</p>
      <button class="btn btn-primary" data-action="retry">${window.i18n.t('success.retry')}</button>
      <p><a href="/" class="back-link">← ${window.i18n.t('success.backHome')}</a></p>
    `;
    return;
  }

  if (state === 'not_found') {
    card.innerHTML = `
      <div class="status-icon declined">?</div>
      <h1>${window.i18n.t('success.notFoundTitle')}</h1>
      <p>${window.i18n.t('success.notFoundText')}</p>
      <button class="btn btn-secondary" data-action="back-home">${window.i18n.t('success.backHome')}</button>
    `;
    return;
  }

  // error
  card.innerHTML = `
    <div class="status-icon declined">!</div>
    <h1>${window.i18n.t('success.unknowError')}</h1>
    <button class="btn btn-secondary" data-action="back-home">${window.i18n.t('success.backHome')}</button>
  `;
}

// =============================================================
// INITIALISATION GLOBALE
// =============================================================

function initApp() {
  // Année footer
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Page catalogue ?
  initCatalog();

  // Page succès ?
  initSuccessPage();

  // =============================================================
  // MODALE D'ACHAT (supprimée)
  // =============================================================
}

// Surcharge i18n.toggle pour émettre un événement "langchange"
const _origToggle = window.i18n.toggle;
window.i18n.toggle = function () {
  _origToggle.call(this);
  window.dispatchEvent(new Event('langchange'));
};
const _origSetLang = window.i18n.setLang;
window.i18n.setLang = function (l) {
  _origSetLang.call(this, l);
  window.dispatchEvent(new Event('langchange'));
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
