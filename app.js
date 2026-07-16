// OmniFit — app.js : orchestrateur (navigation, swipe, boot)
import { render as renderHome } from './modules/home.js';
import { render as renderNutrition } from './modules/nutrition.js';
import { render as renderWorkout } from './modules/workout.js';
import { render as renderActivity } from './modules/activity.js';
import { render as renderSettings, applyTheme } from './modules/settings.js';

const PAGES = [
  { id: 'page-home', render: renderHome },
  { id: 'page-nutrition', render: renderNutrition },
  { id: 'page-workout', render: renderWorkout },
  { id: 'page-activity', render: renderActivity },
  { id: 'page-settings', render: renderSettings },
];

let currentPage = 0;
const rendered = new Set();

function goTo(index, force = false) {
  index = Math.max(0, Math.min(PAGES.length - 1, index));
  if (index === currentPage && rendered.has(index) && !force) return;
  currentPage = index;
  document.documentElement.style.setProperty('--page-index', index);
  document.querySelectorAll('.nav-btn').forEach((b, i) => b.classList.toggle('active', i === index));
  const page = PAGES[index];
  const container = document.getElementById(page.id);
  page.render(container);
  rendered.add(index);
}

// ---------- Navigation par boutons ----------
document.querySelectorAll('.nav-btn').forEach((btn, i) => {
  btn.addEventListener('click', () => goTo(i, true));
});

// ---------- Navigation par swipe ----------
const appContainer = document.getElementById('app-container');
let touchStartX = null;
let touchStartY = null;

appContainer.addEventListener('touchstart', (e) => {
  if (document.body.classList.contains('overlay-open')) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

appContainer.addEventListener('touchend', (e) => {
  if (touchStartX == null) return;
  if (document.body.classList.contains('overlay-open')) { touchStartX = null; return; }
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  touchStartX = null;
  // Swipe horizontal dominant, seuil 60px
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (dx < 0) goTo(currentPage + 1, true);
    else goTo(currentPage - 1, true);
  }
}, { passive: true });

// ---------- Boot ----------
applyTheme();
goTo(0, true);

// ---------- Service worker (PWA) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW non enregistré', e));
  });
}
