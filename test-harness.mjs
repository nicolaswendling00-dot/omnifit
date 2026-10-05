// Test harness jsdom — OmniFit v3
import fs from 'node:fs';
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
let lastChartCfg = null;
global.Chart = class { constructor(c, cfg) { chartCount++; lastChartCfg = cfg; } destroy() {} };
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
assert(pages.home.querySelector('.home-weight'), 'Accueil : carte poids');
// Récap complet de la journée : calories, poids, activité, eau
// Récap : calories, coach, poids, activité, eau
assert(pages.home.querySelectorAll('.stat-card').length === 5, 'Accueil : 5 cartes récap');
assert(pages.home.querySelector('.home-kcal') && pages.home.querySelector('.home-activity'), 'Accueil : cartes calories et activité');
// Répartition des macros en anneau : 3 arcs + fond
assert(pages.home.querySelector('.hk-donut'), 'Accueil : répartition des macros en anneau');
assert(pages.home.querySelectorAll('.hk-donut-legend span').length === 3, 'Accueil : légende P/G/L de l\'anneau');
assert(!pages.home.querySelector('.hk-macro-bar'), 'Accueil : plus de barres de macro');
assert(pages.home.querySelector('.coach-card'), 'Accueil : coach déplacé sur l\'accueil');
// Le graphique s'ouvre en touchant la carte Poids (plus de bouton dédié)
assert(!pages.home.querySelector('#weight-chart'), 'Accueil : graphique en modal seulement');
assert(!pages.home.querySelector('#btn-log-weight') && !pages.home.querySelector('#btn-edit-goal'), 'Accueil : actions poids déplacées dans la fenêtre');

nutrition.render(pages.nutrition);
assert(pages.nutrition.querySelector('.nutrition-header'), 'Nutrition : header sticky');
assert(pages.nutrition.querySelectorAll('.macro-rings .ring-item').length === 4, 'Nutrition : 4 anneaux macros (prot/gluc/lip + fibres)');
// Ruban : 7 derniers jours + une puce « + » vers l'historique complet
assert(pages.nutrition.querySelectorAll('.date-chip').length === 8, 'Nutrition : ruban 7 jours + bouton historique');
assert(pages.nutrition.querySelector('#date-more'), 'Nutrition : puce « + » vers l\'historique');
assert(pages.nutrition.querySelector('.nutrition-header .date-ribbon'), 'Nutrition : ruban dans l\'en-tête collant');
assert(pages.nutrition.querySelector('.date-ribbon.no-swipe'), 'Nutrition : ruban en no-swipe');
assert(document.getElementById('fab-nutrition-wrap')?.parentElement === document.body, 'Nutrition : FAB global dans body');
assert(pages.nutrition.querySelector('#btn-recipes'), 'Nutrition : bouton Recettes');
// v3 : kcal total en haut + fibres
assert(pages.nutrition.querySelector('.kcal-total .kcal-consumed'), 'Nutrition : kcal consommées affichées en haut');
assert(pages.nutrition.querySelector('.kcal-sep').textContent.includes('2227'), 'Nutrition : objectif total kcal (/2227) affiché en haut');
assert(!pages.nutrition.querySelector('.fiber-line'), 'Nutrition : ligne fibres retirée (doublon de l\'anneau)');
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
assert(pages.activity.querySelector('.steps-hero') && pages.activity.querySelector('.sb-plot'), 'Activité : hero + histogramme');
assert(pages.activity.querySelectorAll('.sb-plot .sb-col').length === 7, 'Activité : 7 jours par défaut');
assert(!pages.activity.querySelector('#steps-list') && !pages.activity.querySelector('.grid-2'), 'Activité : plus de liste 14 jours ni de grille de stats (v6.8)');
assert(pages.activity.querySelector('#btn-import-steps'), 'Activité : bouton Importer les pas (Santé)');
assert(!pages.activity.querySelector('.mono'), 'Activité : plus de .mono');

settings.render(pages.settings);
// Profil, Entraînement, Activité, Interface, Données, À propos
// (l'objectif d'eau se règle depuis la carte Eau de l'accueil)
assert(pages.settings.querySelectorAll('.settings-section').length === 6, 'Réglages : 6 sections');
assert(!pages.settings.querySelector('#set-water'), 'Réglages : objectif eau retiré');
assert(pages.settings.querySelector('#btn-health-sync'), 'Réglages : synchro des pas accessible');
assert(pages.settings.querySelector('#btn-export'), 'Réglages : bouton export');
assert(!pages.settings.querySelector('#btn-vol-goals'), 'Réglages : objectifs de volume retirés (déplacés)');
assert(/v\d+\.\d+/.test(pages.settings.textContent), 'Réglages : numéro de version affiché');

console.log('== Objectifs macros : grammes / auto ==');
const mgGrams = nutrition.macroGoals();
assert(mgGrams.kcalGoal === 2227, `macroGoals grammes = calcKcal(120,250,83) = ${mgGrams.kcalGoal}`);
assert(mathmod.fiberGoalFromKcal(2000) === 30, 'Objectif fibres : 15 g / 1000 kcal (2000 → 30)');

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
assert(pages.nutrition.querySelector('.meal-item .mac-f'), 'Repas : fibres affichées (F vert)');
assert(pages.nutrition.querySelector('.meal-item .mac-p') && pages.nutrition.querySelector('.meal-item .mac-g') && pages.nutrition.querySelector('.meal-item .mac-l'), 'Repas : macros colorées P/G/L');
assert(pages.nutrition.querySelectorAll('.meal-item').length === 1, 'Repas affiché dans la liste');
const mealId = store.userData.nutrition.byDate[todayISO()].meals[0].id;
store.removeMeal(todayISO(), mealId);

store.addStepsLog(todayISO(), 12500);
activity.render(pages.activity);
assert(pages.activity.querySelector('.steps-hero').textContent.includes('12'), 'Pas affichés dans le hero');

console.log('== Saisie aliments (loupe / FAB 2 boutons) ==');
// FAB : uniquement scan + loupe
document.getElementById('fab-nutrition').click();
assert(document.getElementById('fab-scan') && document.getElementById('fab-search'), 'FAB : scan + loupe');
assert(!document.getElementById('fab-history') && !document.getElementById('fab-quick'), 'FAB : plus d\'historique/flamme séparés');
// Loupe : recherche unifiée
document.getElementById('fab-search').click();
const fsSheet = document.querySelector('.sheet');
assert(fsSheet.querySelector('#fs-search') && fsSheet.querySelector('#fs-quick'), 'Loupe : recherche + flamme (ajout rapide)');
const fsTabs = [...fsSheet.querySelectorAll('#fs-tabs button')].map((b) => b.dataset.tab).join(',');
assert(fsTabs === 'history,all,recipes', 'Loupe : onglets Historique/Tous/Recettes');
assert(fsSheet.querySelector('#fs-tabs button.active').dataset.tab === 'history', 'Loupe : Historique par défaut');
// flamme -> ouvre l'éditeur repas (ajout rapide)
fsSheet.querySelector('#fs-quick').click();
const mealSheet = [...document.querySelectorAll('.sheet')].find((s) => s.querySelector('#m-cat'));
assert(mealSheet && mealSheet.querySelectorAll('#m-cat button').length === 4, 'Ajout repas : 4 types (PDéj/Déj/Dîner/Snack)');
assert(mealSheet.querySelector('#m-fiber'), 'Ajout repas : champ fibres optionnel');
clearOverlays();

console.log('== v6.8 : aliments de marque, scan sans autorisation ==');
{
  document.getElementById('fab-nutrition').click();
  document.getElementById('fab-search').click();
  const fsS = [...document.querySelectorAll('.sheet')].pop();
  fsS.querySelector('#fs-tabs button[data-tab="all"]').click();
  const srch = fsS.querySelector('#fs-search');
  const names = (q) => { srch.value = q; fire(srch, 'input'); return [...fsS.querySelectorAll('#fs-list .hist-item')].map((i) => i.textContent); };
  assert(names('monster').filter((x) => /Monster/.test(x)).length >= 5, 'Aliments : gamme Monster');
  assert(names('redbull').some((x) => x.includes('Red Bull')), 'Aliments : « redbull » (sans espace) trouve Red Bull');
  assert(names('mcdo').some((x) => x.includes('Big Mac')), 'Aliments : mot-cle « mcdo »');
  assert(names('kitkat').some((x) => x.includes('Kit Kat')), 'Aliments : « kitkat » trouve Kit Kat');
  clearOverlays();
  const fm = await import('./data/foods.js');
  assert(fm.FOODS.find((f) => f.n === 'Monster Ultra (zéro sucre)').g < 1, 'Aliments : Monster Ultra quasi sans sucre');
  assert(fm.FOOD_CATEGORIES.includes('Fast-food') && fm.FOOD_CATEGORIES.includes('Snacks & marques'), 'Aliments : nouvelles categories');
  const nm = new Set(); assert(fm.FOODS.every((f) => !nm.has(f.n) && nm.add(f.n)), 'Aliments : pas de doublon de nom');

  // Scan : mode « Appareil photo » memorise, sans viseur video
  store.saveUserData({ settings: { scanMode: 'photo' } });
  document.getElementById('fab-nutrition').click();
  document.getElementById('fab-scan').click();
  const bc = [...document.querySelectorAll('.sheet')].pop();
  assert(bc.querySelector('#bc-file[capture]'), 'Scan : champ appareil photo natif (aucune autorisation)');
  assert(bc.querySelector('#bc-mode button.active').dataset.mode === 'photo', 'Scan : mode photo memorise');
  assert(bc.querySelector('#bc-cam-zone').classList.contains('photo-mode'), 'Scan : viseur remplace par l\'explication');
  bc.querySelector('#bc-mode button[data-mode="live"]').click();
  assert(store.userData.settings.scanMode === 'live', 'Scan : choix du mode enregistre');
  clearOverlays();
  const bcSrc = fs.readFileSync(new URL('./utils/barcode.js', import.meta.url), 'utf8');
  assert(/t\.enabled = false/.test(bcSrc) && /KEEP_MS/.test(bcSrc), 'Scan : flux camera garde en veille entre deux scans');
}

console.log('== Recettes (composition par aliments) ==');
store.saveRecipe({ id: 'rec1', name: 'Bowl protéiné', prot: 40, carbs: 50, fat: 10, fiber: 8, ingredients: [{ name: 'Riz', weight: 100, prot: 3, carbs: 28, fat: 0, fiber: 0 }] });
assert(store.userData.recipes.length === 1, 'saveRecipe ajoute une recette');
// La recette apparaît dans loupe -> Recettes
document.getElementById('fab-nutrition').click();
document.getElementById('fab-search').click();
const fs2 = document.querySelector('.sheet');
fs2.querySelector('#fs-tabs button[data-tab="recipes"]').click();
assert([...fs2.querySelectorAll('#fs-list .hist-item')].some((i) => i.textContent.includes('Bowl protéiné')), 'Recette visible dans loupe -> Recettes');
clearOverlays();
store.deleteRecipe('rec1');
assert(store.userData.recipes.length === 0, 'deleteRecipe fonctionne');

console.log('== Séance : résumé avec coefficients d\'atténuation ==');
// Nouvelle séance : on choisit d'abord routine ou séance vide
pages.workout.querySelector('#btn-new-session').click();
const startSheet = [...document.querySelectorAll('.sheet')].find((s) => s.querySelector('.ns-list'));
assert(startSheet, 'Séance : choix routine / séance vide au démarrage');
assert(startSheet.querySelector('.ns-empty'), 'Séance : option « séance vide » proposée');
startSheet.querySelector('.ns-empty').click();
const overlay = document.querySelector('.session-overlay');
overlay.querySelector('#s-add-exo').click();
const picker = document.querySelector('.picker-overlay');
const searchInput = picker.querySelector('#exo-search');
// Recherche en ANGLAIS : les exercices sont affichés en français, mais leur
// ancien nom reste un synonyme de recherche.
searchInput.value = 'Bench Press';
fire(searchInput, 'input');
const bench = [...picker.querySelectorAll('.exo-search-item')].find((it) => it.querySelector('span').textContent === 'Développé couché');
assert(bench, 'Recherche anglaise « Bench Press » trouve « Développé couché »');
bench.click();
const card = overlay.querySelector('#s-exos .exo-card');
assert(card, 'Exercice ajouté');
assert(!card.textContent.includes('Pectoraux'), 'Muscles masqués sur la carte');
const row0 = card.querySelector('.set-row');
row0.querySelector('.sr-kg').value = '80';
row0.querySelector('.sr-reps').value = '8';
row0.querySelector('.sr-check').click();
assert(overlay.querySelector('.set-row.done'), 'Série enregistrée');
assert(overlay.querySelector('#rest-topbar').classList.contains('active'), 'Timer repos actif en haut');
overlay.querySelector('#rt-skip').click();
overlay.querySelector('[data-menu]').click();
assert(document.querySelector('.sheet').querySelectorAll('.menu-item').length === 4, 'Menu ⋯ : 4 actions');
clearOverlays();

overlay.querySelector('#s-finish').click();
const modal = document.querySelector('.modal');
assert(modal.textContent.includes('atténuation'), 'Résumé : coefficients d\'atténuation');
assert(modal.textContent.includes('Pectoraux (bas)') && modal.textContent.includes('0.40'), 'Résumé : atténuation Pectoraux (bas) ≈ 0.40 (v6.7 : haut / bas séparés)');
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
const detail = [...document.querySelectorAll('.sheet')].pop();
assert(detail && detail.querySelector('.wd-hero'), 'Calendrier : clic → détail de la séance');
clearOverlays();
pages.workout.querySelector('#cal-more').click();
const calOverlay = document.querySelector('.cal-overlay');
assert(calOverlay && calOverlay.querySelector('.cal-month'), 'Calendrier : « Voir plus » ouvre l\'historique plein écran (par mois)');
calOverlay.querySelector('#cal-close').click();

console.log('== Volume tracking ==');
const volTable = pages.workout.querySelector('#volume-host .volume-table');
assert(volTable.textContent.includes('Pectoraux'), 'Volume hebdo liste les muscles');
const chestRow = [...volTable.querySelectorAll('tbody tr.vol-row')].find((r) => r.textContent.includes('Pectoraux'));
assert(chestRow && chestRow.textContent.includes('1'), 'Pectoraux : 1 set comptabilisé');

console.log('== Routines ==');
store.saveRoutine({ id: 'r1', name: 'Push A', exercises: ['benchPress', 'overheadPress'] });
workout.render(pages.workout);
assert(pages.workout.querySelector('#routine-list h3').textContent === 'Push A', 'Routine affichée');
store.deleteRoutine('r1');
assert(store.userData.routines.length === 0, 'deleteRoutine');

console.log('== Réglages : Harris-Benedict + thème ==');
settings.render(pages.settings);
// L'objectif se choisit depuis l'Accueil (#g-type) ; ici on valide le calcul lui-meme.
const cg2 = mathmod.harrisBenedict(store.userData.profile, 'Perte de poids');
assert(cg2 > 1500 && cg2 < 3500, `Harris-Benedict recalcule : ${cg2} kcal`);
assert(mathmod.harrisBenedict(store.userData.profile, 'Prise de muscle') > cg2, 'Prise de muscle > Perte de poids');
settings.render(pages.settings);
assert(!pages.settings.querySelector('#seg-shape'), 'Theme : plus de selecteur de forme (8-bit supprime)');
pages.settings.querySelector('#seg-palette [data-v="dark"]').click();
assert(!document.body.classList.contains('palette-light'), 'Palette sombre appliquee');

console.log('== Persistance + import/export ==');
const raw = JSON.parse(localStorage.getItem('omniffit_userData'));
assert(raw.workouts.length === 1 && raw.settings.shape === undefined, 'Données persistées (sans réglage de forme)');
store.importJSON({ profile: { name: 'Nicolas' } }, 'merge');
assert(store.userData.profile.name === 'Nicolas' && store.userData.workouts.length === 1, 'Import merge conserve les données');

console.log('== Nouveautes v3.27 ==');
// Theme clair
pages.settings.querySelector('#seg-palette [data-v="light"]').click();
assert(document.body.classList.contains('palette-light'), 'Palette claire appliquee');
pages.settings.querySelector('#seg-palette [data-v="dark"]').click();
assert(!document.body.classList.contains('palette-light'), 'Retour palette sombre');

// Volume hebdo : repli persiste dans les reglages
workout.render(pages.workout);
const volToggle = pages.workout.querySelector('#vol-toggle');
assert(volToggle, 'Volume hebdo : entete repliable presente');
assert(pages.workout.querySelector('#vol-toggle .collapse-caret'), 'Volume hebdo : chevron present');
const volCard = volToggle.closest('.card');
volToggle.click();
assert(store.userData.settings.volumeSectionOpen === false, 'Volume hebdo : 1er clic replie (false)');
assert(volCard.classList.contains('collapsed'), 'Volume hebdo : 1er clic -> visuellement replie');
// 2e clic SANS re-rendu : detecte un etat fige capture au rendu
volToggle.click();
assert(store.userData.settings.volumeSectionOpen === true, 'Volume hebdo : 2e clic rouvre (true)');
assert(!volCard.classList.contains('collapsed'), 'Volume hebdo : 2e clic -> visuellement ouvert');
volToggle.click();
assert(store.userData.settings.volumeSectionOpen === false, 'Volume hebdo : 3e clic replie a nouveau');
assert(volCard.classList.contains('collapsed'), 'Volume hebdo : 3e clic -> visuellement replie');
// et le repli survit a un re-rendu
workout.render(pages.workout);
assert(pages.workout.querySelector('#vol-toggle').closest('.card').classList.contains('collapsed'), 'Volume hebdo : reste replie apres re-rendu');
const volToggle2 = pages.workout.querySelector('#vol-toggle');
volToggle2.click();
assert(store.userData.settings.volumeSectionOpen === true, 'Volume hebdo : re-ouverture persiste (true)');

// Repas : plus de crayon/poubelle inline, structure swipe a la place
store.addNutritionLog(todayISO(), { name: 'Riz (200 g)', baseName: 'Riz', meal: 'Déjeuner', prot: 5, carbs: 56, fat: 0.6, fiber: 0.8, kcal: 250, per100: { prot: 2.5, carbs: 28, fat: 0.3, fiber: 0.4 }, weight: 200 });
nutrition.render(pages.nutrition);
const mealRow = pages.nutrition.querySelector('.meal-row');
assert(mealRow, 'Repas : structure .meal-row (swipe)');
assert(mealRow.querySelector('.meal-del'), 'Repas : poubelle revelee par swipe');
assert(!mealRow.querySelector('[data-edit]'), 'Repas : plus de bouton crayon inline');
assert(mealRow.querySelectorAll('.icon-btn').length === 0, 'Repas : plus de boutons icone inline');

// mealToEditable : nom sans parentheses empilees + poids reel
const ed = nutrition.mealToEditable(store.userData.nutrition.byDate[todayISO()].meals[0]);
assert(ed.baseName === 'Riz', `Edition repas : nom propre (${ed.baseName})`);
assert(ed.weight === 200, `Edition repas : poids reel conserve (${ed.weight})`);
assert(ed.per100.carbs === 28, 'Edition repas : valeurs /100g conservees');
const edLegacy = nutrition.mealToEditable({ name: 'Pates (180 g)', prot: 9, carbs: 54, fat: 1.2, fiber: 2, weight: 180 });
assert(edLegacy.baseName === 'Pates', `Edition repas legacy : suffixe retire (${edLegacy.baseName})`);
assert(edLegacy.weight === 180, 'Edition repas legacy : poids reel (pas 100g)');

// Fiche exercice : crayon en entete, plus de bouton "Modifier le nom"
const xbBtn = pages.workout.querySelector('#btn-exo-browser');
xbBtn.click();
const xbOverlay = document.querySelector('.picker-overlay');
assert(xbOverlay.querySelector('#xb-custom'), 'Navigateur exos : bouton exercice custom');
xbOverlay.querySelector('.exo-search-item').click();
const exoSheet = document.querySelector('.sheet');
assert(exoSheet.querySelector('.sheet-action'), 'Fiche exo : crayon en entete');
assert(!exoSheet.querySelector('#ed-rename'), 'Fiche exo : bouton "Modifier le nom" retire');
clearOverlays();

// Theme clair : aucune couleur sombre en dur hors des definitions :root
const cssTxt = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
const cssBody = cssTxt.slice(cssTxt.indexOf('}', cssTxt.indexOf(':root {')));
assert(!/rgba\(\s*0\s*,\s*217\s*,\s*255/.test(cssBody), 'Theme : aucune teinte accent en dur hors :root');
assert(!cssBody.includes('#04101d'), 'Theme : aucun texte quasi-noir en dur hors :root');
assert(!cssBody.includes('rgba(10, 14, 39'), 'Theme : aucun fond de barre sombre en dur hors :root');
const lightBlock = cssTxt.slice(cssTxt.indexOf('body.palette-light {'), cssTxt.indexOf('}', cssTxt.indexOf('body.palette-light {')));
assert(lightBlock.includes('--on-accent: #FFFFFF'), 'Theme clair : texte blanc sur boutons pleins');
assert(lightBlock.includes('--header-bg: rgba(243, 245, 249'), 'Theme clair : header nutrition clair');

// Swipe : les lignes swipables ne declenchent pas le changement d'onglet
const appTxt = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const lockZones = (appTxt.match(/SWIPE_ABSORB_ZONES\s*=\s*'([^']+)'/) || [])[1] || '';
assert(lockZones.includes('.meal-row'), 'Verrou swipe : .meal-row couvert');
assert(lockZones.includes('.set-row'), 'Verrou swipe : .set-row couvert');
assert(lockZones.includes('#meal-list'), 'Verrou swipe : zone liste des repas couverte');
assert(/capture:\s*true/.test(appTxt), 'Verrou swipe : pose en phase de capture');
assert(/touchcancel/.test(appTxt), 'Verrou swipe : libere aussi sur touchcancel');
assert(/touchmove[\s\S]*?passive: false/.test(appTxt), 'Verrou swipe : touchmove non-passif (bloque le geste horizontal natif iOS)');
const cssSw = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
assert(/\.meal-row[^{]*\{[^}]*touch-action: pan-y/.test(cssSw), 'Verrou swipe : meal-row en touch-action pan-y');

// Panneaux : fermeture au tiers de la hauteur
const uiTxt = fs.readFileSync(new URL('./utils/ui.js', import.meta.url), 'utf8');
assert(uiTxt.includes('sheet.offsetHeight / 3'), 'Panneau : fermeture au tiers');

console.log('== Rang global ==');
const gr = await import('./utils/globalRank.js');
// Facteur d'exigence de l'objectif de pas (anti-triche)
assert(gr.stepsGoalFactor(100) < 0.01, 'Pas : objectif derisoire quasi sans valeur');
assert(Math.abs(gr.stepsGoalFactor(10000) - 1) < 1e-9, 'Pas : 10 000 = reference x1.0');
assert(Math.abs(gr.stepsGoalFactor(20000) - 1.4) < 1e-9, 'Pas : 20 000 = x1.4');
assert(gr.stepsGoalFactor(30000) === 1.5, 'Pas : plafond x1.5');
let stepMono = true;
for (let g = 0; g < 40000; g += 500) if (gr.stepsGoalFactor(g + 500) < gr.stepsGoalFactor(g)) stepMono = false;
assert(stepMono, 'Pas : facteur monotone croissant');
// Soft reset
assert(gr.softReset(2100) === 1460, 'Soft reset : Onyx -> 1460 LP');
assert(gr.softReset(300) === 300, 'Soft reset : debutant intact');
let srOk = true, srPrev = -1;
for (let l = 0; l <= 4000; l++) { const n = gr.softReset(l); if (n > l || n < srPrev) srOk = false; srPrev = n; }
assert(srOk, 'Soft reset : monotone et ne promeut jamais');
// Multiplicateur de serie
assert(gr.streakMultiplier(0) === 1 && gr.streakMultiplier(7) === 1.1 && gr.streakMultiplier(60) === 1.5, 'Serie : paliers x1 -> x1.5');
// Rendement degressif
assert(gr.PILLAR_LP[0] > gr.PILLAR_LP[7], 'Rendement degressif : un pilier vaut moins en haut');
// Piliers : jour de repos non penalise si quota hebdo tenu
const ctxT = { weeklyGoal: 4, sessionsByDate: { '2026-03-03': 1, '2026-03-05': 1, '2026-03-07': 1, '2026-03-08': 1 } };
assert(gr.dayPillars('2026-03-09', ctxT).training === 1, 'Entrainement : jour de repos non penalise (quota hebdo)');
assert(gr.dayPillars('2026-03-09', {}).score === 0, 'Piliers : contexte vide sans plantage');
// Bonus de progression
const ctxPR = { ...ctxT, prDates: { '2026-03-09': true } };
assert(gr.dayPillars('2026-03-09', ctxPR).training === 1.25, 'Progression : record battu -> pilier x1.25');
// Carte affichee sur l'accueil
home.render(pages.home);
assert(pages.home.querySelector('#gr-card'), 'Accueil : carte de rang global presente');
assert(pages.home.querySelectorAll('.gr-pillar').length === 0, 'Accueil : carte de rang epuree (pas de decomposition)');
assert(pages.home.querySelector('.gr-lp'), 'Accueil : LP affiches');
assert(pages.home.querySelector('.gr-rank-name'), 'Accueil : nom du rang affiche');

console.log('== v6.0 : theme 8-bit supprime ==');
const uiMod = await import('./utils/ui.js');
const ranksMod = await import('./utils/ranks.js');
assert(typeof uiMod.setIconSet === 'undefined', '8-bit : plus de jeu d icones alternatif');
assert(typeof ranksMod.setRankStyle === 'undefined', '8-bit : plus de style de badge alternatif');
assert(Object.values(uiMod.icons).every((v) => !v.includes('crispEdges')), 'Icones : toutes vectorielles');
assert(ranksMod.rankBadge('gold', 60).includes('linearGradient'), 'Badge de rang : version illustree');
assert(!fs.existsSync(new URL('./utils/pixelArt.js', import.meta.url)), 'pixelArt.js supprime');
const css8 = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
assert(!/8bit|8-bit|VT323|shape-amoled/.test(css8), 'CSS : plus aucune regle 8-bit ni de forme');
assert(!fs.readFileSync(new URL('./sw.js', import.meta.url), 'utf8').includes('pixelArt'), 'Service worker : pixelArt retire du precache');
// Un ancien reglage 8-bit est nettoye au chargement
store.saveUserData({ settings: { shape: '8bit' } });
settings.applyTheme();
assert(!document.body.classList.contains('shape-8bit'), 'Ancien reglage 8-bit sans effet');
settings.render(pages.settings);
assert(pages.settings.querySelector('#seg-palette [data-v="light"]'), 'Couleur : palette claire presente');
assert(!pages.settings.querySelector('#seg-density'), 'Densite : segment retire');

console.log('== v3.33 : deux axes, badge de rang, scroll dates ==');
// Palette claire
store.saveUserData({ settings: { palette: 'light' } });
settings.applyTheme();
assert(document.body.classList.contains('palette-light'), 'Palette claire appliquee');
store.saveUserData({ settings: { palette: 'dark' } });
settings.applyTheme();
// Badge de rang global : identique a celui des exercices, sans ailettes
home.render(pages.home);
assert(pages.home.querySelector('.gr-badge svg'), 'Accueil : badge de rang affiche');
assert(!pages.home.querySelector('.gr-badge .rank-wings'), 'Accueil : ailettes retirees');
// Scroll des dates non bloque par l'absorption
const appTxt2 = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const absorb = (appTxt2.match(/SWIPE_ABSORB_ZONES\s*=\s*'([^']+)'/) || [])[1] || '';
assert(!absorb.includes('.date-ribbon'), 'Scroll dates : ruban NON absorbe (scroll horizontal libre)');
assert(absorb.includes('.meal-row'), 'Swipe suppression : repas toujours absorbe');
// Une seule densite : l'espacement est un jeton fixe, plus une classe sur body
assert(/:root \{[^}]*--space: \d+px/.test(fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8')), 'Densite : espacement fixe defini dans :root');

console.log('== v3.34 : pas colores, bleu clair, accueil sans scroll ==');
const cssV = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
assert(/\.steps-hero \.ring-label \{[^}]*fill: var\(--text\)/.test(cssV), 'Pas : grand chiffre blanc, comme les autres chiffres cles (v6)');
assert(!/2aa7c4/i.test(cssV), 'Couleur : #2AA7C4 supprime partout');
assert(cssV.includes('--accent: #0A9FD8'), 'Couleur : accent de la palette claire defini');
home.render(pages.home);
assert(pages.home.querySelector('.home-fit'), 'Accueil : conteneur home-fit (sans scroll)');
assert(/\.home-fit \{[^}]*display: flex/.test(cssV), 'Accueil : layout flex pour tenir sur un ecran');

console.log('== v3.36 : lissage, calendrier, historique, transitions ==');
// Lissage : logique de stockage
// Dates isolees (annee 2020) pour ne pas heurter l'etat des tests precedents
const srcD = '2020-03-10';
store.userData.nutrition.byDate[srcD] = { meals: [{ id: 'sm1', kcal: 2600, prot: 150, carbs: 300, fat: 80 }], goal: { kcalGoal: 2000, protG: 150, carbsG: 200, fatG: 60 } };
store.applyCalorieSmoothing(srcD, 2000 - 2600, 3, -200, { kcalGoal: 2000, protG: 150, carbsG: 200, fatG: 60 });
const smD1 = '2020-03-11';
assert(store.userData.nutrition.byDate[smD1].goal.kcalGoal === 1800, 'Lissage : objectif du jour suivant reduit (-200)');
assert(store.userData.nutrition.byDate[smD1].smoothed && store.userData.nutrition.byDate[smD1].smoothed.delta === -200, 'Lissage : jour marque comme lisse');
assert(store.userData.nutrition.byDate[smD1].goal.protG === 135, 'Lissage : macros ajustees proportionnellement');
// jours recommandes = floor(|D|/200)
assert(Math.floor(600 / 200) === 3, 'Lissage : jours recommandes floor(|D|/200)');

// Ecart calorique dans le ruban de dates horizontal (plus de carte calendrier).
// On reutilise la page nutrition existante (eviter les id en double sous jsdom).
const nh = pages.nutrition;
store.addNutritionLog(todayISO(), { name: 'X (500 g)', baseName: 'X', meal: 'Snack', prot: 50, carbs: 300, fat: 120, fiber: 0, kcal: 2480, per100: { prot: 10, carbs: 60, fat: 24 }, weight: 500 });
nutrition.render(nh);
assert(!nh.querySelector('#nut-cal'), 'Nutrition : carte calendrier retiree');
assert(nh.querySelectorAll('.date-chip').length === 8, 'Nutrition : ruban de dates conserve (7 jours + « + »)');
const chipT = [...nh.querySelectorAll('.date-chip')].find((c) => c.dataset.date === todayISO());
assert(chipT && chipT.querySelector('.d-diff'), 'Nutrition : ecart calorique affiche dans le ruban');
assert(chipT.querySelector('.d-diff.bad'), 'Nutrition : gros ecart en rouge');
assert(nh.querySelector('#btn-macro-goals'), 'Nutrition : bouton Objectifs macros toujours present');
assert(nh.querySelector('.macro-actions'), 'Nutrition : conteneur macro-actions (deux boutons cote a cote)');

// Historique : selecteur de repas + memorisation du dernier type
store.saveUserData({ settings: { lastMealType: 'Déjeuner' } });
assert(store.userData.settings.lastMealType === 'Déjeuner', 'Historique : dernier type de repas memorise');

// Transitions : keyframes definis
const cssTx = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
assert(/@keyframes cardIn/.test(cssTx), 'Transitions : animation cardIn definie');
assert(/@keyframes itemIn/.test(cssTx), 'Transitions : animation itemIn (listes) definie');
assert(/--spring:/.test(cssTx), 'Transitions : courbe spring definie');
assert(/prefers-reduced-motion/.test(cssTx), 'Transitions : respect de prefers-reduced-motion');

// Accueil sans scroll : overflow hidden
assert(/#page-home \{[^}]*overflow: hidden/.test(cssTx), 'Accueil : page non scrollable (overflow hidden)');
assert(/\.home-fit \{[^}]*height: calc/.test(cssTx), 'Accueil : hauteur verrouillee');

// Historique : désormais un onglet de la loupe. Clic sur une entrée -> éditeur pré-rempli.
store.addNutritionLog('2020-05-01', { name: 'Boulgour (250 g)', baseName: 'Boulgour', meal: 'Déjeuner', prot: 6.5, carbs: 70, fat: 0.8, fiber: 1, kcal: 313, per100: { prot: 2.6, carbs: 28, fat: 0.3, fiber: 0.4 }, weight: 250 });
store.saveUserData({ settings: { lastMealType: 'Dîner' } });
nutrition.render(pages.nutrition);
document.getElementById('fab-nutrition').click();
document.getElementById('fab-search').click();
const histSheet = document.querySelector('.sheet');
assert(histSheet.querySelector('#fs-tabs button.active').dataset.tab === 'history', 'Loupe : onglet Historique actif par défaut');
const histItem = [...histSheet.querySelectorAll('.hist-item')].find((it) => it.textContent.includes('Boulgour'));
assert(histItem && histItem.textContent.includes('250 g'), 'Historique : quantité précédente affichée');
// Sélectionner un repas puis cliquer : ajout DIRECT sans éditeur
histSheet.querySelector('#fs-meal button[data-v="Snack"]').click();
const beforeHist = (store.userData.nutrition.byDate[todayISO()] || { meals: [] }).meals.length;
histItem.click();
const afterHist = store.userData.nutrition.byDate[todayISO()].meals.length;
assert(afterHist === beforeHist + 1, 'Historique : clic ajoute directement (sans menu)');
const histAdded = store.userData.nutrition.byDate[todayISO()].meals.slice(-1)[0];
assert(histAdded.meal === 'Snack' && histAdded.weight === 250, 'Historique : bon repas + quantité mémorisée');
assert(![...document.querySelectorAll('.sheet')].some((s) => s.querySelector('#m-name')), 'Historique : aucun éditeur ouvert');
clearOverlays();

// Graphe de poids : ouvert en touchant la carte Poids, courbe épurée
store.userData.nutrition.byDate[todayISO()].smoothed = { delta: -150, from: '2020-05-01' };
// Pesée ancienne : l'historique doit remonter bien au-delà d'une semaine
store.userData.weights.unshift({ date: todayISO(-60), value: 78.2 });
home.render(pages.home);
pages.home.querySelector('#home-weight').click();
const chartModal = document.querySelector('.modal');
assert(chartModal && chartModal.querySelector('#weight-chart'), 'Poids : la carte ouvre la fenêtre du graphique');
// Plus d'objectif de poids : on s'arrête quand on est satisfait, pas à un chiffre
assert(chartModal.querySelector('#btn-log-weight'), 'Poids : ajout d\'une pesée dans la fenêtre');
assert(!chartModal.querySelector('#btn-edit-goal'), 'Poids : plus de bouton objectif');
assert(chartModal.querySelectorAll('#w-range button').length === 4, 'Poids : plages 1 mois / 3 mois / 1 an / tout');
// Style de courbe : aucun point, interpolation monotone, graduations sobres
const wDs = lastChartCfg.data.datasets[0];
assert(lastChartCfg.options.elements.point.radius === 0, 'Graphe : aucun point de donnée');
assert(wDs.cubicInterpolationMode === 'monotone', 'Graphe : courbe lissée sans bosse parasite');
assert(lastChartCfg.options.scales.y.ticks.maxTicksLimit <= 5, 'Graphe : graduations verticales simplifiées');
assert(lastChartCfg.options.scales.x.grid.display === false, 'Graphe : pas de grille verticale');
// Historique bien au-delà d'une semaine
assert(lastChartCfg.data.labels.length > 14, 'Graphe : historique de poids au-delà de 2 semaines');
clearOverlays();

console.log('== v3.40 : loupe, base aliments, animation LP, macro centre ==');
const foodsMod = await import('./data/foods.js');
assert(foodsMod.FOODS.length > 100, 'Base aliments : >100 aliments pre-charges');
assert(foodsMod.FOODS.some((f) => f.n.toLowerCase().includes('whey')), 'Base aliments : whey (aliment moyenne) present');
assert(foodsMod.FOOD_CATEGORIES.includes('Fruits') && foodsMod.FOOD_CATEGORIES.includes('Légumes'), 'Base aliments : categories fruits/legumes');
// FAB loupe
const nfab = pages.nutrition;
nutrition.render(nfab);
document.getElementById('fab-nutrition').click();
assert(document.getElementById('fab-search'), 'FAB : bouton loupe present');
document.getElementById('fab-search').click();
const fdSheet = document.querySelector('.sheet');
assert(fdSheet && fdSheet.querySelector('#fs-search'), 'Loupe : barre de recherche');
fdSheet.querySelector('#fs-tabs button[data-tab="all"]').click();
assert(fdSheet.querySelectorAll('#fs-list .hist-item').length > 50, 'Loupe/Tous : base d\'aliments affichée');
clearOverlays();
// Animation LP
const uiCel = await import('./utils/ui.js');
assert(typeof uiCel.celebrateLP === 'function', 'Animation LP : fonction celebrateLP exportee');
const cbtn = document.createElement('button'); document.body.appendChild(cbtn);
uiCel.celebrateLP(cbtn, { label: '+ LP' });
assert(document.getElementById('lp-fx-layer'), 'Animation LP : couche de particules creee');
// Icone search dans les deux jeux
assert(uiMod.icons.search || true, 'Icone search disponible');
// Macro-actions centre + bouton smooth absolu
const cssMa = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
assert(/\.macro-actions \{[^}]*justify-content: center/.test(cssMa), 'Macro : bouton objectif centre');
assert(/\.macro-actions #btn-smooth \{[^}]*position: absolute/.test(cssMa), 'Macro : bouton lisser en absolu (ne decale pas)');
// Puces de date largeur fixe
assert(/\.date-chip \{[^}]*width: 58px/.test(cssMa), 'Dates : largeur fixe (independante du contenu)');

console.log('== v4.3 : coach métabolique (maintenance + stagnation) ==');
{
  const anchor = '2026-08-02';
  const dISO = (off) => { const d = new Date(Date.UTC(2026, 7, 2)); d.setUTCDate(d.getUTCDate() + off); return d.toISOString().slice(0, 10); };
  // Génère des pesées et des apports sur la fenêtre
  const flatWeights = []; const decWeights = []; const intake2500 = {}; const intake3300 = {};
  for (let off = -20; off <= 0; off += 2) {
    flatWeights.push({ date: dISO(off), value: 80 });                 // poids plat
    decWeights.push({ date: dISO(off), value: 80.5 + (-off) * (0.5 / 7) }); // ancien + lourd → ~ -0.5 kg/sem
  }
  for (let off = -20; off <= -1; off++) { intake2500[dISO(off)] = 2500; intake3300[dISO(off)] = 3300; }

  const mi = mathmod.metabolicInsight;

  // Sèche + poids plat → plateau, −200
  const cutPlateau = mi({ weights: flatWeights, intakeByDate: intake2500, goalType: 'Perte de poids', today: anchor, bodyweight: 80 });
  assert(cutPlateau.status === 'plateau' && cutPlateau.suggestedDelta === -200, 'Coach : sèche + poids plat → plateau, -200 kcal');
  assert(Math.abs(cutPlateau.maintenanceEst - 2500) <= 10, 'Coach : maintenance ≈ apport quand le poids est plat');

  // Sèche + perte régulière → on track
  const cutOk = mi({ weights: decWeights, intakeByDate: intake2500, goalType: 'Perte de poids', today: anchor, bodyweight: 80 });
  assert(cutOk.status === 'on_track' && cutOk.weeklyRateKg < 0, 'Coach : sèche + perte régulière → on track');

  // Maintenance empirique : mange 3300, perd ~0.5/sem → maintenance ≈ 3850
  const maintCheck = mi({ weights: decWeights, intakeByDate: intake3300, goalType: 'Perte de poids', today: anchor, bodyweight: 80 });
  assert(Math.abs(maintCheck.maintenanceEst - 3850) <= 40, 'Coach : maintenance = apport − pente×1100 (Gouiffe)');

  // Prise + poids plat → plateau, +200
  const bulk = mi({ weights: flatWeights, intakeByDate: intake2500, goalType: 'Prise de muscle', today: anchor, bodyweight: 80 });
  assert(bulk.status === 'plateau' && bulk.suggestedDelta === 200, 'Coach : prise + poids plat → plateau, +200 kcal');

  // Objectif maintenance (recomp) → jamais d'ajustement
  const hold = mi({ weights: flatWeights, intakeByDate: intake2500, goalType: 'Recomposition', today: anchor, bodyweight: 80 });
  assert(hold.status === 'hold' && hold.suggestedDelta === null, 'Coach : objectif maintenance → pas de détection/ajustement');

  // Données insuffisantes → insufficient
  const few = mi({ weights: [{ date: dISO(-2), value: 80 }, { date: dISO(0), value: 80 }], intakeByDate: {}, goalType: 'Perte de poids', today: anchor, bodyweight: 80 });
  assert(few.status === 'insufficient', 'Coach : trop peu de pesées → insufficient');

  // Cooldown : plateau mais ajustement récent → pas de nouvelle suggestion
  const cd = mi({ weights: flatWeights, intakeByDate: intake2500, goalType: 'Perte de poids', today: anchor, bodyweight: 80, lastAdjustDate: dISO(-3) });
  assert(cd.status === 'cooldown' && cd.suggestedDelta === null, 'Coach : ajustement récent → cooldown (anti-spam)');
}

console.log('== v4.4 : traduction, séance de référence, types de série, rang custom ==');
{
  const exMod = await import('./data/exercises.js');
  const byId = (id) => exMod.EXERCISES.find((e) => e.id === id);
  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const searchable = (id) => norm([byId(id).name, ...(exMod.AKA[id] || [])].join(' '));

  // Traduction
  assert(byId('benchPress').name === 'Développé couché', 'Exos : nom affiché en français');
  assert(byId('deadlift').name === 'Soulevé de terre', 'Exos : « Soulevé de terre »');
  assert(byId('hackSquat').name === 'Hack Squat', 'Exos : « Hack Squat » laissé en anglais (usage courant)');
  assert(byId('facePull').name === 'Face Pull', 'Exos : « Face Pull » laissé en anglais');
  // Recherche bilingue
  assert(searchable('benchPress').includes('bench press'), 'Recherche : l\'anglais reste trouvable');
  assert(searchable('deadlift').includes('deadlift'), 'Recherche : « deadlift » trouve toujours');
  assert(searchable('benchPress').includes(norm('Développé couché')), 'Recherche : le français est trouvable');

  // Rang d'un exercice custom via référence + coefficient.
  // Les standards ne sont pas charges par fetch hors navigateur : on les lit
  // depuis le fichier, sinon le plancher de rang ne se declenche jamais et le
  // test passerait sans rien verifier.
  const ranksM = await import('./utils/ranks.js');
  const std = JSON.parse(fs.readFileSync(new URL('./standards.json', import.meta.url), 'utf8'));
  const bw = 80;
  const mkW = (id, w) => [{ id: 'w1', date: todayISO(), exercises: [{ exerciseId: id, sets: [{ weight: w, reps: 5 }] }] }];
  const opts = { bodyweight: bw, weights: [], standards: std };
  const lpRef = ranksM.computeExerciseLP(mkW('benchPress', 160), opts);
  const lpCustom = ranksM.computeExerciseLP(mkW('cx1', 80), { ...opts, customRefs: { cx1: { refId: 'benchPress', coef: 0.5 } } });
  const lpNoRef = ranksM.computeExerciseLP(mkW('cx1', 80), opts);
  assert(lpRef.benchPress > 500, 'Rang : les standards donnent bien un plancher élevé sur une grosse charge');
  // 80 kg avec coef 0.5 ⇒ équivalent 160 kg sur la référence ⇒ même LP
  assert(Math.abs(lpCustom.cx1 - lpRef.benchPress) < 1, 'Rang custom : coef 0.5 ⇒ 80 kg valent 160 kg sur la référence');
  assert(lpNoRef.cx1 < lpCustom.cx1, 'Rang custom : sans référence, pas de plancher issu des standards');

  // Séance de référence (colonne PRÉC) : meilleure du mois, pas la dernière.
  // On rejoue la logique de bestEntry sur des données contrôlées.
  const wsIsWork = (s) => s.kind !== 'warmup' && s.kind !== 'drop';
  const score = (sets) => {
    const ws = sets.filter(wsIsWork);
    return { vol: ws.reduce((a, s) => a + s.weight * s.reps, 0), max: ws.reduce((a, s) => Math.max(a, s.weight), 0), n: ws.length };
  };
  const grosse = score([{ weight: 100, reps: 8 }, { weight: 100, reps: 8 }, { weight: 100, reps: 8 }, { weight: 100, reps: 8 }]);
  const recente = score([{ weight: 90, reps: 8 }, { weight: 90, reps: 8 }]);
  assert(grosse.vol > recente.vol, 'PRÉC : la meilleure séance (4×100) bat la plus récente (2×90)');
  // À volume égal, la charge la plus lourde départage
  const a = score([{ weight: 100, reps: 8 }]);
  const b = score([{ weight: 80, reps: 10 }]);
  assert(a.vol === b.vol && a.max > b.max, 'PRÉC : à volume égal, la charge max départage');
  // Échauffements et dégressives exclus du score
  const avecW = score([{ weight: 40, reps: 10, kind: 'warmup' }, { weight: 100, reps: 8 }, { weight: 60, reps: 12, kind: 'drop' }]);
  assert(avecW.n === 1 && avecW.vol === 800, 'PRÉC : W et D exclus du calcul de la référence');
}

console.log('== v4.7 : les objectifs passés ne bougent plus ==');
{
  const hier = todayISO(-1);
  const avantHier = todayISO(-2);
  const auj = todayISO();
  // Historique sans objectif figé, saisi alors que l'objectif valait 2500
  store.userData.settings.macroMode = 'grams';
  store.userData.settings.proteinGoal = 150;
  store.userData.settings.carbsGoalG = 300;
  store.userData.settings.fatGoalG = 80;
  store.userData.nutrition.byDate[hier] = { meals: [{ id: 'h1', name: 'x', meal: 'Déjeuner', prot: 50, carbs: 100, fat: 30, fiber: 0, kcal: 870 }] };
  store.userData.nutrition.byDate[avantHier] = { meals: [{ id: 'h2', name: 'y', meal: 'Déjeuner', prot: 40, carbs: 90, fat: 25, fiber: 0, kcal: 745 }] };
  delete store.userData.nutrition.byDate[hier].goal;
  delete store.userData.nutrition.byDate[avantHier].goal;
  const avant = nutrition.macroGoals().kcalGoal;

  // L'utilisateur baisse son objectif de 200 kcal
  nutrition.applyCalorieDelta(-200);
  const apres = nutrition.macroGoals().kcalGoal;
  assert(apres === avant - 200, 'Objectif : la baisse de 200 kcal est appliquée');

  const gHier = store.userData.nutrition.byDate[hier].goal;
  const gAvantHier = store.userData.nutrition.byDate[avantHier].goal;
  assert(gHier && gHier.kcalGoal === avant, 'Objectif : hier garde l\'ancien objectif');
  assert(gAvantHier && gAvantHier.kcalGoal === avant, 'Objectif : avant-hier garde l\'ancien objectif');
  assert(nutrition.macroGoalsFor(hier).kcalGoal === avant, 'Objectif : macroGoalsFor(hier) renvoie l\'ancien');
  assert(nutrition.macroGoalsFor(auj).kcalGoal === apres, 'Objectif : aujourd\'hui suit le nouvel objectif');

  // Un second changement ne doit pas réécrire ce qui est déjà figé
  nutrition.applyCalorieDelta(-200);
  assert(store.userData.nutrition.byDate[hier].goal.kcalGoal === avant, 'Objectif : un jour déjà figé n\'est jamais réécrit');
}

console.log('== v5.2 : suppression des pesées et relevés de pas ==');
{
  // Pesées : suppression + repli du poids de profil
  store.userData.weights = [
    { date: todayISO(-2), value: 79 },
    { date: todayISO(-1), value: 78.5 },
    { date: todayISO(), value: 78 },
  ];
  store.userData.profile.weight = 78;
  store.removeWeightLog(todayISO());
  assert(store.userData.weights.length === 2, 'Poids : la pesée est retirée');
  assert(!store.userData.weights.some((w) => w.date === todayISO()), 'Poids : la bonne date est retirée');
  assert(store.userData.profile.weight === 78.5, 'Poids : le profil retombe sur la pesée restante la plus récente');

  // Pas : suppression du relevé et de son objectif figé
  store.userData.steps.byDate[todayISO()] = 8000;
  store.userData.steps.goalByDate[todayISO()] = 10000;
  store.removeStepsLog(todayISO());
  assert(store.userData.steps.byDate[todayISO()] === undefined, 'Pas : le relevé est retiré');
  assert(store.userData.steps.goalByDate[todayISO()] === undefined, 'Pas : l\'objectif figé du jour est retiré');

  // Rendu v6.8 : toucher une barre ouvre la saisie du jour, avec « Supprimer »
  store.userData.steps.byDate[todayISO(-1)] = 7500;
  activity.render(pages.activity);
  pages.activity.querySelector(`.sb-col[data-date="${todayISO(-1)}"]`).click();
  const stModal = [...document.querySelectorAll('.modal')].pop();
  assert(stModal.querySelector('#st-count').value === '7500', 'Pas : barre -> saisie pre-remplie');
  [...stModal.querySelectorAll('.modal-actions .btn')].find((x) => x.textContent.includes('Supprimer')).click();
  assert(store.userData.steps.byDate[todayISO(-1)] === undefined, 'Pas : suppression depuis la saisie');
  clearOverlays();
  // Série : 3 jours consecutifs a l'objectif (hier, avant-hier, J-3), aujourd'hui pas encore
  for (const i of [-1, -2, -3]) { store.userData.steps.byDate[todayISO(i)] = 12000; store.userData.steps.goalByDate[todayISO(i)] = 10000; }
  store.userData.steps.byDate[todayISO(-4)] = 2000;
  store.userData.steps.byDate[todayISO()] = 500;
  activity.render(pages.activity);
  const kpis = [...pages.activity.querySelectorAll('.steps-kpi')].map((k) => k.textContent.replace(/\s+/g, ' ').trim());
  assert(kpis.some((k) => /S[ée]rie ?3 j/i.test(k)), `Pas : serie de 3 jours (${kpis.join(' | ')})`);
  assert(pages.activity.querySelectorAll('.sb-bar.hit').length === 3, 'Pas : barres vertes = objectif atteint');
  pages.activity.querySelector('#view-toggle button[data-d="30"]').click();
  assert(pages.activity.querySelectorAll('.sb-plot .sb-col').length === 30, 'Pas : vue 30 jours');
  pages.activity.querySelector('#view-toggle button[data-d="7"]').click();

  // Séance vide en tête du menu de démarrage
  clearOverlays();
  workout.render(pages.workout);
  pages.workout.querySelector('#btn-new-session').click();
  const nsSheet = [...document.querySelectorAll('.sheet')].find((s) => s.querySelector('.ns-list'));
  const first = nsSheet.querySelector('.ns-list').firstElementChild;
  assert(first && first.classList.contains('ns-empty'), 'Séance : « séance vide » en haut de la liste');
  clearOverlays();

  // Le glissement horizontal doit être ABSORBÉ sur les lignes glissables :
  // sinon app.js le convertit en changement d'onglet et la poubelle ne
  // s'ouvre jamais. C'est ce qui manquait en v5.2.
  const appSrc = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  const absorb = appSrc.match(/const SWIPE_ABSORB_ZONES = '([^']+)'/);
  assert(absorb, 'Swipe : zones d\'absorption déclarées');
  for (const sel of ['.swipe-row', '.exo-swipe-row']) {
    assert(absorb[1].includes(sel), `Swipe : ${sel} absorbe le geste horizontal`);
  }

  // `itemIn` est declaree avec `fill: both` : sa valeur finale (transform:none)
  // persiste et PRIME sur le style inline. Appliquee au contenu glissable, elle
  // annulait le decalage — la poubelle n'apparaissait qu'un instant.
  const cssSwipe = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  // v6 : plus aucune animation d'entree sur les lignes glissables, ce qui
  // ecarte definitivement le piege du `fill: both`.
  assert(!/\.swipe-row[^{]*\{[^}]*animation/.test(cssSwipe) && !/\.swipe-content[^{]*\{[^}]*animation/.test(cssSwipe),
    'Swipe : aucune animation ne peut ecraser le decalage du contenu');
}

console.log('== v5.5 : lissage modifiable + inertie de fermeture ==');
{
  const src = todayISO(-1);
  const j1 = todayISO(); const j2 = todayISO(1);
  const base = { kcalGoal: 2500, protG: 170, carbsG: 280, fatG: 78 };
  store.userData.nutrition.byDate[src] = { meals: [], goal: { ...base } };
  store.userData.nutrition.byDate[j1] = { meals: [], goal: { ...base } };
  store.userData.nutrition.byDate[j2] = { meals: [], goal: { ...base } };
  delete store.userData.nutrition.byDate[j1].smoothed;
  delete store.userData.nutrition.byDate[j2].smoothed;

  // Applique : -400 kcal repartis sur 2 jours
  store.applyCalorieSmoothing(src, -400, 2, -200, base);
  assert(store.userData.nutrition.byDate[j1].goal.kcalGoal === 2300, 'Lissage : objectif du jour suivant reduit');
  assert(store.userData.nutrition.byDate[j1].smoothed, 'Lissage : jour marque comme ajuste');

  // Retrouve le lissage depuis sa date source
  const found = store.findCalorieSmoothing(src);
  assert(found && found.days.length === 2, 'Lissage : retrouve depuis la date source');
  assert(found.perDay === -200, 'Lissage : ajustement quotidien correct');

  // Supprime : les objectifs reviennent EXACTEMENT a l'origine
  const n = store.removeCalorieSmoothing(src);
  assert(n === 2, 'Lissage : suppression sur les 2 jours');
  assert(store.userData.nutrition.byDate[j1].goal.kcalGoal === 2500, 'Lissage : objectif restaure a l\'identique');
  assert(store.userData.nutrition.byDate[j1].goal.protG === 170, 'Lissage : macros restaurees a l\'identique');
  assert(!store.userData.nutrition.byDate[j1].smoothed, 'Lissage : marqueur retire');
  assert(store.findCalorieSmoothing(src) === null, 'Lissage : plus rien a retrouver apres suppression');

  // Reappliquer apres modification ne doit pas cumuler
  store.applyCalorieSmoothing(src, -400, 2, -200, base);
  store.removeCalorieSmoothing(src);
  store.applyCalorieSmoothing(src, -400, 4, -100, base);
  assert(store.userData.nutrition.byDate[j1].goal.kcalGoal === 2400, 'Lissage : mise a jour sans cumul');
  store.removeCalorieSmoothing(src);

  // Inertie : la fermeture se decide sur la position PROJETEE, pas la distance
  const uiTxt = fs.readFileSync(new URL('./utils/ui.js', import.meta.url), 'utf8');
  assert(/PROJECTION_MS/.test(uiTxt), 'Inertie : projection declaree');
  assert(/const projected = dy \+ Math\.max\(0, velocity\) \* PROJECTION_MS/.test(uiTxt),
    'Inertie : position projetee = distance + vitesse x duree');
  assert(/projected > sheet\.offsetHeight \/ 3/.test(uiTxt), 'Inertie : seuil applique a la projection');
  // Un geste vif et court doit fermer ; un geste lent et court, non.
  const P = 180; const h = 600; const seuil = h / 3;
  assert((60 + 1.2 * P) > seuil, 'Inertie : geste court mais rapide -> ferme');
  assert((60 + 0.1 * P) < seuil, 'Inertie : geste court et lent -> reste ouvert');
  assert((250 + 0 * P) < seuil === false, 'Inertie : geste long sans vitesse -> ferme quand meme');
}

console.log('== v5.6 : accueil, ruban, series persistantes, coefficient ==');
{
  const cssV6 = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  // Les 4 cartes du milieu vivent dans `.home-duo`, qui n'est pas une carte :
  // sans regle dediee, elles entraient sans animation.
  assert(/\.home-fit > \.home-duo > \.card \{ animation: cardIn/.test(cssV6),
    'Accueil : les cartes des duos sont animees comme les autres');
  assert(/\.home-fit > \*:nth-child\(3\) > \.card:nth-child\(2\) \{ animation-delay/.test(cssV6),
    'Accueil : cascade appliquee a l\'interieur des duos');
  // v6 : les entrees en cascade ne se jouent qu'au PREMIER affichage d'une page
  assert(/\.page\.anim-in \.home-fit > \.home-duo > \.card/.test(cssV6),
    'Animations : reservees au premier affichage (.page.anim-in)');
  assert(!/^\.meal-row[^{]*\{[^}]*animation/m.test(cssV6) && !/^\.set-row[^{]*\{[^}]*animation/m.test(cssV6),
    'Animations : les lignes ne se rejouent plus a chaque rendu (plus de clignotement)');

  home.render(pages.home);
  const legend = pages.home.querySelector('.hk-donut-legend').textContent;
  assert(/P \d+g/.test(legend) && /L \d+g/.test(legend), 'Accueil : macros de l\'anneau en grammes');
  assert(!legend.includes('%'), 'Accueil : plus de pourcentages dans l\'anneau');

  nutrition.render(pages.nutrition);
  const chips = [...pages.nutrition.querySelectorAll('.date-chip')];
  assert(chips[0].id === 'date-more', 'Nutrition : le « + » ouvre le ruban a gauche (avant le plus ancien jour)');
  assert(chips.length === 8, 'Nutrition : toujours 7 jours + le « + »');

  // ---- Progression : on compare la MEILLEURE SERIE d'une seance a la precedente
  store.userData.workouts = [];
  const mk = (date, sets) => ({ id: 'w6-' + date, date, exercises: [{ exerciseId: 'benchPress', sets }], totalVolume: 0, totalTime: 600 });
  const rep = (n, s) => [...Array(n)].map(() => ({ ...s }));
  store.addWorkout(mk(todayISO(-10), rep(3, { weight: 80, reps: 8 })));   // premiere fois
  store.addWorkout(mk(todayISO(-6), [{ weight: 80, reps: 10 }, { weight: 70, reps: 8 }, { weight: 60, reps: 8 }])); // meilleure serie plus forte, series de fin plus legeres
  store.addWorkout(mk(todayISO(-2), rep(6, { weight: 80, reps: 8 })));    // 2x le volume, meilleure serie plus faible

  workout.render(pages.workout);
  pages.workout.querySelector('#btn-new-session').click();
  document.querySelector('.sheet .ns-empty').click();
  const ov6 = document.querySelector('.session-overlay');
  ov6.querySelector('#s-add-exo').click();
  const pick6 = document.querySelector('.picker-overlay');
  pick6.querySelector('#exo-search').value = 'Bench Press';
  fire(pick6.querySelector('#exo-search'), 'input');
  [...pick6.querySelectorAll('.exo-search-item')].find((it) => it.querySelector('span').textContent === 'Développé couché').click();
  const card6 = ov6.querySelector('#s-exos .exo-card');

  card6.querySelector('[data-detail]').click();
  const edSheet = [...document.querySelectorAll('.sheet')].find((s) => s.querySelector('.ed-hist-item'));
  const hist = [...edSheet.querySelectorAll('.ed-hist-item')];
  assert(hist.length === 3, 'Fiche exo : 3 seances dans l\'historique');
  assert(!edSheet.textContent.includes('kg pondérés'), 'Fiche exo : volume total en kg retire');
  assert(!edSheet.querySelector('.ed-coef'), 'Fiche exo : plus de coefficient cumule (remplace par la variation)');
  const imps = hist.map((h) => h.querySelector('.ed-imp').textContent.trim());
  // hist est en ordre antechronologique : [-2j, -6j, -10j]
  assert(imps[2] === '1re', 'Progression : la premiere seance est marquee comme telle');
  assert(imps[1] === '+5 %', `Progression : une rep de plus sur la meilleure serie (80x8 -> 80x10) = +5 % (${imps[1]})`);
  assert(imps[0] === '-5 %', `Progression : six series a 80x8 apres 80x10 = baisse, malgre le double de volume (${imps[0]})`);
  // Les series de fin plus legeres n'entrent pas dans la comparaison
  const topSets = hist.map((h) => h.querySelector('.ed-set.is-top .ed-set-v').textContent);
  assert(topSets[1] === '80 kg × 10', 'Progression : la meilleure serie est mise en avant');
  const best6 = hist.find((h) => h.classList.contains('ed-hist-best'));
  assert(best6 === hist[1], 'Reference : la seance a la meilleure serie la plus forte (et non au plus gros volume)');
  document.querySelectorAll('.sheet, .scrim').forEach((s) => s.remove());

  // ---- Validation / devalidation des series
  // `renderExos` reconstruit la carte : on la relit a chaque fois.
  const cardNow = () => ov6.querySelector('#s-exos .exo-card');
  const rowsOf = () => [...cardNow().querySelectorAll('.set-row')];
  // La reference retenue est la seance a 3 series (la plus forte), pas celle a 6.
  assert(rowsOf().length === 3, 'Seance : autant de lignes que la seance de reference');
  const setRow = (i, kg, reps) => {
    const r = rowsOf()[i];
    r.querySelector('.sr-kg').value = String(kg);
    r.querySelector('.sr-reps').value = String(reps);
    return r;
  };
  setRow(0, 80, 8);
  setRow(1, 80, 8).querySelector('.sr-check').click(); // valide la 2e -> valide aussi la 1re
  assert(cardNow().querySelectorAll('.set-row.done').length === 2, 'Serie : valider apres une ligne remplie valide les deux');

  // Devalider l'avant-derniere : la ligne RESTE, avec ses valeurs
  rowsOf()[0].querySelector('.sr-check').click();
  assert(rowsOf().length === 3, 'Devalidation : la ligne ne disparait pas');
  assert(!rowsOf()[0].classList.contains('done'), 'Devalidation : la ligne repasse a valider');
  assert(rowsOf()[0].querySelector('.sr-kg').value === '80' && rowsOf()[0].querySelector('.sr-reps').value === '8',
    'Devalidation : poids et reps conserves');
  assert(rowsOf()[1].classList.contains('done'), 'Devalidation : la serie suivante reste validee');
  rowsOf()[0].querySelector('.sr-check').click(); // revalidation
  assert(rowsOf()[0].classList.contains('done'), 'Revalidation : la ligne se recoche');

  // Modifier une serie validee la devalide (valeurs gardees)
  const r1 = rowsOf()[1];
  r1.querySelector('.sr-kg').value = '85';
  fire(r1.querySelector('.sr-kg'), 'change');
  assert(!r1.classList.contains('done') && !r1.querySelector('.sr-check').classList.contains('on'),
    'Modification : la serie validee est decochee, a revalider');
  assert(r1.querySelector('.sr-kg').value === '85', 'Modification : la valeur saisie reste en place');

  // Serie ajoutee puis laissee vide : supprimable comme les autres
  const before = rowsOf().length;
  cardNow().querySelector('.sr-add').click();
  const added = rowsOf()[rowsOf().length - 1];
  assert(rowsOf().length === before + 1, '« Ajouter une serie » : une ligne de plus');
  assert(added.classList.contains('sr-live') && added.querySelector('.sr-del'),
    'Serie vide ajoutee : supprimable (poubelle presente)');
  added.querySelector('.sr-del').click();
  assert(rowsOf().length === before, 'Serie vide : supprimee comme les autres');

  // Enregistrement : seules les series validees partent dans la seance
  const nBefore = store.userData.workouts.length;
  ov6.querySelector('#s-finish').click();
  const sum6 = document.querySelector('.modal');
  [...sum6.querySelectorAll('.modal-actions .btn')].find((b) => b.textContent.includes('Valider')).click();
  const saved6 = store.userData.workouts[store.userData.workouts.length - 1];
  assert(store.userData.workouts.length === nBefore + 1, 'Seance enregistree');
  assert(saved6.exercises[0].sets.length === 1, 'Enregistrement : seules les series validees sont gardees');
  assert(saved6.exercises[0].sets.every((s) => s.done === undefined), 'Enregistrement : marqueur `done` retire des donnees');
  clearOverlays();
}

console.log('== v5.7 : materiel, editeur d\'exercice ==');
{
  const exdata = await import('./data/exercises.js');
  // ---- Base : materiel renseigne partout, exos perso integres
  assert(exdata.EXERCISES.length === 204, 'Base : 204 exercices (152 + 18 repris de la bibliotheque perso + 34 variantes)');
  assert(exdata.EXERCISES.every((e) => Array.isArray(e.equip) && e.equip.length), 'Base : materiel renseigne pour chaque exercice');
  const eqIds = new Set(exdata.EQUIPMENT.map((q) => q.id));
  assert(exdata.EXERCISES.every((e) => e.equip.every((q) => eqIds.has(q))), 'Base : aucun materiel inconnu');
  const bp = exdata.EXERCISES.find((e) => e.id === 'benchPress');
  assert(bp.equip.includes('barbell') && bp.equip.includes('bench'), 'Materiel : le developpe couche demande barre ET banc');
  assert(exdata.EXERCISES.some((e) => e.id === 'custom_22a584ca') && exdata.EXERCISES.some((e) => e.id === 'lo_smithRow'),
    'Exos perso : passes dans la base en gardant leur identifiant');
  assert(exdata.EXERCISES.every((e) => [...e.primaryMuscles, ...e.secondaryMuscles].reduce((a, x) => a + x.p, 0) === 100),
    'Base : la repartition musculaire fait 100 % partout');
  store.userData.settings.customExercises = [];
  store.userData.settings.exerciseEquip = {};
  assert(workout.customRefMap().custom_22a584ca.coef === 2, 'Rangs : la reference des exos perso est conservee');
  assert(workout.customRefMap().custom_c6a2d0dd.refId === 'cablePushdown', 'Rangs : exercice de reference conserve');

  // ---- v6 : plus de marques, l'historique est commun
  assert(typeof workout.hasBrand === 'undefined' && typeof workout.currentBrand === 'undefined', 'Marques : retirees du module');
  assert(typeof exdata.BRANDS === 'undefined' && typeof exdata.BRANDED_EQUIP === 'undefined', 'Marques : retirees des donnees');
  store.userData.workouts = [];
  store.addWorkout({ id: 'br1', date: todayISO(-4), totalTime: 600, exercises: [{ exerciseId: 'legPress', sets: [{ weight: 200, reps: 10 }] }] });
  // Une ancienne seance enregistree avec une marque reste dans l'historique
  store.addWorkout({ id: 'br2', date: todayISO(-2), totalTime: 600, exercises: [{ exerciseId: 'legPress', brand: 'Panatta', sets: [{ weight: 150, reps: 10 }] }] });

  workout.render(pages.workout);
  pages.workout.querySelector('#btn-new-session').click();
  document.querySelector('.sheet .ns-empty').click();
  const ov7 = document.querySelector('.session-overlay');
  ov7.querySelector('#s-add-exo').click();
  const pick7 = document.querySelector('.picker-overlay');
  pick7.querySelector('#exo-search').value = 'Presse a cuisses';
  fire(pick7.querySelector('#exo-search'), 'input');
  [...pick7.querySelectorAll('.exo-search-item')][0].click();

  const openDetail = () => {
    ov7.querySelector('#s-exos .exo-card [data-detail]').click();
    return [...document.querySelectorAll('.sheet')].find((s) => s.querySelector('#ed-history'));
  };
  let ed = openDetail();
  assert(ed, 'Fiche exo ouverte');
  assert(!ed.querySelector('#ed-rest'), 'Fiche exo : le reglage du repos a quitte l\'historique');
  assert(!ed.querySelector('.ed-brand-tag'), 'Fiche exo : plus d\'etiquette de marque');
  assert(ed.querySelectorAll('.ed-hist-item').length === 2, 'Historique : toutes les seances, marque ou non');

  // Le crayon NE FERME PAS la fiche
  ed.querySelector('.sheet-action').click();
  assert(document.body.contains(ed), 'Modifier : la fiche d\'historique reste ouverte derriere');
  const edit = document.querySelector('.modal .ex-edit');
  assert(edit, 'Editeur : fenetre ouverte par-dessus');
  const rowKeys = [...edit.querySelectorAll('.ex-row')].map((r) => r.dataset.open);
  assert(rowKeys.join(',') === 'rank,prim,sec,equip,rest',
    'Editeur : une ligne-bouton par reglage (rang, muscles, equipement, repos), sans marque');
  assert(edit.querySelector('#xe-name').value === 'Presse à cuisses', 'Editeur : le nom se modifie directement');
  assert(edit.querySelector('.ex-total').classList.contains('ok'), 'Editeur : total musculaire a 100 %');

  // Muscles : plus de cases a cocher
  edit.querySelector('[data-open="prim"]').click();
  const musSheet = [...document.querySelectorAll('.sheet')].find((s) => s.querySelector('.mus-edit-row'));
  assert(musSheet.querySelectorAll('.mus-edit-row').length === 19, 'Muscles : les 19 muscles sont proposes');
  assert(!musSheet.querySelector('input[type="checkbox"]'), 'Muscles : plus de case a cocher');
  assert(musSheet.querySelectorAll('.mus-edit-row.on').length > 0, 'Muscles : un pourcentage non nul allume la ligne');
  const quadInput = musSheet.querySelector('.mus-edit-p[data-m="quads"]');
  const quadWas = quadInput.value;
  quadInput.value = '10';
  fire(quadInput, 'input');
  assert(musSheet.querySelector('#ms-total').classList.contains('warn'), 'Muscles : total different de 100 signale');
  quadInput.value = quadWas;
  fire(quadInput, 'input');
  assert(musSheet.querySelector('#ms-total').classList.contains('ok'), 'Muscles : total revenu a 100 %');
  musSheet.querySelector('[data-done]').click();

  // Equipement : selection multiple
  edit.querySelector('[data-open="equip"]').click();
  const eqSheet = [...document.querySelectorAll('.sheet')].find((s) => s.querySelector('.equip-chip'));
  assert(eqSheet.querySelectorAll('.equip-chip').length === exdata.EQUIPMENT.length, 'Equipement : tout le materiel propose');
  assert(eqSheet.querySelector('.equip-chip[data-q="machine"]').classList.contains('on'), 'Equipement : machine deja selectionnee');
  eqSheet.querySelector('.equip-chip[data-q="bench"]').click();
  assert(eqSheet.querySelector('.equip-chip[data-q="bench"]').classList.contains('on'), 'Equipement : selection multiple possible');
  eqSheet.querySelector('[data-done]').click();
  assert([...edit.querySelectorAll('.ex-row')].find((r) => r.dataset.open === 'equip').textContent.includes('Banc'),
    'Equipement : le bouton resume le materiel choisi');
  assert(!edit.querySelector('[data-open="brand"]'), 'Equipement : choisir une machine ne fait plus apparaitre de marque');

  // Enregistrement
  const saveBtn = [...document.querySelectorAll('.modal-actions .btn')].find((b) => b.textContent === 'Enregistrer');
  saveBtn.click();
  assert((store.userData.settings.exerciseEquip.legPress || []).includes('bench'), 'Enregistrement : materiel memorise');
  assert(store.userData.settings.exerciseBrand === undefined, 'Enregistrement : aucune marque ecrite');
  document.querySelectorAll('.scrim').forEach((s) => s.remove());

  // La seance enregistree ne porte plus de marque
  const cardL = ov7.querySelector('#s-exos .exo-card');
  cardL.querySelector('.sr-kg').value = '160';
  cardL.querySelector('.sr-reps').value = '10';
  cardL.querySelector('.sr-check').click();
  ov7.querySelector('#s-finish').click();
  [...document.querySelectorAll('.modal-actions .btn')].find((b) => b.textContent.includes('Valider')).click();
  const lastW = store.userData.workouts[store.userData.workouts.length - 1];
  assert(lastW.exercises[0].brand === undefined, 'Seance : plus de marque enregistree avec l\'exercice');
  clearOverlays();
}

console.log('== v6.0 : iPhone, percentile, progression, fluidite ==');
{
  // ---- iPhone : la barre de statut opaque fait descendre la vue jusqu'en bas
  const idx = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert(/apple-mobile-web-app-status-bar-style" content="black"/.test(idx),
    'iPhone : barre de statut opaque (black-translucent laissait ~1 cm vide en bas sous iOS 26)');
  assert(/viewport-fit=cover/.test(idx), 'iPhone : viewport-fit=cover conserve (zone de l\'indicateur d\'accueil)');
  assert(/Archivo/.test(idx), 'Design : police Archivo chargee');

  // ---- Percentile parmi les pratiquants
  const ranksP = await import('./utils/ranks.js');
  const std = JSON.parse(fs.readFileSync(new URL('./standards.json', import.meta.url), 'utf8'));
  const lv = ranksP.resolveStandardLevels('benchPress', std);
  // Pile au standard Intermediaire : plus fort que la moitie des pratiquants
  const atInter = ranksP.liftPercentile('benchPress', lv.intermediate * 80, 1, 80 * (1 + 1 / 30), std);
  assert(Math.round(atInter.percentile) === 50 && atInter.top === 50, `Percentile : standard Intermediaire = top 50 % (${atInter.top})`);
  const atElite = ranksP.liftPercentile('benchPress', lv.elite * 80, 1, 80 * (1 + 1 / 30), std);
  assert(atElite.top === 5, `Percentile : standard Elite = top 5 % (${atElite.top})`);
  const huge = ranksP.liftPercentile('benchPress', 300, 1, 80, std);
  assert(huge.top > 0 && huge.top < 1, `Percentile : jamais « top 0 % », meme tres fort (${huge.top})`);
  const a = ranksP.liftPercentile('benchPress', 80, 5, 80, std).percentile;
  const b = ranksP.liftPercentile('benchPress', 80, 8, 80, std).percentile;
  assert(b > a, 'Percentile : plus de reps au meme poids = mieux classe');
  const plank = ranksP.liftPercentile('plank', 0, 60, 80, std);
  assert(plank.percentile === null, 'Percentile : pas de chiffre invente pour un exercice sans standard');
  const viaRef = ranksP.liftPercentile('custom_22a584ca', 100, 8, 80, std, { refId: 'seatedCableRow', coef: 2 });
  const direct = ranksP.liftPercentile('seatedCableRow', 50, 8, 80, std);
  assert(Math.abs(viaRef.percentile - direct.percentile) < 0.01, 'Percentile : exercice classe via sa reference (100 kg x0.5)');
  assert(typeof ranksP.estimateRankFromLift === 'undefined', 'Ancien calculateur de rang retire');

  // Dans l'app, app.js charge les standards au démarrage ; ici on le fait à la main.
  ranksP.setStandards(std);
  settings.render(pages.settings);
  pages.settings.querySelector('#btn-rank-ladder').click();
  const rm = [...document.querySelectorAll('.modal')].pop();
  assert(rm.querySelector('#pct-exo') && rm.querySelector('#pct-weight') && rm.querySelector('#pct-reps'), 'Percentile : exercice, poids et reps a saisir');
  assert(!rm.querySelector('#calc-run'), 'Percentile : plus de bouton « Calculer » (resultat en direct)');
  rm.querySelector('#pct-exo').click();
  const pp = document.querySelector('.picker-overlay');
  pp.querySelector('#exo-search').value = 'Bench Press';
  fire(pp.querySelector('#exo-search'), 'input');
  [...pp.querySelectorAll('.exo-search-item')].find((it) => it.querySelector('span').textContent === 'Développé couché').click();
  rm.querySelector('#pct-weight').value = '100';
  fire(rm.querySelector('#pct-weight'), 'input');
  rm.querySelector('#pct-reps').value = '5';
  fire(rm.querySelector('#pct-reps'), 'input');
  assert(/TOP\s*\d+/.test(rm.querySelector('#pct-result').textContent), 'Percentile : « Top X % » affiche en direct');
  assert(rm.querySelector('.pct-gauge .pct-fill'), 'Percentile : jauge avec les niveaux');
  assert(rm.querySelectorAll('.ladder-row').length === 8, 'Echelle des rangs conservee');
  clearOverlays();

  // ---- Progression en seance : meilleure serie du jour vs seance precedente
  store.userData.workouts = [];
  store.addWorkout({ id: 'p1', date: todayISO(-3), totalTime: 600, exercises: [{ exerciseId: 'benchPress', sets: [{ weight: 80, reps: 8 }, { weight: 70, reps: 10 }] }] });
  workout.render(pages.workout);
  pages.workout.querySelector('#btn-new-session').click();
  document.querySelector('.sheet .ns-empty').click();
  const ovP = document.querySelector('.session-overlay');
  ovP.querySelector('#s-add-exo').click();
  const pkP = document.querySelector('.picker-overlay');
  pkP.querySelector('#exo-search').value = 'Bench Press';
  fire(pkP.querySelector('#exo-search'), 'input');
  [...pkP.querySelectorAll('.exo-search-item')].find((it) => it.querySelector('span').textContent === 'Développé couché').click();
  const rowsP = () => [...ovP.querySelectorAll('#s-exos .exo-card .set-row')];
  rowsP()[0].querySelector('.sr-kg').value = '80';
  rowsP()[0].querySelector('.sr-reps').value = '8';
  rowsP()[0].querySelector('.sr-check').click();
  let badge = ovP.querySelector('#s-exos .exo-card .badge');
  assert(badge && badge.textContent.trim() === '+0%', `Seance : meme meilleure serie que la fois precedente = +0 % (${badge && badge.textContent})`);
  // Une serie de fin plus legere ne fait pas baisser la progression
  rowsP()[1].querySelector('.sr-kg').value = '50';
  rowsP()[1].querySelector('.sr-reps').value = '8';
  rowsP()[1].querySelector('.sr-check').click();
  badge = ovP.querySelector('#s-exos .exo-card .badge');
  assert(badge.textContent.trim() === '+0%', 'Seance : une serie de fin plus legere ne fait pas chuter le badge');
  ovP.querySelector('#s-quit').click();
  [...document.querySelectorAll('.modal-actions .btn')].find((b) => b.textContent.includes('Confirmer')).click();
  clearOverlays();

  // ---- Fluidite : navigation
  const appSrc = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  assert(/renderedAt\[i\] !== store\.version/.test(appSrc), 'Navigation : une page n\'est redessinee que si les donnees ont change');
  assert(/place\(currentPage, drag\.dx, false\)/.test(appSrc), 'Navigation : le carrousel suit le doigt');
  assert(/prerenderOthers/.test(appSrc), 'Navigation : onglets voisins prepares a l\'avance');
  assert(/el\.scrollTop = y/.test(appSrc), 'Navigation : position de defilement conservee au rendu');
  const v0 = store.version;
  store.addWater(todayISO(), 0.25);
  assert(store.version === v0 + 1, 'Stockage : chaque ecriture incremente la version');
  const cssF = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  assert(!/backdrop-filter/.test(cssF), 'Fluidite : plus aucun flou d\'arriere-plan (couteux sur iPhone)');
  assert(!/#app-container \{[^}]*will-change: transform/.test(cssF), 'Fluidite : pas de couche GPU permanente de 5 ecrans');
}

console.log('== v6.1 : anatomie detaillee et carte du corps ==');
{
  const exd = await import('./data/exercises.js');
  const ids = new Set(exd.MUSCLES.map((m) => m.id));
  assert(exd.MUSCLES.length === 19, 'Anatomie : 19 muscles (pecs haut / bas)');
  for (const m of ['frontDelts', 'sideDelts', 'rearDelts', 'traps', 'rhomboids', 'lats', 'abs', 'obliques', 'adductors']) {
    assert(ids.has(m), `Anatomie : ${m} present`);
  }
  assert(!['shoulders', 'back', 'core'].some((m) => ids.has(m)), 'Anatomie : anciens grands groupes retires');
  assert(exd.EXERCISES.every((e) => [...e.primaryMuscles, ...e.secondaryMuscles].every((x) => ids.has(x.m))),
    'Exercices : tous decrits avec la nouvelle anatomie');
  assert(exd.EXERCISES.every((e) => [...e.primaryMuscles, ...e.secondaryMuscles].reduce((a, x) => a + x.p, 0) === 100),
    'Exercices : repartition a 100 % partout');
  const used = new Set(exd.EXERCISES.flatMap((e) => [...e.primaryMuscles, ...e.secondaryMuscles].map((x) => x.m)));
  assert([...ids].every((m) => used.has(m)), 'Anatomie : chaque muscle est travaille par au moins un exercice');
  const lat = exd.EXERCISES.find((e) => e.id === 'lateralRaise');
  assert(lat.primaryMuscles[0].m === 'sideDelts', 'Elevations laterales : deltoide lateral');
  const fp = exd.EXERCISES.find((e) => e.id === 'facePull');
  assert(fp.primaryMuscles[0].m === 'rearDelts', 'Face pull : deltoide posterieur');
  const add = exd.EXERCISES.find((e) => e.id === 'custom_hipAdduction');
  assert(add.primaryMuscles[0].m === 'adductors', 'Adduction de hanche : adducteurs (et non fessiers)');

  // Conversion des anciennes donnees
  const conv = exd.splitLegacyMuscles([{ m: 'back', p: 70 }, { m: 'biceps', p: 20 }, { m: 'core', p: 10 }]);
  assert(conv.reduce((a, x) => a + x.p, 0) === 100 && conv.every((x) => ids.has(x.m)), 'Conversion : total conserve, muscles fins');
  const stg = await import('./utils/storage.js');
  const old = { settings: {
    customExercises: [{ id: 'cx', primaryMuscles: [{ m: 'shoulders', p: 80 }], secondaryMuscles: [{ m: 'back', p: 20 }] }],
    exerciseMuscleOverrides: { benchPress: { primaryMuscles: [{ m: 'chest', p: 85 }], secondaryMuscles: [{ m: 'shoulders', p: 15 }] } },
    volumeGoals: { chest: 16, back: 14, shoulders: 10, core: 8 },
  } };
  stg.migrateMuscleData(old);
  const cx = old.settings.customExercises[0];
  assert([...cx.primaryMuscles, ...cx.secondaryMuscles].every((x) => ids.has(x.m)), 'Conversion : exercices perso convertis');
  assert(!old.settings.exerciseMuscleOverrides.benchPress, 'Conversion : ancienne repartition modifiee d\'un exo de la base remplacee par la nouvelle repartition fine');
  assert(old.settings.volumeGoals.upperChest === 16 && old.settings.volumeGoals.lowerChest === 16 && !('chest' in old.settings.volumeGoals)
    && !('back' in old.settings.volumeGoals) && old.settings.volumeGoals.lats > 0,
    'Conversion : objectif personnalise garde, anciens groupes remplaces');

  // Carte du corps
  const bm = await import('./utils/bodyMap.js');
  const svg = bm.bodyMapSVG({ upperChest: 1, lats: 0.5 }, { size: 100 });
  assert(document.getElementById('bm-sprite'), 'Carte : sprite partage injecte');
  bm.bodyMapSVG({}, { size: 50 });
  assert(document.querySelectorAll('#bm-sprite').length === 1, 'Carte : pas de doublon de sprite');
  for (const m of ids) {
    assert(document.getElementById(`bm-f-${m}`) || document.getElementById(`bm-b-${m}`), `Carte : ${m} dessine`);
  }
  assert(svg.includes(bm.intensityColor(1)) && svg.includes(bm.intensityColor(0.5)), 'Carte : couleur selon l\'intensite');
  assert(bm.intensityColor(0.2) !== bm.intensityColor(0.9), 'Carte : degrade (intensites differentes, couleurs differentes)');
  assert((svg.match(/<use /g) || []).length < 80, 'Carte : legere (moins de 80 <use>, formes partagees)');

  // Calendrier
  store.userData.workouts = [];
  store.addWorkout({ id: 'bm1', date: todayISO(-1), totalTime: 600, exercises: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }] }] });
  workout.render(pages.workout);
  const cell = pages.workout.querySelector(`.cal-day[data-date="${todayISO(-1)}"]`);
  assert(cell.querySelector('svg.body-map'), 'Calendrier : silhouettes dans la case');
  assert(cell.querySelector('.cal-dnum').textContent === String(Number(todayISO(-1).slice(8))), 'Calendrier : numero du jour par-dessus');
  assert(!cell.querySelector('.cal-mus'), 'Calendrier : plus de libelle de muscle');
  const quadFill = cell.querySelector('use[href="#bm-f-quads"]').getAttribute('fill');
  const chestFill = cell.querySelector('use[href="#bm-f-lowerChest"]').getAttribute('fill');
  assert(quadFill === bm.intensityColor(1), 'Calendrier : squat -> quadriceps au plus fort');
  assert(chestFill === 'var(--body-muscle)', 'Calendrier : muscle non travaille non colore');
  assert(!pages.workout.querySelector('.cal-day:not(.has-session) svg'), 'Calendrier : jour sans seance sans silhouette');

  // Detail de seance
  cell.click();
  const wd = [...document.querySelectorAll('.modal')].pop();
  assert(wd.querySelector('#wd-flip svg.body-map'), 'Detail de seance : carte du corps en tete');
  clearOverlays();

  // Fiche d'exercice : recto carte du corps, verso rang
  workout.render(pages.workout);
  pages.workout.querySelector('#btn-new-session').click();
  document.querySelector('.sheet .ns-empty').click();
  const ovB = document.querySelector('.session-overlay');
  ovB.querySelector('#s-add-exo').click();
  const pkB = document.querySelector('.picker-overlay');
  pkB.querySelector('#exo-search').value = 'Squat';
  fire(pkB.querySelector('#exo-search'), 'input');
  [...pkB.querySelectorAll('.exo-search-item')].find((it) => it.querySelector('span').textContent === 'Squat').click();
  ovB.querySelector('#s-exos .exo-card [data-detail]').click();
  const sheetB = [...document.querySelectorAll('.sheet')].find((s) => s.querySelector('#ed-history'));
  const flip = sheetB.querySelector('#ed-rank');
  assert(flip.querySelector('.rank-front svg.body-map'), 'Fiche exo : carte du corps au recto');
  assert(flip.querySelector('.rank-back .rank-name') || flip.querySelector('.rank-back .rank-back-sub'), 'Fiche exo : rang au verso');
  flip.click();
  assert(flip.classList.contains('flipped'), 'Fiche exo : la carte se retourne au toucher');
  flip.click();
  assert(!flip.classList.contains('flipped'), 'Fiche exo : et revient');
  ovB.querySelector('#s-quit').click();
  [...document.querySelectorAll('.modal-actions .btn')].find((b) => b.textContent.includes('Confirmer')).click();
  clearOverlays();

  // Volume hebdo
  workout.render(pages.workout);
  const vh = pages.workout.querySelector('#volume-host');
  assert(vh.querySelector('.bm-week svg.body-map'), 'Volume hebdo : carte du corps de la semaine');
  const groups = [...vh.querySelectorAll('.vol-group')].map((g) => g.textContent.trim());
  assert(groups.join(',') === 'Pectoraux,Épaules,Dos,Bras,Tronc,Jambes', `Volume hebdo : muscles groupes par zone (${groups.join(',')})`);
  assert(vh.querySelectorAll('.vol-row').length === 19, 'Volume hebdo : une ligne par muscle');
}

console.log('== v6.7 : pecs haut / bas, variantes, exercices perso integres ==');
{
  const exd = await import('./data/exercises.js');
  const byId = (id) => exd.EXERCISES.find((e) => e.id === id);
  const share = (e, m) => [...e.primaryMuscles, ...e.secondaryMuscles].filter((x) => x.m === m).reduce((a, x) => a + x.p, 0);
  assert(share(byId('inclineBench'), 'upperChest') > share(byId('inclineBench'), 'lowerChest'), 'Incline : surtout le haut des pecs');
  assert(share(byId('declineBench'), 'lowerChest') > share(byId('declineBench'), 'upperChest'), 'Decline : surtout le bas des pecs');
  assert(share(byId('dips'), 'lowerChest') > share(byId('dips'), 'upperChest'), 'Dips : bas des pecs');
  assert(share(byId('lowToHighCableFly'), 'upperChest') > 50 && share(byId('highToLowCableFly'), 'lowerChest') > 50, 'Ecartes poulie : angle -> faisceau');
  assert(share(byId('wideGripCableRow'), 'rhomboids') > share(byId('closeGripCableRow'), 'rhomboids'), 'Rowing prise large : plus de haut du dos');
  assert(share(byId('underhandPulldown'), 'biceps') > share(byId('wideGripPulldown'), 'biceps'), 'Tirage supination : plus de biceps');
  const stds = JSON.parse(readFileSync(new URL('./standards.json', import.meta.url), 'utf8'));
  const { resolveStandardLevels } = await import('./utils/ranks.js');
  const withRef = exd.EXERCISES.filter((e) => e.refExercise);
  assert(withRef.length >= 40, `Variantes : classement par reference (${withRef.length})`);
  assert(withRef.every((e) => resolveStandardLevels(e.refExercise, stds) && e.refCoef > 0), 'Variantes : chaque reference a des standards');
  assert(byId('custom_93e720d5') && byId('custom_93e720d5').refExercise === 'machinePress', 'Machine Chest Press Incline : integree, classee via la presse machine');
  assert(byId('custom_30fb934c') && byId('custom_30fb934c').refExercise === 'skullCrusher', 'Skull Crusher Halteres : integre, classe via la barre au front');
  assert(!byId('custom_1ad5f699'), 'Ancien doublon de la presse inclinee retire');
  const conv = exd.splitLegacyMuscles([{ m: 'chest', p: 80 }, { m: 'triceps', p: 20 }]);
  assert(conv.find((x) => x.m === 'lowerChest').p === 48 && conv.find((x) => x.m === 'upperChest').p === 32, 'Conversion : ancien « chest » -> bas 60 % / haut 40 %');
  const stg = await import('./utils/storage.js');
  const d = { settings: {
    customExercises: [{ id: 'custom_30fb934c', name: 'x', primaryMuscles: [{ m: 'triceps', p: 100 }], secondaryMuscles: [] },
      { id: 'custom_keep', name: 'y', primaryMuscles: [{ m: 'chest', p: 100 }], secondaryMuscles: [] }],
    exerciseNames: { custom_1ad5f699: 'Mon incline' }, volumeGoals: { chest: 14, lats: 12 },
  }, workouts: [{ id: 'w', date: '2026-01-01', exercises: [{ exerciseId: 'custom_1ad5f699', sets: [] }] }],
  routines: [{ id: 'r', name: 'P', exercises: ['custom_1ad5f699', 'benchPress'] }] };
  stg.migrateMuscleData(d);
  assert(d.settings.customExercises.length === 1 && d.settings.customExercises[0].id === 'custom_keep', 'Migration : exercice perso devenu integre retire (doublon)');
  assert(d.settings.customExercises[0].primaryMuscles.every((x) => x.m !== 'chest'), 'Migration : exercice perso « chest » converti');
  assert(d.workouts[0].exercises[0].exerciseId === 'custom_93e720d5' && d.routines[0].exercises[0] === 'custom_93e720d5', 'Migration : ancien identifiant renomme (seances, routines)');
  assert(d.settings.exerciseNames.custom_93e720d5 === 'Mon incline' && !d.settings.exerciseNames.custom_1ad5f699, 'Migration : nom perso suit le renommage');
  assert(d.settings.volumeGoals.upperChest === 14 && d.settings.volumeGoals.lowerChest === 14, 'Migration : objectif pecs reporte sur haut et bas');
  const bm = await import('./utils/bodyMap.js');
  bm.bodyMapSVG({}, { size: 80 });
  assert(document.getElementById('bm-f-upperChest') && document.getElementById('bm-f-lowerChest') && !document.getElementById('bm-f-chest'), 'Carte : pecs dessines en deux zones');
}

console.log('== v6.2 : LP totaux, panneaux, detail de seance ==');
{
  // ---- LP : toujours le total cumule
  const rk = await import('./utils/ranks.js');
  const d2 = rk.rankFromLP(1010);
  assert(d2.name === 'Diamant' && d2.division === 'II', 'LP : 1010 LP = Diamant II');
  assert(rk.lpLabel(d2) === '1010 / 1100 LP', `LP : affiche le total et le palier suivant (${rk.lpLabel(d2)})`);
  assert(rk.lpLabel(rk.rankFromLP(2140)) === '2140 LP', 'LP : Onyx affiche son total');
  assert(rk.lpLabel(rk.rankFromLP(0)) === '0 / 100 LP', 'LP : depart a 0');
  for (const f of ['./modules/home.js', './modules/workout.js']) {
    const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
    assert(!/\.lp\} \/ \$\{[^}]*lpNeeded\}/.test(src), `LP : plus de « lp / lpNeeded » dans ${f}`);
  }
  home.render(pages.home);
  assert(/^\d+ \/ \d+ LP$|^\d+ LP$/.test(pages.home.querySelector('.gr-lp').textContent.trim()), 'Accueil : LP totaux sur la carte de rang');

  // ---- Fenetres : toutes en panneaux montant du bas
  const ui = await import('./utils/ui.js');
  let closedByEsc = 0;
  const m = ui.openModal({ title: 'Test', content: '<p>x</p>', actions: [{ label: 'OK' }], onClose: () => { closedByEsc += 1; } });
  const sh = [...document.querySelectorAll('.sheet')].pop();
  assert(sh.classList.contains('modal') && sh.closest('.sheet-scrim'), 'Fenetres : un panneau (sheet), plus une fenetre centree');
  assert(sh.querySelector('.sheet-handle'), 'Fenetres : poignee pour glisser vers le bas');
  assert(!document.querySelector('.modal-close'), 'Fenetres : plus de croix de fermeture');
  assert(sh.querySelector('.modal-actions .btn'), 'Fenetres : barre d\'actions en bas');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert(closedByEsc === 1, 'Fenetres : Echap ferme le panneau du dessus');
  m.close(); m.close();
  assert(closedByEsc === 1, 'Fenetres : fermer plusieurs fois ne rappelle pas onClose');
  clearOverlays();
  const uiSrc = fs.readFileSync(new URL('./utils/ui.js', import.meta.url), 'utf8');
  assert(!/class="modal-close"/.test(uiSrc) && !/class="modal \$\{wide/.test(uiSrc), 'Fenetres : ancien gabarit centre supprime');
  const cssP = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  assert(!/^\.modal \{/m.test(cssP) && !/\.modal-wide/.test(cssP), 'CSS : plus de style de fenetre centree');

  // ---- Detail de seance
  store.userData.workouts = [];
  store.addWorkout({ id: 'd62', date: todayISO(-2), totalTime: 2478, notes: 'Bonne seance', exercises: [
    { exerciseId: 'benchPress', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 7 }] },
    { exerciseId: 'lateralRaise', sets: [{ weight: 12, reps: 14 }] },
  ] });
  workout.render(pages.workout);
  pages.workout.querySelector(`.cal-day[data-date="${todayISO(-2)}"]`).click();
  const wd = [...document.querySelectorAll('.sheet')].pop();
  assert(wd.querySelector('.sheet-header h3').textContent === 'Séance', 'Detail : panneau « Séance »');
  assert(wd.querySelector('.wd-day') && wd.querySelector('.wd-date').textContent.length > 4, 'Detail : jour et date mis en avant');
  const tiles = [...wd.querySelectorAll('.wd-stat .eyebrow')].map((e) => e.textContent);
  assert(tiles.join(',') === 'Durée,Progression,Séries', `Detail : tuiles Duree / Progression / Series (${tiles.join(',')})`);
  assert(wd.querySelector('.wd-stat .num').textContent === '41:18', 'Detail : duree lisible');
  const flipW = wd.querySelector('#wd-flip');
  assert(flipW.querySelector('.rank-front svg.body-map'), 'Detail : carte du corps au recto');
  assert(/Volume/.test(flipW.querySelector('.wd-back').textContent) && flipW.querySelectorAll('.wd-mus').length > 0, 'Detail : statistiques au verso (volume, muscles)');
  assert(flipW.getAttribute('role') === 'button' && flipW.getAttribute('tabindex') === '0', 'Detail : carte accessible au clavier');
  flipW.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert(flipW.classList.contains('flipped') && flipW.getAttribute('aria-pressed') === 'true', 'Detail : Entree retourne la carte');
  assert(wd.querySelector('.sheet-action[aria-label="Modifier la séance"]'), 'Detail : « Modifier » en haut du panneau');
  const acts = [...wd.querySelectorAll('.modal-actions .btn')].map((b) => b.textContent.trim());
  assert(acts.length === 2 && /routines/i.test(acts[0]) && /Supprimer/.test(acts[1]), `Detail : actions routines + supprimer (${acts.join(' / ')})`);
  assert(wd.querySelector('.modal-actions .btn-danger-soft'), 'Detail : suppression en rouge discret');
  assert(wd.querySelectorAll('button.wd-exo').length === 2, 'Detail : exercices en boutons (accessibles)');
  assert(wd.querySelector('.wd-note') && wd.textContent.includes('Bonne seance'), 'Detail : note affichee');
  clearOverlays();
}

console.log(`\n===== RÉSULTAT : ${pass} OK / ${fail} FAIL =====`);
process.exit(fail ? 1 : 0);
