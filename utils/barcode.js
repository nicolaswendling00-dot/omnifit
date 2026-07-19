// OmniFit — utils/barcode.js
// Scan de codes-barres (EAN-13, etc.) via html5-qrcode (CDN), en Vanilla JS pur.
// Module séparé de l'appel API et de l'UI : ne s'occupe QUE de la caméra/détection.

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

// Démarre le scan dans l'élément DOM #elementId (doit déjà être dans le document).
// callbacks : { onDetected(code), onError(message) }
// Retourne une promesse résolue avec un objet { stop() } pour couper la caméra manuellement.
export async function startBarcodeScanner(elementId, { onDetected, onError }) {
  try {
    await loadHtml5Qrcode();
  } catch (e) {
    onError(e.message || 'Chargement de la librairie de scan impossible');
    return { stop: async () => {} };
  }

  const html5QrCode = new window.Html5Qrcode(elementId, { verbose: false });
  let stopped = false;
  let detected = false;

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (_) { /* déjà arrêté / jamais démarré : sans conséquence */ }
  };

  const config = {
    fps: 15,
    // Zone de scan large et basse : un EAN-13 est un rectangle large et peu haut,
    // un cadre trop étroit/carré le coupe et empêche la détection.
    qrbox: (viewfinderWidth, viewfinderHeight) => {
      const w = Math.floor(viewfinderWidth * 0.85);
      const h = Math.floor(Math.min(viewfinderHeight * 0.4, w * 0.5));
      return { width: w, height: h };
    },
    // Formats code-barres produits courants (EAN-13, EAN-8, UPC-A, UPC-E) + QR au cas où.
    formatsToSupport: window.Html5QrcodeSupportedFormats ? [
      window.Html5QrcodeSupportedFormats.EAN_13,
      window.Html5QrcodeSupportedFormats.EAN_8,
      window.Html5QrcodeSupportedFormats.UPC_A,
      window.Html5QrcodeSupportedFormats.UPC_E,
      window.Html5QrcodeSupportedFormats.CODE_128,
    ] : undefined,
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
  };

  try {
    await html5QrCode.start(
      { facingMode: 'environment' },
      config,
      (decodedText) => {
        if (detected) return; // ignore toute détection après la première (le temps que stop() agisse)
        detected = true;
        stop().finally(() => onDetected(decodedText));
      },
      () => { /* échecs de détection frame par frame : normal, on ignore */ },
    );
  } catch (e) {
    stopped = true;
    const msg = (e && e.toString && e.toString().includes('Permission'))
      ? 'Accès à la caméra refusé. Autorise la caméra dans les réglages de Safari pour ce site.'
      : 'Impossible d\'accéder à la caméra sur cet appareil.';
    onError(msg);
    return { stop: async () => {} };
  }

  // Contrainte iOS Safari : forcer le rendu inline (sinon la vidéo s'ouvre en plein écran natif).
  const videoEl = document.querySelector(`#${elementId} video`);
  if (videoEl) {
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('webkit-playsinline', 'true');
    videoEl.muted = true;
  }

  return { stop };
}
