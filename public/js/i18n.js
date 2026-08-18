// =============================================================
// Bêta Arsenal — Système d'internationalisation FR / EN
// -------------------------------------------------------------
// - Langue par défaut : français.
// - Langue mémorisée dans localStorage (clé : "ba_lang").
// - Expose window.i18n : { lang, t(key), setLang(lang), apply() }
// - Les éléments avec [data-i18n="key"] sont traduits automatiquement.
// =============================================================

const TRANSLATIONS = {
  fr: {
    'nav.home': 'Accueil',
    'nav.legal': 'Légal',
    'nav.admin': 'Admin',

    'home.heroTitle': 'Produits numériques & services premium',
    'home.heroSubtitle': 'Livraison instantanée après paiement. Accès sécurisé à vos fichiers et services.',
    'home.filterAll': 'Tout',
    'home.filterDigital': 'Produits numériques',
    'home.filterService': 'Services',
    'home.empty': 'Aucune offre disponible pour le moment.',
    'home.viewDetails': 'Voir détails',

    'product.back': 'Retour au catalogue',
    'product.notFound': 'Produit introuvable.',
    'product.backHome': "Retour à l'accueil",
    'product.highlights': 'Points forts',
    'product.excerpts': 'Extraits',
    'home.typeDigital': 'Produit numérique',
    'home.typeService': 'Service',
    'home.buy': 'Acheter',
    'home.unavailable': 'Paiement indisponible',

    'buy.title': 'Finaliser votre achat',
    'buy.emailLabel': 'Votre email',
    'buy.emailHint': 'Le reçu et l\'accès seront envoyés à cette adresse.',
    'buy.pay': 'Payer',
    'buy.invalidEmail': 'Veuillez saisir un email valide.',
    'buy.creating': 'Création du paiement...',
    'buy.error': 'Une erreur est survenue. Veuillez réessayer.',

    'success.pendingTitle': 'Vérification du paiement en cours',
    'success.pendingText': 'Votre paiement est en cours de vérification. Cette page s\'actualise automatiquement.',
    'success.checkNow': 'Vérifier maintenant',
    'success.approvedTitle': 'Paiement confirmé ✓',
    'success.approvedTextDigital': 'Votre achat est confirmé. Téléchargez votre fichier ci-dessous.',
    'success.approvedTextService': 'Votre achat est confirmé. Voici vos instructions d\'accès.',
    'success.download': 'Télécharger le fichier',
    'success.linkExpires': 'Ce lien expire le {time}.',
    'success.serviceInstructions': 'Instructions',
    'success.privateLink': 'Accéder au lien privé',
    'success.bookingLink': 'Prendre rendez-vous',
    'success.contact': 'Contacter',
    'success.declinedTitle': 'Paiement refusé',
    'success.declinedText': 'Votre paiement a été refusé. Vous pouvez réessayer.',
    'success.retry': 'Réessayer',
    'success.notFoundTitle': 'Transaction introuvable',
    'success.notFoundText': 'Aucune transaction ne correspond à ce lien.',
    'success.backHome': 'Retour à l\'accueil',
    'success.retryIn': 'Nouvelle vérification dans {sec}s',
    'success.unknowError': 'Erreur inattendue. Rechargez la page.',

    'legal.title': 'Informations légales',
    'legal.warningTitle': '⚠️ Modèles à personnaliser',
    'legal.warningText': 'Les textes ci-dessous sont des modèles. Ils doivent être vérifiés et adaptés par le vendeur avant la mise en ligne (statut juridique, SIRET, hébergeur, contact...).',
    'legal.tabMentions': 'Mentions légales',
    'legal.tabCgv': 'CGV',
    'legal.tabPrivacy': 'Confidentialité',

    'legal.mentionsTitle': 'Mentions légales',
    'legal.mentionsOwner': 'Éditeur du site : Florian, entrepreneur individuel (particulier), Bénin. Adresse disponible sur demande auprès du contact ci-dessous.',
    'legal.mentionsContact': 'Contact : bokoflorian24@gmail.com',
    'legal.mentionsHost': 'Hébergement du site : Cloudflare, Inc. (Pages, Workers, D1) et GitHub pour les images produits.',
    'legal.mentionsPayment': "Paiement et vente : les transactions (paiement, facturation, livraison des accès) sont intégralement gérées par Chariow, plateforme tierce de vente en ligne. Bêta Arsenal n'est qu'une vitrine présentant le catalogue ; tout achat redirige vers Chariow, qui traite le paiement et délivre le produit selon ses propres conditions.",
    'legal.mentionsResponsability': "Responsabilité : les informations présentées sur ce site sont indicatives. Le vendeur s'efforce d'assurer leur exactitude mais ne saurait être tenu responsable d'erreurs, d'indisponibilités temporaires du site, ou de dysfonctionnements imputables à Chariow ou à tout autre prestataire tiers.",

    'legal.cgvTitle': 'Conditions Générales de Vente',
    'legal.cgvScope': "Les présentes CGV s'appliquent à toute commande passée depuis ce site et finalisée sur Chariow.",
    'legal.cgvProducts': "Produits et services : le vendeur commercialise des produits numériques (livraison immédiate après paiement) et, le cas échéant, des services (accès selon les modalités indiquées sur l'offre). Bêta Arsenal présente le catalogue ; la commande elle-même est passée sur Chariow.",
    'legal.cgvPrice': "Prix et paiement : les prix sont indiqués dans la devise de l'offre. Le paiement est traité intégralement par Chariow, qui sécurise la transaction (le vendeur n'a accès à aucune donnée bancaire).",
    'legal.cgvDelivery': "Livraison : pour les produits numériques, l'accès ou le lien de téléchargement est fourni directement par Chariow après confirmation du paiement. Pour les services, les instructions sont communiquées sur la page de confirmation de Chariow ou par email.",
    'legal.cgvRefund': "Remboursement : compte tenu de la nature numérique des biens, aucun remboursement n'est accordé après téléchargement ou accès au produit, sauf dysfonctionnement technique avéré. Toute demande de remboursement doit être adressée au vendeur (voir contact) ; les délais de traitement des remboursements peuvent dépendre des conditions propres à Chariow.",
    'legal.cgvLaw': 'Droit applicable : les présentes CGV sont soumises au droit béninois. En cas de litige, une solution amiable sera recherchée en priorité avant toute autre démarche.',

    'legal.privacyTitle': 'Politique de confidentialité',
    'legal.privacyData': "Données collectées : ce site (Bêta Arsenal) ne collecte lui-même aucune donnée personnelle liée à l'achat. Lors d'une commande, vos données (email, informations de paiement) sont saisies directement sur Chariow, qui les traite selon sa propre politique de confidentialité. Aucune donnée bancaire ne transite ni n'est stockée sur ce site.",
    'legal.privacyStorage': "Stockage : le site lui-même (catalogue, contenu) est hébergé sur Cloudflare (Pages, Workers, D1). Les images produits sont stockées sur GitHub (dépôt public). Les données liées aux commandes et aux paiements sont stockées et gérées par Chariow, en dehors de l'infrastructure de ce site.",
    'legal.privacyRetention': 'Conservation : le vendeur ne conserve pas de base de données clients propre. Les données de transaction sont conservées par Chariow selon ses propres règles et obligations légales.',
    'legal.privacyRights': "Vos droits : pour toute question sur vos données de transaction, adressez-vous en priorité à Chariow. Vous pouvez également écrire à l'éditeur de ce site (voir mentions légales) pour toute donnée qui le concernerait directement.",
    'legal.privacyCookies': "Cookies : ce site utilise le stockage local (localStorage) du navigateur uniquement pour mémoriser la langue préférée. Aucun cookie de suivi ou publicitaire n'est utilisé sur ce site.",

    'admin.loginTitle': 'Espace administrateur',
    'admin.loginSubtitle': 'Connexion réservée au vendeur autorisé.',
    'admin.email': 'Email',
    'admin.password': 'Mot de passe',
    'admin.signIn': 'Se connecter',
    'admin.signingIn': 'Connexion...',
    'admin.loginError': 'Email ou mot de passe incorrect.',
    'admin.notAuthorized': 'Cet email n\'est pas autorisé à accéder à l\'administration.',
    'admin.logout': 'Déconnexion',

    'admin.dashboard': 'Tableau de bord',
    'admin.statTotal': 'Ventes totales',
    'admin.statApproved': 'Approuvées',
    'admin.statPending': 'En attente',
    'admin.statRevenue': 'Chiffre d\'affaires',
    'admin.tabOffers': 'Offres',
    'admin.tabTransactions': 'Transactions',
    'admin.offersTitle': 'Gestion des offres',
    'admin.newOffer': '+ Nouvelle offre',
    'admin.transactionsTitle': 'Transactions',
    'admin.refresh': 'Rafraîchir',
    'admin.txDate': 'Date',
    'admin.txOffer': 'Offre',
    'admin.txBuyer': 'Acheteur',
    'admin.txAmount': 'Montant',
    'admin.txStatus': 'Statut',
    'admin.txActions': 'Actions',
    'admin.regenerate': 'Régénérer le lien',
    'admin.noTransactions': 'Aucune transaction.',

    'admin.offerFormTitle': 'Offre',
    'admin.offerType': 'Type d\'offre',
    'admin.typeDigital': 'Produit numérique',
    'admin.typeService': 'Service',
    'admin.titleFr': 'Titre (FR)',
    'admin.titleEn': 'Titre (EN)',
    'admin.descFr': 'Description (FR)',
    'admin.descEn': 'Description (EN)',
    'admin.price': 'Prix (entier, ex: 5000)',
    'admin.currency': 'Devise (ISO)',
    'admin.isActive': 'Offre active (visible publiquement)',
    'admin.digitalLegend': 'Fichier numérique',
    'admin.serviceLegend': 'Configuration du service',
    'admin.serviceMode': 'Mode de service',
    'admin.modeInstructions': 'Instructions simples',
    'admin.modeRdv': 'Rendez-vous',
    'admin.modePrivateLink': 'Lien privé',
    'admin.modePrivateGroup': 'Groupe privé',
    'admin.instructionsFr': 'Instructions (FR)',
    'admin.instructionsEn': 'Instructions (EN)',
    'admin.privateLink': 'Lien privé (optionnel)',
    'admin.bookingLink': 'Lien de réservation (optionnel)',
    'admin.contact': 'Contact (optionnel)',
    'admin.socialLegend': 'Liens sociaux / contact (optionnel)',
    'admin.cancel': 'Annuler',
    'admin.save': 'Enregistrer',
    'admin.edit': 'Modifier',
    'admin.delete': 'Supprimer',
    'admin.saving': 'Enregistrement...',
    'admin.deleteConfirm': 'Supprimer cette offre ?',
    'admin.saved': 'Offre enregistrée.',
    'admin.deleted': 'Offre supprimée.',
    'admin.fileSelected': 'Fichier sélectionné',
    'admin.size': 'Taille',
    'admin.noFile': 'Aucun fichier sélectionné',
    'admin.linkRegenerated': 'Lien régénéré.',
    'admin.detailsLegend': 'Détails de l\'offre',
    'admin.salesTunnelLink': 'Lien du tunnel de vente / lien privé',
    'admin.salesTunnelHint': 'Pour un produit numérique : URL du site annexe où le fichier est hébergé. Pour un service : lien privé/groupe.',
    'admin.mediaLegend': 'Média (illustration du produit)',
    'admin.mediaType': 'Type de média',
    'admin.mediaNone': 'Aucun média',
    'admin.mediaDemo': 'Démo (vidéo TikTok)',
    'admin.mediaImage': 'Images (upload sur GitHub)',
    'admin.tiktokUrl': 'URL de la vidéo TikTok',
    'admin.tiktokHint': 'Collez l\'URL complète de la vidéo TikTok. Elle sera intégrée (embed) sur la page produit.',
    'admin.uploadImages': 'Uploader des images',
    'admin.chooseImages': '+ Choisir des images',
    'admin.uploadHint': 'JPG, PNG, WebP, GIF, AVIF — max 5 Mo par image.',
    'admin.presentationLegend': 'Page de présentation (configurable)',
    'admin.summaryFr': 'Résumé long (FR)',
    'admin.summaryEn': 'Résumé long (EN)',
    'admin.highlightsFr': 'Points forts (FR)',
    'admin.highlightsEn': 'Points forts (EN)',
    'admin.excerptsFr': 'Extraits (FR) — titre + contenu',
    'admin.excerptsEn': 'Extraits (EN) — titre + contenu',
    'admin.addHighlight': '+ Ajouter un point fort',
    'admin.addExcerpt': '+ Ajouter un extrait',
  },

  en: {
    'nav.home': 'Home',
    'nav.legal': 'Legal',
    'nav.admin': 'Admin',

    'home.heroTitle': 'Premium digital products & services',
    'home.heroSubtitle': 'Instant delivery after payment. Secure access to your files and services.',
    'home.filterAll': 'All',
    'home.filterDigital': 'Digital products',
    'home.filterService': 'Services',
    'home.empty': 'No offer available at the moment.',
    'home.viewDetails': 'View details',

    'product.back': 'Back to catalog',
    'product.notFound': 'Product not found.',
    'product.backHome': 'Back to home',
    'product.highlights': 'Highlights',
    'product.excerpts': 'Excerpts',
    'home.typeDigital': 'Digital product',
    'home.typeService': 'Service',
    'home.buy': 'Buy',
    'home.unavailable': 'Payment unavailable',

    'buy.title': 'Complete your purchase',
    'buy.emailLabel': 'Your email',
    'buy.emailHint': 'The receipt and access will be sent to this address.',
    'buy.pay': 'Pay',
    'buy.invalidEmail': 'Please enter a valid email.',
    'buy.creating': 'Creating payment...',
    'buy.error': 'An error occurred. Please try again.',

    'success.pendingTitle': 'Payment verification in progress',
    'success.pendingText': 'Your payment is being verified. This page refreshes automatically.',
    'success.checkNow': 'Check now',
    'success.approvedTitle': 'Payment confirmed ✓',
    'success.approvedTextDigital': 'Your purchase is confirmed. Download your file below.',
    'success.approvedTextService': 'Your purchase is confirmed. Here are your access instructions.',
    'success.download': 'Download file',
    'success.linkExpires': 'This link expires on {time}.',
    'success.serviceInstructions': 'Instructions',
    'success.privateLink': 'Access private link',
    'success.bookingLink': 'Book a slot',
    'success.contact': 'Contact',
    'success.declinedTitle': 'Payment declined',
    'success.declinedText': 'Your payment was declined. You can try again.',
    'success.retry': 'Try again',
    'success.notFoundTitle': 'Transaction not found',
    'success.notFoundText': 'No transaction matches this link.',
    'success.backHome': 'Back to home',
    'success.retryIn': 'Next check in {sec}s',
    'success.unknowError': 'Unexpected error. Reload the page.',

    'legal.title': 'Legal information',
    'legal.warningTitle': '⚠️ Templates to customize',
    'legal.warningText': 'The texts below are templates. They must be reviewed and adapted by the seller before going live (legal status, registration number, host, contact...).',
    'legal.tabMentions': 'Legal notice',
    'legal.tabCgv': 'Terms of sale',
    'legal.tabPrivacy': 'Privacy',

    'legal.mentionsTitle': 'Legal notice',
    'legal.mentionsOwner': 'Site publisher: Florian, sole trader (individual), Benin. Address available on request from the contact below.',
    'legal.mentionsContact': 'Contact: bokoflorian24@gmail.com',
    'legal.mentionsHost': 'Site hosting: Cloudflare, Inc. (Pages, Workers, D1) and GitHub for product images.',
    'legal.mentionsPayment': "Payment and sales: transactions (payment, invoicing, access delivery) are fully managed by Chariow, a third-party sales platform. Bêta Arsenal is only a showcase presenting the catalog; every purchase redirects to Chariow, which processes the payment and delivers the product under its own terms.",
    'legal.mentionsResponsability': "Liability: the information on this site is provided for guidance. The seller strives to ensure its accuracy but cannot be held liable for errors, temporary site unavailability, or malfunctions attributable to Chariow or any other third-party provider.",

    'legal.cgvTitle': 'Terms of Sale',
    'legal.cgvScope': 'These Terms of Sale apply to any order placed from this site and finalized on Chariow.',
    'legal.cgvProducts': "Products and services: the seller offers digital products (instant delivery after payment) and, where applicable, services (access according to the terms stated on the offer). Bêta Arsenal presents the catalog; the order itself is placed on Chariow.",
    'legal.cgvPrice': "Price and payment: prices are shown in the offer's currency. Payment is processed entirely by Chariow, which secures the transaction (the seller has no access to any banking data).",
    'legal.cgvDelivery': "Delivery: for digital products, access or the download link is provided directly by Chariow after payment confirmation. For services, instructions are communicated on Chariow's confirmation page or by email.",
    'legal.cgvRefund': "Refunds: given the digital nature of the goods, no refund is granted after download or access to the product, except in the case of a proven technical malfunction. Any refund request must be sent to the seller (see contact); processing times may depend on Chariow's own terms.",
    'legal.cgvLaw': 'Governing law: these Terms of Sale are governed by the law of Benin. In case of dispute, an amicable solution will be sought first before any other action.',

    'legal.privacyTitle': 'Privacy Policy',
    'legal.privacyData': "Data collected: this site (Bêta Arsenal) does not itself collect any personal data related to the purchase. When placing an order, your data (email, payment information) is entered directly on Chariow, which processes it under its own privacy policy. No banking data passes through or is stored on this site.",
    'legal.privacyStorage': 'Storage: the site itself (catalog, content) is hosted on Cloudflare (Pages, Workers, D1). Product images are stored on GitHub (public repository). Order and payment data is stored and managed by Chariow, outside this site\'s infrastructure.',
    'legal.privacyRetention': "Retention: the seller does not keep its own customer database. Transaction data is retained by Chariow according to its own rules and legal obligations.",
    'legal.privacyRights': "Your rights: for any question about your transaction data, please contact Chariow first. You may also write to this site's publisher (see legal notice) for any data directly concerning them.",
    'legal.privacyCookies': "Cookies: this site uses the browser's local storage (localStorage) only to remember the preferred language. No tracking or advertising cookies are used on this site.",

    'admin.loginTitle': 'Admin area',
    'admin.loginSubtitle': 'Sign in restricted to the authorized seller.',
    'admin.email': 'Email',
    'admin.password': 'Password',
    'admin.signIn': 'Sign in',
    'admin.signingIn': 'Signing in...',
    'admin.loginError': 'Wrong email or password.',
    'admin.notAuthorized': 'This email is not allowed to access the admin area.',
    'admin.logout': 'Sign out',

    'admin.dashboard': 'Dashboard',
    'admin.statTotal': 'Total sales',
    'admin.statApproved': 'Approved',
    'admin.statPending': 'Pending',
    'admin.statRevenue': 'Revenue',
    'admin.tabOffers': 'Offers',
    'admin.tabTransactions': 'Transactions',
    'admin.offersTitle': 'Offer management',
    'admin.newOffer': '+ New offer',
    'admin.transactionsTitle': 'Transactions',
    'admin.refresh': 'Refresh',
    'admin.txDate': 'Date',
    'admin.txOffer': 'Offer',
    'admin.txBuyer': 'Buyer',
    'admin.txAmount': 'Amount',
    'admin.txStatus': 'Status',
    'admin.txActions': 'Actions',
    'admin.regenerate': 'Regenerate link',
    'admin.noTransactions': 'No transactions.',

    'admin.offerFormTitle': 'Offer',
    'admin.offerType': 'Offer type',
    'admin.typeDigital': 'Digital product',
    'admin.typeService': 'Service',
    'admin.titleFr': 'Title (FR)',
    'admin.titleEn': 'Title (EN)',
    'admin.descFr': 'Description (FR)',
    'admin.descEn': 'Description (EN)',
    'admin.price': 'Price (integer, e.g. 5000)',
    'admin.currency': 'Currency (ISO)',
    'admin.isActive': 'Active offer (publicly visible)',
    'admin.digitalLegend': 'Digital file',
    'admin.serviceLegend': 'Service configuration',
    'admin.serviceMode': 'Service mode',
    'admin.modeInstructions': 'Simple instructions',
    'admin.modeRdv': 'Appointment',
    'admin.modePrivateLink': 'Private link',
    'admin.modePrivateGroup': 'Private group',
    'admin.instructionsFr': 'Instructions (FR)',
    'admin.instructionsEn': 'Instructions (EN)',
    'admin.privateLink': 'Private link (optional)',
    'admin.bookingLink': 'Booking link (optional)',
    'admin.contact': 'Contact (optional)',
    'admin.socialLegend': 'Social / contact links (optional)',
    'admin.cancel': 'Cancel',
    'admin.save': 'Save',
    'admin.edit': 'Edit',
    'admin.delete': 'Delete',
    'admin.saving': 'Saving...',
    'admin.deleteConfirm': 'Delete this offer?',
    'admin.saved': 'Offer saved.',
    'admin.deleted': 'Offer deleted.',
    'admin.fileSelected': 'Selected file',
    'admin.size': 'Size',
    'admin.noFile': 'No file selected',
    'admin.linkRegenerated': 'Link regenerated.',
    'admin.detailsLegend': 'Offer details',
    'admin.salesTunnelLink': 'Sales tunnel link / private link',
    'admin.salesTunnelHint': 'For a digital product: URL of the external site hosting the file. For a service: private/group link.',
    'admin.mediaLegend': 'Media (product illustration)',
    'admin.mediaType': 'Media type',
    'admin.mediaNone': 'No media',
    'admin.mediaDemo': 'Demo (TikTok video)',
    'admin.mediaImage': 'Images (GitHub upload)',
    'admin.tiktokUrl': 'TikTok video URL',
    'admin.tiktokHint': 'Paste the full TikTok video URL. It will be embedded on the product page.',
    'admin.uploadImages': 'Upload images',
    'admin.chooseImages': '+ Choose images',
    'admin.uploadHint': 'JPG, PNG, WebP, GIF, AVIF — max 5MB per image.',
    'admin.presentationLegend': 'Presentation page (configurable)',
    'admin.summaryFr': 'Long summary (FR)',
    'admin.summaryEn': 'Long summary (EN)',
    'admin.highlightsFr': 'Highlights (FR)',
    'admin.highlightsEn': 'Highlights (EN)',
    'admin.excerptsFr': 'Excerpts (FR) — title + content',
    'admin.excerptsEn': 'Excerpts (EN) — title + content',
    'admin.addHighlight': '+ Add a highlight',
    'admin.addExcerpt': '+ Add an excerpt',
  },
};

const LANG_KEY = 'ba_lang';
const DEFAULT_LANG = 'fr';

// Détermine la langue initiale (localStorage > navigateur > défaut)
function detectLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && TRANSLATIONS[saved]) return saved;
  } catch (_) { /* localStorage indisponible */ }
  const nav = (navigator.language || DEFAULT_LANG).slice(0, 2).toLowerCase();
  return TRANSLATIONS[nav] ? nav : DEFAULT_LANG;
}

const i18n = {
  lang: detectLang(),

  // Récupère une chaîne traduite, avec interpolation {var}
  t(key, vars) {
    const dict = TRANSLATIONS[i18n.lang] || TRANSLATIONS[DEFAULT_LANG];
    let str = dict[key] || TRANSLATIONS[DEFAULT_LANG][key] || key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return str;
  },

  // Change la langue active et l'applique au DOM
  setLang(lang) {
    if (!TRANSLATIONS[lang]) return;
    i18n.lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
    i18n.apply();
  },

  // Bascule entre FR et EN
  toggle() {
    i18n.setLang(i18n.lang === 'fr' ? 'en' : 'fr');
  },

  // Applique la traduction à tous les [data-i18n]
  apply() {
    document.documentElement.lang = i18n.lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      el.textContent = i18n.t(key);
    });
    // Met à jour le bouton de bascule de langue
    const label = document.getElementById('lang-label');
    if (label) label.textContent = i18n.lang === 'fr' ? 'EN' : 'FR';
  },
};

// Expose globalement pour les autres scripts
window.i18n = i18n;

// Initialise au chargement du DOM
function initI18n() {
  i18n.apply();
  const toggleBtn = document.getElementById('lang-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => i18n.toggle());
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initI18n);
} else {
  initI18n();
}

export default i18n;
