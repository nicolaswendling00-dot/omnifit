// Test harness jsdom — OmniFit v2
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
const fire = (elm, type) => elm.dispatchEvent(new window.Event(type, { bubbles: true }));
// En test synchrone, le setTimeout(250) de close() ne s'exécute pas : on retire les scrims à la main
const clearOverlays = () => {
  document.querySelectorAll('.scrim').forEach((s) => s.remove());
  document.body.classList.remove('overlay-open');
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

console.log('== Rendu des 5 pages (structure v2) ==');
home.render(pages.home);
assert(pages.home.querySelector('.weight-hero'), 'Accueil : carte poids (weight-hero)');
assert(pages.home.querySelectorAll('.stat-card').length === 4, 'Accueil : 4 cartes récap (calories/pas/prot/eau)');
assert(!pages.home.querySelector('#weight-chart'), 'Accueil : graphique PAS affiché directement');
assert(pages.home.querySelector('#btn-chart'), 'Accueil : bouton Graphique présent');
// Le graphique vit dans une modal
pages.home.querySelector('#btn-chart').click();
assert(document.querySelector('.modal #weight-chart'), 'Accueil : graphique poids ouvert en modal');
clearOverlays();

nutrition.render(pages.nutrition);
assert(pages.nutrition.querySelector('.nutrition-header'), 'Nutrition : header sticky');
assert(pages.nutrition.querySelectorAll('.macro-rings .ring-item').length === 3, 'Nutrition : 3 anneaux macros');
assert(pages.nutrition.querySelectorAll('.date-chip').length === 15, 'Nutrition : ruban 15 dates');
assert(pages.nutrition.querySelector('.date-ribbon.no-swipe'), 'Nutrition : ruban dates en no-swipe');
assert(document.getElementById('fab-nutrition') && document.getElementById('fab-nutrition').parentElement === document.body, 'Nutrition : FAB global dans le body');
assert(pages.nutrition.querySelector('#btn-macro-goals'), 'Nutrition : bouton Objectifs macros');

workout.render(pages.workout);
assert(pages.workout.querySelector('#btn-new-session'), 'Workout : bouton nouvelle séance');
assert(pages.workout.querySelector('#volume-host .volume-table'), 'Workout : table volume hebdo');

activity.render(pages.activity);
assert(pages.activity.querySelector('.steps-hero'), 'Activité : hero pas');
assert(pages.activity.querySelector('#steps-chart'), 'Activité : histogramme');
assert(!pages.activity.querySelector('.mono'), 'Activité : plus de classe .mono (Courier retiré)');

settings.render(pages.settings);
assert(pages.settings.querySelectorAll('.settings-section').length === 7, 'Réglages : 7 sections');
assert(pages.settings.querySelector('#btn-export'), 'Réglages : bouton export');
assert(!pages.settings.textContent.includes('Protéines (g)'), 'Réglages : macros retirées (déplacées en Nutrition)');

console.log('== Objectifs macros en grammes (par défaut) ==');
const mg = nutrition.macroGoals();
assert(mg.protG === 120 && mg.carbsG === 250 && mg.fatG === 83, 'macroGoals grammes = 120/250/83');
assert(mg.kcalGoal === 2227, `macroGoals kcal auto = calcKcal(120,250,83) = ${mg.kcalGoal}`);

console.log('== Log activité : champs empilés (field-stack) ==');
pages.activity.querySelector('#btn-log-steps').click();
const stepModal = document.querySelector('.modal');
assert(stepModal && stepModal.querySelector('.field-stack'), 'Log pas : formulaire en field-stack (empilé)');
assert(stepModal && !stepModal.querySelector('.field-row'), 'Log pas : plus de field-row (fin de superposition iOS)');
clearOverlays();

console.log('== Données : poids, repas, pas ==');
store.addWeightLog(todayISO(), 74.6);
assert(store.userData.weights.length === 1 && store.userData.profile.weight === 74.6, 'addWeightLog met à jour weights + profile');
home.render(pages.home);
assert(pages.home.querySelector('.w-now').textContent.includes('74.6'), 'Accueil : poids courant affiché (74.6)');

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
pages.workout.querySelector('#btn-new-session').click();
const overlay = document.querySelector('.session-overlay');
assert(overlay, 'Overlay séance ouvert (monte du bas)');
assert(document.body.classList.contains('overlay-open'), 'body.overlay-open actif');
assert(!overlay.querySelector('input[type="date"]'), 'Séance : pas de champ date (retiré)');

// Picker plein écran, recherche en haut
overlay.querySelector('#s-add-exo').click();
const picker = document.querySelector('.picker-overlay');
assert(picker, 'Picker plein écran ouvert');
const searchInput = picker.querySelector('#exo-search');
assert(searchInput && picker.querySelector('.picker-topbar').contains(searchInput), 'Recherche ancrée en haut (jamais derrière le clavier)');
searchInput.value = 'Développé couché';
fire(searchInput, 'input');
const items = [...picker.querySelectorAll('.exo-search-item')];
assert(items.length > 0, 'Recherche filtre les exercices');
const bench = items.find((it) => it.querySelector('span').textContent === 'Développé couché');
assert(bench, 'Résultat exact « Développé couché » présent');
bench.click();
assert(!document.querySelector('.picker-overlay'), 'Picker fermé après sélection');
const card = overlay.querySelector('#s-exos .exo-card');
assert(card, 'Exercice ajouté à la séance');

// Muscles masqués tant qu'on ne clique pas sur le nom
assert(card.querySelector('.exo-name-btn[data-detail]'), 'Nom = grand bouton cliquable (détail)');
assert(!card.textContent.includes('Pectoraux'), 'Muscles NON affichés sur la carte (seulement au clic)');
assert(card.querySelector('[data-menu]'), 'Menu ⋯ (3 points) présent au lieu de la poubelle');

// Ajouter une série
card.querySelector('.in-weight').value = '80';
card.querySelector('.in-reps').value = '8';
card.querySelector('[data-addset]').click();
assert(overlay.querySelector('.set-line'), 'Série #1 enregistrée');
const restBar = overlay.querySelector('#rest-topbar');
assert(restBar.classList.contains('active'), 'Timer de repos en haut et actif');
overlay.querySelector('#rt-skip').click();
assert(!restBar.classList.contains('active'), 'Skip repos fonctionne');

// Menu ⋯ : 4 actions
overlay.querySelector('[data-menu]').click();
const menuSheet = document.querySelector('.sheet');
const menuItems = menuSheet ? [...menuSheet.querySelectorAll('.menu-item')] : [];
assert(menuItems.length === 4, 'Menu ⋯ : 4 actions (réorg/superset/remplacer/supprimer)');
assert(menuItems.some((b) => b.dataset.a === 'reorder') && menuItems.some((b) => b.dataset.a === 'superset') && menuItems.some((b) => b.dataset.a === 'replace') && menuItems.some((b) => b.dataset.a === 'delete'), 'Menu ⋯ : les 4 actions attendues');
clearOverlays();

// Terminer → résumé avec amélioration par muscle
overlay.querySelector('#s-finish').click();
const modal = document.querySelector('.modal');
assert(modal && modal.textContent.includes('Résumé'), 'Modal résumé affichée');
assert(modal.textContent.includes('Amélioration'), 'Résumé : coefficient d\'amélioration par muscle');
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
const routineTitle = pages.workout.querySelector('#routine-list h3');
assert(routineTitle && routineTitle.textContent === 'Push A', 'Routine affichée');
store.deleteRoutine('r1');
assert(store.userData.routines.length === 0, 'deleteRoutine fonctionne');

console.log('== Réglages : Harris-Benedict + thème ==');
settings.render(pages.settings);
const calInput = pages.settings.querySelector('#set-cal');
assert(calInput.disabled === true, 'Input calories désactivé (auto ON)');
const cg = store.userData.settings.calorieGoal;
assert(cg === 2500, 'calorieGoal encore à la valeur par défaut');

const goalSelect = pages.settings.querySelector('#set-goal-type');
goalSelect.value = 'Perte de poids';
fire(goalSelect, 'change');
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
