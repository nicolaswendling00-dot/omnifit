// OmniFit — app.js : orchestrateur (navigation, swipe, boot)
import { render as renderHome } from './modules/home.js';
import { render as renderNutrition } from './modules/nutrition.js';
import { render as renderWorkout } from './modules/workout.js';
import { render as renderActivity } from './modules/activity.js';
import { render as renderSettings, applyTheme } from './modules/settings.js';
import { setStandards } from './utils/ranks.js';

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

appContainer.addEventListener('touchstart', (e) => {
  if (document.body.classList.contains('overlay-open')) { touchStartX = null; return; }
  // Ne pas déclencher le swipe depuis les zones scrollables horizontalement
  if (e.target.closest('.no-swipe, .date-ribbon, .segment, input[type="range"]')) { touchStartX = null; return; }
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

appContainer.addEventListener('touchend', (e) => {
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
goTo(0);

// Standards StrengthLevel (pour le raccourci Onyx). Chargement non bloquant.
fetch('./standards.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((data) => { if (data) { setStandards(data); const p = PAGES[currentPage]; p.render(document.getElementById(p.id)); } })
  .catch(() => {});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
