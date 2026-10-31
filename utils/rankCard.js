// OmniFit — Carte de rang au format carte à jouer, commune au rang global
// (accueil) et au rang d'un exercice. Recto : logo, titre facultatif (nom de
// l'exercice), badge, rang et LP. Toucher la carte la retourne ; toucher à
// côté (ou Échap) la referme.
import { el, esc } from './ui.js';
import { flipCard, channel } from './gestures.js';
import { rankBadge, lpLabel } from './ranks.js';

// Le logo OmniFit : l'infini qui se termine en flèche (cf. assets/icon.svg)
const markPaths = (c) => `<path d="M77 29 L50 55 C42 63 36 70 28 70 C19 70 13 63 13 55 C13 47 19 40 28 40 C36 40 42 46 50 55 C58 64 64 70 72 70 C81 70 87 63 87 55 C87 51 85.5 47.5 83 45" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M88 18 L72.5 21.5 L84.5 33.5 Z" fill="${c}" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>`;
const MARK_VB = '6 12 90 66';
export const logoMark = (cls = '') => `<svg class="${cls}" viewBox="${MARK_VB}" aria-hidden="true">${markPaths('currentColor')}</svg>`;

// Dos de carte : le logo au centre, sur le fond sombre aux reflets bleu et violet
export const brandBack = () => `<div class="rk-brand">${logoMark('rk-brand-mark')}<div class="rk-brand-name">OmniFit</div></div>`;

const loadSVG = async (svg) => {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  return img;
};

// Recto redessiné dans un canvas : c'est l'image sur laquelle le shader
// holographique pose son motif. Mêmes éléments que la face HTML.
async function rankCardArt(rank, label, title, w, h) {
  const k = Math.min(window.devicePixelRatio || 1, 2);
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  const ctx = cv.getContext('2d');
  ctx.scale(k, k);
  const css = getComputedStyle(document.body);
  ctx.fillStyle = css.getPropertyValue('--surface').trim() || '#0C0E13';
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 0.7);
  glow.addColorStop(0, rank.color + '38');
  glow.addColorStop(1, rank.color + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rank.color;
  ctx.fillRect(22, 0, w - 44, 3);
  const text = css.getPropertyValue('--text').trim() || '#F4F6FA';
  const logo = await loadSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VB}">${markPaths(text)}</svg>`);
  const lw = w * 0.13;
  ctx.drawImage(logo, (w - lw) / 2, 18, lw, lw * (66 / 90));
  const img = await loadSVG(rankBadge(rank.id, 400));
  const b = Math.min(200, w * (title ? 0.54 : 0.62));
  const top = h * (title ? 0.52 : 0.47) - b * 0.62;
  ctx.drawImage(img, (w - b) / 2, top, b, b);
  try { await document.fonts.load('800 20px Archivo'); } catch (_) { /* police système */ }
  ctx.textAlign = 'center';
  if ('fontStretch' in ctx) ctx.fontStretch = 'semi-expanded';
  if (title) {
    ctx.fillStyle = text;
    ctx.font = `700 ${Math.round(w * 0.066)}px Archivo, sans-serif`;
    ctx.fillText(title, w / 2, top - 14, w - 40);
  }
  ctx.fillStyle = rank.color;
  ctx.font = `800 ${Math.round(w * 0.1)}px Archivo, sans-serif`;
  ctx.fillText(label.toUpperCase(), w / 2, top + b * 1.12);
  ctx.fillStyle = text;
  ctx.font = `800 ${Math.round(w * 0.066)}px Archivo, sans-serif`;
  ctx.fillText(lpLabel(rank), w / 2, top + b * 1.12 + w * 0.1);
  return cv;
}

// rank : objet de rang (id, couleur, LP) ou null pour « Non classé ».
// holo : effet holographique au recto. back : HTML du verso.
export function openRankCard({ rank, label, title = '', ariaLabel = label, holo = false, back = brandBack() }) {
  const color = rank ? rank.color : 'var(--text-3)';
  const front = `<div class="rk-face${title ? ' rk-face--titled' : ''}" style="--rk:${color}">
    ${logoMark('rk-logo')}
    ${title ? `<div class="rk-title">${esc(title)}</div>` : ''}
    ${rank ? `<div class="rk-badge">${rankBadge(rank.id, 200)}</div>
    <div class="rk-name">${esc(label)}</div>
    <div class="rk-lp num">${lpLabel(rank)}</div>` : '<div class="rk-name">Non classé</div>'}
  </div>`;
  const card = flipCard({
    label: ariaLabel,
    holo: holo && rank ? { art: (w, h) => rankCardArt(rank, label, title, w, h) } : null,
    front,
    back,
  });
  const scrim = el('<div class="scrim rk-scrim"><div class="rk-stage"></div><div class="rk-hint">Toucher la carte pour la retourner</div></div>');
  const stage = scrim.querySelector('.rk-stage');
  stage.appendChild(card);
  document.body.appendChild(scrim);
  // Entrée : la carte arrive en grandissant, avec un ressort
  const enter = channel((v) => { stage.style.transform = `scale(${v})`; stage.style.opacity = String(Math.min(1, (v - 0.6) / 0.4)); }, 0.6);
  requestAnimationFrame(() => { scrim.classList.add('visible'); enter.to(1, { duration: 0.45, bounce: 0.25 }); });
  const close = () => {
    scrim.classList.remove('visible');
    enter.to(0.6, { duration: 0.25 });
    setTimeout(() => scrim.remove(), 240);
  };
  scrim._close = close;
  scrim.addEventListener('click', (e) => { if (!card.contains(e.target)) close(); });
  card.focus({ preventScroll: true });
  return { close, card };
}
