import { ICONS_PIXEL as PIXEL_ICONS } from './pixelArt.js';
// OmniFit — Helpers UI partagés (modals, sheets, toasts, icônes SVG)

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
  steps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3c2 0 3 1.7 3 4s-1 4-2.5 4S6 9.3 6 7s.5-4 2-4ZM7 14.5c1.5 0 2.5 1 2.5 2.5S8.5 20 7.5 20 5 19 5 17.5 5.5 14.5 7 14.5ZM16 6c1.5 0 2 1.7 2 4s-1 4-2.5 4-2.5-1.7-2.5-4 1-4 3-4ZM16.5 17.5c1.5 0 2.5 1 2.5 2.5" transform="translate(0,-1)"/></svg>',
  water: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5Z"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c4.4 0 7-2.8 7-6.5 0-4-3-6.5-4.5-9C13 4 13 2 13 2s-6 4-6 9c-1-1-1.5-2.5-1.5-2.5C4 10.5 5 22 12 22Z"/></svg>',
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

// `icons` est un objet MUTABLE : le thème 8-bit remplace son contenu par le jeu
// pixel-art. Les modules l'importent une fois et lisent ses propriétés au moment
// du rendu, donc la bascule s'applique partout au prochain rendu.
export const icons = { ...ICONS_LINE };

export function setIconSet(mode) {
  const src = mode === '8bit' ? PIXEL_ICONS : ICONS_LINE;
  for (const k of Object.keys(icons)) delete icons[k];
  Object.assign(icons, src);
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
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
// rapporte des LP (objectif calorique atteint, séance enregistrée…). Des
// particules jaillissent du bouton pressé vers l'extérieur de l'écran.
//   - Thème 8-bit : pièces pixel qui montent en tournoyant (façon jeu rétro).
//   - Autres thèmes : orbes lumineuses cyan/violet qui éclatent puis retombent.
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
    const is8bit = document.body.classList.contains('shape-8bit');

    let layer = document.getElementById('lp-fx-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'lp-fx-layer';
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden';
      document.body.appendChild(layer);
    }

    const canAnimate = typeof Element !== 'undefined' && Element.prototype.animate;
    const N = is8bit ? 7 : 12;

    for (let i = 0; i < N; i++) {
      const p = document.createElement('div');
      if (is8bit) {
        // Pièce pixel : petit carré doré avec un « ¢ » façon sprite de jeu.
        p.textContent = '¢';
        p.style.cssText = `position:absolute;left:${ox}px;top:${oy}px;width:16px;height:16px;line-height:16px;text-align:center;font-family:'VT323',monospace;font-weight:700;font-size:15px;color:#ffd479;background:#8a5a00;border:1px solid #ffd479;image-rendering:pixelated;transform:translate(-50%,-50%);will-change:transform,opacity`;
      } else {
        // Orbe lumineuse : dégradé accent → violet, halo.
        const c = i % 2 ? 'var(--accent)' : 'var(--accent-2)';
        const size = 8 + Math.round(Math.random() * 8);
        p.style.cssText = `position:absolute;left:${ox}px;top:${oy}px;width:${size}px;height:${size}px;border-radius:50%;background:${c};box-shadow:0 0 10px ${c};transform:translate(-50%,-50%);will-change:transform,opacity`;
      }
      layer.appendChild(p);

      // Trajectoire : vers le haut et sur les côtés, avec un peu de gravité.
      const angle = (-Math.PI / 2) + (Math.random() - 0.5) * (is8bit ? 1.1 : 2.4);
      const dist = (is8bit ? 220 : 130) + Math.random() * (is8bit ? 260 : 120);
      const dx = Math.cos(angle) * dist;
      const dyUp = Math.sin(angle) * dist;
      const dur = is8bit ? 900 + Math.random() * 400 : 700 + Math.random() * 400;
      const spin = (Math.random() - 0.5) * 720;

      if (canAnimate) {
        const anim = p.animate(
          [
            { transform: 'translate(-50%,-50%) translate(0px,0px) rotate(0deg) scale(1)', opacity: 1 },
            { transform: `translate(-50%,-50%) translate(${dx * 0.6}px, ${dyUp}px) rotate(${spin * 0.6}deg) scale(1.05)`, opacity: 1, offset: 0.6 },
            { transform: `translate(-50%,-50%) translate(${dx}px, ${dyUp + (is8bit ? -80 : 90)}px) rotate(${spin}deg) scale(${is8bit ? 0.9 : 0.4})`, opacity: 0 },
          ],
          { duration: dur, easing: is8bit ? 'cubic-bezier(0.22,1,0.36,1)' : 'cubic-bezier(0.4,0,0.6,1)', fill: 'forwards' },
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
      tag.style.cssText = `position:absolute;left:${ox}px;top:${oy}px;transform:translate(-50%,-50%);font-weight:800;font-size:1rem;color:${is8bit ? '#ffd479' : 'var(--accent)'};text-shadow:0 0 8px rgba(0,0,0,0.4);${is8bit ? "font-family:'VT323',monospace;" : ''}will-change:transform,opacity`;
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

// ---------- Modal ----------
export function openModal({ title, content, actions = [], onClose = null, wide = false }) {
  document.body.classList.add('overlay-open');
  // Le titre est du texte brut chez tous les appelants (nom d'exercice, de
  // recette, date…) : on l'échappe ici plutôt qu'à chaque site d'appel.
  const t = esc(title);
  const scrim = el(`
    <div class="scrim">
      <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${t}">
        <div class="modal-header">
          <h3>${t}</h3>
          <button class="icon-btn modal-close" aria-label="Fermer">${icons.close}</button>
        </div>
        <div class="modal-body"></div>
        <div class="modal-actions"></div>
      </div>
    </div>`);
  const body = scrim.querySelector('.modal-body');
  if (typeof content === 'string') body.innerHTML = content;
  else body.appendChild(content);

  const actionsEl = scrim.querySelector('.modal-actions');
  const close = () => {
    scrim.classList.remove('visible');
    document.body.classList.remove('overlay-open');
    setTimeout(() => scrim.remove(), 250);
    if (onClose) onClose();
  };
  for (const a of actions) {
    const btn = el(`<button class="btn ${a.variant || 'btn-secondary'}">${a.label}</button>`);
    btn.addEventListener('click', () => {
      const keep = a.onClick ? a.onClick(body, close) : null;
      if (keep !== 'keep') close();
    });
    actionsEl.appendChild(btn);
  }
  if (!actions.length) actionsEl.remove();

  scrim.querySelector('.modal-close').addEventListener('click', close);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  document.body.appendChild(scrim);
  requestAnimationFrame(() => scrim.classList.add('visible'));
  return { close, body };
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

// ---------- Bottom Sheet ----------
// headerAction (facultatif) : { icon, label, onClick } -> bouton en haut à droite.
export function openSheet({ title, content, onClose = null, headerAction = null }) {
  document.body.classList.add('overlay-open');
  const t = esc(title); // texte brut chez tous les appelants (cf. openModal)
  const scrim = el(`
    <div class="scrim sheet-scrim">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${t}">
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
  const close = () => {
    scrim.classList.remove('visible');
    document.body.classList.remove('overlay-open');
    setTimeout(() => scrim.remove(), 320);
    if (onClose) onClose();
  };
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
    if (activeScroller.scrollTop > 0) { startY = null; return; }
    startY = e.touches[0].clientY; dy = 0; dragging = false;
  }, { passive: true });

  sheet.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    dy = e.touches[0].clientY - startY;
    if (dy <= 0) { // remontée : on ne déplace pas, on laisse le scroll reprendre
      if (dragging) { sheet.style.transition = ''; setY(0); dragging = false; }
      return;
    }
    // La liste interne a pu défiler entre-temps (doigt remonté puis redescendu) :
    // on lui rend la main plutôt que de fermer le panneau.
    if (!dragging && activeScroller && activeScroller.scrollTop > 0) { startY = null; return; }
    if (!dragging) {
      if (dy < 6) return;      // petit seuil pour ne pas gêner les taps
      dragging = true;
      sheet.style.transition = 'none'; // suivi immédiat du doigt
    }
    e.preventDefault();        // empêche le rebond de la page pendant le glissement
    setY(dy);
  }, { passive: false });

  const endDrag = () => {
    if (startY == null) { return; }
    const wasDragging = dragging;
    startY = null; dragging = false;
    if (!wasDragging) return;
    sheet.style.transition = 'transform 260ms var(--ease)';
    if (dy > sheet.offsetHeight / 3) {
      // Au-delà du tiers : on termine la fermeture jusqu'en bas
      setY(sheet.offsetHeight);
      setTimeout(close, 220);
    } else {
      setY(0); // retour en place, le panneau reste ouvert
      setTimeout(() => { sheet.style.transition = ''; sheet.style.transform = ''; }, 280);
    }
  };
  sheet.addEventListener('touchend', endDrag, { passive: true });
  sheet.addEventListener('touchcancel', endDrag, { passive: true });

  document.body.appendChild(scrim);
  requestAnimationFrame(() => scrim.classList.add('visible'));
  return { close, body };
}

// Normalise une chaîne pour la recherche : minuscules, sans accents ni signes
// diacritiques. Permet de trouver « Phở bò » en tapant « pho », ou « Petit-
// Déjeuner » en tapant « dejeuner ». NFD sépare la lettre de son accent, que
// l'on retire ensuite.
export function normalizeStr(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

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

export function fmtDateLong(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
