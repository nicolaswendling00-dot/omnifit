// OmniFit — utils/barcode.js
// Scan de codes-barres (EAN-13, etc.) via html5-qrcode (CDN), en Vanilla JS pur.
// Module séparé de l'appel API et de l'UI : ne s'occupe QUE de la capture/détection.
//
// Choix technique : PHOTO UNIQUE (appareil photo natif) plutôt que scan vidéo en direct.
// Safari iOS n'a aucun support natif de la Barcode Detection API : html5-qrcode retombe
// alors sur son moteur de secours (ZXing-js), qui doit décoder un flux vidéo web basse
// résolution, sans mise au point ni stabilisation — peu fiable pour un EAN-13 (barres
// fines). L'appareil photo natif (déclenché via <input capture>) capture en pleine
// résolution avec mise au point automatique : la détection est bien plus fiable.
// On utilise donc Html5Qrcode.scanFile(), fait pour décoder une image statique.

const CDN_URL = 'https://unpkg.com/html5-qrcode';

let loadPromise = null;

// Charge html5-qrcode depuis le CDN une seule fois (mis en cache par le navigateur/SW ensuite).
function loadHtml5Qrcode() {
  if (window.Html5Qrcode) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CDN_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Impossible de charger la librairie de scan (pas de connexion ?)'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

// Déclenche l'appareil photo natif du téléphone (capture="environment") et retourne
// le File capturé (ou null si l'utilisateur annule).
export function captureBarcodePhoto() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;left:-9999px';
    document.body.appendChild(input);
    const cleanup = () => setTimeout(() => input.remove(), 0);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      cleanup();
      resolve(file);
    });
    // Si l'utilisateur annule la capture (pas d'event 'change' fiable sur tous les
    // navigateurs) : on retombe sur le focus de la fenêtre pour détecter l'annulation.
    window.addEventListener('focus', function onFocus() {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => { if (!input.files || !input.files.length) { cleanup(); resolve(null); } }, 400);
    }, { once: true });
    input.click();
  });
}

// Décode un code-barre à partir d'une image (File/Blob) déjà capturée.
// Retourne le texte décodé, ou lève une erreur explicite si rien n'est détecté.
export async function decodeBarcodeFromFile(file) {
  try {
    await loadHtml5Qrcode();
  } catch (e) {
    throw new Error(e.message || 'Chargement de la librairie de scan impossible');
  }
  // Élément technique requis par la lib (non affiché : on ne veut pas son aperçu par défaut).
  let host = document.getElementById('bc-scanfile-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'bc-scanfile-host';
    host.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none';
    document.body.appendChild(host);
  }
  const html5QrCode = new window.Html5Qrcode('bc-scanfile-host', { verbose: false });
  try {
    const result = await html5QrCode.scanFile(file, false);
    return result;
  } catch (e) {
    throw new Error('Aucun code-barre détecté sur la photo. Réessaie avec un meilleur cadrage/éclairage, ou saisis le code manuellement.');
  }
}
