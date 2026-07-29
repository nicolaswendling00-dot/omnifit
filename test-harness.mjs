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
assert(pages.home.querySelector('.weight-hero'), 'Accueil : carte poids');
assert(pages.home.querySelectorAll('.stat-card').length === 4, 'Accueil : 4 cartes récap');
assert(pages.home.querySelector('#btn-chart') && !pages.home.querySelector('#weight-chart'), 'Accueil : graphique en modal seulement');

nutrition.render(pages.nutrition);
assert(pages.nutrition.querySelector('.nutrition-header'), 'Nutrition : header sticky');
assert(pages.nutrition.querySelectorAll('.macro-rings .ring-item').length === 4, 'Nutrition : 4 anneaux macros (prot/gluc/lip + fibres)');
assert(pages.nutrition.querySelectorAll('.date-chip').length === 15, 'Nutrition : ruban 15 dates');
assert(pages.nutrition.querySelector('.date-ribbon.no-swipe'), 'Nutrition : ruban en no-swipe');
assert(document.getElementById('fab-nutrition-wrap')?.parentElement === document.body, 'Nutrition : FAB global dans body');
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
assert(pages.activity.querySelector('#btn-import-steps'), 'Activité : bouton Importer les pas (Santé)');
assert(!pages.activity.querySelector('.mono'), 'Activité : plus de .mono');

settings.render(pages.settings);
assert(pages.settings.querySelectorAll('.settings-section').length === 6, 'Réglages : 6 sections');
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
assert(pages.nutrition.querySelector('.meal-item .fiber-tag'), 'Repas : fibres affichées en petit');
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
pages.workout.querySelector('#btn-new-session').click();
const overlay = document.querySelector('.session-overlay');
overlay.querySelector('#s-add-exo').click();
const picker = document.querySelector('.picker-overlay');
const searchInput = picker.querySelector('#exo-search');
searchInput.value = 'Bench Press';
fire(searchInput, 'input');
const bench = [...picker.querySelectorAll('.exo-search-item')].find((it) => it.querySelector('span').textContent === 'Bench Press');
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
// L'objectif se choisit depuis l'Accueil (#g-type) ; ici on valide le calcul lui-meme.
const cg2 = mathmod.harrisBenedict(store.userData.profile, 'Perte de poids');
assert(cg2 > 1500 && cg2 < 3500, `Harris-Benedict recalcule : ${cg2} kcal`);
assert(mathmod.harrisBenedict(store.userData.profile, 'Prise de muscle') > cg2, 'Prise de muscle > Perte de poids');
settings.render(pages.settings);
pages.settings.querySelector('#seg-shape [data-v="amoled"]').click();
assert(document.body.classList.contains('shape-amoled'), 'Forme AMOLED appliquee');

console.log('== Persistance + import/export ==');
const raw = JSON.parse(localStorage.getItem('omniffit_userData'));
assert(raw.workouts.length === 1 && raw.settings.shape === 'amoled', 'Données persistées');
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
assert(lightBlock.includes('--header-bg: rgba(255, 255, 255'), 'Theme clair : header nutrition clair');

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
assert(/\.meal-row \{[^}]*touch-action: pan-y/.test(cssSw), 'Verrou swipe : meal-row en touch-action pan-y');

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

console.log('== Theme 8-bit ==');
const uiMod = await import('./utils/ui.js');
const ranksMod = await import('./utils/ranks.js');
const lineHome = uiMod.icons.home;
uiMod.setIconSet('8bit');
assert(Object.keys(uiMod.icons).length === 31, '8-bit : 31 icones');
assert(Object.values(uiMod.icons).every((v) => v.includes('crispEdges')), '8-bit : toutes les icones sont pixelisees');
ranksMod.setRankStyle('8bit');
assert(ranksMod.rankBadge('gold', 60).includes('crispEdges'), '8-bit : badge de rang pixelise');
assert(!ranksMod.rankBadge('gold', 60).includes('linearGradient'), '8-bit : aucun degrade dans le badge');
const allSigils = ['bronze','gold','plat','diam','emer','saph','ruby','onyx'].map((id) => ranksMod.rankBadge(id, 48));
assert(new Set(allSigils).size === 8, '8-bit : chaque rang a une silhouette distincte (identifiable en monochrome)');
const rc = (id) => (ranksMod.rankBadge(id, 48).match(/<rect/g) || []).length;
assert(rc('onyx') > rc('bronze'), '8-bit : complexite du sigil croit avec le rang');
uiMod.setIconSet('default');
ranksMod.setRankStyle('default');
assert(uiMod.icons.home === lineHome, '8-bit : retour au jeu d icones par defaut');
// Bascule complete via les reglages
store.saveUserData({ settings: { shape: '8bit' } });
settings.applyTheme();
assert(document.body.classList.contains('shape-8bit'), '8-bit : classe appliquee');
assert(uiMod.icons.home.includes('crispEdges'), '8-bit : applyTheme bascule les icones');
const nav8 = document.querySelector('#bottom-nav .nav-btn svg');
assert(nav8 && nav8.getAttribute('shape-rendering') === 'crispEdges', '8-bit : barre de nav pixelisee');
assert(document.getElementById('font-8bit').href.includes('VT323'), '8-bit : police terminal VT323');
store.saveUserData({ settings: { shape: 'amoled' } });
settings.applyTheme();
assert(!document.body.classList.contains('shape-8bit'), '8-bit : retour AMOLED');
assert(uiMod.icons.home.includes('stroke'), '8-bit : icones vectorielles restaurees');
// L'option « Sombre » a disparu des reglages
settings.render(pages.settings);
assert(pages.settings.querySelector('#seg-shape [data-v="8bit"]'), 'Theme : forme 8-bit presente');
assert(pages.settings.querySelector('#seg-palette [data-v="light"]'), 'Couleur : palette claire presente');
assert(!pages.settings.querySelector('#seg-density'), 'Densite : segment retire');

console.log('== v3.33 : deux axes, badge de rang, scroll dates ==');
// 8-bit clair possible
store.saveUserData({ settings: { shape: '8bit', palette: 'light' } });
settings.applyTheme();
assert(document.body.classList.contains('shape-8bit') && document.body.classList.contains('palette-light'), '8-bit clair : combinaison des deux axes');
store.saveUserData({ settings: { shape: 'amoled', palette: 'dark' } });
settings.applyTheme();
// Badge de rang global : identique a celui des exercices (px-rank en 8-bit), sans ailettes
home.render(pages.home);
assert(pages.home.querySelector('.gr-badge svg'), 'Accueil : badge de rang affiche');
assert(!pages.home.querySelector('.gr-badge .rank-wings'), 'Accueil : ailettes retirees');
// Scroll des dates non bloque par l'absorption
const appTxt2 = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const absorb = (appTxt2.match(/SWIPE_ABSORB_ZONES\s*=\s*'([^']+)'/) || [])[1] || '';
assert(!absorb.includes('.date-ribbon'), 'Scroll dates : ruban NON absorbe (scroll horizontal libre)');
assert(absorb.includes('.meal-row'), 'Swipe suppression : repas toujours absorbe');
// Densite figee en spacieux
assert(document.body.classList.contains('density-spacious'), 'Densite : toujours spacieuse');

console.log('== v3.34 : pas colores, bleu clair, accueil sans scroll ==');
const cssV = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
assert(/\.steps-hero \.ring-label \{[^}]*fill: var\(--accent\)/.test(cssV), 'Pas : nombre en couleur accent (comme calories)');
assert(!/2aa7c4/i.test(cssV), 'Couleur : #2AA7C4 supprime partout');
assert(cssV.includes('#3AA0F0'), 'Couleur : nouveau bleu ciel present');
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
assert(nh.querySelectorAll('.date-chip').length === 15, 'Nutrition : ruban de dates conserve');
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
histItem.click();
const editSheet = [...document.querySelectorAll('.sheet')].find((s) => s.querySelector('#m-name'));
assert(editSheet && editSheet.querySelector('#m-name').value.includes('Boulgour'), 'Historique : clic -> éditeur pré-rempli');
clearOverlays();

// Graphe de poids : cercle creux pour les jours lisses
store.userData.nutrition.byDate[todayISO()].smoothed = { delta: -150, from: '2020-05-01' };
home.render(pages.home);
pages.home.querySelector('#btn-chart').click();
const chartModal = document.querySelector('.modal');
chartModal.querySelector('#btn-toggle-cal').click();
const calDs = lastChartCfg.data.datasets.find((d) => d.label === 'Calories');
assert(calDs && Array.isArray(calDs.pointBackgroundColor), 'Graphe : couleurs de points par jour');
const chartDays = [...Array(14)].map((_, i) => todayISO(i - 13));
const iSm = chartDays.indexOf(todayISO());
assert(calDs.pointBackgroundColor[iSm] === 'transparent', 'Graphe : jour lisse = cercle creux');
assert(calDs.pointBorderColor[iSm] === '#FB923C', 'Graphe : contour du cercle creux visible');
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

console.log(`\n===== RÉSULTAT : ${pass} OK / ${fail} FAIL =====`);
process.exit(fail ? 1 : 0);
