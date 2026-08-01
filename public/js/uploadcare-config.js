// =============================================================
// Bêta Arsenal - Configuration Uploadcare (CÔTÉ FRONTEND)
// -------------------------------------------------------------
// Seule la CLÉ PUBLIQUE Uploadcare est exposée ici.
// La clé secrète (utilisée pour signer les liens temporaires)
// reste côté Worker (UPLOADCARE_SECRET_KEY).
// =============================================================

export const UPLOADCARE_PUBLIC_KEY = 'xxxxxxxxxxxxxxxxxxxxxxxx';

// Charge dynamiquement le widget Uploadcare si besoin
export async function loadUploadcareWidget() {
  if (window.uploadcare) return window.uploadcare;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://ucarecdn.com/libs/widget/3.x/uploadcare.full.min.js';
    script.async = true;
    script.onload = () => resolve(window.uploadcare);
    script.onerror = () => reject(new Error('Uploadcare widget load error'));
    document.head.appendChild(script);
  });
}
