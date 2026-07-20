// OmniFit — utils/barcode.js
// Scan de codes-barres (EAN-13, EAN-8, UPC, CODE-128/39/93, QR…) via zbar-wasm.
//
// Historique : on utilisait html5-qrcode (moteur ZXing). ZXing est bon pour les
// QR codes mais faible sur les codes-barres 1D (EAN) dans une photo réelle : il
// binarise l'image entière d'un coup et rate une fine bande de code-barres au
// milieu d'un fond chargé. zbar, lui, LOCALISE la zone du code — beaucoup plus
// robuste. On utilise donc zbar compilé en WebAssembly (build « inlined », le
// .wasm est embarqué en base64 → aucun fetch séparé, fonctionne hors-ligne une
// fois mis en cache par le service worker).
//
// Flux d'utilisation (UI dans nutrition.js) : caméra live in-app (getUserMedia)
// → bouton « pause » qui fige une image → décodage de cette image. On ne quitte
// jamais l'app. zbar gère nativement l'orientation, pas besoin de faire pivoter.

const ZBAR_URL = 'https://cdn.jsdelivr.net/npm/@undecaf/zbar-wasm@0.11.0/dist/inlined/index.mjs';

let zbarPromise = null;

// Charge zbar-wasm une seule fois (module ESM importé dynamiquement depuis le CDN).
function loadZbar() {
  if (zbarPromise) return zbarPromise;
  zbarPromise = import(/* @vite-ignore */ ZBAR_URL).catch((e) => {
    zbarPromise = null; // permet un nouvel essai plus tard
    throw new Error('Impossible de charger le moteur de scan (pas de connexion ?)');
  });
  return zbarPromise;
}

// ------------------------------------------------------------------
// Caméra live : ouvre un flux vidéo dans un <video> fourni par l'appelant.
// Retourne un contrôleur { stop } et remplit videoEl.
// ------------------------------------------------------------------
export async function startCameraStream(videoEl) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("L'accès caméra n'est pas disponible sur ce navigateur.");
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
  } catch (e) {
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
      throw new Error("Accès caméra refusé. Autorise la caméra dans les réglages Safari pour scanner.");
    }
    throw new Error("Impossible d'ouvrir la caméra.");
  }
  videoEl.srcObject = stream;
  videoEl.setAttribute('playsinline', 'true');
  videoEl.muted = true;
  try { await videoEl.play(); } catch (_) { /* iOS peut différer play(), on ignore */ }

  return {
    stop() {
      try { stream.getTracks().forEach((t) => t.stop()); } catch (_) { /* noop */ }
      try { videoEl.srcObject = null; } catch (_) { /* noop */ }
    },
  };
}

// Capture l'image courante d'un <video> en cours de lecture → Blob (image/jpeg).
export function captureFrame(videoEl) {
  return new Promise((resolve, reject) => {
    const w = videoEl.videoWidth;
    const h = videoEl.videoHeight;
    if (!w || !h) { reject(new Error("La caméra n'est pas encore prête, réessaie.")); return; }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(videoEl, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Capture de l'image impossible."));
    }, 'image/jpeg', 0.95);
  });
}

// Charge un Blob/File dans une <img> puis renvoie l'élément image chargé.
function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { resolve({ img, url }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });
}

// Dessine une image dans un canvas à une échelle donnée et renvoie l'ImageData.
function imageDataFrom(img, scale = 1) {
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

// Décode un code-barre à partir d'une image (File/Blob) déjà capturée.
// zbar localise et lit le code quel que soit son sens. On tente d'abord en
// pleine résolution ; si rien n'est trouvé, on retente une version réduite
// (utile quand l'image est très grande/bruitée). Retourne le texte décodé.
export async function decodeBarcodeFromFile(file) {
  const mod = await loadZbar();
  const { img, url } = await loadImage(file);
  try {
    // Échelles à essayer : pleine résolution, puis réduites si besoin.
    const longSide = Math.max(img.naturalWidth, img.naturalHeight);
    const scales = [1];
    if (longSide > 1600) scales.push(1600 / longSide); // réduit les très grandes images
    scales.push(0.6);                                   // dernier recours

    for (const scale of scales) {
      let symbols;
      try {
        const imageData = imageDataFrom(img, scale);
        symbols = await mod.scanImageData(imageData);
      } catch (_) { symbols = []; }
      if (symbols && symbols.length) {
        // Priorité aux symboles 1D produits (EAN/UPC) puis n'importe lequel
        const best = symbols.find((s) => /EAN|UPC|CODE/.test(s.typeName)) || symbols[0];
        const code = best.decode();
        if (code) return code;
      }
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  throw new Error("Aucun code-barre détecté sur la photo. Recadre le code bien à plat en remplissant le viseur, puis reprends une photo — ou saisis les chiffres manuellement.");
}
