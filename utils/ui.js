// OmniFit — Helpers UI partagés (modals, sheets, toasts, icônes SVG)
import { channel } from './gestures.js';
import { getViewDate, isViewingToday, setViewDate } from './nav.js';

const reducedMotion = () => !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICONS_LINE = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>',
  nutrition: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5a4.5 4.5 0 0 0-4.5 4.5"/><path d="M20.5 4 17 7.5"/></svg>',
  workout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01A1.7 1.7 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  steps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.5c1.8 0 3 2 3 4.6 0 2.2-.8 3.3-.8 4.9H5.8c0-1.6-.8-2.7-.8-4.9C5 5.5 6.2 3.5 8 3.5Z"/><path d="M5.9 15.5h4.2v1.2a2.1 2.1 0 0 1-4.2 0Z"/><path d="M16 7c1.8 0 3 2 3 4.6 0 2.2-.8 3.3-.8 4.9h-4.4c0-1.6-.8-2.7-.8-4.9C13 9 14.2 7 16 7Z"/><path d="M13.9 19h4.2v.2a2.1 2.1 0 0 1-4.2 0Z"/></svg>',
  water: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5Z"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/></svg>',
  barcode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="butt"><path d="M4 5v14" stroke-width="1.4"/><path d="M7 5v14" stroke-width="2.6"/><path d="M10 5v14" stroke-width="1.4"/><path d="M12.5 5v14" stroke-width="1.4"/><path d="M15 5v14" stroke-width="2.6"/><path d="M18 5v14" stroke-width="1.4"/><path d="M20 5v14" stroke-width="1.4"/></svg>',
  protein: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="13.5" rx="7.5" ry="6"/><path d="M12 7.5C12 5 14 3 16.5 3 15 4.5 15 7 15 7"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3m0 0L8 7m4-4 4 4M4 17v3h16v-3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5 10 18 19.5 6.5"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  drag: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 3.5v5h5"/><path d="M12 7.5V12l3 2"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H6a2 2 0 0 0-2 2Z"/><path d="M4 19.5A2 2 0 0 1 6 18h13v3H6a2 2 0 0 1-2-1.5Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
};

export const icons = { ...ICONS_LINE };

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// Bouton « ajouter » flottant d'un onglet, même place et même forme partout
// (comme celui de Nutrition). Posé dans body : dans le carrousel transformé,
// un élément fixe ne resterait pas fixe sur iOS. Visible via body[data-page].
export function pageFab(page, icon, label, onClick) {
  const id = `fab-page-${page}`;
  let wrap = document.getElementById(id);
  if (!wrap) {
    wrap = el(`<div class="fab-wrap" id="${id}" data-for="${page}"><button class="fab"></button></div>`);
    document.body.appendChild(wrap);
  }
  const btn = wrap.firstElementChild;
  btn.innerHTML = icon;
  btn.setAttribute('aria-label', label);
  btn.onclick = onClick;
}

// Échappe une chaîne destinée à être injectée en innerHTML. À utiliser pour
// TOUT texte venant de l'utilisateur ou d'une source externe : noms d'aliments,
// de recettes, d'exercices custom, notes de séance, produits Open Food Facts.
// Sans ça, une apostrophe ou un « < » casse le rendu de la carte.
// Couvre aussi les guillemets, car ces valeurs servent parfois d'attribut.
export function esc(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function haptic() {
  if (navigator.vibrate) navigator.vibrate(10);
}

// Animation de récompense : jouée quand une quête journalière est validée et
// rapporte des LP (objectif calorique atteint, séance enregistrée…). Des orbes
// cyan/violet jaillissent du bouton pressé puis retombent.
// `originEl` = l'élément à partir duquel émettre (le bouton). `opts.label`
// affiche un « +N LP » flottant.
export function celebrateLP(originEl, opts = {}) {
  try {
    if (typeof document === 'undefined') return;
    const rect = originEl && originEl.getBoundingClientRect
      ? originEl.getBoundingClientRect()
      : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;

    let layer = document.getElementById('lp-fx-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'lp-fx-layer';
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden';
      document.body.appendChild(layer);
    }

    const canAnimate = typeof Element !== 'undefined' && Element.prototype.animate;
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      const c = i % 2 ? 'var(--accent)' : 'var(--accent-2)';
      const size = 8 + Math.round(Math.random() * 8);
      p.style.cssText = `position:absolute;left:${ox}px;top:${oy}px;width:${size}px;height:${size}px;border-radius:50%;background:${c};box-shadow:0 0 10px ${c};transform:translate(-50%,-50%);will-change:transform,opacity`;
      layer.appendChild(p);

      // Trajectoire : vers le haut et sur les côtés, avec un peu de gravité.
      const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 2.4;
      const dist = 130 + Math.random() * 120;
      const dx = Math.cos(angle) * dist;
      const dyUp = Math.sin(angle) * dist;
      const spin = (Math.random() - 0.5) * 720;

      if (canAnimate) {
        const anim = p.animate(
          [
            { transform: 'translate(-50%,-50%) translate(0px,0px) rotate(0deg) scale(1)', opacity: 1 },
            { transform: `translate(-50%,-50%) translate(${dx * 0.6}px, ${dyUp}px) rotate(${spin * 0.6}deg) scale(1.05)`, opacity: 1, offset: 0.6 },
            { transform: `translate(-50%,-50%) translate(${dx}px, ${dyUp + 90}px) rotate(${spin}deg) scale(0.4)`, opacity: 0 },
          ],
          { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(0.4,0,0.6,1)', fill: 'forwards' },
        );
        anim.onfinish = () => p.remove();
      } else {
        p.remove();
      }
    }

    // « +N LP » flottant
    if (opts.label) {
      const tag = document.createElement('div');
      tag.textContent = opts.label;
      tag.style.cssText = `position:absolute;left:${ox}px;top:${oy}px;transform:translate(-50%,-50%);font-weight:800;font-size:1rem;color:var(--accent);text-shadow:0 0 8px rgba(0,0,0,0.4);will-change:transform,opacity`;
      layer.appendChild(tag);
      if (canAnimate) {
        const a = tag.animate(
          [
            { transform: 'translate(-50%,-50%) translateY(0) scale(0.8)', opacity: 0 },
            { transform: 'translate(-50%,-50%) translateY(-18px) scale(1.1)', opacity: 1, offset: 0.3 },
            { transform: 'translate(-50%,-50%) translateY(-52px) scale(1)', opacity: 0 },
          ],
          { duration: 1100, easing: 'ease-out', fill: 'forwards' },
        );
        a.onfinish = () => tag.remove();
      } else { tag.remove(); }
    }

    haptic();
  } catch (_) { /* l'animation ne doit jamais casser l'action */ }
}

let audioCtx = null;
export function beep(freq = 880, duration = 0.12) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) { /* silencieux */ }
}

// ---------- Toast ----------
export function toast(message, type = 'info') {
  const t = el(`<div class="toast toast-${type}">${message}</div>`);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => {
    t.classList.remove('visible');
    setTimeout(() => t.remove(), 300);
  }, 2400);
}

// Les panneaux peuvent s'empiler (une feuille par-dessus une fenêtre, par ex.
// le choix des muscles au-dessus de l'éditeur d'exercice). Fermer celui du
// dessus ne doit donc pas rendre son défilement à la page tant qu'il en reste
// un ouvert dessous.
function releaseOverlayLock() {
  if (!document.querySelector('.scrim, .picker-overlay')) {
    document.body.classList.remove('overlay-open');
  }
}

// ---------- Fenêtres ----------
// Il n'y a plus de fenêtre centrée avec une croix : toutes les fenêtres sont
// des panneaux qui montent du bas et se referment en glissant vers le bas,
// comme les autres menus de l'app. `openModal` garde sa signature (titre,
// contenu, boutons d'action) ; les actions forment une barre fixe en bas du
// panneau, toujours accessible même quand le contenu défile.
export function openModal({ title, content, actions = [], onClose = null, headerAction = null }) {
  const sh = openSheet({ title, content, onClose, headerAction, variant: 'modal' });
  if (actions.length) {
    const bar = el('<div class="modal-actions"></div>');
    for (const a of actions) {
      const btn = el(`<button class="btn ${a.variant || 'btn-secondary'}">${a.label}</button>`);
      btn.addEventListener('click', () => {
        const keep = a.onClick ? a.onClick(sh.body, sh.close) : null;
        if (keep !== 'keep') sh.close();
      });
      bar.appendChild(btn);
    }
    sh.sheet.appendChild(bar);
  }
  return { close: sh.close, body: sh.body, setTitle: sh.setTitle };
}

export function confirmModal(title, message, onConfirm, danger = false) {
  openModal({
    title,
    content: `<p class="confirm-text">${message}</p>`,
    actions: [
      { label: 'Annuler', variant: 'btn-secondary' },
      { label: 'Confirmer', variant: danger ? 'btn-danger' : 'btn-primary', onClick: () => onConfirm() },
    ],
  });
}

// Ferme d'un coup toutes les fenêtres et panneaux ouverts.
// Utile avant d'ouvrir un écran plein comme le mode séance : celui-ci passe
// SOUS les panneaux (z-index inférieur), et l'utilisateur devrait sinon fermer
// à la main la fiche ou la fenêtre depuis laquelle il vient.
// Ferme un écran plein écran (calendrier complet, choix d'exercice) en le
// faisant redescendre, comme les panneaux.
export function slideAway(overlay, done) {
  const end = () => { overlay.remove(); if (done) done(); };
  if (reducedMotion()) { end(); return; }
  overlay.classList.add('leaving');
  setTimeout(end, 240);
}

// Chiffres et anneaux qui changent d'un rendu à l'autre : au lieu de sauter
// à la nouvelle valeur, les chiffres défilent (compteur très rapide) et les
// anneaux se remplissent ou se vident, toujours en 0,6 s.
//   [data-tw="clé"]      : élément dont le texte est un nombre entier
//   [data-tw-ring="clé"] : conteneur d'un anneau (ringSVG)
const twPrev = new Map();
const TW_MS = 600;
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
function countTo(node, from, to) {
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / TW_MS);
    node.textContent = String(Math.round(from + (to - from) * easeOutCubic(k)));
    if (k < 1 && node.isConnected) window.requestAnimationFrame(step);
  };
  node.textContent = String(from);
  window.requestAnimationFrame(step);
}
export function tweenValues(root) {
  const still = reducedMotion();
  root.querySelectorAll('[data-tw]').forEach((n) => {
    const key = n.dataset.tw;
    const to = parseInt(n.textContent, 10);
    if (Number.isNaN(to)) return;
    const from = twPrev.get(key);
    twPrev.set(key, to);
    if (!still && from != null && from !== to) countTo(n, from, to);
  });
  root.querySelectorAll('[data-tw-ring]').forEach((w) => {
    const key = w.dataset.twRing;
    const fg = w.querySelector('.ring-fg');
    const label = w.querySelector('.ring-label');
    if (!fg) return;
    const to = parseFloat(fg.getAttribute('stroke-dashoffset'));
    const prev = twPrev.get(key);
    twPrev.set(key, to);
    const lTo = label ? parseInt(label.textContent, 10) : NaN;
    const lPrev = twPrev.get(key + ':l');
    if (!Number.isNaN(lTo)) twPrev.set(key + ':l', lTo);
    if (still || prev == null) return;
    if (Math.abs(prev - to) > 0.5) {
      fg.style.transition = 'none';
      fg.style.strokeDashoffset = `${prev}px`;
      void window.getComputedStyle(fg).strokeDashoffset; // fige le point de départ
      fg.style.transition = '';
      fg.style.strokeDashoffset = `${to}px`;
    }
    if (label && lPrev != null && !Number.isNaN(lTo) && lPrev !== lTo) countTo(label, lPrev, lTo);
  });
}

export function closeAllOverlays() {
  // `.picker-overlay` (navigateur d'exercices, calendrier complet) compte aussi :
  // il est en z-index 150 et recouvrirait la séance, qui est en 90.
  document.querySelectorAll('.scrim, .picker-overlay').forEach((s) => s.remove());
  document.body.classList.remove('overlay-open');
}

// ---------- Bottom Sheet ----------
// headerAction (facultatif) : { icon, label, onClick } -> bouton en haut à droite.
// Une liste est « en haut » quand on ne peut plus la faire défiler vers le
// haut. En column-reverse (historiques ouverts sur le mois en cours), le
// défilement part du bas : scrollTop vaut 0 en bas et devient négatif en montant.
function atTop(s) {
  if (s.scrollHeight - s.clientHeight <= 1) return true;
  if (window.getComputedStyle(s).flexDirection === 'column-reverse') return -s.scrollTop >= s.scrollHeight - s.clientHeight - 1;
  return s.scrollTop <= 0;
}

export function openSheet({ title, content, onClose = null, headerAction = null, variant = '' }) {
  document.body.classList.add('overlay-open');
  const t = esc(title); // texte brut chez tous les appelants (cf. openModal)
  const scrim = el(`
    <div class="scrim sheet-scrim">
      <div class="sheet${variant ? ` ${variant}` : ''}" role="dialog" aria-modal="true" aria-label="${t}">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <h3>${t}</h3>
          ${headerAction ? `<button class="icon-btn sheet-action" aria-label="${esc(headerAction.label || 'Action')}">${headerAction.icon}</button>` : ''}
        </div>
        <div class="sheet-body"></div>
      </div>
    </div>`);
  const body = scrim.querySelector('.sheet-body');
  if (typeof content === 'string') body.innerHTML = content;
  else body.appendChild(content);

  const sheet = scrim.querySelector('.sheet');
  // Contenu qui change de taille (mode d'un réglage, section qui apparaît) :
  // la hauteur du panneau suit en gelée (ressort qui rebondit) au lieu de sauter.
  if (window.ResizeObserver) {
    let lastH = 0; let run = 0;
    const hCh = channel((h) => { sheet.style.height = `${h}px`; });
    new ResizeObserver(() => {
      const from = run ? hCh.x : lastH;
      sheet.style.height = '';
      const to = sheet.offsetHeight;
      lastH = to;
      if (!from || Math.abs(to - from) < 2 || !scrim.classList.contains('visible') || reducedMotion()) return;
      const id = ++run;
      sheet.style.height = `${from}px`;
      hCh.jump(from);
      hCh.to(to, { duration: 0.5, bounce: 0.3 }).then(() => { if (run === id) { run = 0; sheet.style.height = ''; } });
    }).observe(body.firstElementChild || body);
  }
  let closed = false;
  const close = () => {
    if (closed) return; // déjà fermé (clic sur le fond après une action, etc.)
    closed = true;
    scrim.classList.remove('visible');
    setTimeout(() => { scrim.remove(); releaseOverlayLock(); }, 210);
    if (onClose) onClose();
  };
  scrim._close = close; // pour la touche Échap
  // Le titre peut changer sans rouvrir le panneau (renommage d'un exercice
  // depuis la fiche restée ouverte).
  const setTitle = (txt) => { sheet.querySelector('.sheet-header h3').textContent = txt; };
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });

  if (headerAction) {
    sheet.querySelector('.sheet-action').addEventListener('click', () => headerAction.onClick({ close }));
  }

  // ---- Swipe-down pour fermer : le panneau SUIT LE DOIGT ----
  // Le geste ne démarre que si le contenu est déjà en haut (scrollTop <= 0),
  // sinon on laisse le scroll interne faire son travail. Au relâchement : si on
  // a dépassé la moitié de la hauteur du panneau, il finit de se fermer ;
  // sinon il revient en place.
  let startY = null; let dy = 0; let dragging = false;
  let activeScroller = null;
  let lastY = 0; let lastT = 0; let velocity = 0; // px/ms, pour l'inertie
  const setY = (px) => { sheet.style.transform = `translate3d(0, ${px}px, 0)`; };

  // Remonte de `node` jusqu'à la sheet pour trouver le conteneur qui défile
  // réellement sous le doigt. Une sheet peut contenir ses propres listes à
  // hauteur fixe (liste d'aliments, de recettes) : c'est leur scrollTop qui
  // compte, pas celui du panneau.
  const scrollerFor = (node) => {
    let n = node;
    while (n && n !== sheet.parentElement) {
      if (n.scrollHeight - n.clientHeight > 1) {
        const oy = getComputedStyle(n).overflowY;
        if (oy === 'auto' || oy === 'scroll') return n;
      }
      if (n === sheet) break;
      n = n.parentElement;
    }
    return sheet;
  };

  sheet.addEventListener('touchstart', (e) => {
    // Un geste qui démarre sur un champ de saisie (textarea/input/zone éditable)
    // ne doit PAS être capté par le glisser-pour-fermer : sinon l'appui long et
    // le menu « Coller » d'iOS sont bloqués.
    if (e.target.closest('textarea, input, [contenteditable="true"], .no-sheet-drag')) { startY = null; return; }
    activeScroller = scrollerFor(e.target);
    // Si la zone touchée est déjà défilée, le geste lui appartient : on ne
    // capte pas le glisser-pour-fermer, sinon remonter dans une liste interne
    // (recettes, aliments) referme le panneau au lieu de la faire défiler.
    if (!atTop(activeScroller)) { startY = null; return; }
    startY = e.touches[0].clientY; dy = 0; dragging = false;
    lastY = startY; lastT = e.timeStamp || Date.now(); velocity = 0;
  }, { passive: true });

  sheet.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    const y = e.touches[0].clientY;
    dy = y - startY;
    // Vitesse instantanée lissée (px/ms). Le lissage évite qu'une micro-pause
    // juste avant le relâchement n'annule tout l'élan du geste.
    const t = e.timeStamp || Date.now();
    const dt = t - lastT;
    if (dt > 0) {
      const v = (y - lastY) / dt;
      velocity = velocity * 0.6 + v * 0.4;
      lastY = y; lastT = t;
    }
    if (dy <= 0) { // remontée : on ne déplace pas, on laisse le scroll reprendre
      if (dragging) { sheet.style.transition = ''; setY(0); dragging = false; }
      return;
    }
    // La liste interne a pu défiler entre-temps (doigt remonté puis redescendu) :
    // on lui rend la main plutôt que de fermer le panneau.
    if (!dragging && activeScroller && !atTop(activeScroller)) { startY = null; return; }
    if (!dragging) {
      if (dy < 6) return;      // petit seuil pour ne pas gêner les taps
      dragging = true;
      sheet.style.transition = 'none'; // suivi immédiat du doigt
    }
    e.preventDefault();        // empêche le rebond de la page pendant le glissement
    setY(dy);
  }, { passive: false });

  // Inertie : on ne décide pas sur la distance parcourue, mais sur la position
  // PROJETÉE si le doigt continuait sur sa lancée. Un geste vif referme donc
  // sur une courte distance, tandis qu'un geste lent doit descendre plus bas.
  // PROJECTION_MS = durée d'élan simulée après le relâchement.
  const PROJECTION_MS = 180;
  const endDrag = () => {
    if (startY == null) { return; }
    const wasDragging = dragging;
    startY = null; dragging = false;
    if (!wasDragging) return;
    sheet.style.transition = 'transform 130ms var(--ease)';
    const projected = dy + Math.max(0, velocity) * PROJECTION_MS;
    if (projected > sheet.offsetHeight / 3) {
      // Le geste (élan compris) dépasse le tiers : on termine la fermeture
      setY(sheet.offsetHeight);
      setTimeout(close, 110);
    } else {
      setY(0); // retour en place, le panneau reste ouvert
      setTimeout(() => { sheet.style.transition = ''; sheet.style.transform = ''; }, 150);
    }
  };
  sheet.addEventListener('touchend', endDrag, { passive: true });
  sheet.addEventListener('touchcancel', endDrag, { passive: true });

  document.body.appendChild(scrim);
  requestAnimationFrame(() => scrim.classList.add('visible'));
  return { close, body, setTitle, sheet };
}

// Échap ferme le panneau du dessus (clavier, lecteurs d'écran).
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const top = [...document.querySelectorAll('.scrim')].pop();
    if (top && top._close) top._close();
  });
}

// Normalise une chaîne pour la recherche : minuscules, sans accents ni signes
// diacritiques. Permet de trouver « Phở bò » en tapant « pho », ou « Petit-
// Déjeuner » en tapant « dejeuner ». NFD sépare la lettre de son accent, que
// l'on retire ensuite.
export function normalizeStr(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ---------- Glisser pour supprimer ----------
// Moteur commun (élastique, suppression au glisser complet) : utils/gestures.js.
// L'import charge aussi les sélecteurs segmentés élastiques, partout.
export { attachSwipeToDelete } from './gestures.js';

// ---------- Graphiques ----------
// Crée un graphique en détruisant systématiquement l'instance précédente (sinon
// Chart.js garde le canvas et ses écouteurs en mémoire à chaque re-rendu).
// Chart.js est servi par un CDN : s'il n'a pas pu être chargé (premier lancement
// hors ligne), on affiche un repli discret au lieu de laisser l'exception
// remonter et casser le rendu de TOUTE la page.
export function makeChart(canvas, config, previous = null) {
  if (previous && typeof previous.destroy === 'function') {
    try { previous.destroy(); } catch (_) { /* instance déjà morte */ }
  }
  if (!canvas) return null;
  const Ctor = typeof Chart !== 'undefined' ? Chart : null;
  if (!Ctor) {
    const wrap = canvas.parentElement;
    if (wrap) wrap.innerHTML = '<div class="empty-state">Graphique indisponible hors ligne</div>';
    return null;
  }
  try { return new Ctor(canvas, config); } catch (_) { return null; }
}

// ---------- Anneau SVG de progression ----------
let _ringUid = 0;
export function ringSVG({ size = 72, stroke = 7, progress = 0, color = 'var(--accent)', label = '', sub = '', gradient = false }) {
  const uid = 'r' + (++_ringUid);
  const r = (size - stroke) / 2;
  const cx = size / 2; const cy = size / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, progress);
  const base = Math.min(1, p);
  const off = c * (1 - base);
  const stroking = gradient ? `url(#grad-${uid})` : color;

  // Arc de dépassement (au-delà de 100 %) : rayures claires sur la superposition
  let overshoot = '';
  if (p > 1) {
    const fo = Math.min(1, p - 1);
    const a0 = -Math.PI / 2;
    const a1 = a0 + fo * 2 * Math.PI;
    const x0 = cx + r * Math.cos(a0); const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1); const y1 = cy + r * Math.sin(a1);
    const largeArc = fo > 0.5 ? 1 : 0;
    overshoot = `<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="var(--text)" stroke-width="${stroke}" stroke-linecap="butt" stroke-dasharray="2 3"/>`;
  }

  return `
    <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label} ${Math.round(p * 100)}%">
      ${gradient ? `<defs><linearGradient id="grad-${uid}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="var(--grad-a)"/><stop offset="100%" stop-color="var(--grad-b)"/></linearGradient></defs>` : ''}
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(var(--accent-rgb), 0.14)" stroke-width="${stroke}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroking}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
        transform="rotate(-90 ${cx} ${cy})" class="ring-fg"/>
      ${overshoot}
      <text x="50%" y="${sub ? '46%' : '52%'}" text-anchor="middle" dominant-baseline="middle" class="ring-label">${label}</text>
      ${sub ? `<text x="50%" y="64%" text-anchor="middle" dominant-baseline="middle" class="ring-sub">${sub}</text>` : ''}
    </svg>`;
}

export function fmtDateShort(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
}

// Date complète en français : « 3 août 2026 ». Format retenu partout où une
// date est affichée telle quelle (au lieu du brut « 2026-08-03 »).
export function fmtDateFull(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return String(iso);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtDateLong(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---------- Jour consulté : en-tête de date et calendrier, communs aux onglets ----------
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const CARET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const ARROW_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';

export function dayLabel(iso) {
  const t = new Date();
  if (iso === isoLocal(t)) return 'Aujourd\'hui';
  t.setDate(t.getDate() - 1);
  if (iso === isoLocal(t)) return 'Hier';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (y !== new Date().getFullYear()) opts.year = 'numeric';
  return cap(dt.toLocaleDateString('fr-FR', opts));
}

// En-tête d'onglet : le jour consulté (touche → calendrier) et, sur un autre
// jour, un bouton pour revenir à aujourd'hui. Le h1 reste pour les lecteurs
// d'écran. mark(iso) → '' | 'on' | 'ok' | 'bad' : point sous le jour dans le
// calendrier, propre à chaque onglet (repas saisis, séance, objectif de pas).
// Sept jours autour du jour consulté (jamais dans le futur) : le jour choisi
// est plein, un point marque les jours renseignés.
function weekStrip(sel, mark) {
  const today = isoLocal(new Date());
  const end = new Date(sel + 'T12:00:00');
  end.setDate(end.getDate() + 3);
  const last = isoLocal(end) > today ? new Date(today + 'T12:00:00') : end;
  let html = '';
  for (let i = 6; i >= 0; i--) {
    const d = new Date(last); d.setDate(last.getDate() - i);
    const iso = isoLocal(d);
    const k = mark ? mark(iso) : '';
    html += `<button type="button" class="wk-day${iso === sel ? ' sel' : ''}" data-date="${iso}" aria-label="${fmtDateLong(iso)}" ${iso === sel ? 'aria-current="date"' : ''}>
      <b class="num">${d.getDate()}</b><span>${d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</span>${k ? `<i class="dp-mark ${k}"></i>` : ''}
    </button>`;
  }
  return html;
}

// ---------- Périodes des graphiques (comme l'app Santé) ----------
// kind : 'week' (lundi à dimanche), 'month', '6m', 'year' ; offset 0 = période
// en cours, 1 = la précédente, etc. Renvoie { start, end, days[], label }.
const MONTH_FMT = { month: 'short' };
export function periodRange(kind, offset = 0) {
  const t = new Date(); t.setHours(12, 0, 0, 0);
  let s; let e;
  // Semaine et mois glissants : 7 ou 30 jours qui finissent aujourd'hui
  // (offset 0), sans caler sur le lundi ni sur le 1er du mois.
  if (kind === 'week' || kind === 'month') {
    const n = kind === 'week' ? 7 : 30;
    e = new Date(t); e.setDate(t.getDate() - n * offset);
    s = new Date(e); s.setDate(e.getDate() - n + 1);
  } else if (kind === '6m') {
    s = new Date(t.getFullYear(), t.getMonth() - 5 - 6 * offset, 1, 12);
    e = new Date(t.getFullYear(), t.getMonth() - 6 * offset + 1, 0, 12);
  } else {
    s = new Date(t.getFullYear() - offset, 0, 1, 12);
    e = new Date(t.getFullYear() - offset, 11, 31, 12);
  }
  const days = [];
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) days.push(isoLocal(d));
  const y = e.getFullYear();
  const label = kind === 'week' || kind === 'month'
    ? `${s.getDate()} ${s.getMonth() !== e.getMonth() ? s.toLocaleDateString('fr-FR', MONTH_FMT) + ' ' : ''}au ${e.getDate()} ${e.toLocaleDateString('fr-FR', MONTH_FMT)} ${y}`
    : kind === '6m' ? `${cap(s.toLocaleDateString('fr-FR', MONTH_FMT))} à ${e.toLocaleDateString('fr-FR', MONTH_FMT)} ${y}`
        : String(y);
  return { start: days[0], end: days[days.length - 1], days, label };
}

// En-tête d'un graphique : flèches, valeur moyenne de la période, dates.
export function periodHead(range, avgHtml, offset) {
  return `<div class="period-head">
    <button type="button" class="icon-btn per-prev" aria-label="Période précédente">${ARROW_L}</button>
    <div class="per-mid">${avgHtml}<span class="per-label">${range.label}</span></div>
    <button type="button" class="icon-btn per-next" aria-label="Période suivante" ${offset > 0 ? '' : 'disabled'}>${icons.chevron}</button>
  </div>`;
}

// Glisser horizontalement sur un graphique change de période (vers la droite =
// période précédente), comme dans l'app Santé. step(+1) = plus ancienne.
export function attachPeriodSwipe(zone, step) {
  zone.classList.add('no-swipe');
  let x0 = null; let y0 = 0;
  zone.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  zone.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - x0; const dy = p.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx > 0 ? 1 : -1);
  }, { passive: true });
}

// Arrivée de la nouvelle période du côté d'où elle vient.
export function slideIn(node, dir) {
  if (!node || !node.animate || reducedMotion() || !dir) return;
  node.animate([{ transform: `translateX(${-dir * 40}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
    { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)' });
}

export function dateBar({ title, mark = null, onChange }) {
  const iso = getViewDate();
  const bar = el(`<div class="date-bar">
    <h1 class="sr-only">${esc(title)}</h1>
    <button type="button" class="date-pick" aria-haspopup="dialog" aria-expanded="false">
      <span>${dayLabel(iso)}</span>${icons.calendar}
    </button>
    ${isViewingToday() ? '' : `<button type="button" class="btn btn-secondary btn-sm date-back">${ARROW_L} Aujourd'hui</button>`}
    <div class="week-strip no-swipe">${weekStrip(iso, mark)}</div>
  </div>`);
  const pick = bar.querySelector('.date-pick');
  const change = (d) => { if (setViewDate(d)) { haptic(); onChange(); } };
  pick.addEventListener('click', () => openDayPicker(pick, { mark, onPick: change }));
  const back = bar.querySelector('.date-back');
  if (back) back.addEventListener('click', () => change(null));
  bar.querySelector('.week-strip').addEventListener('click', (e) => {
    const b = e.target.closest('.wk-day');
    if (b) change(b.dataset.date);
  });
  return bar;
}

export function openDayPicker(anchor, { mark = null, onPick }) {
  const today = isoLocal(new Date());
  const sel = getViewDate();
  let [y, m] = sel.split('-').map(Number); m -= 1;
  const [ty, tm] = today.split('-').map(Number);

  document.body.classList.add('overlay-open');
  const scrim = el(`<div class="scrim day-scrim">
    <div class="day-pop" role="dialog" aria-modal="true" aria-label="Choisir un jour">
      <div class="dp-head">
        <span class="dp-title" aria-live="polite"></span>
        <button type="button" class="icon-btn dp-prev" aria-label="Mois précédent">${ARROW_L}</button>
        <button type="button" class="icon-btn dp-next" aria-label="Mois suivant">${icons.chevron}</button>
      </div>
      <div class="dp-wd" aria-hidden="true">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="dp-grid"></div>
    </div>
  </div>`);
  const pop = scrim.querySelector('.day-pop');
  const grid = scrim.querySelector('.dp-grid');
  const r = anchor.getBoundingClientRect();
  pop.style.top = `${Math.round(r.bottom + 8)}px`;

  const draw = () => {
    const first = new Date(y, m, 1);
    scrim.querySelector('.dp-title').textContent = cap(first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
    scrim.querySelector('.dp-next').disabled = y > ty || (y === ty && m >= tm - 1);
    const offset = (first.getDay() + 6) % 7; // semaine commençant lundi
    const n = new Date(y, m + 1, 0).getDate();
    let html = '<span></span>'.repeat(offset);
    for (let d = 1; d <= n; d++) {
      const iso = isoLocal(new Date(y, m, d));
      const k = mark && iso <= today ? mark(iso) : '';
      const cls = `dp-day${iso === sel ? ' sel' : ''}${iso === today ? ' today' : ''}`;
      html += `<button type="button" class="${cls}" data-date="${iso}" ${iso > today ? 'disabled' : ''}
        aria-label="${fmtDateLong(iso)}" ${iso === sel ? 'aria-current="date"' : ''}>${d}${k ? `<i class="dp-mark ${k}"></i>` : ''}</button>`;
    }
    grid.innerHTML = html;
  };
  draw();

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    anchor.setAttribute('aria-expanded', 'false');
    scrim.classList.remove('visible');
    setTimeout(() => { scrim.remove(); releaseOverlayLock(); anchor.focus({ preventScroll: true }); }, 200);
  };
  scrim._close = close; // touche Échap
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) { close(); return; }
    if (e.target.closest('.dp-prev')) { m--; if (m < 0) { m = 11; y--; } draw(); return; }
    if (e.target.closest('.dp-next')) { m++; if (m > 11) { m = 0; y++; } draw(); return; }
    const b = e.target.closest('.dp-day');
    if (!b || b.disabled) return;
    close();
    onPick(b.dataset.date);
  });
  document.body.appendChild(scrim);
  anchor.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => {
    scrim.classList.add('visible');
    (grid.querySelector('.dp-day.sel') || grid.querySelector('.dp-day')).focus({ preventScroll: true });
  });
  return { close };
}

// Ouvre ou ferme une section repliable (.card > .collapse-body) en animant sa
// vraie hauteur : partir d'un plafond de 1600 px laissait l'animation à l'arrêt
// pendant un moment, puis la refermait d'un coup.
export function setCollapsed(card, collapsed) {
  const body = card.querySelector('.collapse-body');
  if (!body || reducedMotion()) { card.classList.toggle('collapsed', collapsed); return; }
  body.style.maxHeight = `${body.offsetHeight}px`; // hauteur visible de départ
  void body.offsetHeight;
  card.classList.toggle('collapsed', collapsed);
  body.style.maxHeight = collapsed ? '0px' : `${body.scrollHeight}px`;
  body.addEventListener('transitionend', () => {
    // Ouverte : on rend la main au CSS, le contenu peut encore changer de taille
    if (!card.classList.contains('collapsed')) body.style.maxHeight = '';
  }, { once: true });
}
