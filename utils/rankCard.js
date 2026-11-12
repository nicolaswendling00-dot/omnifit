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
// Ciel étoilé fixe (positions tirées une fois pour toutes), comme sur l'icône
const STARS = [[0.0,106.7,0.81,0.73],[18.8,83.7,0.98,0.50],[26.5,88.0,0.25,0.89],[45.0,101.6,0.26,0.42],[9.4,22.6,0.25,0.59],[76.7,59.1,0.35,0.67],[77.0,9.2,0.90,0.79],[73.6,101.5,0.26,0.35],[51.2,139.5,0.41,0.89],[28.5,123.8,0.74,0.75],[18.8,88.7,0.27,0.84],[68.2,73.7,0.30,0.70],[72.7,23.0,0.26,0.37],[99.3,108.2,0.47,0.65],[21.7,119.1,0.26,0.51],[99.8,83.3,0.78,0.77],[71.9,52.3,0.51,0.89],[90.3,76.8,0.45,0.39],[81.9,26.6,0.26,0.80],[76.1,7.2,0.99,0.45],[38.4,88.6,0.33,0.62],[23.3,30.9,0.41,0.49],[98.9,92.4,0.85,0.61],[37.1,109.0,0.38,0.81],[65.4,94.0,0.57,0.78],[28.3,115.7,0.25,0.80],[22.8,0.7,0.79,0.77],[22.3,65.5,0.25,0.78],[64.6,98.8,0.26,0.76],[35.5,65.5,0.25,0.79],[91.1,107.3,0.25,0.77],[56.4,126.9,0.61,0.37],[79.9,93.6,0.54,0.77],[15.7,43.2,0.26,0.44],[49.5,13.7,0.33,0.80],[39.2,8.9,0.60,0.42],[64.9,81.8,0.97,0.87],[29.5,36.2,0.67,0.46],[64.7,27.3,0.62,0.48],[66.1,94.7,0.25,0.87],[20.5,0.7,0.27,0.51],[59.6,130.9,0.94,0.94],[89.7,86.3,0.68,0.71],[93.6,56.9,0.43,0.75]];
const starSky = `<svg class="rk-brand-sky" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${STARS.map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" opacity="${o}"/>`).join('')}</svg>`;
export const brandBack = () => `<div class="rk-brand">${starSky}${logoMark('rk-brand-mark')}<div class="rk-brand-name">OmniFit</div></div>`;

// rank : objet de rang (id, couleur, LP) ou null pour « Non classé ».
// back : HTML du verso.
export function openRankCard({ rank, label, title = '', ariaLabel = label, back = brandBack() }) {
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
