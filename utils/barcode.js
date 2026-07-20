// OmniFit — utils/barcode.js
// Scan de codes-barres (EAN-13, etc.) via html5-qrcode (CDN), en Vanilla JS pur.
// Module séparé de l'appel API et de l'UI : ne s'occupe QUE de la capture/détection.
//
// Choix technique : CAMÉRA EN DIRECT DANS L'APPLICATION (getUserMedia), avec un
// bouton « pause » qui fige une image (comme prendre une photo), qu'on analyse
// ensuite. On ne quitte jamais l'app vers l'appareil photo natif. Le décodage
// tente plusieurs orientations (0/90/180/270°) pour lire le code quel que soit
// le sens de la photo.

const CDN_URL = 'https://unpkg.com/html5-qrcode';

let loadPromise = null;

// Charge html5-qrcode depuis le CDN une seule fois (mis en cache ensuite).
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
    }, 'image/jpeg', 0.92);
  });
}

// Fait pivoter un Blob image de `deg` degrés → nouveau Blob (pour tenter
// plusieurs orientations de lecture).
function rotateBlob(blob, deg) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const swap = deg === 90 || deg === 270;
      canvas.width = swap ? img.height : img.width;
      canvas.height = swap ? img.width : img.height;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      URL.revokeObjectURL(url);
      canvas.toBlob((out) => { out ? resolve(out) : reject(new Error('Rotation impossible')); }, 'image/jpeg', 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });
}

// Décode via html5-qrcode une image (File/Blob) statique. Renvoie le code ou lève.
async function scanOnce(fileOrBlob) {
  let host = document.getElementById('bc-scanfile-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'bc-scanfile-host';
    host.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none';
    document.body.appendChild(host);
  }
  const html5QrCode = new window.Html5Qrcode('bc-scanfile-host', { verbose: false });
  return html5QrCode.scanFile(fileOrBlob, false);
}

// Décode un code-barre à partir d'une image (File/Blob) déjà capturée.
// Essaie l'image telle quelle puis pivotée (90/180/270°) pour être robuste au
// sens de la photo. Retourne le texte décodé, ou lève une erreur explicite.
export async function decodeBarcodeFromFile(file) {
  try {
    await loadHtml5Qrcode();
  } catch (e) {
    throw new Error(e.message || 'Chargement de la librairie de scan impossible');
  }
  // 1) tentative directe
  try { return await scanOnce(file); } catch (_) { /* on tente les rotations */ }
  // 2) rotations successives
  for (const deg of [90, 180, 270]) {
    try {
      const rotated = await rotateBlob(file, deg);
      return await scanOnce(rotated);
    } catch (_) { /* suivant */ }
  }
  throw new Error("Aucun code-barre détecté sur la photo. Recadre le code bien à plat, remplis l'écran, puis reprends une photo — ou saisis les chiffres manuellement.");
}
