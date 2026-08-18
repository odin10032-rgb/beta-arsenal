// =============================================================
// Bêta Arsenal - Logique page produit (/product.html?id=...)
// -------------------------------------------------------------
// - Charge l'offre par ID via GET /api/offers/:id
// - Affiche : média (TikTok embed OU galerie d'images), résumé,
//   points forts, extraits, prix, bouton acheter, liens sociaux.
// - Réutilise la modale d'achat (même logique que app.js).
// =============================================================

import { WORKER_API_URL } from './config.js';

// Devises supportées par FedaPay (V1)
const FEDAPAY_SUPPORTED_CURRENCIES = ['XOF', 'XAF', 'GHS', 'EUR', 'USD'];

let _offer = null;

// =============================================================
// Utilitaires (identiques à app.js)
// =============================================================
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

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
// Rendu de la page produit
// =============================================================
async function initProductPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const container = document.getElementById('product-container');
  const errorEl = document.getElementById('product-error');

  if (!id) {
    container.classList.add('hidden');
    errorEl.classList.remove('hidden');
    return;
  }

  try {
    const data = await api(`/api/offers/${encodeURIComponent(id)}`);
    _offer = data.offer;
    renderProduct(_offer);
  } catch (err) {
    console.error('Erreur chargement produit:', err);
    container.classList.add('hidden');
    errorEl.classList.remove('hidden');
  }
}

function renderProduct(offer) {
  const container = document.getElementById('product-container');
  const lang = window.i18n.lang;
  const title = lang === 'fr' ? offer.title_fr : offer.title_en;
  const description = lang === 'fr' ? offer.description_fr : offer.description_en;
  const summary = lang === 'fr' ? offer.presentation_summary_fr : offer.presentation_summary_en;
  const highlights = lang === 'fr' ? offer.presentation_highlights_fr : offer.presentation_highlights_en;
  const excerpts = lang === 'fr' ? offer.presentation_excerpts_fr : offer.presentation_excerpts_en;
  const supported = FEDAPAY_SUPPORTED_CURRENCIES.includes(offer.currency);
  const isDigital = offer.type === 'digital_product';
  const typeLabel = window.i18n.t(isDigital ? 'home.typeDigital' : 'home.typeService');

  // Média
  let mediaHtml = '';
  if (offer.media_type === 'demo' && offer.media_demo_url) {
    mediaHtml = renderTikTokEmbed(offer.media_demo_url);
  } else if (offer.media_type === 'image' && Array.isArray(offer.media_images) && offer.media_images.length > 0) {
    mediaHtml = renderImageGallery(offer.media_images);
  } else {
    mediaHtml = `<div class="product-media-placeholder">${escapeHtml(title.charAt(0))}</div>`;
  }

  // Liens sociaux
  const socials = offer.social_links || {};
  const socialsHtml = Object.entries(socials)
    .filter(([, v]) => v)
    .map(([k, v]) => `<a href="${escapeHtml(v)}" target="_blank" rel="noopener noreferrer" class="service-link">${escapeHtml(k)}</a>`)
    .join('');

  // Points forts
  const highlightsHtml = (highlights && highlights.length > 0)
    ? `<div class="product-section"><h2 data-i18n="product.highlights">Points forts</h2><ul class="highlights-list">${highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul></div>`
    : '';

  // Extraits
  const excerptsHtml = (excerpts && excerpts.length > 0)
    ? `<div class="product-section"><h2 data-i18n="product.excerpts">Extraits</h2>${excerpts.map((e) => `<div class="excerpt-card"><h3>${escapeHtml(e.title || '')}</h3><p>${escapeHtml(e.content || '').replace(/\n/g, '<br>')}</p></div>`).join('')}</div>`
    : '';

  container.innerHTML = `
    <article class="product-detail">
      <div class="product-media">${mediaHtml}</div>
      <div class="product-info">
        <span class="offer-type ${isDigital ? '' : 'service'}">${escapeHtml(typeLabel)}</span>
        <h1 class="product-title">${escapeHtml(title)}</h1>
        <p class="product-price">${formatPrice(offer.price, offer.currency, lang)}</p>
        <p class="product-description">${escapeHtml(description)}</p>

        ${summary ? `<div class="product-summary">${escapeHtml(summary).replace(/\n/g, '<br>')}</div>` : ''}

        <div class="product-buy-section">
          ${supported
            ? `<button class="btn btn-primary btn-lg" id="buy-trigger">${window.i18n.t('home.buy')} · ${formatPrice(offer.price, offer.currency, lang)}</button>`
            : `<button class="btn btn-ghost btn-lg" disabled>${window.i18n.t('home.unavailable')}</button>`
          }
          ${socialsHtml ? `<div class="offer-socials">${socialsHtml}</div>` : ''}
        </div>
      </div>
    </article>

    ${highlightsHtml}
    ${excerptsHtml}
  `;

  // Re-applique l'i18n sur les nouveaux éléments
  window.i18n.apply();

  // Bouton acheter
  const buyBtn = document.getElementById('buy-trigger');
  if (buyBtn) {
    buyBtn.addEventListener('click', () => openBuyModal(offer));
  }

  // Ré-init TikTok embed si présent
  if (offer.media_type === 'demo') {
    loadTikTokEmbedScript();
  }
}

// =============================================================
// Rendu du média TikTok
// =============================================================
function renderTikTokEmbed(url) {
  // Extrait l'ID vidéo depuis l'URL TikTok
  // Formats: https://www.tiktok.com/@user/video/1234567890
  const match = String(url).match(/\/video\/(\d+)/);
  const videoId = match ? match[1] : null;
  if (!videoId) {
    // URL non reconnue, on affiche un lien simple
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="tiktok-fallback">▶ ${escapeHtml(url)}</a>`;
  }
  return `
    <blockquote class="tiktok-embed" cite="${escapeHtml(url)}" data-video-id="${escapeHtml(videoId)}" style="max-width: 420px;min-width: 280px;">
      <a href="${escapeHtml(url)}" target="_blank">TikTok</a>
    </blockquote>
  `;
}

let _tiktokScriptLoaded = false;
function loadTikTokEmbedScript() {
  if (_tiktokScriptLoaded) return;
  if (document.querySelector('script[src*="tiktok.com/embed.js"]')) {
    _tiktokScriptLoaded = true;
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://www.tiktok.com/embed.js';
  script.async = true;
  document.head.appendChild(script);
  _tiktokScriptLoaded = true;
}

// =============================================================
// Rendu galerie d'images
// =============================================================
function renderImageGallery(images) {
  if (!images || images.length === 0) return '';
  const main = images[0];
  const thumbs = images.slice(1);
  return `
    <div class="image-gallery" data-gallery>
      <div class="gallery-main">
        <img src="${escapeHtml(main)}" alt="" class="gallery-current" data-main-image />
      </div>
      ${thumbs.length > 0 ? `
        <div class="gallery-thumbs">
          <button class="thumb thumb-active" data-src="${escapeHtml(main)}"><img src="${escapeHtml(main)}" alt="" /></button>
          ${thumbs.map((src) => `<button class="thumb" data-src="${escapeHtml(src)}"><img src="${escapeHtml(src)}" alt="" /></button>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// Gestion du clic sur les thumbnails
document.addEventListener('click', (e) => {
  const thumb = e.target.closest('.thumb');
  if (!thumb) return;
  const gallery = thumb.closest('[data-gallery]');
  if (!gallery) return;
  const mainImg = gallery.querySelector('[data-main-image]');
  if (mainImg && thumb.dataset.src) {
    mainImg.src = thumb.dataset.src;
    gallery.querySelectorAll('.thumb').forEach((t) => t.classList.remove('thumb-active'));
    thumb.classList.add('thumb-active');
  }
});

// =============================================================
// Modale d'achat (identique à app.js)
// =============================================================
function openBuyModal(offer) {
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
}

async function handleBuySubmit(e) {
  e.preventDefault();
  const emailInput = document.getElementById('buyer-email');
  const submitBtn = document.getElementById('buy-submit');
  const errorEl = document.getElementById('buy-error');
  const email = emailInput.value.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errorEl.textContent = window.i18n.t('buy.invalidEmail');
    errorEl.classList.remove('hidden');
    return;
  }
  if (!_offer) return;

  errorEl.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.querySelector('span').textContent = window.i18n.t('buy.creating');

  try {
    const data = await api('/api/create-transaction', {
      method: 'POST',
      body: JSON.stringify({
        offer_id: _offer.id,
        buyer_email: email,
      }),
    });

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
// Initialisation
// =============================================================
function initApp() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initProductPage();

  const buyModal = document.getElementById('buy-modal');
  if (buyModal) {
    buyModal.querySelectorAll('[data-close-modal]').forEach((el) =>
      el.addEventListener('click', closeBuyModal)
    );
    const form = document.getElementById('buy-form');
    if (form) form.addEventListener('submit', handleBuySubmit);
  }
}

// Re-render quand la langue change
window.addEventListener('langchange', () => {
  if (_offer) renderProduct(_offer);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
