// =============================================================
// Bêta Arsenal - Logique principale (catalogue + tunnel d'achat + succès)
// -------------------------------------------------------------
// - Charge les offres actives via le Worker.
// - Affiche le catalogue avec filtres FR/EN.
// - Gère la modale d'achat (email) et la création de transaction.
// - Gère la page success.html : vérification du statut + polling.
// =============================================================

import { WORKER_API_URL } from './config.js';

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
    const data = await api('/api/offers');
    offers = Array.isArray(data) ? data : (data.offers || []);
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
  const productUrl = `product.html?id=${encodeURIComponent(offer.id)}`;

  const card = document.createElement('article');
  card.className = 'offer-card';

  // Image de couverture (1ère image si media_type=image)
  const coverImage = offer.cover_image
    ? `<a href="${productUrl}" class="offer-cover"><img src="${escapeHtml(offer.cover_image)}" alt="${escapeHtml(title)}" loading="lazy" /></a>`
    : '';
  const demoBadge = offer.has_demo
    ? `<span class="demo-badge">▶ TikTok</span>`
    : '';

  // Liens sociaux (optionnels)
  const socials = offer.social_links || {};
  const socialsHtml = Object.entries(socials)
    .filter(([, v]) => v)
    .map(([k, v]) => `<a href="${escapeHtml(v)}" target="_blank" rel="noopener noreferrer">${escapeHtml(k)}</a>`)
    .join('');

  card.innerHTML = `
    ${coverImage}
    <div class="offer-card-body">
      <span class="offer-type ${isDigital ? '' : 'service'}">${escapeHtml(typeLabel)} ${demoBadge}</span>
      <h3 class="offer-title"><a href="${productUrl}">${escapeHtml(title)}</a></h3>
      <p class="offer-desc">${escapeHtml(description)}</p>
      <div class="offer-price">${formatPrice(offer.price, offer.currency, lang)}</div>
      ${socialsHtml ? `<div class="offer-socials">${socialsHtml}</div>` : ''}
      <div class="offer-foot">
        <a href="${productUrl}" class="btn btn-secondary btn-block" data-i18n="home.viewDetails">Voir détails</a>
        ${supported
          ? `<button class="btn btn-primary btn-block" data-buy="${offer.id}">${window.i18n.t('home.buy')}</button>`
          : `<button class="btn btn-ghost btn-block" disabled>${window.i18n.t('home.unavailable')}</button>`
        }
      </div>
    </div>
  `;

  // Bouton acheter -> ouvre la modale
  const buyBtn = card.querySelector('[data-buy]');
  if (buyBtn) {
    buyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openBuyModal(offer);
    });
  }

  return card;
}

// =============================================================
// MODALE D'ACHAT
// =============================================================

let _selectedOffer = null;

function openBuyModal(offer) {
  _selectedOffer = offer;
  const modal = document.getElementById('buy-modal');
  const preview = document.getElementById('buy-offer-preview');
  const priceEl = document.getElementById('buy-price');
  const errorEl = document.getElementById('buy-error');
  const emailInput = document.getElementById('buyer-email');
  const submitBtn = document.getElementById('buy-submit');

  const lang = window.i18n.lang;
  const title = lang === 'fr' ? offer.title_fr : offer.title_en;

  preview.innerHTML = `
    <div class="op-title">${escapeHtml(title)}</div>
    <div class="op-price">${formatPrice(offer.price, offer.currency, lang)}</div>
  `;
  priceEl.textContent = formatPrice(offer.price, offer.currency, lang);
  errorEl.classList.add('hidden');
  emailInput.value = '';
  submitBtn.disabled = false;
  submitBtn.querySelector('span').textContent = window.i18n.t('buy.pay');

  modal.classList.remove('hidden');
}

function closeBuyModal() {
  document.getElementById('buy-modal').classList.add('hidden');
  _selectedOffer = null;
}

async function handleBuySubmit(e) {
  e.preventDefault();
  const emailInput = document.getElementById('buyer-email');
  const submitBtn = document.getElementById('buy-submit');
  const errorEl = document.getElementById('buy-error');
  const email = emailInput.value.trim();

  // Validation email simple
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errorEl.textContent = window.i18n.t('buy.invalidEmail');
    errorEl.classList.remove('hidden');
    return;
  }
  if (!_selectedOffer) return;

  errorEl.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.querySelector('span').textContent = window.i18n.t('buy.creating');

  try {
    // Crée la transaction côté Worker (qui appelle FedaPay)
    const data = await api('/api/create-transaction', {
      method: 'POST',
      body: JSON.stringify({
        offer_id: _selectedOffer.id,
        buyer_email: email,
      }),
    });

    // Redirige vers FedaPay pour le paiement
    if (data.payment_url) {
      window.location.href = data.payment_url;
      return;
    }
    throw new Error('No payment URL returned');
  } catch (err) {
    console.error(err);
    errorEl.textContent = window.i18n.t('buy.error') + ' (' + err.message + ')';
    errorEl.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.querySelector('span').textContent = window.i18n.t('buy.pay');
  }
}

// =============================================================
// PAGE SUCCÈS (success.html)
// =============================================================

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

  // Modale d'achat : fermeture + soumission
  const buyModal = document.getElementById('buy-modal');
  if (buyModal) {
    buyModal.querySelectorAll('[data-close-modal]').forEach((el) =>
      el.addEventListener('click', closeBuyModal)
    );
    const form = document.getElementById('buy-form');
    if (form) form.addEventListener('submit', handleBuySubmit);
  }
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
