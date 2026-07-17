// Test harness jsdom — OmniFit v3
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const html = readFileSync('./index.html', 'utf8');
const dom = new JSDOM(html, { url: 'https://localhost/', pretendToBeVisual: true });
const { window } = dom;

global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;
Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true });
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.Blob = window.Blob;
global.URL = window.URL;
global.FileReader = window.FileReader;
global.HTMLElement = window.HTMLElement;

let chartCount = 0;
global.Chart = class { constructor() { chartCount++; } destroy() {} };
window.Chart = global.Chart;

let pass = 0, fail = 0;
const assert = (cond, msg) => {
  if (cond) { pass++; console.log('  OK  ' + msg); }
  else { fail++; console.log('  FAIL ' + msg); }
};
const fire = (elm, type) => elm.dispatchEvent(new window.Event(type, { bubbles: true }));
const clearOverlays = () => {
  document.querySelectorAll('.scrim').forEach((s) => s.remove());
  document.body.classList.remove('overlay-open');
};

const { store, todayISO } = await import('./utils/storage.js');
const mathmod = await import('./utils/math.js');
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

console.log('== Rendu des 5 pages (structure v3) ==');
home.render(pages.home);
assert(pages.home.querySelector('.weight-hero'), 'Accueil : carte poids');
assert(pages.home.querySelectorAll('.stat-card').length === 4, 'Accueil : 4 cartes récap');
assert(pages.home.querySelector('#btn-chart') && !pages.home.querySelector('#weight-chart'), 'Accueil : graphique en modal seulement');

nutrition.render(pages.nutrition);
assert(pages.nutrition.querySelector('.nutrition-header'), 'Nutrition : header sticky');
assert(pages.nutrition.querySelectorAll('.macro-rings .ring-item').length === 3, 'Nutrition : 3 anneaux macros');
assert(pages.nutrition.querySelectorAll('.date-chip').length === 15, 'Nutrition : ruban 15 dates');
assert(pages.nutrition.querySelector('.date-ribbon.no-swipe'), 'Nutrition : ruban en no-swipe');
assert(document.getElementById('fab-nutrition')?.parentElement === document.body, 'Nutrition : FAB global dans body');
assert(pages.nutrition.querySelector('#btn-recipes'), 'Nutrition : bouton Recettes');
// v3 : kcal total en haut + fibres
assert(pages.nutrition.querySelector('.kcal-total .kcal-consumed'), 'Nutrition : kcal consommées affichées en haut');
assert(pages.nutrition.querySelector('.kcal-sep').textContent.includes('2227'), 'Nutrition : objectif total kcal (/2227) affiché en haut');
assert(pages.nutrition.querySelector('.fiber-line'), 'Nutrition : ligne fibres présente');
// v3 : couleurs macros (prot orange)
const protRing = pages.nutrition.querySelector('.macro-rings .ring-item svg');
assert(protRing && protRing.innerHTML.includes('#FB923C'), 'Nutrition : anneau protéines en orange (#FB923C)');

workout.render(pages.workout);
assert(pages.workout.querySelector('#btn-new-session'), 'Workout : bouton nouvelle séance');
assert(pages.workout.querySelector('#volume-host .volume-table'), 'Workout : table volume hebdo');
assert(pages.workout.querySelector('#vol-goals-btn'), 'Workout : objectifs de volume déplacés ici');
assert(pages.workout.querySelector('#calendar-host .cal-grid'), 'Workout : calendrier 2 semaines présent');
assert(pages.workout.querySelectorAll('#calendar-host .cal-grid .cal-day').length === 14, 'Workout : calendrier = 14 jours (2 lignes)');

activity.render(pages.activity);
assert(pages.activity.querySelector('.steps-hero') && pages.activity.querySelector('#steps-chart'), 'Activité : hero + histogramme');
assert(!pages.activity.querySelector('.mono'), 'Activité : plus de .mono');

settings.render(pages.settings);
assert(pages.settings.querySelectorAll('.settings-section').length === 7, 'Réglages : 7 sections');
assert(pages.settings.querySelector('#btn-export'), 'Réglages : bouton export');
assert(!pages.settings.querySelector('#btn-vol-goals'), 'Réglages : objectifs de volume retirés (déplacés)');
assert(pages.settings.textContent.includes('v3.0'), 'Réglages : version 3.0');

console.log('== Objectifs macros : grammes / auto ==');
const mgGrams = nutrition.macroGoals();
assert(mgGrams.kcalGoal === 2227, `macroGoals grammes = calcKcal(120,250,83) = ${mgGrams.kcalGoal}`);
assert(mathmod.fiberGoalFromKcal(2000) === 20, 'Objectif fibres : 10 g / 1000 kcal (2000 → 20)');

console.log('== Log activité : champs empilés ==');
pages.activity.querySelector('#btn-log-steps').click();
assert(document.querySelector('.modal .field-stack') && !document.querySelector('.modal .field-row'), 'Log pas : champs empilés (fin superposition)');
clearOverlays();

console.log('== Données : poids, repas typé + fibres, pas ==');
store.addWeightLog(todayISO(), 74.6);
home.render(pages.home);
assert(pages.home.querySelector('.w-now').textContent.includes('74.6'), 'Accueil : poids courant 74.6');

// macroGoals auto (dépend du poids de corps)
store.saveUserData({ settings: { macroMode: 'auto', calorieGoal: 2500, protMult: 2.2, fatMult: 1.0 } });
const mgAuto = nutrition.macroGoals();
assert(mgAuto.protG === 164 && mgAuto.fatG === 75 && mgAuto.carbsG === 292 && mgAuto.kcalGoal === 2500,
  `macroGoals auto @74.6kg : P${mgAuto.protG}/L${mgAuto.fatG}/G${mgAuto.carbsG} (reste)`);
store.saveUserData({ settings: { macroMode: 'grams' } });

store.addNutritionLog(todayISO(), { name: 'Poulet riz', meal: 'Déjeuner', prot: 40, carbs: 60, fat: 12, fiber: 9, kcal: 508 });
nutrition.render(pages.nutrition);
assert([...pages.nutrition.querySelectorAll('.meal-cat-head')].some((h) => h.textContent.includes('Déjeuner')), 'Repas typé : en-tête catégorie « Déjeuner »');
assert(pages.nutrition.querySelector('.meal-item .fiber-tag'), 'Repas : fibres affichées en petit');
assert(pages.nutrition.querySelectorAll('.meal-item').length === 1, 'Repas affiché dans la liste');
const mealId = store.userData.nutrition.byDate[todayISO()].meals[0].id;
store.removeMeal(todayISO(), mealId);

store.addStepsLog(todayISO(), 12500);
activity.render(pages.activity);
assert(pages.activity.querySelector('.steps-hero .big').textContent.includes('12'), 'Pas affichés dans le hero');

console.log('== Recettes ==');
store.saveRecipe({ id: 'rec1', name: 'Bowl protéiné', prot: 40, carbs: 50, fat: 10, fiber: 8 });
assert(store.userData.recipes.length === 1, 'saveRecipe ajoute une recette');
document.getElementById('fab-nutrition').click();
const mealSheet = document.querySelector('.sheet');
assert(mealSheet.querySelectorAll('#m-cat button').length === 4, 'Ajout repas : 4 types (PDéj/Déj/Dîner/Snack)');
assert(mealSheet.querySelector('#m-fiber'), 'Ajout repas : champ fibres optionnel');
assert(mealSheet.querySelector('.recipe-chip'), 'Ajout repas : recettes rapides proposées');
clearOverlays();
store.deleteRecipe('rec1');
assert(store.userData.recipes.length === 0, 'deleteRecipe fonctionne');

console.log('== Séance : résumé avec coefficients d\'atténuation ==');
pages.workout.querySelector('#btn-new-session').click();
const overlay = document.querySelector('.session-overlay');
overlay.querySelector('#s-add-exo').click();
const picker = document.querySelector('.picker-overlay');
const searchInput = picker.querySelector('#exo-search');
searchInput.value = 'Développé couché';
fire(searchInput, 'input');
const bench = [...picker.querySelectorAll('.exo-search-item')].find((it) => it.querySelector('span').textContent === 'Développé couché');
bench.click();
const card = overlay.querySelector('#s-exos .exo-card');
assert(card, 'Exercice ajouté');
assert(!card.textContent.includes('Pectoraux'), 'Muscles masqués sur la carte');
card.querySelector('.in-weight').value = '80';
card.querySelector('.in-reps').value = '8';
card.querySelector('[data-addset]').click();
assert(overlay.querySelector('.set-line'), 'Série enregistrée');
assert(overlay.querySelector('#rest-topbar').classList.contains('active'), 'Timer repos actif en haut');
overlay.querySelector('#rt-skip').click();
overlay.querySelector('[data-menu]').click();
assert(document.querySelector('.sheet').querySelectorAll('.menu-item').length === 4, 'Menu ⋯ : 4 actions');
clearOverlays();

overlay.querySelector('#s-finish').click();
const modal = document.querySelector('.modal');
assert(modal.textContent.includes('atténuation'), 'Résumé : coefficients d\'atténuation');
assert(modal.textContent.includes('0.70'), 'Résumé : atténuation Pectoraux ≈ 0.70 (chest 70% principal)');
assert(modal.textContent.includes('Séries'), 'Résumé : nb de séries (volume retiré des résultats)');
assert(!modal.textContent.includes('640'), 'Résumé : volume total NON affiché');
assert(modal.querySelector('.volume-table'), 'Résumé : table par muscle présente');
const validateBtn = [...modal.querySelectorAll('.modal-actions .btn')].find((b) => b.textContent.includes('Valider'));
validateBtn.click();
assert(store.userData.workouts.length === 1 && store.userData.workouts[0].totalVolume === 640, 'Séance sauvegardée (volume 640 stocké)');
assert(!document.querySelector('.session-overlay'), 'Overlay fermé');
clearOverlays();

console.log('== Calendrier ==');
workout.render(pages.workout);
const todayCell = pages.workout.querySelector(`#calendar-host .cal-day.has-session[data-date="${todayISO()}"]`);
assert(todayCell, 'Calendrier : séance du jour marquée (has-session)');
todayCell.click();
const detail = document.querySelector('.modal');
assert(detail && detail.textContent.includes('Séance du'), 'Calendrier : clic → détail de la séance');
clearOverlays();
pages.workout.querySelector('#cal-more').click();
const calOverlay = document.querySelector('.cal-overlay');
assert(calOverlay && calOverlay.querySelector('.cal-month'), 'Calendrier : « Voir plus » ouvre l\'historique plein écran (par mois)');
calOverlay.querySelector('#cal-close').click();

console.log('== Volume tracking ==');
const volTable = pages.workout.querySelector('#volume-host .volume-table');
assert(volTable.textContent.includes('Pectoraux'), 'Volume hebdo liste les muscles');
const chestRow = [...volTable.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Pectoraux'));
assert(chestRow && chestRow.textContent.includes('1'), 'Pectoraux : 1 set comptabilisé');

console.log('== Routines ==');
store.saveRoutine({ id: 'r1', name: 'Push A', exercises: ['benchPress', 'overheadPress'] });
workout.render(pages.workout);
assert(pages.workout.querySelector('#routine-list h3').textContent === 'Push A', 'Routine affichée');
store.deleteRoutine('r1');
assert(store.userData.routines.length === 0, 'deleteRoutine');

console.log('== Réglages : Harris-Benedict + thème ==');
settings.render(pages.settings);
const goalSelect = pages.settings.querySelector('#set-goal-type');
goalSelect.value = 'Perte de poids';
fire(goalSelect, 'change');
const cg2 = store.userData.settings.calorieGoal;
assert(cg2 > 1500 && cg2 < 3500, `Harris-Benedict recalculé : ${cg2} kcal`);
settings.render(pages.settings);
pages.settings.querySelector('#seg-theme [data-v="amoled"]').click();
assert(document.body.classList.contains('theme-amoled'), 'Thème AMOLED appliqué');

console.log('== Persistance + import/export ==');
const raw = JSON.parse(localStorage.getItem('omniffit_userData'));
assert(raw.workouts.length === 1 && raw.settings.theme === 'amoled', 'Données persistées');
store.importJSON({ profile: { name: 'Nicolas' } }, 'merge');
assert(store.userData.profile.name === 'Nicolas' && store.userData.workouts.length === 1, 'Import merge conserve les données');

console.log(`\n===== RÉSULTAT : ${pass} OK / ${fail} FAIL =====`);
process.exit(fail ? 1 : 0);
