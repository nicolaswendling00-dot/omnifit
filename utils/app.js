// OmniFit — app.js : orchestrateur (navigation, swipe, boot)
import { render as renderHome } from './modules/home.js';
import { render as renderNutrition } from './modules/nutrition.js';
import { render as renderWorkout, resumeActiveSession, refreshActiveSession } from './modules/workout.js';
import { render as renderActivity } from './modules/activity.js';
import { render as renderSettings, applyTheme } from './modules/settings.js';
import { setStandards } from './utils/ranks.js';
import { store, parseStepsPayload } from './utils/storage.js';

const PAGES = [
  { id: 'page-home', render: renderHome },
  { id: 'page-nutrition', render: renderNutrition },
  { id: 'page-workout', render: renderWorkout },
  { id: 'page-activity', render: renderActivity },
  { id: 'page-settings', render: renderSettings },
];

let currentPage = 0;
const appContainer = document.getElementById('app-container');

function goTo(index) {
  index = Math.max(0, Math.min(PAGES.length - 1, index));
  currentPage = index;
  // Transform inline en % (fiable sur iOS, contrairement aux CSS vars + vw)
  appContainer.style.transform = `translateX(-${index * 20}%)`;
  document.body.dataset.page = index;
  document.querySelectorAll('.nav-btn').forEach((b, i) => b.classList.toggle('active', i === index));
  const page = PAGES[index];
  page.render(document.getElementById(page.id));
}

document.querySelectorAll('.nav-btn').forEach((btn, i) => {
  btn.addEventListener('click', () => goTo(i));
});

// ---------- Swipe latéral ----------
let touchStartX = null;
let touchStartY = null;

// ---- Verrou de swipe d'onglet ----
// Certaines zones ont leur propre glissement horizontal (suppression d'un repas
// ou d'une série). Dès que le doigt se pose dessus, on désactive le changement
// d'onglet JUSQU'À CE QUE LE DOIGT SE LÈVE. Le verrou est posé en phase de
// CAPTURE sur `document` (donc avant tout autre gestionnaire) et libéré en phase
// de propagation (donc après celui de #app-container, qui le voit encore actif).
const SWIPE_LOCK_ZONES = '.meal-row, .set-row, #meal-list, #s-exos, .swipe-lock, .no-swipe, .date-ribbon, .segment, input[type="range"]';
let swipeLocked = false;

document.addEventListener('touchstart', (e) => {
  if (e.target.closest && e.target.closest(SWIPE_LOCK_ZONES)) {
    swipeLocked = true;
    touchStartX = null; // annule un éventuel suivi déjà amorcé
  }
}, { capture: true, passive: true });

const releaseSwipeLock = () => { swipeLocked = false; };
document.addEventListener('touchend', releaseSwipeLock, { passive: true });
document.addEventListener('touchcancel', releaseSwipeLock, { passive: true });

appContainer.addEventListener('touchstart', (e) => {
  if (swipeLocked) { touchStartX = null; return; }
  if (document.body.classList.contains('overlay-open')) { touchStartX = null; return; }
  // Ne pas déclencher le swipe depuis les zones scrollables horizontalement
  // ni depuis les lignes à swipe latéral (repas, séries) : sinon le geste de
  // suppression fait changer d'onglet.
  if (e.target.closest(SWIPE_LOCK_ZONES)) { touchStartX = null; return; }
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

appContainer.addEventListener('touchend', (e) => {
  if (swipeLocked) { touchStartX = null; return; }
  if (touchStartX == null) return;
  if (document.body.classList.contains('overlay-open')) { touchStartX = null; return; }
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  touchStartX = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    goTo(currentPage + (dx < 0 ? 1 : -1));
  }
}, { passive: true });

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

goTo(0);

// Standards StrengthLevel (nécessaires au calcul des rangs). Chargement non
// bloquant, MAIS la reprise d'une séance en cours attend que les standards
// soient prêts : sinon les rangs des exercices de la séance seraient calculés
// sans référence et s'afficheraient faux jusqu'au prochain rendu.
const rerenderCurrent = () => { const p = PAGES[currentPage]; p.render(document.getElementById(p.id)); };

fetch('./standards.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((data) => { if (data) setStandards(data); })
  .catch(() => {})
  .finally(() => {
    rerenderCurrent();                 // la page courante récupère les rangs
    resumeActiveSession(rerenderCurrent); // reprise séance (standards désormais chargés → rangs corrects)
    refreshActiveSession();            // et si une séance était déjà là, on recalcule ses rangs
  });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
