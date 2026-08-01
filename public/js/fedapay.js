// =============================================================
// Bêta Arsenal - Intégration FedaPay (CÔTÉ FRONTEND)
// -------------------------------------------------------------
// Charge le SDK JS FedaPay et expose une fonction pour lancer
// le paiement en ouvrant l'URL de paiement renvoyée par le Worker.
// Aucune clé secrète n'est manipulée ici : la transaction est créée
// côté Worker (FEDAPAY_SECRET_KEY).
// =============================================================

// Charge dynamiquement le script FedaPay JS
let _loaded = false;
export function loadFedapayScript() {
  if (_loaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.fedapay.com/checkout.js';
    script.async = true;
    script.onload = () => { _loaded = true; resolve(); };
    script.onerror = () => reject(new Error('FedaPay SDK load error'));
    document.head.appendChild(script);
  });
}

// Ouvre le paiement FedaPay à partir de l'URL de paiement renvoyée par le Worker
// Le Worker renvoie { payment_url, public_token }
export async function startFedapayPayment(paymentUrl, onSuccess, onClose) {
  await loadFedapayScript();

  // Méthode 1 : redirection simple vers la page de paiement FedaPay
  // (compatible mobile et desktop, la plus robuste)
  if (paymentUrl) {
    window.location.href = paymentUrl;
    return;
  }

  // Méthode 2 (alternative) : FedaPay Checkout popup si disponible
  if (window.FedaPay && typeof window.FedaPay.open === 'function') {
    window.FedaPay.open({
      onSuccess,
      onClose,
    });
  }
}
