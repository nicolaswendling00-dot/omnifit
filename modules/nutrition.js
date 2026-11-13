// OmniFit — PAGE 1 : Nutrition (macros couleur, fibres, modes grammes/auto/%, repas typés, recettes)
import { store, todayISO } from '../utils/storage.js';
import { calcKcal, fiberGoalFromKcal, metabolicInsight } from '../utils/math.js';
import { el, esc, icons, openSheet, openModal, toast, ringSVG, confirmModal, fmtDateShort, haptic, celebrateLP, normalizeStr, attachSwipeToDelete, tweenValues, dateBar, dayLabel, periodRange, monthBuckets, PERIODS, periodHead, attachPeriodSwipe, slideIn } from '../utils/ui.js';
import { startCameraStream, captureFrame, decodeBarcodeFromFile } from '../utils/barcode.js';
import { fetchProductByBarcode } from '../utils/openfoodfacts.js';
import { FOODS, FOOD_CATEGORIES } from '../data/foods.js';

// Un aliment de la base correspond à la recherche si son nom OU ses mots-clés
// la contiennent ; on compare aussi sans espaces ni tirets (« redbull »,
// « cocacola », « kitkat » trouvent Red Bull, Coca-Cola, Kit Kat).
const squash = (s) => s.replace(/[\s'’\-]/g, '');
function foodMatches(f, nq) {
  const hay = normalizeStr(f.k ? `${f.n} ${f.k}` : f.n);
  return hay.includes(nq) || squash(hay).includes(squash(nq));
}
import { PRESET_RECIPES, presetToRecipe } from '../data/recipes.js';
import { getViewDate, setViewDate } from '../utils/nav.js';

let selectedDate = todayISO();
// Dernier état affiché (jour, nombre de repas) : sert à faire apparaître
// « Aucun repas » en douceur quand on supprime le dernier repas du jour.
let lastShown = { date: null, n: 0 };
const motionOff = () => !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Changement de jour : l'ancienne liste de repas glisse et s'efface pendant
// que la nouvelle arrive du côté opposé.
function crossfadeMeals(container, ghost, dir) {
  const nl = container.querySelector('#meal-list');
  if (!ghost || !nl || motionOff() || !nl.animate) return;
  const host = nl.parentElement;
  host.style.position = 'relative';
  ghost.removeAttribute('id');
  ghost.classList.add('no-al');
  Object.assign(ghost.style, { position: 'absolute', left: `${nl.offsetLeft}px`, top: `${nl.offsetTop}px`, width: `${nl.offsetWidth}px`, pointerEvents: 'none' });
  host.appendChild(ghost);
  ghost.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dir * 28}px)` }],
    { duration: 220, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).onfinish = () => ghost.remove();
  nl.animate([{ opacity: 0, transform: `translateX(${dir * 28}px)` }, { opacity: 1, transform: 'none' }],
    { duration: 340, delay: 60, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
}
let currentRerender = null;
const mealOpen = {};

// Couleurs macros (jetons --mac-* de style.css) : prot cyan, glucides bleu,
// lipides violet, fibres en gris (anneau secondaire).
const C_PROT = 'var(--mac-p)';
const C_CARB = 'var(--mac-g)';
const C_FAT = 'var(--mac-l)';
const C_FIBER = 'var(--mac-f)';

const MEAL_TYPES = ['Petit-Déjeuner', 'Déjeuner', 'Dîner', 'Snack'];

// ============================================================
// STATISTIQUES NUTRITION (toucher l'en-tête des calories)
// ============================================================
// Deux vues, sur la semaine, le mois ou l'année, navigables comme les
// autres graphiques : Calories (barres empilées par repas) et Macros
// (barres empilées des calories de chaque macro). Une colonne « Moy. »
// à droite, la ligne d'objectif en pointillés.
const MEAL_COLORS = ['var(--mac-p)', 'var(--mac-g)', 'var(--mac-l)', 'var(--mac-f)'];
const MACROS = [
  { k: 'prot', name: 'Protéines', kcal: 4, color: C_PROT },
  { k: 'carbs', name: 'Glucides', kcal: 4, color: C_CARB },
  { k: 'fat', name: 'Lipides', kcal: 9, color: C_FAT },
];
const statsState = { tab: 'kcal', kind: 'week', offset: 0 };

function nutritionStatsData(kind, offset) {
  const byDate = store.userData.nutrition.byDate;
  const R = periodRange(kind, offset, Object.keys(byDate).filter((d) => (byDate[d].meals || []).length).sort()[0]);
  const dayStats = (d) => {
    const meals = (byDate[d] && byDate[d].meals) || [];
    const perMeal = MEAL_TYPES.map((c) => meals.filter((m) => (MEAL_TYPES.includes(m.meal) ? m.meal : 'Snack') === c).reduce((a, m) => a + (m.kcal || 0), 0));
    const g = MACROS.map((x) => meals.reduce((a, m) => a + (m[x.k] || 0), 0));
    return { d, n: meals.length, perMeal, total: perMeal.reduce((a, b) => a + b, 0), g, goal: macroGoalsFor(d) };
  };
  const days = R.days.map(dayStats);
  const logged = days.filter((s) => s.n);
  const mean = (f) => (logged.length ? logged.reduce((a, s) => a + f(s), 0) / logged.length : 0);
  let cols;
  if (kind === 'year' || (kind === 'all' && R.days.length > 31)) {
    cols = monthBuckets(R.days).map(({ days: md, label }) => {
      const ds = logged.filter((s) => md.includes(s.d));
      const avg = (f) => (ds.length ? ds.reduce((a, s) => a + f(s), 0) / ds.length : 0);
      return { label, perMeal: MEAL_TYPES.map((_, i) => avg((s) => s.perMeal[i])), g: MACROS.map((_, i) => avg((s) => s.g[i])) };
    });
  } else {
    cols = days.map((s) => {
      const dt = new Date(s.d + 'T12:00:00');
      const n = dt.getDate();
      return { label: R.days.length <= 7 ? 'DLMMJVS'[dt.getDay()] : (n === 1 || n % 7 === 1 ? String(n) : ''), perMeal: s.perMeal, g: s.g };
    });
  }
  const goalAvg = Math.round(mean((s) => s.goal.kcalGoal) || macroGoalsFor(todayISO()).kcalGoal);
  return {
    R, cols, logged: logged.length,
    avgPerMeal: MEAL_TYPES.map((_, i) => mean((s) => s.perMeal[i])),
    avgG: MACROS.map((_, i) => mean((s) => s.g[i])),
    avgTotal: mean((s) => s.total),
    gap: logged.reduce((a, s) => a + (s.goal.kcalGoal - s.total), 0),
    goal: goalAvg,
    goalPct: (() => { const g = macroGoalsFor(todayISO()); const k = g.protG * 4 + g.carbsG * 4 + g.fatG * 9 || 1; return [g.protG * 4 / k, g.carbsG * 4 / k, g.fatG * 9 / k]; })(),
    days: logged,
  };
}

function statsBars(cols, avgSegs, colors, goal) {
  const all = [...cols.map((c) => c.segs), avgSegs];
  const max = Math.max(goal * 1.15, ...all.map((s) => s.reduce((a, b) => a + b, 0))) || 1;
  const col = (segs, label, extra = '') => `<div class="ns-col${extra}">
    <span class="ns-stack">${segs.map((v, i) => (v > 0 ? `<i style="height:${((v / max) * 100).toFixed(2)}%;background:${colors[i]}"></i>` : '')).join('')}</span>
    <span class="ns-lbl">${label}</span>
  </div>`;
  return `<div class="ns-plot${cols.length > 12 ? ' dense' : ''}" style="--goal:${(goal / max).toFixed(3)}">
    <div class="ns-goal"></div>
    ${cols.map((c) => col(c.segs, c.label)).join('')}
    ${col(avgSegs, 'Moy.', ' avg')}
  </div>`;
}

function nutritionStatsHTML() {
  const s = statsState;
  const D = nutritionStatsData(s.kind, s.offset);
  const fmt = (v) => Math.round(v).toLocaleString('fr-FR');
  const head = periodHead(D.R, `<span class="per-avg"><b class="num">${fmt(D.avgTotal)}</b> kcal par jour</span>`, s.offset);
  let body;
  if (s.tab === 'kcal') {
    const tot = D.avgPerMeal.reduce((a, b) => a + b, 0) || 1;
    body = `${statsBars(D.cols.map((c) => ({ ...c, segs: c.perMeal })), D.avgPerMeal, MEAL_COLORS, D.goal)}
      <div class="ns-legend">${MEAL_TYPES.map((m, i) => `<div class="ns-leg"><i style="background:${MEAL_COLORS[i]}"></i><span>${m}<small>${Math.round((D.avgPerMeal[i] / tot) * 100)} %, ${fmt(D.avgPerMeal[i])} kcal</small></span></div>`).join('')}</div>
      <div class="ns-rows">
        <div class="ns-row"><span>${D.gap >= 0 ? 'Calories sous l\'objectif' : 'Calories au-dessus de l\'objectif'}</span><b class="num">${fmt(Math.abs(D.gap))}</b></div>
        <div class="ns-row"><span>Moyenne quotidienne</span><b class="num">${fmt(D.avgTotal)}</b></div>
        <div class="ns-row"><span>Objectif</span><b class="num accent">${fmt(D.goal)}</b></div>
        <div class="ns-row"><span>Jours renseignés</span><b class="num">${D.logged}</b></div>
      </div>`;
  } else {
    const kc = D.avgG.map((g, i) => g * MACROS[i].kcal);
    const tot = kc.reduce((a, b) => a + b, 0) || 1;
    // Aliments qui apportent le plus de chaque macro sur la période
    const top = MACROS.map((x) => {
      const acc = {};
      for (const day of D.days) {
        for (const m of store.userData.nutrition.byDate[day.d].meals) {
          const name = m.baseName || m.name;
          acc[name] = (acc[name] || 0) + (m[x.k] || 0);
        }
      }
      return Object.entries(acc).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
    });
    body = `${statsBars(D.cols.map((c) => ({ ...c, segs: c.g.map((g, i) => g * MACROS[i].kcal) })), kc, MACROS.map((x) => x.color), D.goal)}
      <div class="ns-mtable">
        <div class="ns-mrow head"><span></span><span>Moy.</span><span>Objectif</span></div>
        ${MACROS.map((x, i) => `<div class="ns-mrow"><span><i style="background:${x.color}"></i>${x.name} <small>(${fmt(D.avgG[i])} g)</small></span><b class="num">${Math.round((kc[i] / tot) * 100)} %</b><b class="num accent">${Math.round(D.goalPct[i] * 100)} %</b></div>`).join('')}
      </div>
      ${MACROS.map((x, i) => `<h3 class="ns-top-h">Les plus riches en ${x.name.toLowerCase()}</h3>
        ${top[i].length ? `<div class="ns-rows">${top[i].map(([n, v]) => `<div class="ns-row"><span>${esc(n)}</span><b class="num">${fmt(v)} g</b></div>`).join('')}</div>` : '<div class="empty-state">Aucun repas sur la période</div>'}`).join('')}`;
  }
  return `${head}<div class="ns-zone">${body}</div>`;
}

function openNutritionStats() {
  const content = el(`<div class="nstats">
    <div class="segment" id="ns-tab"><button data-t="kcal">Calories</button><button data-t="macro">Macros</button></div>
    <div class="segment" id="ns-kind">${PERIODS.map(([k, l]) => `<button data-k="${k}">${l}</button>`).join('')}</div>
    <div id="ns-body"></div>
  </div>`);
  const body = content.querySelector('#ns-body');
  const sync = () => {
    content.querySelectorAll('#ns-tab button').forEach((b) => b.classList.toggle('active', b.dataset.t === statsState.tab));
    content.querySelectorAll('#ns-kind button').forEach((b) => b.classList.toggle('active', b.dataset.k === statsState.kind));
  };
  const draw = (dir = 0) => {
    sync();
    body.innerHTML = nutritionStatsHTML();
    body.querySelector('.per-prev').addEventListener('click', () => go(1));
    body.querySelector('.per-next').addEventListener('click', () => go(-1));
    attachPeriodSwipe(body.querySelector('.ns-zone'), go);
    slideIn(body.querySelector('.ns-plot'), dir);
  };
  const go = (dir) => { if (statsState.kind === 'all' || statsState.offset + dir < 0) return; statsState.offset += dir; haptic(); draw(dir); };
  content.querySelector('#ns-tab').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { statsState.tab = b.dataset.t; draw(); } });
  content.querySelector('#ns-kind').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { statsState.kind = b.dataset.k; statsState.offset = 0; draw(); } });
  draw();
  openSheet({ title: 'Statistiques', content });
}

// Retrouve une recette par son id, qu'elle soit personnelle ou préenregistrée.
// Indispensable pour rouvrir le menu multiplicateur d'un repas déjà ajouté :
// `meal.fromRecipe` peut désormais pointer vers l'une ou l'autre des sources.
function findRecipe(id) {
  const mine = (store.userData.recipes || []).find((r) => r.id === id);
  if (mine) return mine;
  const preset = PRESET_RECIPES.find((r) => r.id === id);
  return preset ? presetToRecipe(preset) : null;
}

// Génère le texte coloré des macros : P cyan, G bleu, L violet, F gris.
// `opts.round` arrondit à 1 décimale. Les fibres n'apparaissent que si > 0.
function macroLine(prot, carbs, fat, fiber, opts = {}) {
  const r = opts.round ? (v) => Math.round((v || 0) * 10) / 10 : (v) => (v || 0);
  let s = `<span class="mac-p">P ${r(prot)}</span>&ensp;<span class="mac-g">G ${r(carbs)}</span>&ensp;<span class="mac-l">L ${r(fat)}</span>`;
  if (fiber != null && fiber > 0) s += `&ensp;<span class="mac-f">F ${r(fiber)}</span>`;
  return s;
}
// Dernier type de repas auquel on a ajouté quelque chose (persisté entre sessions
// via les réglages) : sert de sélection par défaut dans l'historique.
function lastMealType() {
  return store.userData.settings.lastMealType || defaultMealType();
}
function rememberMealType(t) {
  if (MEAL_TYPES.includes(t)) store.saveUserData({ settings: { lastMealType: t } });
}
function defaultMealType() {
  const h = new Date().getHours();
  if (h < 11) return 'Petit-Déjeuner';
  if (h < 15) return 'Déjeuner';
  if (h < 21) return 'Dîner';
  return 'Snack';
}

function currentWeight() {
  const w = store.userData.weights;
  return w.length ? w[w.length - 1].value : store.userData.profile.weight;
}

// Objectifs macros effectifs selon le mode (grammes par défaut / auto / pourcentages)
export function macroGoals() {
  const s = store.userData.settings;
  if (s.macroMode === 'pct') {
    const kcal = s.calorieGoal;
    return {
      protG: Math.round((kcal * (s.protPct / 100)) / 4),
      carbsG: Math.round((kcal * (s.carbsPct / 100)) / 4),
      fatG: Math.round((kcal * (s.fatPct / 100)) / 9),
      kcalGoal: kcal,
    };
  }
  if (s.macroMode === 'auto') {
    const w = currentWeight();
    const protG = Math.round((s.protMult ?? 2.2) * w);
    const fatG = Math.round((s.fatMult ?? 1.0) * w);
    const kcalGoal = s.calorieGoal;
    const carbsG = Math.max(0, Math.round((kcalGoal - (protG * 4 + fatG * 9)) / 4));
    return { protG, carbsG, fatG, kcalGoal };
  }
  const protG = s.proteinGoal;
  const carbsG = s.carbsGoalG;
  const fatG = s.fatGoalG;
  return { protG, carbsG, fatG, kcalGoal: calcKcal(protG, carbsG, fatG) };
}

// Ajuste l'objectif calorique de ±delta kcal, en tenant compte du mode macro :
//   - mode « grammes » : on porte l'écart sur les glucides (4 kcal/g), les
//     autres macros ne bougent pas ;
//   - modes « auto » / « % » : on décale directement calorieGoal (et on fige
//     calorieAuto pour que la valeur tienne).
// Horodate l'ajustement (lastCalorieAdjust) : le coach patiente ensuite ~10 j
// avant de reproposer un changement, le temps que le poids réponde.
// Fige l'objectif ACTUEL sur tous les jours passés qui n'en ont pas encore.
// À appeler AVANT toute modification de l'objectif calorique : sans ça, un jour
// ancien jamais consulté se verrait attribuer le NOUVEL objectif lors de son
// premier affichage, ce qui fausserait rétroactivement son écart calorique.
export function freezePastGoals() {
  const today = todayISO();
  const live = macroGoals();
  let changed = false;
  for (const [date, day] of Object.entries(store.userData.nutrition.byDate || {})) {
    if (date >= today) continue;          // aujourd'hui suit l'objectif courant
    if (!day || day.goal) continue;       // déjà figé : on n'y touche jamais
    day.goal = { ...live };
    changed = true;
  }
  if (changed) store.persist();
}

export function applyCalorieDelta(delta) {
  freezePastGoals(); // l'historique garde l'objectif en vigueur jusqu'ici
  const s = store.userData.settings;
  const stamp = { lastCalorieAdjust: { date: todayISO(), delta } };
  if (s.macroMode === 'grams') {
    const newCarbs = Math.max(0, Math.round((s.carbsGoalG + delta / 4) / 5) * 5);
    store.saveUserData({ settings: { carbsGoalG: newCarbs, ...stamp } });
  } else {
    const newGoal = Math.max(0, Math.round((s.calorieGoal + delta) / 10) * 10);
    store.saveUserData({ settings: { calorieGoal: newGoal, calorieAuto: false, ...stamp } });
  }
}

// Cale l'objectif calorique sur une valeur cible (utilisé pour adopter la
// maintenance mesurée). Même prise en compte du mode macro que ci-dessus.
export function setCalorieGoal(kcal) {
  freezePastGoals();
  const s = store.userData.settings;
  const target = Math.max(0, Math.round(kcal / 10) * 10);
  if (s.macroMode === 'grams') {
    const fromPF = s.proteinGoal * 4 + s.fatGoalG * 9;
    const carbs = Math.max(0, Math.round((target - fromPF) / 4 / 5) * 5);
    store.saveUserData({ settings: { carbsGoalG: carbs } });
  } else {
    store.saveUserData({ settings: { calorieGoal: target, calorieAuto: false } });
  }
}

// Objectif figé par jour : les jours passés gardent l'objectif qu'ils avaient
// (changer l'objectif aujourd'hui ne modifie plus l'historique).
// Deux objectifs sont identiques si leurs quatre valeurs le sont. Sert à ne
// PAS réécrire le stockage quand rien n'a changé : `persist()` sérialise tout
// le userData, et macroGoalsFor est appelée à chaque rendu (ruban de dates).
function sameGoal(a, b) {
  if (!a || !b) return false;
  return a.kcalGoal === b.kcalGoal && a.protG === b.protG
    && a.carbsG === b.carbsG && a.fatG === b.fatG;
}

export function macroGoalsFor(date) {
  const day = store.userData.nutrition.byDate[date];
  const live = macroGoals();
  if (date === todayISO()) {
    if (day && !sameGoal(day.goal, live)) { day.goal = live; store.persist(); }
    return live;
  }
  if (day) {
    if (!day.goal) { day.goal = live; store.persist(); }
    return day.goal;
  }
  return live;
}

// Quête nutrition d'un jour « validée » : calories dans ±10 % de l'objectif ET
// protéines ≥ 90 % de l'objectif (même règle que le pilier nutrition du rang
// global). Sert à déclencher l'animation de gain de LP au bon moment.
function nutritionGoalMet(date) {
  const day = store.userData.nutrition.byDate[date];
  if (!day || !day.meals || !day.meals.length) return false;
  const goal = macroGoalsFor(date);
  if (!goal || !goal.kcalGoal) return false;
  const t = store.dayTotals(date);
  const relOk = Math.abs(t.kcal - goal.kcalGoal) / goal.kcalGoal <= 0.10;
  const protOk = !goal.protG || t.prot >= goal.protG * 0.9;
  return relOk && protOk;
}


// au moment de l'import — plutôt que de le figer plus tard avec l'objectif du jour
// où l'utilisateur consulte cette date par hasard (ce qui serait incorrect/trompeur).
export function backfillNutritionGoals() {
  const live = macroGoals();
  let changed = false;
  for (const day of Object.values(store.userData.nutrition.byDate)) {
    if (!day.goal) { day.goal = live; changed = true; }
  }
  if (changed) store.persist();
}

// ============================================================
// OBJECTIFS MACROS — sheet (Grammes / Auto / Pourcentages)
// ============================================================
function openMacroGoalsSheet(rerender) {
  const s = store.userData.settings;
  let mode = s.macroMode || 'grams';

  const form = el(`<div>
    <div class="segment" style="margin-bottom:14px" id="mg-mode">
      <button data-v="grams" class="${mode === 'grams' ? 'active' : ''}">Grammes</button>
      <button data-v="auto" class="${mode === 'auto' ? 'active' : ''}">Auto</button>
      <button data-v="pct" class="${mode === 'pct' ? 'active' : ''}">%</button>
    </div>
    <div id="mg-body"></div>
    <div style="margin:8px 0 4px">
      <div class="card-row"><span style="font-size:0.9rem;color:var(--mac-f)">Fibres / 1000 kcal</span>
        <span class="num" id="mg-fiber-val" style="color:var(--mac-f)">${s.fiberPer1000 ?? 15} g</span></div>
      <input id="mg-fiber-per" type="range" min="5" max="25" step="1" value="${s.fiberPer1000 ?? 15}" style="accent-color:var(--accent)">
    </div>
    <div class="macro-kcal-sticky">
      <span class="muted">Calories cibles</span>
      <span class="num" id="mg-kcal" style="color:var(--accent);font-size:1.2rem"></span>
    </div>
    <button class="btn btn-primary btn-block" id="mg-save" style="margin-top:10px">Enregistrer</button>
  </div>`);
  const sheet = openSheet({ title: 'Objectifs macros', content: form });
  const body = form.querySelector('#mg-body');
  const kcalEl = form.querySelector('#mg-kcal');
  const fiberSlider = form.querySelector('#mg-fiber-per');
  fiberSlider.addEventListener('input', () => { form.querySelector('#mg-fiber-val').textContent = `${fiberSlider.value} g`; });
  const w = currentWeight();

  const renderBody = () => {
    if (mode === 'grams') {
      const rows = [
        ['p', 'Protéines', s.proteinGoal, C_PROT],
        ['c', 'Glucides', s.carbsGoalG, C_CARB],
        ['f', 'Lipides', s.fatGoalG, C_FAT],
      ];
      body.innerHTML = rows.map(([k, lbl, v, col]) => `
        <div style="margin-bottom:14px">
          <div class="card-row"><span style="font-size:0.9rem">${lbl}</span>
            <span class="num" id="mg-${k}-val" style="color:${col}">${v} g</span></div>
          <input id="mg-${k}" type="range" min="0" max="2000" step="5" value="${v}" style="accent-color:${col}">
        </div>`).join('');
      const upd = () => {
        const p = +body.querySelector('#mg-p').value;
        const c = +body.querySelector('#mg-c').value;
        const f = +body.querySelector('#mg-f').value;
        body.querySelector('#mg-p-val').textContent = p + ' g';
        body.querySelector('#mg-c-val').textContent = c + ' g';
        body.querySelector('#mg-f-val').textContent = f + ' g';
        kcalEl.textContent = `${calcKcal(p, c, f)} kcal`;
      };
      body.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd));
      upd();
    } else if (mode === 'auto') {
      body.innerHTML = `
        <div class="muted" style="margin-bottom:12px">Poids actuel <b>${w} kg</b></div>
        <div class="field" style="margin-bottom:12px"><span>Objectif calories</span>
          <div class="cal-adjust-row">
            <button type="button" class="btn btn-secondary cal-step" id="mg-cal-minus">−200</button>
            <input id="mg-cal" type="number" inputmode="numeric" step="10" value="${s.calorieGoal}">
            <button type="button" class="btn btn-secondary cal-step" id="mg-cal-plus">+200</button>
          </div></div>
        <div style="margin-bottom:12px">
          <div class="card-row"><span style="font-size:0.9rem">Protéines en g/kg</span>
            <span class="num" id="mg-pm-val" style="color:${C_PROT}">${(s.protMult ?? 2.2).toFixed(1)}</span></div>
          <input id="mg-pm" type="range" min="1.4" max="3.0" step="0.1" value="${s.protMult ?? 2.2}" style="accent-color:${C_PROT}">
        </div>
        <div style="margin-bottom:12px">
          <div class="card-row"><span style="font-size:0.9rem">Lipides en g/kg</span>
            <span class="num" id="mg-fm-val" style="color:${C_FAT}">${(s.fatMult ?? 1.0).toFixed(1)}</span></div>
          <input id="mg-fm" type="range" min="0.5" max="1.5" step="0.1" value="${s.fatMult ?? 1.0}" style="accent-color:${C_FAT}">
        </div>
        <div class="card" style="background:var(--surface-2);margin:0;padding:10px">
          <div class="card-row"><span class="muted" style="color:${C_PROT}">Protéines</span><span class="num" id="mg-auto-p"></span></div>
          <div class="card-row"><span class="muted" style="color:${C_CARB}">Glucides</span><span class="num" id="mg-auto-c"></span></div>
          <div class="card-row"><span class="muted" style="color:${C_FAT}">Lipides</span><span class="num" id="mg-auto-f"></span></div>
        </div>`;
      const upd = () => {
        const cal = +body.querySelector('#mg-cal').value || 0;
        const pm = +body.querySelector('#mg-pm').value;
        const fm = +body.querySelector('#mg-fm').value;
        body.querySelector('#mg-pm-val').textContent = pm.toFixed(1);
        body.querySelector('#mg-fm-val').textContent = fm.toFixed(1);
        const protG = Math.round(pm * w);
        const fatG = Math.round(fm * w);
        const carbsG = Math.max(0, Math.round((cal - (protG * 4 + fatG * 9)) / 4));
        body.querySelector('#mg-auto-p').textContent = `${protG} g`;
        body.querySelector('#mg-auto-c').textContent = `${carbsG} g`;
        body.querySelector('#mg-auto-f').textContent = `${fatG} g`;
        kcalEl.textContent = `${cal} kcal`;
      };
      body.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd));
      // Clic dans le champ calories : sélectionne tout le nombre pour pouvoir
      // le remplacer directement (même geste que le champ poids d'un repas).
      const calInput = body.querySelector('#mg-cal');
      calInput.addEventListener('focus', () => {
        setTimeout(() => {
          try { calInput.select(); } catch (_) {
            try { calInput.setSelectionRange(0, calInput.value.length); } catch (_) { /* noop */ }
          }
        }, 0);
      });
      // Boutons ±200 kcal : ajustent l'objectif par paliers ronds sans clavier.
      const stepCal = (delta) => {
        const cur = parseInt(calInput.value, 10) || 0;
        calInput.value = Math.max(0, cur + delta);
        upd();
        haptic();
      };
      body.querySelector('#mg-cal-minus').addEventListener('click', () => stepCal(-200));
      body.querySelector('#mg-cal-plus').addEventListener('click', () => stepCal(200));
      upd();
    } else {
      body.innerHTML = `
        <div class="muted" style="margin-bottom:10px">Répartition de l'objectif ${s.calorieGoal} kcal</div>
        ${[['Protéines', 'p', s.protPct, C_PROT], ['Glucides', 'c', s.carbsPct, C_CARB], ['Lipides', 'f', s.fatPct, C_FAT]].map(([lbl, k, v, col]) => `
          <div style="margin-bottom:10px">
            <div class="card-row"><span style="font-size:0.85rem">${lbl}</span><span class="num" id="mgp-${k}-val" style="color:${col}">${v}%</span></div>
            <input id="mgp-${k}" type="range" min="5" max="70" value="${v}" style="accent-color:${col}">
          </div>`).join('')}
        <div class="card-row"><span class="muted">Total</span><span class="num" id="mgp-total"></span></div>`;
      const upd = () => {
        const p = +body.querySelector('#mgp-p').value;
        const c = +body.querySelector('#mgp-c').value;
        const f = +body.querySelector('#mgp-f').value;
        body.querySelector('#mgp-p-val').textContent = p + '%';
        body.querySelector('#mgp-c-val').textContent = c + '%';
        body.querySelector('#mgp-f-val').textContent = f + '%';
        const tot = body.querySelector('#mgp-total');
        tot.textContent = (p + c + f) + '%';
        tot.style.color = (p + c + f) === 100 ? 'var(--success)' : 'var(--warning)';
        kcalEl.textContent = `${s.calorieGoal} kcal`;
      };
      body.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd));
      upd();
    }
  };
  renderBody();

  form.querySelector('#mg-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    mode = b.dataset.v;
    form.querySelectorAll('#mg-mode button').forEach((x) => x.classList.toggle('active', x === b));
    renderBody();
  });

  form.querySelector('#mg-save').addEventListener('click', () => {
    // L'historique conserve l'objectif en vigueur avant cette modification.
    freezePastGoals();
    if (mode === 'grams') {
      store.saveUserData({ settings: {
        macroMode: 'grams',
        proteinGoal: +body.querySelector('#mg-p').value,
        carbsGoalG: +body.querySelector('#mg-c').value,
        fatGoalG: +body.querySelector('#mg-f').value,
      } });
    } else if (mode === 'auto') {
      store.saveUserData({ settings: {
        macroMode: 'auto',
        calorieAuto: false,
        calorieGoal: +body.querySelector('#mg-cal').value || s.calorieGoal,
        protMult: +body.querySelector('#mg-pm').value,
        fatMult: +body.querySelector('#mg-fm').value,
      } });
    } else {
      store.saveUserData({ settings: {
        macroMode: 'pct',
        protPct: +body.querySelector('#mgp-p').value,
        carbsPct: +body.querySelector('#mgp-c').value,
        fatPct: +body.querySelector('#mgp-f').value,
      } });
    }
    store.saveUserData({ settings: { fiberPer1000: +fiberSlider.value } });
    sheet.close();
    toast('Objectifs enregistrés', 'success');
    rerender();
  });
}

// ============================================================
// AJOUT DE REPAS — sheet : macros POUR 100 g, puis POIDS en bas (mis en valeur)
// ============================================================
// prefill peut contenir :
//   - pour l'édition : { editId, name, meal, prot, carbs, fat, fiber } (macros absolues)
//   - depuis l'historique : { per100:{prot,carbs,fat,fiber}, weight, baseName, meal }
// Normalise un repas enregistré en données éditables { baseName, per100, weight }.
// Gère les repas anciens (sans per100/weight/baseName) : on reconstitue les
// valeurs pour 100 g à partir des macros absolues et du poids, et on retire le
// suffixe « (123 g) » du nom pour ne pas l'empiler à chaque modification.
export function mealToEditable(m) {
  const baseName = m.baseName || String(m.name || '').replace(/\s*\(\s*[\d.,]+\s*g\s*\)\s*$/i, '').trim();
  const weight = m.weight != null && m.weight > 0 ? m.weight : 100;
  let per100;
  if (m.per100) {
    per100 = { prot: m.per100.prot || 0, carbs: m.per100.carbs || 0, fat: m.per100.fat || 0, fiber: m.per100.fiber || 0 };
  } else {
    const r = 100 / weight;
    const rd = (v) => Math.round((v || 0) * r * 10) / 10;
    per100 = { prot: rd(m.prot), carbs: rd(m.carbs), fat: rd(m.fat), fiber: rd(m.fiber) };
  }
  return { baseName, per100, weight, meal: m.meal };
}

function openAddMealSheet(rerender, prefill = null) {
  const pf = prefill || {};
  let cat = pf.meal || defaultMealType();

  // Détermine les valeurs pour 100 g + le poids de départ selon le prefill.
  let per100 = { prot: '', carbs: '', fat: '', fiber: '' };
  let startWeight = 100;
  let baseName = pf.baseName || pf.name || '';
  if (pf.per100) {
    per100 = { prot: pf.per100.prot ?? '', carbs: pf.per100.carbs ?? '', fat: pf.per100.fat ?? '', fiber: pf.per100.fiber ?? '' };
    startWeight = pf.weight ?? 100;
  } else if (pf.editId && (pf.prot != null || pf.carbs != null || pf.fat != null)) {
    // Édition d'un ancien repas sans per100 : on repart d'une base 100 g = macros telles quelles
    per100 = { prot: pf.prot ?? '', carbs: pf.carbs ?? '', fat: pf.fat ?? '', fiber: pf.fiber ?? '' };
    startWeight = pf.weight ?? 100;
  }

  const form = el(`<div>
    <div class="segment segment-wrap" id="m-cat" style="margin-bottom:12px">
      ${MEAL_TYPES.map((t) => `<button data-v="${t}" class="${t === cat ? 'active' : ''}">${t}</button>`).join('')}
    </div>
    <label class="field"><span>Nom de l'aliment</span><input id="m-name" type="text" placeholder="Poulet, riz basmati…" autocomplete="off" value="${esc(baseName)}"></label>
    <div class="muted" style="font-size:0.78rem;margin:2px 0 8px">Valeurs nutritionnelles <b>pour 100 g</b></div>
    <div class="field-row">
      <label class="field"><span>Prot /100g</span><input id="m-prot" type="number" inputmode="decimal" min="0" placeholder="0" value="${per100.prot}"></label>
      <label class="field"><span>Gluc /100g</span><input id="m-carbs" type="number" inputmode="decimal" min="0" placeholder="0" value="${per100.carbs}"></label>
      <label class="field"><span>Lip /100g</span><input id="m-fat" type="number" inputmode="decimal" min="0" placeholder="0" value="${per100.fat}"></label>
    </div>
    <label class="field" style="margin-bottom:8px"><span>Fibres /100 g</span><input id="m-fiber" type="number" inputmode="decimal" min="0" placeholder="0" value="${per100.fiber}"></label>

    <div class="m-weight-box">
      <label class="field m-weight-field"><span>Poids consommé (g)</span>
        <input id="m-weight" type="number" inputmode="decimal" min="0" step="1" placeholder="0" value="${startWeight}"></label>
      <div class="m-weight-result">
        <span class="num" id="m-kcal">0 kcal</span>
        <span class="m-weight-macros" id="m-macros">${macroLine(0, 0, 0, 0)}</span>
      </div>
    </div>


    <button class="btn btn-primary btn-block" id="m-add">${pf.editId ? icons.check + ' Enregistrer' : icons.plus + ' Ajouter'}</button>
  </div>`);

  const sheet = openSheet({ title: pf.editId ? 'Modifier le repas' : `Repas du ${fmtDateShort(selectedDate)}`, content: form });

  const scale = () => {
    const p100 = parseFloat(form.querySelector('#m-prot').value) || 0;
    const c100 = parseFloat(form.querySelector('#m-carbs').value) || 0;
    const f100 = parseFloat(form.querySelector('#m-fat').value) || 0;
    const fi100 = parseFloat(form.querySelector('#m-fiber').value) || 0;
    const g = parseFloat(form.querySelector('#m-weight').value) || 0;
    const r = g / 100;
    return {
      prot: Math.round(p100 * r * 10) / 10,
      carbs: Math.round(c100 * r * 10) / 10,
      fat: Math.round(f100 * r * 10) / 10,
      fiber: Math.round(fi100 * r * 10) / 10,
      per100: { prot: p100, carbs: c100, fat: f100, fiber: fi100 },
      weight: g,
    };
  };
  const upd = () => {
    const v = scale();
    form.querySelector('#m-kcal').textContent = `${calcKcal(v.prot, v.carbs, v.fat)} kcal`;
    form.querySelector('#m-macros').innerHTML = macroLine(v.prot, v.carbs, v.fat, v.fiber);
  };
  ['#m-prot', '#m-carbs', '#m-fat', '#m-fiber', '#m-weight'].forEach((sel) => form.querySelector(sel).addEventListener('input', upd));
  upd();

  // Au clic dans le champ poids : sélectionne tout le nombre pour pouvoir le
  // remplacer directement (sans avoir à effacer chiffre par chiffre).
  const weightInput = form.querySelector('#m-weight');
  weightInput.addEventListener('focus', () => {
    setTimeout(() => {
      try { weightInput.select(); } catch (_) {
        try { weightInput.setSelectionRange(0, weightInput.value.length); } catch (_) { /* noop */ }
      }
    }, 0);
  });

  form.querySelector('#m-cat').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    cat = b.dataset.v;
    form.querySelectorAll('#m-cat button').forEach((x) => x.classList.toggle('active', x === b));
  });

  form.querySelector('#m-add').addEventListener('click', (ev) => {
    const bn = form.querySelector('#m-name').value.trim();
    const v = scale();
    if (!bn) { toast('Nom requis', 'error'); return; }
    if (v.per100.prot + v.per100.carbs + v.per100.fat === 0) { toast('Renseigne les macros /100g', 'error'); return; }
    if (!v.weight || v.weight <= 0) { toast('Poids invalide', 'error'); return; }
    // Mode "composer une recette" : on renvoie l'aliment pesé au lieu de l'ajouter aux repas.
    if (pf.onPick) {
      pf.onPick({ name: bn, per100: v.per100, weight: v.weight, prot: v.prot, carbs: v.carbs, fat: v.fat, fiber: v.fiber });
      haptic();
      sheet.close();
      return;
    }
    // État de la quête nutrition AVANT l'ajout, pour détecter un passage à complet
    const goalMetBefore = nutritionGoalMet(selectedDate);
    const btn = ev.currentTarget;
    const displayName = `${bn} (${v.weight} g)`;
    const payload = {
      name: displayName, baseName: bn, meal: cat,
      prot: v.prot, carbs: v.carbs, fat: v.fat, fiber: v.fiber,
      kcal: calcKcal(v.prot, v.carbs, v.fat),
      per100: v.per100, weight: v.weight,
    };
    if (pf.editId) {
      store.updateMeal(selectedDate, pf.editId, payload);
      toast('Repas modifié', 'success');
    } else {
      store.addNutritionLog(selectedDate, payload);
      rememberMealType(cat);
    }
    haptic();
    // Quête validée : le pilier nutrition passe de non-atteint à atteint
    if (!goalMetBefore && nutritionGoalMet(selectedDate)) {
      celebrateLP(btn, { label: '+ LP' });
    }
    sheet.close();
    rerender();
  });
}

// ============================================================
// LISSAGE CALORIQUE — répartit un excès/déficit sur plusieurs jours
// `remaining` = objectif - consommé du jour source (signé) :
//   remaining < 0 → excès mangé (on retirera des calories les jours suivants)
//   remaining > 0 → déficit    (on ajoutera des calories les jours suivants)
// ============================================================
function openSmoothingSheet(rerender, sourceDate, remaining) {
  const D = Math.round(remaining);            // écart signé (obj - consommé)
  const absD = Math.abs(D);
  const excess = D < 0;                       // true = on a trop mangé
  // Lissage déjà en place depuis ce jour : on part de son nombre de jours,
  // et on propose de le modifier ou de le supprimer plutôt que d'en empiler un.
  const existing = store.findCalorieSmoothing(sourceDate);
  const recommended = existing ? existing.days.length : Math.max(1, Math.floor(absD / 200));
  const liveGoal = macroGoalsFor(sourceDate); // objectif du jour source (pour dériver les macros)

  const form = el(`<div>
    <div class="smooth-head">
      <div class="smooth-delta ${excess ? 'over' : 'under'}">${excess ? '+' : '−'}${absD} kcal</div>
      <div class="muted">${excess ? 'mangées en trop le' : 'manquantes le'} ${fmtDateShort(sourceDate)}</div>
    </div>
    ${existing ? `<div class="smooth-active">
      <div class="smooth-active-h">${icons.check} Lissage en cours</div>
      <div class="smooth-active-d">
        ${existing.perDay > 0 ? '+' : ''}${existing.perDay} kcal/jour sur ${existing.days.length} jour(s),
        du ${fmtDateShort(existing.days[0].date)} au ${fmtDateShort(existing.days[existing.days.length - 1].date)}.
      </div>
      <button class="btn btn-danger btn-sm btn-block" id="sm-remove" style="margin-top:10px">${icons.trash} Supprimer ce lissage</button>
    </div>` : ''}
    <p class="muted" style="font-size:0.82rem;line-height:1.5;margin:6px 0 14px">
      Répartis cet écart sur les prochains jours pour ${excess ? 'ne pas avoir à te priver d\'un coup' : 'ne pas avoir à te gaver d\'un coup'}.
      L'objectif de ces jours sera ${excess ? 'réduit' : 'augmenté'} en conséquence (uniquement dans Nutrition).
    </p>
    <label class="field"><span>Nombre de jours</span>
      <input id="sm-days" type="number" inputmode="numeric" min="1" max="60" value="${recommended}"></label>
    <div class="smooth-preview" id="sm-preview"></div>
    <button class="btn btn-primary btn-block" id="sm-apply" style="margin-top:14px">${icons.check} ${existing ? 'Mettre à jour' : 'Lisser'} sur <span id="sm-apply-n">${recommended}</span> jour(s)</button>
  </div>`);

  const sheet = openSheet({ title: 'Lisser les calories', content: form });
  const daysInput = form.querySelector('#sm-days');
  const preview = form.querySelector('#sm-preview');
  const applyN = form.querySelector('#sm-apply-n');

  const update = () => {
    const n = Math.max(1, Math.min(60, parseInt(daysInput.value, 10) || 1));
    // Excès → on retire des calories (perDay négatif) ; déficit → on ajoute.
    const perDay = Math.round((excess ? -absD : absD) / n);
    applyN.textContent = n;
    preview.innerHTML = `
      <div class="smooth-row"><span>Par jour</span><b class="${excess ? 'over' : 'under'}">${perDay > 0 ? '+' : ''}${perDay} kcal</b></div>
      <div class="smooth-row"><span>Sur</span><b>${n} jour(s)</b></div>
      <div class="smooth-row muted"><span>Total réparti</span><b>${perDay * n > 0 ? '+' : ''}${perDay * n} kcal</b></div>`;
    return { n, perDay };
  };
  update();
  daysInput.addEventListener('input', update);
  // Sélectionne tout le nombre au focus (remplacement direct)
  daysInput.addEventListener('focus', () => {
    setTimeout(() => { try { daysInput.select(); } catch (_) { /* noop */ } }, 0);
  });

  const removeBtn = form.querySelector('#sm-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      confirmModal(
        'Supprimer le lissage',
        `Les ${existing.days.length} jour(s) concernés retrouveront leur objectif d'origine.`,
        () => {
          const n = store.removeCalorieSmoothing(sourceDate);
          haptic();
          toast(`Lissage retiré sur ${n} jour(s)`, 'success');
          sheet.close();
          rerender();
        },
        true,
      );
    });
  }

  form.querySelector('#sm-apply').addEventListener('click', () => {
    const { n, perDay } = update();
    if (perDay === 0) { toast('Écart trop faible à lisser', 'error'); return; }
    // Un lissage existant est d'abord annulé : sans ça le nouveau s'ajouterait
    // au précédent et l'écart serait compté deux fois.
    if (existing) store.removeCalorieSmoothing(sourceDate);
    store.applyCalorieSmoothing(sourceDate, D, n, perDay, liveGoal);
    haptic();
    toast(existing ? `Lissage mis à jour sur ${n} jour(s)` : `Écart lissé sur ${n} jour(s)`, 'success');
    sheet.close();
    rerender();
  });
}
// Liste toutes les entrées passées, de la plus récente à la plus ancienne.
// Au clic → ouvre l'ajout pré-rempli avec les valeurs /100g : il n'y a plus
// qu'à ajuster le poids.
// ============================================================
// ============================================================
// RECETTES — sheet de gestion
// ============================================================
function openRecipesSheet(rerender) {
  const build = () => {
    const recipes = store.userData.recipes || [];
    const form = el(`<div>
      <button class="btn btn-primary btn-block" id="r-new" style="margin-bottom:14px">${icons.plus} Créer une recette</button>
      <div id="r-list">${recipes.length ? '' : '<div class="empty-state">Aucune recette.<br>Crée-en une avec le bouton ci-dessus.</div>'}</div>
    </div>`);
    const sheet = openSheet({ title: 'Mes recettes', content: form });
    const list = form.querySelector('#r-list');
    for (const r of recipes) {
      const nIng = (r.ingredients && r.ingredients.length) ? `&ensp;${r.ingredients.length} aliment${r.ingredients.length > 1 ? 's' : ''}` : '';
      const item = el(`<div class="swipe-row recipe-row">
        <button class="swipe-del" data-del aria-label="Supprimer la recette">${icons.trash}</button>
        <div class="swipe-content recipe-item">
        <div class="recipe-info">
          <div class="recipe-name">${esc(r.name)}</div>
          <div class="meal-macros">${calcKcal(r.prot, r.carbs, r.fat)} kcal&ensp;${macroLine(r.prot, r.carbs, r.fat, r.fiber)}${nIng}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="icon-btn" data-edit aria-label="Modifier">${icons.edit}</button>
        </div>
        </div>
      </div>`);
      item.querySelector('[data-edit]').addEventListener('click', () => {
        sheet.close();
        openRecipeEditor(() => build(), r);
      });
      item.querySelector('[data-del]').addEventListener('click', () => {
        confirmModal('Supprimer', `Supprimer la recette « ${esc(r.name)} » ?`, () => {
          store.deleteRecipe(r.id);
          sheet.close();
          build();
        }, true);
      });
      list.appendChild(item);
    }
    attachSwipeToDelete(list, { rowSelector: '.recipe-row', contentSelector: '.swipe-content', collapse: false });
    form.querySelector('#r-new').addEventListener('click', () => {
      sheet.close();
      openRecipeEditor(() => build());
    });
  };
  build();
}

// Éditeur de recette : nom + liste d'aliments composée via Loupe / code-barre.
// Les macros de la recette = somme des aliments ajoutés. `existing` = recette à éditer.
function openRecipeEditor(onSaved, existing = null) {
  const state = {
    name: existing ? existing.name : '',
    ingredients: existing && existing.ingredients ? existing.ingredients.map((i) => ({ ...i }) ) : [],
  };

  const totals = () => state.ingredients.reduce((a, i) => ({
    prot: a.prot + (i.prot || 0), carbs: a.carbs + (i.carbs || 0),
    fat: a.fat + (i.fat || 0), fiber: a.fiber + (i.fiber || 0),
  }), { prot: 0, carbs: 0, fat: 0, fiber: 0 });

  const form = el(`<div>
    <label class="field"><span>Nom de la recette</span><input id="re-name" type="text" placeholder="Bowl protéiné" autocomplete="off" value="${state.name.replace(/"/g, '&quot;')}"></label>
    <div class="re-add-row">
      <span class="muted" style="font-size:0.8rem">Ajouter un aliment</span>
      <div style="display:flex;gap:6px">
        <button class="btn btn-secondary btn-sm" id="re-search" aria-label="Rechercher">${icons.search}</button>
        <button class="btn btn-secondary btn-sm" id="re-scan" aria-label="Code-barre">${icons.barcode}</button>
      </div>
    </div>
    <div id="re-ings" style="margin-top:10px"></div>
    <div class="re-totals" id="re-totals"></div>
  </div>`);

  const round = (v) => Math.round((v || 0) * 10) / 10;
  const renderIngs = () => {
    const host = form.querySelector('#re-ings');
    if (!state.ingredients.length) {
      host.innerHTML = '<div class="empty-state" style="padding:16px">Aucun aliment.<br>Utilise la loupe ou le code-barre.</div>';
    } else {
      host.innerHTML = '';
      state.ingredients.forEach((ing, idx) => {
        const row = el(`<div class="swipe-row re-ing-row">
          <button class="swipe-del" data-del aria-label="Retirer l'aliment">${icons.trash}</button>
          <div class="swipe-content re-ing">
          <div class="re-ing-info">
            <div class="re-ing-name">${esc(ing.name)}${ing.weight ? ` <span class="muted">(${ing.weight} g)</span>` : ''}</div>
            <div class="meal-macros">${calcKcal(ing.prot, ing.carbs, ing.fat)} kcal&ensp;${macroLine(ing.prot, ing.carbs, ing.fat, ing.fiber, { round: true })}</div>
          </div>
          </div>
        </div>`);
        row.querySelector('[data-del]').addEventListener('click', () => { state.ingredients.splice(idx, 1); renderIngs(); });
        host.appendChild(row);
      });
      attachSwipeToDelete(host, { rowSelector: '.re-ing-row', contentSelector: '.re-ing' });
    }
    const t = totals();
    form.querySelector('#re-totals').innerHTML = `
      <div class="re-tot-row"><span>Total recette</span><b class="num" style="color:var(--accent)">${calcKcal(t.prot, t.carbs, t.fat)} kcal</b></div>
      <div class="re-tot-row muted"><span>P ${round(t.prot)}&ensp;G ${round(t.carbs)}&ensp;L ${round(t.fat)}${t.fiber ? `&ensp;F ${round(t.fiber)}` : ''}</span></div>`;
  };
  renderIngs();

  // Callback commun : reçoit un aliment pesé et l'ajoute à la recette.
  const addIngredient = (food) => {
    const r = (food.weight || 100) / 100;
    const rd = (v) => Math.round((v || 0) * r * 10) / 10;
    // food peut venir de la base (per100) ou de l'éditeur (déjà pesé : prot/carbs...)
    const already = food.prot != null && food.per100; // openAddMealSheet renvoie les deux
    const prot = already ? food.prot : rd(food.per100.prot);
    const carbs = already ? food.carbs : rd(food.per100.carbs);
    const fat = already ? food.fat : rd(food.per100.fat);
    const fiber = already ? food.fiber : rd(food.per100.fiber);
    state.ingredients.push({ name: food.name, weight: food.weight || 100, prot, carbs, fat, fiber, per100: food.per100 });
    renderIngs();
  };

  form.querySelector('#re-search').addEventListener('click', () => {
    openFoodSearchSheet(() => {}, { onPick: addIngredient });
  });
  form.querySelector('#re-scan').addEventListener('click', () => {
    openBarcodeSheet(() => {}, { onPick: addIngredient });
  });

  openModal({
    title: existing ? 'Modifier la recette' : 'Nouvelle recette',
    content: form,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Enregistrer', variant: 'btn-primary',
        onClick: (b) => {
          const name = b.querySelector('#re-name').value.trim();
          if (!name) { toast('Nom requis', 'error'); return 'keep'; }
          if (!state.ingredients.length) { toast('Ajoute au moins un aliment', 'error'); return 'keep'; }
          const t = totals();
          const recipe = {
            id: existing ? existing.id : crypto.randomUUID(),
            name,
            prot: Math.round(t.prot), carbs: Math.round(t.carbs), fat: Math.round(t.fat), fiber: Math.round(t.fiber),
            ingredients: state.ingredients,
          };
          store.saveRecipe(recipe);
          toast(existing ? 'Recette mise à jour' : 'Recette enregistrée', 'success');
          if (onSaved) onSaved();
        },
      },
    ],
  });
}

// ============================================================
// SCAN CODE-BARRE — caméra LIVE dans l'app + pause/capture -> Open Food Facts
// On reste dans l'application : flux vidéo getUserMedia, bouton pour figer une
// image (« photo »), puis analyse multi-orientation du code-barre.
// ============================================================
// Deux modes, mémorisés dans les réglages (scanMode) :
//   « live »  : viseur vidéo dans l'app (demande l'accès à la caméra) ;
//   « photo » : ouvre l'appareil photo du téléphone via un <input capture>.
//               C'est le système qui prend la photo : AUCUNE autorisation
//               n'est jamais demandée.
function openBarcodeSheet(rerender, opts = {}) {
  let stoppedByUser = false;
  let camera = null;      // contrôleur { stop }
  let lastPhotoUrl = null;
  let mode = store.userData.settings.scanMode === 'photo' ? 'photo' : 'live';

  const content = el(`<div>
    <div id="bc-camera-step">
      <div class="bc-cam-zone" id="bc-cam-zone">
        <video id="bc-video" playsinline autoplay muted></video>
        <img id="bc-frozen" alt="Image figée" style="display:none">
        <div class="bc-cam-reticle"></div>
        <div class="bc-photo-hint" id="bc-photo-hint">${icons.barcode}<span>Photographie le code-barre</span></div>
      </div>
      <input type="file" accept="image/*" capture="environment" id="bc-file" hidden>
      <div class="segment bc-mode" id="bc-mode">
        <button type="button" data-mode="live">Viseur</button>
        <button type="button" data-mode="photo">Appareil photo</button>
      </div>
      <div class="bc-cam-actions">
        <button class="btn btn-primary btn-block" id="bc-shoot">${icons.barcode} Prendre la photo</button>
        <button class="btn btn-secondary btn-block" id="bc-retry" style="display:none">Reprendre</button>
      </div>
      <div class="muted" id="bc-status" style="text-align:center;margin-top:10px">Cadre le code-barre dans le viseur</div>
      <div class="bc-manual-row">
        <input type="text" inputmode="numeric" id="bc-manual-code" placeholder="Ou saisis les chiffres (ex: 3017620422003)">
        <button class="btn btn-secondary btn-sm" id="bc-manual-go">Valider</button>
      </div>
    </div>
  </div>`);

  const sheet = openSheet({
    title: 'Scanner un produit',
    content,
    onClose: () => {
      stoppedByUser = true;
      if (camera) camera.stop();
      if (lastPhotoUrl) URL.revokeObjectURL(lastPhotoUrl);
    },
  });

  const statusEl = content.querySelector('#bc-status');
  const videoEl = content.querySelector('#bc-video');
  const frozenEl = content.querySelector('#bc-frozen');
  const shootBtn = content.querySelector('#bc-shoot');
  const retryBtn = content.querySelector('#bc-retry');

  const fileEl = content.querySelector('#bc-file');
  const zoneEl = content.querySelector('#bc-cam-zone');
  const LIVE_HINT = 'Cadre le code-barre dans le viseur';
  const PHOTO_HINT = 'Photo prise par l\'appareil photo, sans autorisation';

  // Démarrage de la caméra (mode viseur uniquement)
  async function startLive() {
    try {
      camera = await startCameraStream(videoEl);
      if (stoppedByUser || mode !== 'live') { camera.stop(); camera = null; }
    } catch (e) {
      if (!stoppedByUser && mode === 'live') {
        statusEl.innerHTML = `${e.message}<br>Tu peux aussi saisir les chiffres du code-barre ci-dessous.`;
        shootBtn.disabled = true;
      }
    }
  }
  function applyMode() {
    content.querySelectorAll('#bc-mode button').forEach((x) => x.classList.toggle('active', x.dataset.mode === mode));
    zoneEl.classList.toggle('photo-mode', mode === 'photo');
    shootBtn.disabled = false;
    if (mode === 'photo') {
      if (camera) { camera.stop(); camera = null; }
      shootBtn.innerHTML = `${icons.barcode} Ouvrir l'appareil photo`;
      statusEl.textContent = PHOTO_HINT;
    } else {
      shootBtn.innerHTML = `${icons.barcode} Prendre la photo`;
      statusEl.textContent = LIVE_HINT;
      startLive();
    }
    showLive();
  }
  content.querySelector('#bc-mode').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.dataset.mode === mode) return;
    mode = btn.dataset.mode;
    store.saveUserData({ settings: { scanMode: mode } });
    haptic();
    applyMode();
  });

  // Mode « Appareil photo » : la photo revient dans le champ fichier.
  fileEl.addEventListener('change', async () => {
    const file = fileEl.files && fileEl.files[0];
    fileEl.value = '';
    if (!file) return;
    if (lastPhotoUrl) URL.revokeObjectURL(lastPhotoUrl);
    lastPhotoUrl = URL.createObjectURL(file);
    frozenEl.src = lastPhotoUrl;
    videoEl.style.display = 'none';
    frozenEl.style.display = '';
    zoneEl.classList.add('has-photo');
    statusEl.textContent = 'Analyse de la photo…';
    try {
      const code = await decodeBarcodeFromFile(file);
      if (stoppedByUser) return;
      await handleCode(code);
    } catch (e) {
      if (!stoppedByUser) statusEl.textContent = `${e.message} Réessaie en rapprochant le code-barre.`;
    }
  });

  function showLive() {
    videoEl.style.display = mode === 'live' ? '' : 'none';
    frozenEl.style.display = 'none';
    zoneEl.classList.remove('has-photo');
    shootBtn.style.display = '';
    retryBtn.style.display = 'none';
    if (lastPhotoUrl) { URL.revokeObjectURL(lastPhotoUrl); lastPhotoUrl = null; }
  }

  async function handleCode(code) {
    if (stoppedByUser) return;
    statusEl.textContent = `Code ${code}, recherche…`;
    try {
      const product = await fetchProductByBarcode(code);
      if (stoppedByUser) return;
      if (!product) {
        statusEl.textContent = 'Produit introuvable sur Open Food Facts. Vérifie le code ou ajoute-le manuellement (Ajout rapide).';
        return;
      }
      if (camera) camera.stop();
      // On réutilise le menu d'ajout rapide (mêmes 4 types de repas en haut),
      // avec les valeurs pour 100 g déjà remplies : il ne reste que le poids.
      sheet.close();
      const per100 = { prot: product.prot, carbs: product.carbs, fat: product.fat, fiber: product.fiber };
      if (opts.onPick) {
        openAddMealSheet(rerender, { baseName: product.name, per100, weight: 100, onPick: opts.onPick });
      } else {
        openAddMealSheet(rerender, { baseName: product.name, per100, weight: 100 });
      }
    } catch (e) {
      if (!stoppedByUser) statusEl.textContent = e.message || 'Erreur lors de la recherche du produit.';
    }
  }

  // Prendre la photo = figer l'image courante (pause) puis l'analyser
  shootBtn.addEventListener('click', async () => {
    // Mode photo : le tap ouvre directement l'appareil photo du système.
    if (mode === 'photo') { fileEl.click(); return; }
    shootBtn.disabled = true;
    let blob;
    try {
      blob = await captureFrame(videoEl);
    } catch (e) {
      statusEl.textContent = e.message;
      shootBtn.disabled = false;
      return;
    }
    // Fige l'aperçu (met "pause" sur la caméra)
    lastPhotoUrl = URL.createObjectURL(blob);
    frozenEl.src = lastPhotoUrl;
    videoEl.style.display = 'none';
    frozenEl.style.display = '';
    shootBtn.style.display = 'none';
    retryBtn.style.display = '';
    statusEl.textContent = 'Analyse de la photo…';

    try {
      const code = await decodeBarcodeFromFile(blob);
      if (stoppedByUser) return;
      await handleCode(code);
    } catch (e) {
      if (!stoppedByUser) statusEl.textContent = e.message;
    } finally {
      shootBtn.disabled = false;
    }
  });

  retryBtn.addEventListener('click', () => {
    showLive();
    statusEl.textContent = 'Cadre le code-barre dans le viseur puis prends la photo.';
  });

  applyMode();

  content.querySelector('#bc-manual-go').addEventListener('click', () => {
    const code = content.querySelector('#bc-manual-code').value.trim();
    if (!code) { toast('Entre un code-barre', 'error'); return; }
    handleCode(code);
  });

}

// Base d'aliments courants (loupe) : recherche + filtres par catégorie. Un clic
// ouvre l'éditeur classique pré-rempli (per100) pour ajuster le poids.
// ============================================================
// RECHERCHE UNIFIÉE (bouton Loupe)
// Regroupe Historique / Tous (base d'aliments) / Recettes, avec une barre de
// recherche et un bouton flamme (ajout rapide) à droite.
// `opts.onPick(food)` : si fourni, sélectionner un aliment appelle ce callback
//   au lieu d'ouvrir l'éditeur de repas (utilisé pour composer une recette).
//   `food` = { name, per100:{prot,carbs,fat,fiber}, weight }
// `opts.mealDefault` : type de repas ciblé par défaut (mode repas).
// `opts.includeRecipes` (défaut true) : afficher l'onglet Recettes.
// ============================================================
// Ajout d'une recette à un repas : sélecteur de repas, récapitulatif des
// ingrédients, et un multiplicateur (×1 par défaut) qui multiplie toutes les
// macros. Le bouton « Ajouter » enregistre la recette (× mult) dans le repas.
// `getCat/setCat` synchronisent le repas courant avec la sheet loupe parente.
function openRecipeAddSheet(rerender, recipe, getCat, setCat, opts = {}) {
  let cat = (getCat && getCat()) || defaultMealType();
  const editing = !!opts.editMealId;
  let mult = opts.mult || 1;
  const ings = recipe.ingredients || [];

  const form = el(`<div>
    <div class="segment segment-wrap" id="ra-cat" style="margin-bottom:12px">
      ${MEAL_TYPES.map((t) => `<button data-v="${t}" class="${t === cat ? 'active' : ''}">${t}</button>`).join('')}
    </div>
    <div class="ra-title">${esc(recipe.name)}</div>
    ${ings.length ? `<div class="ra-ings">${ings.map((i) => `
      <div class="ra-ing">
        <span class="ra-ing-name">${esc(i.name)}${i.weight ? ` <span class="muted">(${i.weight} g)</span>` : ''}</span>
        <span class="muted">${calcKcal(i.prot, i.carbs, i.fat)} kcal</span>
      </div>`).join('')}</div>` : '<div class="muted" style="font-size:0.8rem;margin-bottom:8px">Sans détail d\'ingrédients</div>'}
    <label class="field ra-mult"><span>Multiplicateur (portions)</span>
      <input id="ra-mult" type="number" inputmode="decimal" min="0.1" step="0.5" value="${mult}"></label>
    <div class="ra-totals" id="ra-totals"></div>
    <button class="btn btn-primary btn-block" id="ra-add" style="margin-top:14px">${editing ? icons.check + ' Enregistrer' : icons.plus + ' Ajouter'}</button>
  </div>`);
  const sheet = openSheet({ title: editing ? 'Modifier la recette' : 'Ajouter la recette', content: form });

  const round = (v) => Math.round((v || 0) * 10) / 10;
  const scaled = () => ({
    prot: (recipe.prot || 0) * mult, carbs: (recipe.carbs || 0) * mult,
    fat: (recipe.fat || 0) * mult, fiber: (recipe.fiber || 0) * mult,
  });
  const refresh = () => {
    const s = scaled();
    form.querySelector('#ra-totals').innerHTML = `
      <div class="re-tot-row"><span>Total ${mult !== 1 ? `(×${mult})` : ''}</span><b class="num" style="color:var(--accent)">${calcKcal(s.prot, s.carbs, s.fat)} kcal</b></div>
      <div class="re-tot-row muted"><span>P ${round(s.prot)}&ensp;G ${round(s.carbs)}&ensp;L ${round(s.fat)}${s.fiber ? `&ensp;F ${round(s.fiber)}` : ''}</span></div>`;
  };
  refresh();

  form.querySelector('#ra-cat').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    cat = b.dataset.v;
    if (setCat) setCat(cat);
    form.querySelectorAll('#ra-cat button').forEach((x) => x.classList.toggle('active', x === b));
    haptic();
  });
  form.querySelector('#ra-mult').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    mult = (isNaN(val) || val <= 0) ? 1 : val;
    refresh();
  });
  form.querySelector('#ra-add').addEventListener('click', () => {
    const s = scaled();
    const prot = Math.round(s.prot * 10) / 10;
    const carbs = Math.round(s.carbs * 10) / 10;
    const fat = Math.round(s.fat * 10) / 10;
    const fiber = Math.round(s.fiber * 10) / 10;
    const goalMetBefore = nutritionGoalMet(selectedDate);
    const label = mult !== 1 ? `${recipe.name} ×${mult}` : recipe.name;
    const payload = {
      name: label, baseName: recipe.name, meal: cat,
      prot, carbs, fat, fiber, kcal: calcKcal(prot, carbs, fat),
      per100: { prot: 0, carbs: 0, fat: 0, fiber: 0 }, weight: 0, fromRecipe: recipe.id, recipeMult: mult,
    };
    if (editing) {
      store.updateMeal(selectedDate, opts.editMealId, payload);
      toast('Recette mise à jour', 'success');
    } else {
      store.addNutritionLog(selectedDate, payload);
      toast(`${recipe.name} ajouté à ${cat}`, 'success');
    }
    rememberMealType(cat);
    haptic();
    const btn = form.querySelector('#ra-add');
    sheet.close();
    if (!goalMetBefore && nutritionGoalMet(selectedDate)) celebrateLP(btn, { label: '+ LP' });
    rerender();
  });
}

function openFoodSearchSheet(rerender, opts = {}) {
  const onPick = opts.onPick || null;         // mode "composer une recette" si défini
  const includeRecipes = opts.includeRecipes !== false && !onPick; // pas de recettes dans une recette
  let tab = 'history';                          // history | all | recipes
  let recipeSource = 'mine';                    // mine | preset (onglet Recettes)
  let query = '';
  let cat = opts.mealDefault || lastMealType(); // repas ciblé (mode repas)

  const tabsHtml = `
    <button data-tab="history" class="active">Historique</button>
    <button data-tab="all">Tous</button>
    ${includeRecipes ? '<button data-tab="recipes">Recettes</button>' : ''}`;

  const form = el(`<div>
    <div class="fs-searchbar">
      <input id="fs-search" type="text" placeholder="Rechercher" autocomplete="off" class="field-input-solo">
      <button class="fs-quick" id="fs-quick" aria-label="Ajout rapide" title="Ajout rapide">${icons.flame}</button>
    </div>
    ${onPick ? '' : `<div class="segment segment-meals" id="fs-meal" style="margin-top:10px">
      ${MEAL_TYPES.map((t) => `<button data-v="${t}" class="${t === cat ? 'active' : ''}">${t}</button>`).join('')}
    </div>`}
    <div class="segment fs-tabs-eq" id="fs-tabs" style="margin:10px 0 12px">${tabsHtml}</div>
    <div class="segment fs-tabs-eq fs-rsrc" id="fs-rsrc" style="display:none;margin:-4px 0 12px">
      <button data-src="mine" class="active">Mes recettes</button>
      <button data-src="preset">Préenregistrées</button>
    </div>
    <div id="fs-list" class="fs-list-fixed"></div>
  </div>`);
  const sheet = openSheet({ title: onPick ? 'Ajouter un aliment' : 'Aliments', content: form });
  const list = form.querySelector('#fs-list');

  // Retour visuel léger sans fermer le menu (pour enchaîner les ajouts).
  const flashAdded = (elm) => {
    if (!elm) return;
    elm.classList.add('just-added');
    setTimeout(() => elm.classList.remove('just-added'), 450);
  };

  // Ajoute un aliment. IMPORTANT : on NE ferme PAS la sheet, pour enchaîner.
  const pick = (food, srcEl) => {
    if (onPick) { onPick(food); flashAdded(srcEl); haptic(); return; }
    // Mode repas : ouvre l'éditeur pour ajuster le poids (la sheet reste dessous).
    openAddMealSheet(rerender, { baseName: food.name, per100: food.per100, weight: food.weight || 100, meal: cat });
  };

  // Ajout DIRECT au repas sélectionné, sans ouvrir d'éditeur (onglet Historique).
  // `food` a un poids connu (celui de la dernière fois). Les macros sont mises à
  // l'échelle depuis per100.
  const addDirect = (food, srcEl) => {
    if (onPick) { onPick(food); flashAdded(srcEl); haptic(); return; }
    const w = food.weight || 100;
    const r = w / 100;
    const rd = (val) => Math.round((val || 0) * r * 10) / 10;
    const p = food.per100 || {};
    const prot = rd(p.prot); const carbs = rd(p.carbs); const fat = rd(p.fat); const fiber = rd(p.fiber);
    const goalMetBefore = nutritionGoalMet(selectedDate);
    store.addNutritionLog(selectedDate, {
      name: `${food.name} (${w} g)`, baseName: food.name, meal: cat,
      prot, carbs, fat, fiber, kcal: calcKcal(prot, carbs, fat),
      per100: { prot: p.prot || 0, carbs: p.carbs || 0, fat: p.fat || 0, fiber: p.fiber || 0 }, weight: w,
    });
    rememberMealType(cat);
    flashAdded(srcEl);
    haptic();
    toast(`${food.name} ajouté à ${cat}`, 'success');
    if (!goalMetBefore && nutritionGoalMet(selectedDate)) celebrateLP(srcEl, { label: '+ LP' });
    rerender();
  };

  // `handler` : fonction (food, itemEl) à appeler au clic. Par défaut = pick (éditeur).
  const rowFood = (name, per100, weight, meta, handler) => {
    const kcal100 = calcKcal(per100.prot || 0, per100.carbs || 0, per100.fat || 0);
    const item = el(`<button class="hist-item">
      <div class="hist-info">
        <div class="hist-name">${esc(name)}</div>
        <div class="meal-macros">100 g : ${kcal100} kcal&ensp;${macroLine(per100.prot, per100.carbs, per100.fat, per100.fiber, { round: true })}${meta || ''}</div>
      </div>
      <span class="hist-add">${icons.plus}</span>
    </button>`);
    const fn = handler || pick;
    item.addEventListener('click', () => fn({ name, per100, weight: weight || 100 }, item));
    return item;
  };

  const drawHistory = (nq) => {
    const entries = store.nutritionEntryHistory();
    const filtered = nq ? entries.filter((e) => normalizeStr(e.baseName || e.name || '').includes(nq)) : entries;
    if (!filtered.length) { list.innerHTML = `<div class="empty-state">${nq ? 'Aucun résultat' : 'Aucune entrée pour le moment.'}</div>`; return; }
    list.innerHTML = '';
    for (const e of filtered.slice(0, 200)) {
      const p100 = e.per100 || { prot: e.prot, carbs: e.carbs, fat: e.fat, fiber: e.fiber };
      const name = e.baseName || e.name || 'Aliment';
      const weight = e.weight || 100;
      list.appendChild(rowFood(name, p100, weight, `&ensp;dernier ${weight} g`, addDirect));
    }
  };

  const drawAll = (nq) => {
    let items = FOODS;
    if (nq) items = items.filter((f) => foodMatches(f, nq));
    items = items.slice().sort((a, b) => a.n.localeCompare(b.n, 'fr'));
    if (!items.length) { list.innerHTML = '<div class="empty-state">Aucun aliment trouvé</div>'; return; }
    list.innerHTML = '';
    for (const f of items.slice(0, 300)) {
      list.appendChild(rowFood(f.n, { prot: f.p, carbs: f.g, fat: f.f, fiber: f.fb || 0 }, 100, ''));
    }
  };

  // Ajout d'une recette en UN CLIC, sans passer par le menu multiplicateur.
  // Le repas garde `fromRecipe` : le retoucher rouvre le menu avec le
  // multiplicateur, pour ajuster la portion après coup.
  const addRecipeDirect = (recipe, srcEl) => {
    const prot = recipe.prot || 0; const carbs = recipe.carbs || 0;
    const fat = recipe.fat || 0; const fiber = recipe.fiber || 0;
    const goalMetBefore = nutritionGoalMet(selectedDate);
    store.addNutritionLog(selectedDate, {
      name: recipe.name, baseName: recipe.name, meal: cat,
      prot, carbs, fat, fiber, kcal: calcKcal(prot, carbs, fat),
      per100: { prot: 0, carbs: 0, fat: 0, fiber: 0 }, weight: 0,
      fromRecipe: recipe.id, recipeMult: 1,
    });
    rememberMealType(cat);
    flashAdded(srcEl);
    haptic();
    toast(`${recipe.name} ajouté à ${cat}`, 'success');
    if (!goalMetBefore && nutritionGoalMet(selectedDate)) celebrateLP(srcEl, { label: '+ LP' });
    rerender();
  };

  // Ligne de recette. `sub` = texte secondaire sous les macros (description
  // pour les préenregistrées). `handler(recipe, itemEl)` = action au clic.
  const rowRecipe = (r, sub, handler) => {
    const item = el(`<button class="hist-item">
      <div class="hist-info">
        <div class="hist-name">${esc(r.name)}</div>
        <div class="meal-macros">${calcKcal(r.prot, r.carbs, r.fat)} kcal&ensp;${macroLine(r.prot, r.carbs, r.fat, r.fiber)}</div>
        ${sub ? `<div class="hist-sub">${esc(sub)}</div>` : ''}
      </div>
      <span class="hist-add">${icons.plus}</span>
    </button>`);
    item.addEventListener('click', () => handler(r, item));
    return item;
  };

  // Mode « composer une recette » : on renvoie la recette comme un aliment.
  const pickRecipeAsFood = (r, item) => {
    onPick({ name: r.name, per100: { prot: r.prot, carbs: r.carbs, fat: r.fat, fiber: r.fiber || 0 }, weight: 100, isRecipe: true });
    flashAdded(item);
    haptic();
  };

  const drawMyRecipes = (nq) => {
    let recipes = store.userData.recipes || [];
    if (nq) recipes = recipes.filter((r) => normalizeStr(r.name).includes(nq));
    if (!recipes.length) {
      list.innerHTML = `<div class="empty-state">${nq ? 'Aucune recette' : 'Aucune recette personnelle.<br>Crée-en depuis le bouton Recettes,<br>ou pioche dans les préenregistrées.'}</div>`;
      return;
    }
    list.innerHTML = '';
    for (const r of recipes) {
      // Clic → menu récap + multiplicateur (comportement historique).
      list.appendChild(rowRecipe(r, '', onPick
        ? pickRecipeAsFood
        : () => openRecipeAddSheet(rerender, r, () => cat, (c) => { cat = c; })));
    }
  };

  // Recettes préenregistrées : plats composés courants, groupés par catégorie,
  // ajoutés en un seul clic au repas sélectionné.
  const drawPresetRecipes = (nq) => {
    const matching = PRESET_RECIPES.filter((p) => !nq
      || normalizeStr(p.n).includes(nq)
      || normalizeStr(p.c).includes(nq)
      || normalizeStr(p.d).includes(nq));
    if (!matching.length) { list.innerHTML = '<div class="empty-state">Aucune recette trouvée</div>'; return; }
    list.innerHTML = '';
    let lastCat = null;
    for (const p of matching) {
      if (p.c !== lastCat) {
        lastCat = p.c;
        list.appendChild(el(`<div class="fs-cat-head">${esc(p.c)}</div>`));
      }
      const r = presetToRecipe(p);
      // Même menu que pour une recette personnelle : récap + multiplicateur de
      // portions, pour pouvoir ajuster avant d'ajouter.
      list.appendChild(rowRecipe(r, p.d, onPick
        ? pickRecipeAsFood
        : () => openRecipeAddSheet(rerender, r, () => cat, (c) => { cat = c; })));
    }
  };

  const drawRecipes = (nq) => {
    if (recipeSource === 'preset') drawPresetRecipes(nq);
    else drawMyRecipes(nq);
  };

  // ---- Recherche : on cherche PARTOUT, pas seulement dans l'onglet actif ----
  // Dès qu'une requête est saisie, on remonte les résultats des trois sources
  // (historique, base d'aliments, recettes) sous des en-têtes de section. Les
  // onglets ne servent plus qu'à parcourir une source quand le champ est vide.
  const drawSearchEverywhere = (nq) => {
    list.innerHTML = '';
    let total = 0;
    const section = (titre, elements) => {
      if (!elements.length) return;
      total += elements.length;
      list.appendChild(el(`<div class="fs-cat-head">${titre}</div>`));
      for (const e of elements) list.appendChild(e);
    };

    // Historique — clic = ajout direct, poids repris de la dernière saisie
    const hist = store.nutritionEntryHistory()
      .filter((e) => normalizeStr(e.baseName || e.name || '').includes(nq))
      .slice(0, 40)
      .map((e) => rowFood(
        e.baseName || e.name || 'Aliment',
        e.per100 || { prot: e.prot, carbs: e.carbs, fat: e.fat, fiber: e.fiber },
        e.weight || 100,
        `&ensp;dernier ${e.weight || 100} g`,
        addDirect,
      ));
    section('Historique', hist);

    // Base d'aliments
    const foods = FOODS
      .filter((f) => foodMatches(f, nq))
      .sort((a, b) => a.n.localeCompare(b.n, 'fr'))
      .slice(0, 60)
      .map((f) => rowFood(f.n, { prot: f.p, carbs: f.g, fat: f.f, fiber: f.fb || 0 }, 100, ''));
    section('Aliments', foods);

    if (includeRecipes) {
      const mine = (store.userData.recipes || [])
        .filter((r) => normalizeStr(r.name).includes(nq))
        .map((r) => rowRecipe(r, '', () => openRecipeAddSheet(rerender, r, () => cat, (c) => { cat = c; })));
      section('Mes recettes', mine);

      const presets = PRESET_RECIPES
        .filter((p) => normalizeStr(p.n).includes(nq) || normalizeStr(p.c).includes(nq) || normalizeStr(p.d).includes(nq))
        .slice(0, 40)
        .map((p) => {
          const r = presetToRecipe(p);
          return rowRecipe(r, p.d, () => openRecipeAddSheet(rerender, r, () => cat, (c) => { cat = c; }));
        });
      section('Recettes préenregistrées', presets);
    }

    if (!total) list.innerHTML = '<div class="empty-state">Aucun résultat</div>';
  };

  // Le sélecteur de source n'a de sens que dans l'onglet Recettes, sans recherche.
  const srcSeg = form.querySelector('#fs-rsrc');
  const draw = () => {
    // Recherche insensible aux accents : « pho » doit trouver « Phở bò ».
    const nq = normalizeStr(query.trim());
    const searching = nq.length > 0;
    srcSeg.style.display = (!searching && tab === 'recipes') ? '' : 'none';
    form.querySelector('#fs-tabs').style.opacity = searching ? '0.45' : '';
    if (searching) { drawSearchEverywhere(nq); return; }
    if (tab === 'history') drawHistory(nq);
    else if (tab === 'all') drawAll(nq);
    else drawRecipes(nq);
  };
  draw();

  srcSeg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    recipeSource = b.dataset.src;
    srcSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    draw();
    haptic();
  });

  form.querySelector('#fs-search').addEventListener('input', (e) => { query = e.target.value; draw(); });
  form.querySelector('#fs-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.tab;
    form.querySelectorAll('#fs-tabs button').forEach((x) => x.classList.toggle('active', x === b));
    draw();
    haptic();
  });
  // Sélecteur de repas (mode repas uniquement) : choisit le repas ciblé.
  const mealSeg = form.querySelector('#fs-meal');
  if (mealSeg) {
    mealSeg.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      cat = b.dataset.v;
      mealSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      haptic();
    });
  }
  form.querySelector('#fs-quick').addEventListener('click', () => {
    // Ajout rapide : ouvre l'éditeur (la sheet loupe reste dessous, on n'enchaîne pas ici).
    if (onPick) openAddMealSheet(rerender, { onPick });
    else openAddMealSheet(rerender, { meal: cat });
  });
}

// ============================================================
// COACH MÉTABOLIQUE — carte d'insight (maintenance + stagnation)
// ============================================================
// Construit la table {date: kcal} des jours où des repas ont été loggés.
function intakeByDateMap() {
  const out = {};
  const byDate = store.userData.nutrition.byDate || {};
  for (const [d, day] of Object.entries(byDate)) {
    if (day && day.meals && day.meals.length) out[d] = store.dayTotals(d).kcal;
  }
  return out;
}

// Formate la pente hebdomadaire : « +0.30 », « −0.45 », « 0.00 ».
function fmtRate(kg) {
  const s = kg > 0 ? '+' : kg < 0 ? '−' : '';
  return `${s}${Math.abs(kg).toFixed(2)}`;
}

// Rend la carte Coach, ou null s'il n'y a pas encore assez de données.
// Affichée sur l'ACCUEIL (à côté des calories) : c'est là qu'on lit son résumé
// du jour. `opts.compact` resserre la mise en forme pour la demi-largeur.
export function renderCoachCard(rerender) {
  const w = store.userData.weights;
  const currentW = w.length ? w[w.length - 1].value : store.userData.profile.weight;
  const ins = metabolicInsight({
    weights: w,
    intakeByDate: intakeByDateMap(),
    goalType: store.userData.goal.type,
    today: todayISO(),
    bodyweight: currentW,
    lastAdjustDate: (store.userData.settings.lastCalorieAdjust || {}).date || null,
  });
  if (ins.status === 'insufficient') return null;

  const rate = ins.weeklyRateKg;
  const rateStr = `${fmtRate(rate)} kg/sem`;
  const absRate = Math.abs(rate).toFixed(2);
  const dir = ins.direction;

  let tone = 'neutral';
  let msg = '';
  let action = null; // { label, delta }

  if (ins.status === 'on_track') {
    tone = 'good';
    msg = dir === 'down'
      ? `Tu perds ${absRate} kg/sem, rythme idéal`
      : `Tu prends ${absRate} kg/sem, bonne progression`;
  } else if (ins.status === 'plateau') {
    tone = 'warn';
    msg = dir === 'down'
      ? `Ton poids stagne (${rateStr} sur ${ins.daysSpan} j). Retire 200 kcal pour relancer la perte.`
      : `Ta prise stagne (${rateStr} sur ${ins.daysSpan} j). Ajoute 200 kcal pour repartir.`;
    action = { label: `${ins.suggestedDelta > 0 ? '+' : '−'}200 kcal`, delta: ins.suggestedDelta };
  } else if (ins.status === 'overshoot') {
    tone = 'warn';
    msg = dir === 'down'
      ? `Ton poids remonte (${rateStr}). Retire 200 kcal pour repasser en déficit.`
      : `Tu perds du poids (${rateStr}). Ajoute 200 kcal pour repasser en surplus.`;
    action = { label: `${ins.suggestedDelta > 0 ? '+' : '−'}200 kcal`, delta: ins.suggestedDelta };
  } else if (ins.status === 'cooldown') {
    tone = 'neutral';
    const rest = Math.max(0, 10 - ins.daysSinceAdjust);
    msg = `Ajustement récent, prochain bilan dans ${rest} j`;
  } else { // hold (objectif maintenance / recomposition)
    tone = 'good';
    msg = Math.abs(rate) < ins.stallThreshold
      ? `Poids stable (${rateStr}), tu es à ta maintenance`
      : `Ton poids ${rate > 0 ? 'monte' : 'descend'} (${rateStr}). Ajuste si tu veux le stabiliser.`;
  }

  // Ligne maintenance (méthode Gouiffe) — dès qu'assez de jours loggés.
  let maintLine = '';
  if (ins.maintenanceEst) {
    maintLine = store.userData.settings.calorieAuto
      ? `Maintenance mesurée : <b>~${ins.maintenanceEst} kcal</b>`
      : `Maintenance estimée : <b>~${ins.maintenanceEst} kcal</b> (moyenne ${ins.avgIntake} kcal, ${rateStr})`;
  }

  // Adopter la maintenance mesurée : seulement pour un objectif maintenance,
  // et si elle diffère nettement de l'objectif courant.
  const setMaint = (dir === 'hold' && ins.maintenanceEst
    && Math.abs(ins.maintenanceEst - macroGoals().kcalGoal) > 100) ? ins.maintenanceEst : null;

  const card = el(`<div class="card coach-card coach-${tone}">
    <div class="coach-head">
      <span class="coach-title">Coach</span>
      <span class="coach-rate${rate < 0 ? ' coach-down' : rate > 0 ? ' coach-up' : ''}">${rateStr}</span>
    </div>
    <div class="coach-msg">${msg}</div>
    ${maintLine ? `<div class="coach-maint">${maintLine}</div>` : ''}
    <div class="coach-actions"></div>
  </div>`);

  const actionsHost = card.querySelector('.coach-actions');
  if (action) {
    const btn = el(`<button class="btn btn-primary btn-sm coach-btn">${icons.swap} ${action.label}</button>`);
    btn.addEventListener('click', () => {
      applyCalorieDelta(action.delta);
      haptic();
      toast(`Objectif ${action.delta > 0 ? 'augmenté' : 'réduit'} de 200 kcal`, 'success');
      rerender();
    });
    actionsHost.appendChild(btn);
  }
  if (setMaint) {
    const btn = el(`<button class="btn btn-secondary btn-sm coach-btn">${icons.check} Caler sur ~${setMaint}</button>`);
    btn.addEventListener('click', () => {
      setCalorieGoal(setMaint);
      haptic();
      toast(`Objectif calé sur ${setMaint} kcal`, 'success');
      rerender();
    });
    actionsHost.appendChild(btn);
  }
  if (!actionsHost.children.length) actionsHost.remove();

  return card;
}

// FAB global dans body (hors du conteneur transformé, sinon invisible sur iOS)
// Menu déroulant : "+" principal déploie 2 mini-FAB (ajout rapide / scan code-barre).
function ensureFab() {
  let wrap = document.getElementById('fab-nutrition-wrap');
  if (!wrap) {
    wrap = el(`<div class="fab-wrap" id="fab-nutrition-wrap">
      <button class="fab fab-mini" id="fab-search" aria-label="Rechercher un aliment" style="transition-delay:0ms">${icons.search}</button>
      <button class="fab fab-mini" id="fab-scan" aria-label="Scanner un code-barre" style="transition-delay:40ms">${icons.barcode}</button>
      <button class="fab" id="fab-nutrition" aria-label="Ajouter">${icons.plus}</button>
    </div>`);
    document.body.appendChild(wrap);
    // Clic en dehors du menu déployé -> referme (attaché une seule fois, à la création)
    document.addEventListener('click', (e) => {
      if (wrap.classList.contains('fab-open') && !wrap.contains(e.target)) wrap.classList.remove('fab-open');
    });
  }
  const main = wrap.querySelector('#fab-nutrition');
  const scan = wrap.querySelector('#fab-scan');
  const search = wrap.querySelector('#fab-search');

  const setOpen = (open) => wrap.classList.toggle('fab-open', open);

  main.onclick = () => setOpen(!wrap.classList.contains('fab-open'));
  scan.onclick = () => { setOpen(false); openBarcodeSheet(currentRerender); };
  search.onclick = () => { setOpen(false); openFoodSearchSheet(currentRerender); };
}

// opts.keepList : garde la liste de repas affichée (une ligne y termine son
// animation de suppression) et ne remplace que le reste de la page.
export function render(container, opts = {}) {
  const keptList = opts.keepList ? container.querySelector('#meal-list') : null;
  const rerender = () => render(container);
  currentRerender = rerender;
  selectedDate = getViewDate(); // jour commun à tous les onglets
  const totals = store.dayTotals(selectedDate);
  const mg = macroGoalsFor(selectedDate);
  const consumed = Math.round(totals.kcal);
  const remaining = mg.kcalGoal - totals.kcal;
  const fiberGoal = fiberGoalFromKcal(mg.kcalGoal, store.userData.settings.fiberPer1000 ?? 15);
  const day = store.userData.nutrition.byDate[selectedDate];
  const meals = day ? day.meals : [];
  const fadeEmpty = !meals.length && lastShown.date === selectedDate && lastShown.n > 0;
  if (!keptList) lastShown = { date: selectedDate, n: meals.length };

  container.innerHTML = '';
  container.appendChild(el(`
    <div>
      <div class="nut-mini" aria-hidden="true">
        <span class="nut-mini-date">${dayLabel(selectedDate)}</span>
        <span class="nut-mini-kcal">${ringSVG({ size: 46, stroke: 5, progress: totals.kcal / mg.kcalGoal, label: `${consumed}` })}</span>
        <span class="nut-mini-macros">
          ${ringSVG({ size: 24, stroke: 4, progress: totals.prot / mg.protG, color: C_PROT })}
          ${ringSVG({ size: 24, stroke: 4, progress: totals.carbs / mg.carbsG, color: C_CARB })}
          ${ringSVG({ size: 24, stroke: 4, progress: totals.fat / mg.fatG, color: C_FAT })}
        </span>
      </div>
      <div class="nutrition-header">
        <div class="kcal-total">
          <span class="num kcal-consumed" data-tw="n-kcal">${consumed}</span>
          <span class="kcal-sep">/ ${mg.kcalGoal} kcal</span>
        </div>
        <div class="kcal-sub">
          <span>${remaining >= 0 ? `<span data-tw="n-rest">${Math.round(remaining)}</span> kcal restantes` : `<span data-tw="n-over">${Math.abs(Math.round(remaining))}</span> kcal au-dessus`}</span>
        </div>
        <div class="macro-rings">
          <div class="ring-item" data-tw-ring="n-p">
            ${ringSVG({ size: 66, stroke: 7, progress: totals.prot / mg.protG, color: C_PROT, label: `${Math.round(totals.prot)}` })}
            <div class="ring-caption">Prot / ${mg.protG}g</div>
          </div>
          <div class="ring-item" data-tw-ring="n-c">
            ${ringSVG({ size: 66, stroke: 7, progress: totals.carbs / mg.carbsG, color: C_CARB, label: `${Math.round(totals.carbs)}` })}
            <div class="ring-caption">Gluc / ${mg.carbsG}g</div>
          </div>
          <div class="ring-item" data-tw-ring="n-f">
            ${ringSVG({ size: 66, stroke: 7, progress: totals.fat / mg.fatG, color: C_FAT, label: `${Math.round(totals.fat)}` })}
            <div class="ring-caption">Lip / ${mg.fatG}g</div>
          </div>
          <div class="ring-item ring-item-sm" data-tw-ring="n-fb">
            ${ringSVG({ size: 50, stroke: 6, progress: totals.fiber / fiberGoal, color: C_FIBER, label: `${Math.round(totals.fiber)}` })}
            <div class="ring-caption">Fib / ${fiberGoal}g</div>
          </div>
        </div>
        ${day && day.smoothed ? `<button class="smooth-note" id="btn-smooth-note">
          <span>Objectif ajusté de <b>${day.smoothed.delta > 0 ? '+' : ''}${day.smoothed.delta} kcal</b>, lissage du ${fmtDateShort(day.smoothed.from)}</span>${icons.chevron}
        </button>` : ''}
        <div class="macro-actions">
          <button class="btn btn-secondary btn-sm" id="btn-macro-goals">${icons.edit} Objectifs</button>
          ${Math.abs(remaining) > 100 ? `<button class="btn btn-secondary btn-sm" id="btn-smooth">${icons.swap} Lisser l'écart</button>` : ''}
        </div>
      </div>

      <div class="card card-glow">
        <div class="card-row" style="margin-bottom:4px">
          <h3 style="margin:0">Repas</h3>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" id="btn-recipes" aria-label="Recettes">${icons.book}</button>
          </div>
        </div>
        <div id="meal-list">
          ${meals.length ? '' : `<div class="empty-state${fadeEmpty ? ' empty-in' : ''}">Aucun repas</div>`}
        </div>
      </div>
    </div>`));

  const list = container.querySelector('#meal-list');
  // Regroupement par type de repas
  const byCat = {};
  for (const m of meals) {
    const c = MEAL_TYPES.includes(m.meal) ? m.meal : 'Snack';
    (byCat[c] = byCat[c] || []).push(m);
  }
  for (const cat of MEAL_TYPES) {
    // Garde-fou : si la liste est introuvable (conteneur inattendu), on saute
    // l'affichage des repas sans empêcher le câblage du reste de la page.
    if (!list) break;
    const group = byCat[cat];
    if (!group || !group.length) continue;
    const catKcal = group.reduce((a, m) => a + m.kcal, 0);
    const open = !!mealOpen[cat];
    const groupEl = el(`<div class="meal-group${open ? '' : ' collapsed'}">
      <div class="meal-cat-head" data-cat="${cat}">
        <span><span class="collapse-caret">${icons.chevron}</span> ${cat} <span class="meal-count">${group.length}</span></span>
        <span class="num">${Math.round(catKcal)} kcal</span>
      </div>
      <div class="meal-group-body"></div>
    </div>`);
    const body = groupEl.querySelector('.meal-group-body');
    for (const m of group) {
      // Clic = modifier · swipe vers la gauche = révèle la poubelle (suppression directe)
      const item = el(`<div class="meal-row" data-id="${m.id}">
        <button class="meal-del" data-del aria-label="Supprimer">${icons.trash}</button>
        <div class="meal-item">
          <div>
            <div class="meal-name">${esc(m.name)}</div>
            <div class="meal-macros">${macroLine(m.prot, m.carbs, m.fat, m.fiber)}</div>
          </div>
          <span class="meal-kcal">${m.kcal}</span>
        </div>
      </div>`);
      item.querySelector('.meal-item').addEventListener('click', () => {
        if (item.classList.contains('swiped')) return; // ne pas éditer quand la poubelle est ouverte
        // Repas ajouté depuis une recette → on rouvre le menu recette (multiplicateur uniquement).
        if (m.fromRecipe) {
          const recipe = findRecipe(m.fromRecipe);
          if (recipe) { openRecipeAddSheet(rerender, recipe, () => m.meal, null, { editMealId: m.id, mult: m.recipeMult || 1 }); return; }
        }
        openAddMealSheet(rerender, { editId: m.id, ...mealToEditable(m) });
      });
      item.querySelector('[data-del]').addEventListener('click', () => {
        if (!item._removed) { store.removeMeal(selectedDate, m.id); haptic(); rerender(); return; }
        // Déjà retiré au début du geste : la ligne a fini de se replier, on
        // range la liste sans tout redessiner.
        const lst = item.closest('#meal-list');
        const g = item.closest('.meal-group');
        item.remove();
        if (g && !g.querySelector('.meal-row')) g.remove();
        if (lst && !lst.querySelector('.meal-row')) lst.insertAdjacentHTML('beforeend', '<div class="empty-state empty-in">Aucun repas</div>');
        lastShown = { date: selectedDate, n: lst ? lst.querySelectorAll('.meal-row').length : 0 };
      });
      body.appendChild(item);
    }
    groupEl.querySelector('.meal-cat-head').addEventListener('click', () => {
      mealOpen[cat] = !mealOpen[cat];
      groupEl.classList.toggle('collapsed', !mealOpen[cat]);
    });
    list.appendChild(groupEl);
  }

  // Glisser un repas vers la gauche : poubelle, ou suppression en glissant jusqu'au bout
  // Le repas est retiré dès le début du geste : calories, macros et ruban se
  // mettent à jour pendant que la ligne termine son animation. Si c'était le
  // dernier repas de son type, le titre du groupe s'efface en même temps.
  attachSwipeToDelete(list, {
    rowSelector: '.meal-row',
    contentSelector: '.meal-item',
    onCommit: (row) => {
      if (row._removed) return;
      row._removed = true;
      store.removeMeal(selectedDate, row.dataset.id);
      haptic();
      const g = row.closest('.meal-group');
      const rest = g ? [...g.querySelectorAll('.meal-row')].filter((x) => x !== row) : [];
      render(container, { keepList: true });
      if (!g) return;
      const head = g.querySelector('.meal-cat-head');
      if (rest.length) {
        const kcal = rest.reduce((a, x) => a + (parseFloat((x.querySelector('.meal-kcal') || {}).textContent) || 0), 0);
        const cnt = head.querySelector('.meal-count'); if (cnt) cnt.textContent = rest.length;
        const tot = head.querySelector(':scope > .num'); if (tot) tot.textContent = `${Math.round(kcal)} kcal`;
      } else if (head.animate && !motionOff()) {
        const h = head.offsetHeight;
        head.style.overflow = 'hidden';
        head.animate([{ opacity: 1, height: `${h}px` }, { opacity: 0, height: '0px', paddingTop: '0px', paddingBottom: '0px', marginBottom: '0px' }],
          { duration: 360, delay: 240, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
      }
    },
  });

  // En-tête de date commun : point vert si l'écart du jour tient dans ±100 kcal
  const nByDate = store.userData.nutrition.byDate;
  // Dans l'en-tête collant : le jour consulté reste visible en faisant défiler
  container.querySelector('.nutrition-header').prepend(dateBar({
    title: 'Nutrition',
    mark: (d) => {
      const dd = nByDate[d];
      if (!dd || !dd.meals || !dd.meals.length) return '';
      return Math.abs(store.dayTotals(d).kcal - macroGoalsFor(d).kcalGoal) <= 100 ? 'ok' : 'bad';
    },
    onChange: rerender,
  }));
  container.querySelector('#btn-macro-goals').addEventListener('click', () => openMacroGoalsSheet(rerender));
  // Toucher les calories ou les anneaux ouvre les statistiques
  container.querySelectorAll('.kcal-total, .kcal-sub, .macro-rings').forEach((n) => n.addEventListener('click', openNutritionStats));
  const smoothBtn = container.querySelector('#btn-smooth');
  if (smoothBtn) smoothBtn.addEventListener('click', () => openSmoothingSheet(rerender, selectedDate, remaining));
  // Depuis un jour AJUSTÉ, on remonte au jour source pour gérer le lissage.
  const smoothNote = container.querySelector('#btn-smooth-note');
  if (smoothNote) {
    smoothNote.addEventListener('click', () => {
      const src = day.smoothed.from;
      const srcTotals = store.dayTotals(src);
      const srcGoal = macroGoalsFor(src);
      openSmoothingSheet(rerender, src, srcGoal.kcalGoal - srcTotals.kcal);
    });
  }
  container.querySelector('#btn-recipes').addEventListener('click', () => openRecipesSheet(rerender));
  if (keptList) container.querySelector('#meal-list').replaceWith(keptList);
  // En défilant, l'en-tête s'efface et rétrécit pendant que la version
  // compacte (jour, calories, trois macros) le remplace en haut.
  if (!container._nutScroll) {
    container._nutScroll = true;
    container.addEventListener('scroll', () => {
      const head = container.querySelector('.nutrition-header');
      const mini = container.querySelector('.nut-mini');
      if (!head || !mini) return;
      const p = Math.max(0, Math.min(1, container.scrollTop / 140)); // 140 px de défilement pour passer en compact
      head.style.opacity = String(1 - p);
      head.style.transform = p ? `scale(${1 - p * 0.08})` : '';
      mini.style.opacity = String(p);
      mini.style.transform = `translateY(${(1 - p) * -12}px)`;
      mini.classList.toggle('on', p >= 1);
    }, { passive: true });
  }
  container.dispatchEvent(new window.Event('scroll'));
  tweenValues(container);
  ensureFab();
}
