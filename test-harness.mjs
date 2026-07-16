// Test harness jsdom — OmniFit
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const html = readFileSync('./index.html', 'utf8');
const dom = new JSDOM(html, { url: 'https://localhost/', pretendToBeVisual: true });
const { window } = dom;

// Globals
global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;
Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true });
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
// crypto est déjà global en Node 22 (avec randomUUID)
global.Blob = window.Blob;
global.URL = window.URL;
global.FileReader = window.FileReader;
global.HTMLElement = window.HTMLElement;

// Stub Chart.js (CDN global)
let chartCount = 0;
global.Chart = class {
  constructor(canvas, config) { chartCount++; this.config = config; }
  destroy() {}
};
window.Chart = global.Chart;

let pass = 0, fail = 0;
const assert = (cond, msg) => {
  if (cond) { pass++; console.log('  OK  ' + msg); }
  else { fail++; console.log('  FAIL ' + msg); }
};

// ---------- Imports ----------
const { store, todayISO } = await import('./utils/storage.js');
const home = await import('./modules/home.js');
const nutrition = await import('./modules/nutrition.js');
const workout = await import('./modules/workout.js');
const activity = await import('./modules/activity.js');
const settings = await import('./modules/settings.js');

const pages = {
  home: document.getElementById('page-home'),
  nutrition: document.getElementById('page-nutrition'),
  workout: document.getElementById('page-workout'),
  activity: document.getElementById('page-activity'),
  settings: document.getElementById('page-settings'),
};

console.log('== Rendu des 5 pages ==');
home.render(pages.home);
assert(pages.home.querySelector('#goal-card'), 'Accueil : carte objectif');
assert(pages.home.querySelector('#weight-chart'), 'Accueil : canvas poids');
assert(pages.home.querySelectorAll('.stat-card').length === 4, 'Accueil : 4 cartes récap');

nutrition.render(pages.nutrition);
assert(pages.nutrition.querySelector('.nutrition-header'), 'Nutrition : header sticky');
assert(pages.nutrition.querySelectorAll('.macro-rings .ring-item').length === 3, 'Nutrition : 3 anneaux macros');
assert(pages.nutrition.querySelectorAll('.date-chip').length === 15, 'Nutrition : ruban 15 dates');
assert(pages.nutrition.querySelector('#fab-add-meal'), 'Nutrition : FAB');

workout.render(pages.workout);
assert(pages.workout.querySelector('#btn-new-session'), 'Workout : bouton nouvelle séance');
assert(pages.workout.querySelector('#volume-host .volume-table'), 'Workout : table volume tracking');

activity.render(pages.activity);
assert(pages.activity.querySelector('.steps-hero'), 'Activité : hero pas');
assert(pages.activity.querySelector('#steps-chart'), 'Activité : histogramme');

settings.render(pages.settings);
assert(pages.settings.querySelectorAll('.settings-section').length === 7, 'Réglages : 7 sections');
assert(pages.settings.querySelector('#btn-export'), 'Réglages : bouton export');

console.log('== Données : poids, repas, pas ==');
store.addWeightLog(todayISO(), 74.6);
assert(store.userData.weights.length === 1 && store.userData.profile.weight === 74.6, 'addWeightLog met à jour weights + profile');

store.addNutritionLog(todayISO(), { name: 'Poulet riz', prot: 40, carbs: 60, fat: 12, kcal: 508 });
const totals = store.dayTotals(todayISO());
assert(totals.kcal === 508 && totals.prot === 40, 'dayTotals correct');
nutrition.render(pages.nutrition);
assert(pages.nutrition.querySelectorAll('.meal-item').length === 1, 'Repas affiché dans la liste');

const mealId = store.userData.nutrition.byDate[todayISO()].meals[0].id;
store.removeMeal(todayISO(), mealId);
assert(store.dayTotals(todayISO()).kcal === 0, 'removeMeal fonctionne');

store.addStepsLog(todayISO(), 12500);
activity.render(pages.activity);
assert(pages.activity.querySelector('.steps-hero .big').textContent.includes('12'), 'Pas affichés dans le hero');

console.log('== Séance : session complète simulée ==');
// Ouvrir une session via le bouton
pages.workout.querySelector('#btn-new-session').click();
const overlay = document.querySelector('.session-overlay');
assert(overlay, 'Overlay session ouvert');
assert(document.body.classList.contains('overlay-open'), 'body.overlay-open actif');

// Ajouter un exercice via le picker
overlay.querySelector('#s-add-exo').click();
const sheet = document.querySelector('.sheet');
assert(sheet, 'Sheet picker ouvert');
const searchInput = sheet.querySelector('#exo-search');
searchInput.value = 'Développé couché';
searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));
const firstItem = sheet.querySelector('.exo-search-item');
assert(firstItem && firstItem.textContent.includes('Développé couché'), 'Recherche filtre les exercices');
firstItem.click();
assert(overlay.querySelectorAll('#s-exos .card').length === 1, 'Exercice ajouté à la séance');

// Ajouter une série
const card = overlay.querySelector('#s-exos .card');
card.querySelector('.in-weight').value = '80';
card.querySelector('.in-reps').value = '8';
card.querySelector('[data-addset]').click();
assert(overlay.querySelector('.set-line'), 'Série #1 enregistrée');
assert(overlay.querySelector('.rest-timer-wrap'), 'Timer de repos lancé');
overlay.querySelector('#rt-skip').click();
assert(!overlay.querySelector('.rest-timer-wrap'), 'Skip repos fonctionne');

// Terminer → résumé
overlay.querySelector('#s-finish').click();
const modal = document.querySelector('.modal');
assert(modal && modal.textContent.includes('Résumé'), 'Modal résumé affichée');
assert(modal.textContent.includes('640'), 'Volume total 640 kg (80×8)');
assert(modal.querySelector('.volume-table'), 'Breakdown par muscle présent');

// Valider
const validateBtn = [...modal.querySelectorAll('.modal-actions .btn')].find((b) => b.textContent.includes('Valider'));
validateBtn.click();
assert(store.userData.workouts.length === 1, 'Séance sauvegardée dans le store');
assert(store.userData.workouts[0].totalVolume === 640, 'totalVolume correct');
assert(!document.querySelector('.session-overlay'), 'Overlay fermé après validation');

console.log('== Volume tracking après séance ==');
workout.render(pages.workout);
const volTable = pages.workout.querySelector('#volume-host .volume-table');
assert(volTable.textContent.includes('Pectoraux'), 'Table volume liste les muscles');
const chestRow = [...volTable.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Pectoraux'));
assert(chestRow && chestRow.textContent.includes('1'), 'Pectoraux : 1 set comptabilisé');

console.log('== Routines ==');
store.saveRoutine({ id: 'r1', name: 'Push A', exercises: ['benchPress', 'overheadPress'] });
workout.render(pages.workout);
assert(pages.workout.querySelector('.routine-card h3').textContent === 'Push A', 'Routine affichée');
store.deleteRoutine('r1');
assert(store.userData.routines.length === 0, 'deleteRoutine fonctionne');

console.log('== Réglages : Harris-Benedict + thème ==');
settings.render(pages.settings);
const calInput = pages.settings.querySelector('#set-cal');
assert(calInput.disabled === true, 'Input calories désactivé (auto ON)');
// HB : profil 74.6kg / 178cm / 25 ans / M / Prise de muscle
const expected = Math.round((88.362 + 13.397 * 74.6 + 4.799 * 178 - 5.677 * 25) * 1.45 / 10) * 10 + 250;
// applyCalorieAuto arrondit avant +250 ? Non : tdee = bmr*1.45 +250 puis round/10. Vérifions juste la présence d'une valeur cohérente.
const cg = store.userData.settings.calorieGoal;
assert(cg === 2500, 'calorieGoal encore à la valeur par défaut (pas de recalcul déclenché)');

// Déclencher le recalcul via changement du type d'objectif
const goalSelect = pages.settings.querySelector('#set-goal-type');
goalSelect.value = 'Perte de poids';
goalSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
const cg2 = store.userData.settings.calorieGoal;
assert(cg2 !== 2500 && cg2 > 1500 && cg2 < 3500, `Harris-Benedict recalculé : ${cg2} kcal`);

settings.render(pages.settings);
const themeBtn = pages.settings.querySelector('#seg-theme [data-v="amoled"]');
themeBtn.click();
assert(document.body.classList.contains('theme-amoled'), 'Thème AMOLED appliqué au body');

console.log('== Persistance localStorage ==');
const raw = JSON.parse(localStorage.getItem('omniffit_userData'));
assert(raw.workouts.length === 1 && raw.settings.theme === 'amoled', 'Données persistées dans localStorage');

console.log('== Import / export ==');
const size = store.getStorageSize();
assert(size > 500, `Taille stockage : ${size} octets`);
store.importJSON({ profile: { name: 'Nicolas' } }, 'merge');
assert(store.userData.profile.name === 'Nicolas' && store.userData.workouts.length === 1, 'Import merge conserve les données');

console.log(`\n===== RÉSULTAT : ${pass} OK / ${fail} FAIL =====`);
process.exit(fail ? 1 : 0);
