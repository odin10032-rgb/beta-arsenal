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
    'admin.chooseFile': 'Choisir un fichier (Uploadcare)',
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
    'admin.chooseFile': 'Choose a file (Uploadcare)',
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
