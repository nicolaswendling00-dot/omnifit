// OmniFit — app.js : orchestrateur (navigation, glissement entre onglets, boot)
import { render as renderHome } from './modules/home.js';
import { render as renderNutrition } from './modules/nutrition.js';
import { render as renderWorkout, resumeActiveSession, refreshActiveSession } from './modules/workout.js';
import { render as renderActivity } from './modules/activity.js';
import { render as renderSettings, applyTheme } from './modules/settings.js';
import { setStandards } from './utils/ranks.js';
import { setNavigator } from './utils/nav.js';
import { store, parseStepsPayload } from './utils/storage.js';

const PAGES = [
  { id: 'page-home', render: renderHome },
  { id: 'page-nutrition', render: renderNutrition },
  { id: 'page-workout', render: renderWorkout },
  { id: 'page-activity', render: renderActivity },
  { id: 'page-settings', render: renderSettings },
];

const appContainer = document.getElementById('app-container');
const pageEls = PAGES.map((p) => document.getElementById(p.id));
let currentPage = 0;

// ---------- Rendu des pages ----------
// Une page n'est redessinée que si les données ont changé depuis son dernier
// rendu (`store.version`). Revenir sur un onglet inchangé ne coûte donc rien :
// pas de graphiques détruits puis recréés, pas d'animations rejouées.
const renderedAt = new Array(PAGES.length).fill(-1);
// Les cartes entrent en cascade au PREMIER affichage d'une page seulement :
// rejouer l'animation à chaque rendu faisait clignoter l'écran à chaque action.
const animated = new Array(PAGES.length).fill(false);

function renderPage(i) {
  const el = pageEls[i];
  // Le rendu reconstruit le contenu : on garde la position de défilement.
  const y = el.scrollTop;
  if (!animated[i]) {
    animated[i] = true;
    el.classList.add('anim-in');
    setTimeout(() => el.classList.remove('anim-in'), 900);
  }
  PAGES[i].render(el);
  if (y) el.scrollTop = y;
  renderedAt[i] = store.version;
}
const isStale = (i) => renderedAt[i] !== store.version;
const markAllStale = () => renderedAt.fill(-1);

// ---------- Position du carrousel ----------
// 20 % = une page (le conteneur fait 5 écrans de large).
// En mouvement (doigt ou animation), translate3d : le carrousel a sa propre
// couche GPU et se déplace sans être redessiné. Au repos, on repasse en
// translate 2D pour libérer cette couche, qui fait cinq écrans de large.
const SLIDE_EASE = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)';
const restTransform = (index) => `translateX(${-index * 20}%)`;
let restTimer = null;
const settle = () => {
  clearTimeout(restTimer);
  if (drag && drag.dir === 'h') return; // un nouveau geste a commencé
  appContainer.style.transition = 'none';
  appContainer.style.transform = restTransform(currentPage);
};
function place(index, dragPx = 0, animate = true) {
  clearTimeout(restTimer);
  appContainer.style.transition = animate ? SLIDE_EASE : 'none';
  if (!animate && !dragPx) { appContainer.style.transform = restTransform(index); return; }
  appContainer.style.transform = `translate3d(calc(${-index * 20}% + ${dragPx}px), 0, 0)`;
  // `transitionend` ne vient pas toujours (app en arrière-plan, transition
  // interrompue) : une minuterie garantit le retour au repos.
  if (animate) restTimer = setTimeout(settle, 420);
}
appContainer.addEventListener('transitionend', (e) => { if (e.target === appContainer) settle(); });

function goTo(index) {
  index = Math.max(0, Math.min(PAGES.length - 1, index));
  currentPage = index;
  document.body.dataset.page = index;
  document.querySelectorAll('.nav-btn').forEach((b, i) => b.classList.toggle('active', i === index));
  if (isStale(index)) renderPage(index);
  place(index);
}

// Les pages peuvent demander un changement d'onglet (ex. la carte Calories de
// l'accueil ouvre Nutrition) sans connaître cet orchestrateur.
setNavigator(goTo);

document.querySelectorAll('.nav-btn').forEach((btn, i) => {
  btn.addEventListener('click', () => { if (i !== currentPage) goTo(i); });
});

// ---------- Verrou de swipe d'onglet ----------
// Certaines zones ont leur propre glissement horizontal (suppression d'un repas
// ou d'une série). Dès que le doigt se pose dessus, on désactive le changement
// d'onglet JUSQU'À CE QUE LE DOIGT SE LÈVE. Le verrou est posé en phase de
// CAPTURE sur `document` (donc avant tout autre gestionnaire).
// `.swipe-row` / `.exo-swipe-row` : lignes glissables génériques (pesées,
// relevés de pas, exercices custom). Sans elles ici, le geste horizontal part
// dans le changement d'onglet et la poubelle ne s'ouvre jamais.
const SWIPE_ABSORB_ZONES = '.meal-row, .set-row, .swipe-row, .exo-swipe-row, #meal-list, #s-exos, #steps-list, #w-recent, .swipe-lock';
// Zones qui empêchent simplement le CHANGEMENT D'ONGLET (sans bloquer leur propre
// défilement horizontal) : rubans, segments, curseurs.
const SWIPE_LOCK_ZONES = SWIPE_ABSORB_ZONES + ', .no-swipe, .date-ribbon, .segment, input[type="range"]';
let swipeLocked = false;
let swipeAbsorb = false;   // true seulement sur les zones à swipe de suppression
let lockStartX = null;
let lockStartY = null;

document.addEventListener('touchstart', (e) => {
  if (e.target.closest && e.target.closest(SWIPE_LOCK_ZONES)) {
    swipeLocked = true;
    swipeAbsorb = !!(e.target.closest(SWIPE_ABSORB_ZONES));
    lockStartX = e.touches[0].clientX;
    lockStartY = e.touches[0].clientY;
  }
}, { capture: true, passive: true });

// Sur une zone À ABSORBER, on bloque le glissement HORIZONTAL natif (geste de
// retour d'iOS compris). Les rubans à défilement horizontal ne sont pas absorbés.
document.addEventListener('touchmove', (e) => {
  if (!swipeAbsorb || lockStartX == null || !e.cancelable) return;
  const dx = e.touches[0].clientX - lockStartX;
  const dy = e.touches[0].clientY - lockStartY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) e.preventDefault();
}, { capture: true, passive: false });

const releaseSwipeLock = () => { swipeLocked = false; swipeAbsorb = false; lockStartX = null; lockStartY = null; };
document.addEventListener('touchend', releaseSwipeLock, { passive: true });
document.addEventListener('touchcancel', releaseSwipeLock, { passive: true });

// ---------- Glissement entre onglets : le carrousel SUIT LE DOIGT ----------
// Le sens du geste est tranché dans les premiers pixels : vertical → on laisse
// la page défiler ; horizontal → le carrousel suit le doigt, avec une
// résistance élastique aux deux extrémités. Au relâchement, on change d'onglet
// si le geste a parcouru un quart d'écran OU s'il était vif (élan).
let drag = null; // { x0, y0, t0, dx, dir: null | 'h' | 'v', lastX, lastT, v }

appContainer.addEventListener('touchstart', (e) => {
  if (swipeLocked || document.body.classList.contains('overlay-open')) { drag = null; return; }
  const t = e.touches[0];
  drag = { x0: t.clientX, y0: t.clientY, dx: 0, dir: null, lastX: t.clientX, lastT: e.timeStamp, v: 0 };
}, { passive: true });

appContainer.addEventListener('touchmove', (e) => {
  if (!drag || swipeLocked) return;
  const t = e.touches[0];
  const dx = t.clientX - drag.x0;
  const dy = t.clientY - drag.y0;
  if (!drag.dir) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    drag.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
    if (drag.dir === 'h') {
      // La page voisine va apparaître : on la remet à jour AVANT qu'on la voie.
      for (const n of [currentPage - 1, currentPage + 1]) {
        if (n >= 0 && n < PAGES.length && isStale(n)) renderPage(n);
      }
    }
  }
  if (drag.dir !== 'h') return;
  if (e.cancelable) e.preventDefault(); // pas de défilement vertical pendant le glissement
  const atEdge = (currentPage === 0 && dx > 0) || (currentPage === PAGES.length - 1 && dx < 0);
  drag.dx = atEdge ? dx * 0.3 : dx;
  // Vitesse lissée (px/ms) pour l'élan au relâchement
  const dt = e.timeStamp - drag.lastT;
  if (dt > 0) {
    drag.v = drag.v * 0.6 + ((t.clientX - drag.lastX) / dt) * 0.4;
    drag.lastX = t.clientX; drag.lastT = e.timeStamp;
  }
  place(currentPage, drag.dx, false);
}, { passive: false });

const endDrag = () => {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.dir !== 'h') return;
  const w = window.innerWidth;
  const fast = Math.abs(d.v) > 0.45 && Math.abs(d.dx) > 24;
  let next = currentPage;
  if (d.dx < 0 && (d.dx < -w / 4 || (fast && d.v < 0))) next = currentPage + 1;
  if (d.dx > 0 && (d.dx > w / 4 || (fast && d.v > 0))) next = currentPage - 1;
  if (next !== currentPage && next >= 0 && next < PAGES.length) goTo(next);
  else place(currentPage); // retour en place
};
appContainer.addEventListener('touchend', endDrag, { passive: true });
appContainer.addEventListener('touchcancel', endDrag, { passive: true });

// ---------- Boot ----------
applyTheme();

// Synchronisation Santé (Apple) : un raccourci iOS lit les pas depuis l'app Santé
// puis ouvre l'appli avec ?steps=NNN (&stepsDate=YYYY-MM-DD facultatif). On lit
// ce paramètre au démarrage, on enregistre le total du jour, puis on nettoie
// l'URL pour ne pas ré-appliquer une valeur périmée au rechargement.
function ingestStepsFromURL() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('steps')) return;
    const entries = parseStepsPayload(params.get('steps'));
    for (const { date, count } of entries) store.addStepsLog(date, count);
  } catch (_) { /* on ignore un paramètre malformé */ }
  // Nettoie l'URL (retire ?steps=… sans recharger la page)
  try { window.history.replaceState({}, '', window.location.pathname); } catch (_) { /* noop */ }
}
ingestStepsFromURL();

place(0, 0, false);
goTo(0);

// Les autres onglets sont préparés juste après le premier affichage, un par un
// pour ne pas bloquer : ainsi le glissement ne découvre jamais une page vide.
function prerenderOthers() {
  const queue = PAGES.map((_, i) => i).filter((i) => i !== currentPage);
  const step = () => {
    const i = queue.shift();
    if (i === undefined) return;
    if (isStale(i)) renderPage(i);
    setTimeout(step, 30);
  };
  setTimeout(step, 120);
}

// Standards StrengthLevel (nécessaires au calcul des rangs). Chargement non
// bloquant, MAIS la reprise d'une séance en cours attend que les standards
// soient prêts : sinon les rangs des exercices de la séance seraient calculés
// sans référence et s'afficheraient faux jusqu'au prochain rendu.
const rerenderCurrent = () => renderPage(currentPage);

fetch('./standards.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((data) => { if (data) setStandards(data); })
  .catch(() => {})
  .finally(() => {
    markAllStale();                    // les rangs dépendent des standards
    rerenderCurrent();
    resumeActiveSession(rerenderCurrent); // reprise séance (standards désormais chargés → rangs corrects)
    refreshActiveSession();            // et si une séance était déjà là, on recalcule ses rangs
    prerenderOthers();
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
