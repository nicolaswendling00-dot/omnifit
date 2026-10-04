// OmniFit — PAGE 2 : Entraînement v2
// Séance minimisable, timer sticky, menu ⋯ (suppr/réorg/superset/remplacer),
// détail exo (muscles, historique, repos perso), coefficients d'amélioration.
import { store, todayISO } from '../utils/storage.js';
import { EXERCISES, MUSCLES, muscleLabel, AKA, EQUIPMENT, equipLabel } from '../data/exercises.js';
import { formatTime, workoutMuscleVolume, weeklySetsByMuscle, muscleAttenuation } from '../utils/math.js';
import { el, esc, icons, openModal, openSheet, toast, confirmModal, beep, haptic, fmtDateShort, fmtDateLong, fmtDateFull, celebrateLP, makeChart, normalizeStr, closeAllOverlays } from '../utils/ui.js';
import { lineChartOptions, lineDataset } from '../utils/charts.js';
import { bodyMapSVG } from '../utils/bodyMap.js';
import { computeExerciseLP, computeExerciseLPDetailed, rankFromLP, rankBadge, getStandards } from '../utils/ranks.js';

let volumeChart = null;
let impChart = null;
let pageRerender = null;
let routinesOpen = false;
let session = null; // { elapsed, running, date, notes, exercises:[{exerciseId, sets:[{weight,reps}], ss}] }
let sessionUI = null; // { overlay, renderExos, close }
let chronoInterval = null;
let restInterval = null;
let restRemaining = 0;

// Temps écoulé de la séance en secondes, calculé sur l'horloge murale : le
// chrono continue donc d'avancer même si l'app est mise en arrière-plan / gelée
// par iOS (aucun setInterval fiable pendant ce temps).
function elapsedSeconds() {
  if (!session) return 0;
  let s = session.accumulated || 0;
  if (session.running && session.startedAt) s += Math.floor((Date.now() - session.startedAt) / 1000);
  return s;
}
// Persiste l'état de la séance pour la retrouver après avoir quitté l'app.
function persistSession() {
  if (session) store.saveActiveSession(session);
}

// ---------- Lookup ----------
export function allExercises() {
  return [...EXERCISES, ...(store.userData.settings.customExercises || [])];
}
export function exerciseLookup(id) {
  const e = allExercises().find((x) => x.id === id);
  if (!e) return undefined;
  const s = store.userData.settings;
  const nameOv = s.exerciseNames;
  const muscleOv = s.exerciseMuscleOverrides && s.exerciseMuscleOverrides[id];
  const equipOv = s.exerciseEquip && s.exerciseEquip[id];
  const refOv = s.exerciseRefs && s.exerciseRefs[id];
  if (!nameOv?.[id] && !muscleOv && !equipOv && !refOv) return e;
  return {
    ...e,
    ...(nameOv?.[id] ? { name: nameOv[id] } : null),
    ...(muscleOv ? { primaryMuscles: muscleOv.primaryMuscles, secondaryMuscles: muscleOv.secondaryMuscles } : null),
    ...(equipOv ? { equip: equipOv } : null),
    ...(refOv ? { refExercise: refOv.refExercise, refCoef: refOv.refCoef } : null),
  };
}

// ---------- Matériel ----------
// Le matériel vit dans la définition de l'exercice (base ou custom) et peut
// être redéfini par l'utilisateur (settings.exerciseEquip).
export function exerciseEquip(id) {
  const def = exerciseLookup(id);
  return (def && def.equip) || [];
}
// Map LP de tous les exos (avec poids de corps + standards pour le raccourci Onyx)
// Table { idCustom: { refId, coef } } : permet de classer un exercice custom
// via les standards d'un exercice de référence, pondérés par un coefficient.
export function customRefMap() {
  const out = {};
  // Base intégrée comprise : des exercices repris de la bibliothèque perso y
  // sont entrés en gardant leur exercice de référence.
  for (const e of allExercises()) {
    const d = exerciseLookup(e.id) || e;
    if (d.refExercise && d.refCoef > 0) out[e.id] = { refId: d.refExercise, coef: d.refCoef };
  }
  return out;
}

function lpMapAll() {
  return computeExerciseLP(store.userData.workouts, {
    bodyweight: store.userData.profile && store.userData.profile.weight,
    weights: store.userData.weights,
    standards: getStandards(),
    customRefs: customRefMap(),
  });
}
// Rang d'un exo. Retourne null si l'exo n'a JAMAIS été réalisé (pas de rang affiché).
function exerciseRank(exerciseId, lpMap) {
  const map = lpMap || lpMapAll();
  if (map[exerciseId] === undefined) return null;
  return rankFromLP(map[exerciseId]);
}
// Synonymes anglais/familiers par muscle et catégorie (recherche inclusive)
const MUSCLE_SYN = {
  chest: 'chest pecs pectoraux',
  frontDelts: 'shoulders epaules delts deltoides anterieurs front delt',
  sideDelts: 'shoulders epaules delts deltoides lateraux side delt',
  rearDelts: 'shoulders epaules delts deltoides posterieurs rear delt',
  traps: 'back dos traps trapezes', rhomboids: 'back dos rhomboides', lats: 'back dos lats dorsaux',
  lowerback: 'lower back lombaires', biceps: 'biceps', triceps: 'triceps', forearms: 'forearms avant-bras grip',
  abs: 'core abs abdos abdominaux', obliques: 'core obliques abdos',
  quads: 'quads quadriceps legs jambes cuisses', hamstrings: 'hamstrings ischios legs jambes',
  glutes: 'glutes fessiers', adductors: 'adductors adducteurs legs jambes', calves: 'calves mollets',
};
const CAT_SYN = {
  Chest: 'chest pecs', Back: 'back dos', Shoulders: 'shoulders epaules', Biceps: 'biceps', Triceps: 'triceps',
  Forearms: 'forearms avant-bras', Quads: 'quads legs jambes', Hamstrings: 'hamstrings ischios',
  Glutes: 'glutes fessiers', Calves: 'calves mollets', Core: 'core abs', 'Lower Back': 'lower back lombaires', FullBody: 'full body cardio',
};
function exoKeywords(e) {
  const parts = [(exerciseLookup(e.id) || e).name, e.category, CAT_SYN[e.category] || '', ...(AKA[e.id] || [])];
  // Les exercices créés par l'utilisateur répondent à « custom » / « perso ».
  if (e.isCustom) parts.push('custom perso personnalise mes exercices');
  // Le matériel est cherchable : « poulie », « banc », « smith »…
  for (const q of (e.equip || [])) parts.push(q, equipLabel(q));
  for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) {
    parts.push(m.m, muscleLabel(m.m), MUSCLE_SYN[m.m] || '');
  }
  return normalizeStr(parts.join(' '));
}
function exoMatches(e, nq) {
  return !nq || exoKeywords(e).includes(nq);
}
function filteredExercises() {  const s = store.userData.settings;
  let list = allExercises();
  if (!s.exerciseDbFull) list = list.filter((e) => e.difficulty === 'Beginner' || e.isCustom);
  if (s.equipmentFilter && s.equipmentFilter.length) {
    list = list.filter((e) => s.equipmentFilter.includes(e.equipment) || e.isCustom);
  }
  return list;
}

function exoRestDuration(exerciseId) {
  const s = store.userData.settings;
  return (s.restByExercise && s.restByExercise[exerciseId]) || s.restTimerDefault;
}

// ---------- Types de série ----------
// Une série est normale par défaut. Elle peut être marquée « échauffement »
// (W, orange) ou « dégressive » (D, bleu clair). Ces deux types ne reflètent
// pas la performance réelle : ils sont EXCLUS du calcul de la séance de
// référence affichée dans la colonne PRÉC.
const SET_KINDS = [
  { id: 'normal', label: 'Normal', short: '', cls: '' },
  { id: 'warmup', label: 'Échauffement', short: 'W', cls: 'sk-warmup' },
  { id: 'drop', label: 'Dégressive', short: 'D', cls: 'sk-drop' },
];
const isWorkSet = (s) => !s || (s.kind !== 'warmup' && s.kind !== 'drop');

// Étiquettes des séries : les normales sont numérotées séquentiellement, les
// autres portent leur lettre. On obtient « 1 · W · 2 » plutôt que « 1 · W · 3 »,
// qui laisserait croire à une série manquante.
function setLabels(sets) {
  let n = 0;
  return (sets || []).map((s) => {
    const k = SET_KINDS.find((x) => x.id === (s && s.kind)) || SET_KINDS[0];
    if (k.short) return { text: k.short, cls: k.cls };
    n += 1;
    return { text: String(n), cls: '' };
  });
}

// ---------- Séries validées ----------
// Pendant une séance, une ligne peut exister sans être validée : l'utilisateur
// a saisi (ou décoché) des valeurs mais n'a pas coché la case. Ces séries-là
// restent dans `sets` pour ne pas perdre la saisie, mais ne comptent nulle part
// et sont retirées à l'enregistrement. Les séances déjà enregistrées n'ont pas
// de marqueur `done` : elles sont donc toutes considérées comme validées.
const isDone = (s) => !!s && s.done !== false;
const doneSets = (wx) => (wx && wx.sets ? wx.sets.filter(isDone) : []);
// Séries à enregistrer : les validées, sans le marqueur de séance.
const savedSets = (wx) => doneSets(wx).map(({ done, ...rest }) => rest);

// Exercice prêt à être enregistré : uniquement ses séries validées.
function savedExercise(wx) {
  const out = { exerciseId: wx.exerciseId, sets: savedSets(wx) };
  if (wx.ss) out.ss = wx.ss;
  return out;
}

// Volume total d'un exo dans un workout
const exoVolume = (wx) => doneSets(wx).reduce((a, s) => a + s.weight * s.reps, 0);

// Occurrences passées d'un exo, de la plus ancienne à la plus récente.
function exoEntries(exerciseId) {
  const out = [];
  for (const w of store.userData.workouts) {
    const wx = w.exercises.find((x) => x.exerciseId === exerciseId);
    if (wx && wx.sets.length) out.push({ workout: w, wx });
  }
  return out;
}

// Dernier workout contenant l'exo → { workout, wx }
function lastEntry(exerciseId) {
  const all = exoEntries(exerciseId);
  return all.length ? all[all.length - 1] : null;
}

// ---------- Séance de référence (colonne PRÉC) ----------
// On n'affiche pas la DERNIÈRE séance, mais la MEILLEURE du dernier mois :
// celle dont la meilleure série est la plus forte (cf. exoScore). Les séries
// d'échauffement et dégressives sont exclues, elles ne disent rien de la force.
const REFERENCE_WINDOW_DAYS = 30;

function workSets(wx) {
  return doneSets(wx).filter(isWorkSet);
}

// ---------- Performance d'une séance ----------
// Une séance vaut ce que vaut sa MEILLEURE SÉRIE, ramenée à un 1RM estimé
// (Epley : poids × (1 + reps/30)). C'est la lecture qu'on fait naturellement :
// « 82,5 × 8 la semaine dernière, 85 × 8 aujourd'hui → j'ai progressé ».
//   - mêmes charges, mêmes reps            → 0 %
//   - une rep de plus à la même charge     → ≈ +3 %
//   - 2,5 kg de plus aux mêmes reps        → ≈ +3 % sur 80 kg
//   - une série de plus, ou une série de
//     fin plus légère (fatigue)            → ne change rien
// Les anciennes versions faisaient la moyenne de toutes les séries : une
// dernière série plus faible suffisait à afficher une baisse alors qu'on avait
// fait mieux sur la série principale. Séries au poids du corps (0 kg) : on
// compare le nombre de répétitions.
const setScore = (s) => (s.weight > 0 ? s.weight * (1 + s.reps / 30) : s.reps);

// Meilleure série de travail d'un exercice dans une séance (ou null).
function topSet(wx) {
  let best = null;
  for (const s of workSets(wx)) {
    if (!(s.reps > 0)) continue;
    if (!best || setScore(s) > setScore(best)) best = s;
  }
  return best;
}

function exoScore(wx) {
  const s = topSet(wx);
  return s ? setScore(s) : 0;
}

// Variation (en %) entre deux prestations, arrondie à l'unité.
function pctChange(cur, prev) {
  if (!cur || !prev) return null;
  return Math.round(((cur / prev) - 1) * 100);
}

// Meilleure prestation de l'exo sur les 30 derniers jours → { workout, wx, sets }
// `sets` ne contient que les séries de travail, prêtes à servir de référence.
function bestEntry(exerciseId, refDate = null) {
  const end = refDate || todayISO();
  const start = todayISO(-REFERENCE_WINDOW_DAYS);
  let best = null;
  for (const { workout: w, wx } of exoEntries(exerciseId)) {
    if (w.date > end || w.date < start) continue;
    const sets = workSets(wx);
    if (!sets.length) continue;
    const score = exoScore(wx);
    const cand = { workout: w, wx, sets, score };
    // À score égal (mêmes charges, mêmes reps), la séance qui compte le plus de
    // séries l'emporte, puis la plus récente.
    if (!best
      || cand.score > best.score
      || (cand.score === best.score && cand.sets.length > best.sets.length)
      || (cand.score === best.score && cand.sets.length === best.sets.length && cand.workout.date > best.workout.date)) {
      best = cand;
    }
  }
  // Rien dans la fenêtre : on retombe sur la dernière séance connue, pour ne
  // pas laisser la colonne PRÉC vide après une longue interruption.
  if (!best) {
    const last = lastEntry(exerciseId);
    if (!last) return null;
    const sets = workSets(last.wx);
    if (!sets.length) return null;
    return { workout: last.workout, wx: last.wx, sets, fallback: true };
  }
  return best;
}

// Amélioration d'un exo EN COURS de séance : meilleure série du jour vs celle
// de la séance précédente. Quand on corrige une ancienne séance, « précédente »
// veut dire avant ELLE (et jamais elle-même), pas la dernière en date.
function exoImprovement(wx) {
  const date = session ? session.date : todayISO();
  const selfId = session ? session.editingId : null;
  const prev = exoEntries(wx.exerciseId)
    .filter((e) => e.workout.id !== selfId && e.workout.date <= date)
    .pop();
  return prev ? pctChange(exoScore(wx), exoScore(prev.wx)) : null;
}

// Dernier volume d'un muscle dans les séances passées
function lastMuscleVolume(muscle) {
  const ratio = store.userData.settings.secondaryRatio;
  for (let i = store.userData.workouts.length - 1; i >= 0; i--) {
    const bm = workoutMuscleVolume(store.userData.workouts[i], exerciseLookup, ratio);
    if (bm[muscle]) return bm[muscle];
  }
  return null;
}

const impBadge = (imp, small = true) => {
  if (imp == null) return '';
  const cls = imp >= 0 ? 'green' : 'red';
  const sign = imp >= 0 ? '+' : '';
  return `<span class="badge ${cls}" style="${small ? 'font-size:0.62rem;padding:2px 6px' : ''}">${sign}${imp}%</span>`;
};

// ---------- Carte du corps ----------
// Charge de chaque muscle sur une liste d'exercices : chaque série validée
// compte pour la part du muscle (principal p %, secondaire p % × ratio). Les
// valeurs sont ensuite ramenées entre 0 et 1, le muscle le plus sollicité
// valant 1 : c'est ce qui donne le dégradé de couleur.
function muscleLoad(exercises) {
  const ratio = store.userData.settings.secondaryRatio ?? 0.5;
  const acc = {};
  for (const wx of exercises) {
    const def = exerciseLookup(wx.exerciseId);
    const n = doneSets(wx).length;
    if (!def || !n) continue;
    for (const pm of def.primaryMuscles) acc[pm.m] = (acc[pm.m] || 0) + (pm.p / 100) * n;
    for (const sm of def.secondaryMuscles) acc[sm.m] = (acc[sm.m] || 0) + (sm.p / 100) * ratio * n;
  }
  return acc;
}
function normalizeLoad(acc) {
  const max = Math.max(0, ...Object.values(acc));
  const out = {};
  if (max > 0) for (const [m, v] of Object.entries(acc)) out[m] = v / max;
  return out;
}
const workoutIntensity = (w) => normalizeLoad(muscleLoad(w.exercises));
// Muscles d'un exercice seul, d'après sa répartition (secondaires atténués)
function exerciseIntensity(def) {
  const acc = {};
  for (const pm of def.primaryMuscles) acc[pm.m] = pm.p;
  for (const sm of def.secondaryMuscles) acc[sm.m] = sm.p * 0.6;
  return normalizeLoad(acc);
}

// Historique {date, id, score, imp} d'un exo, trié par date. `imp` est la
// variation (%) de la meilleure série par rapport à la séance précédente.
function exoHistory(exerciseId) {
  const h = exoEntries(exerciseId)
    .map(({ workout: w, wx }) => ({ date: w.date, id: w.id, vol: exoVolume(wx), score: exoScore(wx) }));
  h.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  h.forEach((e, i) => { e.imp = i > 0 ? pctChange(e.score, h[i - 1].score) : null; });
  return h;
}

// Amélioration (%) d'un exo dans une séance donnée vs l'occurrence précédente
function exoImprovementAt(exerciseId, workout) {
  const e = exoHistory(exerciseId).find((x) => x.id === workout.id);
  return e ? e.imp : null;
}

// Coefficient d'amélioration d'une séance = moyenne des améliorations d'exos ayant un précédent
function sessionImprovement(workout) {
  const vals = [];
  for (const wx of workout.exercises) {
    const imp = exoImprovementAt(wx.exerciseId, workout);
    if (imp != null) vals.push(imp);
  }
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// ============================================================
// PICKER PLEIN ÉCRAN (recherche en haut → jamais derrière le clavier)
// ============================================================
export function openExercisePicker(onPick, title = 'Ajouter un exercice') {
  const overlay = el(`<div class="picker-overlay">
    <div class="picker-topbar">
      <input id="exo-search" type="text" placeholder="Rechercher…" autocomplete="off">
      <button class="icon-btn" id="picker-close" aria-label="Fermer">${icons.close}</button>
    </div>
    <div class="picker-list" id="exo-list"></div>
    <button class="btn btn-secondary btn-block" id="btn-custom" style="margin:8px 0 calc(10px + var(--safe-b))">${icons.plus} Exercice custom</button>
  </div>`);
  document.body.appendChild(overlay);
  const wasOpen = document.body.classList.contains('overlay-open');
  document.body.classList.add('overlay-open');

  const close = () => {
    overlay.remove();
    if (!wasOpen) document.body.classList.remove('overlay-open');
  };
  const list = overlay.querySelector('#exo-list');
  const renderList = (q = '') => {
    const nq = normalizeStr(q);
    const items = filteredExercises().filter((e) => exoMatches(e, nq));
    list.innerHTML = items.length ? '' : '<div class="empty-state">Aucun résultat</div>';
    const lpMap = lpMapAll();
    for (const e of items.slice(0, 80)) {
      const ranked = lpMap[e.id] !== undefined;
      const rk = ranked ? rankFromLP(lpMap[e.id]) : null;
      const chip = rk ? `<span class="rank-inline" title="${rk.name}${rk.division ? ' ' + rk.division : ''}">${rankBadge(rk.id, 46)}</span>` : '<span class="rank-inline muted" style="font-size:0.66rem">—</span>';
      const b = el(`<button class="exo-search-item"><span>${esc((exerciseLookup(e.id) || e).name)}</span>${chip}</button>`);
      b.addEventListener('click', () => { const picked = exerciseLookup(e.id) || e; close(); onPick(picked); });
      list.appendChild(b);
    }
  };
  renderList();
  const input = overlay.querySelector('#exo-search');
  input.addEventListener('input', (e) => renderList(e.target.value));
  setTimeout(() => input.focus(), 250);
  overlay.querySelector('#picker-close').addEventListener('click', close);
  overlay.querySelector('#btn-custom').addEventListener('click', () => {
    close();
    openExerciseEditor((exo) => onPick(exo));
  });
}

// ============================================================
// ÉDITEUR D'EXERCICE
// ============================================================
// existing = null pour créer, ou la définition de l'exercice pour la modifier.
// onSaved(exo) est appelé avec l'exercice créé/modifié (forme allExercises()).
//
// Chaque réglage est une LIGNE-BOUTON qui ouvre son propre petit panneau : la
// fenêtre reste lisible d'un coup d'œil (on voit l'état de tout l'exercice)
// et chaque réglage a la place qu'il lui faut quand on l'ouvre. Seul le nom se
// modifie directement, puisqu'il n'a besoin que d'un champ.
// Rien n'est écrit tant qu'on n'a pas validé : tout vit dans `draft`.
function openExerciseEditor(onSaved, existing = null) {
  const draft = {
    name: existing ? existing.name : '',
    primary: existing ? existing.primaryMuscles.map((x) => ({ ...x })) : [],
    secondary: existing ? existing.secondaryMuscles.map((x) => ({ ...x })) : [],
    equip: existing && existing.equip ? [...existing.equip] : [],
    refExercise: existing && existing.refExercise ? existing.refExercise : null,
    refCoef: existing && existing.refCoef > 0 ? existing.refCoef : 1,
    rest: existing ? exoRestDuration(existing.id) : store.userData.settings.restTimerDefault,
  };

  const muscleSummary = (list) => (list.length
    ? list.map((x) => `${muscleLabel(x.m)} ${x.p}%`).join(' · ')
    : 'Aucun');
  const equipSummary = () => (draft.equip.length ? draft.equip.map(equipLabel).join(' · ') : 'Non renseigné');
  const rankSummary = () => {
    if (!draft.refExercise) return 'Aucun (pas de rang)';
    const d = exerciseLookup(draft.refExercise);
    return `${d ? d.name : draft.refExercise} ×${draft.refCoef.toFixed(2)}`;
  };
  const totalPct = () => [...draft.primary, ...draft.secondary].reduce((a, x) => a + x.p, 0);

  const row = (key, label, value) => `<button type="button" class="ex-row" data-open="${key}">
      <span class="ex-row-l">${label}</span>
      <span class="ex-row-v">${esc(value)}</span>
      ${icons.chevron}
    </button>`;

  const form = el(`<div class="ex-edit">
    <label class="field ex-edit-name"><span>Nom</span>
      <input id="xe-name" type="text" placeholder="Mon exercice" value="${existing ? esc(existing.name) : ''}">
    </label>
    <div id="xe-rows"></div>
    <div class="ex-total" id="xe-total"></div>
  </div>`);

  const rowsHost = form.querySelector('#xe-rows');
  const totalEl = form.querySelector('#xe-total');
  const paint = () => {
    rowsHost.innerHTML = row('rank', 'Classement', rankSummary())
      + row('prim', 'Muscles principaux', muscleSummary(draft.primary))
      + row('sec', 'Muscles secondaires', muscleSummary(draft.secondary))
      + row('equip', 'Équipement', equipSummary())
      + row('rest', 'Repos', `${draft.rest}s`);
    const t = totalPct();
    totalEl.className = `ex-total ${t === 100 ? 'ok' : 'warn'}`;
    totalEl.textContent = t === 100
      ? 'Répartition musculaire : 100 % ✓'
      : `Répartition musculaire : ${t} % (il faut 100 %)`;
  };
  paint();

  // ---- Panneau « Classement » : exercice de référence + coefficient ----
  const openRankSheet = () => {
    const c = el(`<div>
      <div class="row-sub" style="margin-bottom:10px">Rattache cet exercice à un mouvement connu pour lui attribuer un rang.</div>
      <button type="button" class="btn btn-secondary btn-block" id="xr-pick" style="justify-content:space-between">
        <span id="xr-name">${esc(draft.refExercise ? rankSummary().replace(/ ×[\d.]+$/, '') : 'Aucun (pas de rang)')}</span>${icons.chevron}
      </button>
      <div id="xr-coef-wrap" style="${draft.refExercise ? '' : 'display:none'};margin-top:14px">
        <div class="card-row">
          <span style="font-size:0.85rem">Coefficient</span>
          <span class="num" id="xr-coef-val" style="color:var(--accent)">×${draft.refCoef.toFixed(2)}</span>
        </div>
        <input id="xr-coef" type="range" min="0.2" max="5" step="0.05" value="${draft.refCoef}">
        <div class="muted" id="xr-hint" style="font-size:0.72rem;line-height:1.4;margin-top:4px"></div>
      </div>
      <button type="button" class="btn btn-ghost btn-sm btn-block" id="xr-clear" style="margin-top:14px">Retirer la référence</button>
      <button type="button" class="btn btn-primary btn-block" data-done style="margin-top:10px">Terminé</button>
    </div>`);
    const sh = openSheet({ title: 'Classement (rang)', content: c, onClose: paint });
    c.querySelector('[data-done]').addEventListener('click', () => sh.close());
    const upd = () => {
      const d = draft.refExercise ? exerciseLookup(draft.refExercise) : null;
      c.querySelector('#xr-name').textContent = d ? d.name : 'Aucun (pas de rang)';
      c.querySelector('#xr-coef-val').textContent = `×${draft.refCoef.toFixed(2)}`;
      c.querySelector('#xr-coef-wrap').style.display = draft.refExercise ? '' : 'none';
      c.querySelector('#xr-hint').textContent = d
        ? `100 kg ici comptent comme ${Math.round(100 / draft.refCoef)} kg en ${d.name}.`
        : '';
    };
    upd();
    c.querySelector('#xr-coef').addEventListener('input', (e) => {
      draft.refCoef = parseFloat(e.target.value) || 1;
      upd();
    });
    c.querySelector('#xr-pick').addEventListener('click', () => {
      openExercisePicker((exo) => { draft.refExercise = exo.id; upd(); }, 'Exercice de référence');
    });
    c.querySelector('#xr-clear').addEventListener('click', () => {
      draft.refExercise = null; draft.refCoef = 1; upd(); haptic();
    });
    return sh;
  };

  // ---- Panneau « Muscles » : plus de cases à cocher, un pourcentage suffit ----
  // Un muscle est retenu dès qu'il porte un pourcentage non nul. Le total des
  // deux listes doit faire 100 % : il est affiché en direct, avec ce qui reste.
  const openMuscleSheet = (kind) => {
    const list = kind === 'prim' ? draft.primary : draft.secondary;
    const other = kind === 'prim' ? draft.secondary : draft.primary;
    const otherTotal = other.reduce((a, x) => a + x.p, 0);
    const c = el(`<div>
      <div class="mus-edit">
        ${MUSCLES.map((m, i) => {
    const f = list.find((x) => x.m === m.id);
    const head = i === 0 || MUSCLES[i - 1].group !== m.group ? `<div class="mus-group">${m.group}</div>` : '';
    return `${head}<div class="mus-edit-row${f ? ' on' : ''}" data-m="${m.id}">
            <span class="mus-edit-l">${m.label}</span>
            <input class="mus-edit-p" type="number" inputmode="numeric" min="0" max="100" step="5"
              data-m="${m.id}" placeholder="0" value="${f ? f.p : ''}">
            <span class="mus-edit-u">%</span>
          </div>`;
  }).join('')}
      </div>
      <div class="ex-total" id="ms-total"></div>
      <button type="button" class="btn btn-primary btn-block" data-done style="margin-top:10px">Terminé</button>
    </div>`);
    const tot = c.querySelector('#ms-total');
    const read = () => [...c.querySelectorAll('.mus-edit-p')]
      .map((i) => ({ m: i.dataset.m, p: parseFloat(i.value) || 0 }))
      .filter((x) => x.p > 0);
    const upd = () => {
      const here = read().reduce((a, x) => a + x.p, 0);
      const t = here + otherTotal;
      tot.className = `ex-total ${t === 100 ? 'ok' : 'warn'}`;
      tot.textContent = t === 100
        ? 'Total 100 % ✓'
        : `Total ${t} % — ${t < 100 ? `${100 - t} % à répartir` : `${t - 100} % de trop`}`;
      for (const r of c.querySelectorAll('.mus-edit-row')) {
        const v = parseFloat(r.querySelector('.mus-edit-p').value) || 0;
        r.classList.toggle('on', v > 0);
      }
    };
    upd();
    c.addEventListener('input', upd);
    const apply = () => {
      const vals = read();
      if (kind === 'prim') draft.primary = vals; else draft.secondary = vals;
      paint();
    };
    const sh = openSheet({
      title: kind === 'prim' ? 'Muscles principaux' : 'Muscles secondaires',
      content: c,
      onClose: apply,
    });
    c.querySelector('[data-done]').addEventListener('click', () => sh.close());
    return sh;
  };

  // ---- Panneau « Équipement » : sélection multiple ----
  const openEquipSheet = () => {
    const c = el(`<div>
      <div class="equip-grid">
        ${EQUIPMENT.map((q) => `<button type="button" class="equip-chip${draft.equip.includes(q.id) ? ' on' : ''}" data-q="${q.id}">${q.label}</button>`).join('')}
      </div>
      <button type="button" class="btn btn-primary btn-block" data-done style="margin-top:14px">Terminé</button>
    </div>`);
    const sh = openSheet({ title: 'Équipement', content: c, onClose: paint });
    c.querySelector('[data-done]').addEventListener('click', () => sh.close());
    c.addEventListener('click', (e) => {
      const b = e.target.closest('.equip-chip');
      if (!b) return;
      const id = b.dataset.q;
      if (draft.equip.includes(id)) draft.equip = draft.equip.filter((x) => x !== id);
      else draft.equip = [...draft.equip, id];
      b.classList.toggle('on');
      haptic();
    });
    return sh;
  };

  // ---- Panneau « Repos » ----
  const openRestSheet = () => {
    const c = el(`<div>
      <div class="card-row">
        <span style="font-size:0.85rem">Temps de repos entre les séries</span>
        <span class="num" id="xrest-val" style="color:var(--accent)">${draft.rest}s</span>
      </div>
      <input id="xrest" type="range" min="30" max="300" step="15" value="${draft.rest}">
      <div class="muted" style="font-size:0.72rem;margin-top:6px">Le minuteur démarre à la validation d'une série.</div>
      <button type="button" class="btn btn-primary btn-block" data-done style="margin-top:14px">Terminé</button>
    </div>`);
    c.querySelector('#xrest').addEventListener('input', (e) => {
      draft.rest = +e.target.value;
      c.querySelector('#xrest-val').textContent = `${draft.rest}s`;
    });
    const sh = openSheet({ title: 'Repos', content: c, onClose: paint });
    c.querySelector('[data-done]').addEventListener('click', () => sh.close());
    return sh;
  };

  rowsHost.addEventListener('click', (e) => {
    const b = e.target.closest('.ex-row');
    if (!b) return;
    haptic();
    if (b.dataset.open === 'rank') openRankSheet();
    else if (b.dataset.open === 'prim') openMuscleSheet('prim');
    else if (b.dataset.open === 'sec') openMuscleSheet('sec');
    else if (b.dataset.open === 'equip') openEquipSheet();
    else if (b.dataset.open === 'rest') openRestSheet();
  });

  // Repos propre à l'exercice : stocké par identifiant, donc écrit une fois
  // l'exercice créé.
  const saveById = (id) => {
    const rbe = { ...(store.userData.settings.restByExercise || {}) };
    rbe[id] = draft.rest;
    store.saveUserData({ settings: { restByExercise: rbe } });
  };

  openModal({
    title: existing ? 'Modifier l\'exercice' : 'Créer un exercice',
    content: form,
    wide: true,
    actions: [
      { label: 'Annuler' },
      {
        label: existing ? 'Enregistrer' : 'Créer',
        variant: 'btn-primary',
        onClick: (body) => {
          const name = body.querySelector('#xe-name').value.trim();
          if (!name) { toast('Nom requis', 'error'); return 'keep'; }
          if (!draft.primary.length) { toast('Au moins 1 muscle principal', 'error'); return 'keep'; }
          const t = totalPct();
          if (t !== 100) { toast(`Répartition à ${t} % — il faut 100 %`, 'error'); return 'keep'; }

          if (existing) {
            if (existing.isCustom) {
              const list = (store.userData.settings.customExercises || []).map((e) =>
                (e.id === existing.id
                  ? {
                    ...e,
                    name,
                    primaryMuscles: draft.primary,
                    secondaryMuscles: draft.secondary,
                    equip: draft.equip,
                    refExercise: draft.refExercise,
                    refCoef: draft.refCoef,
                  }
                  : e));
              store.saveUserData({ settings: { customExercises: list } });
            } else {
              // Exercice de la base intégrée : on empile des surcouches par
              // identifiant, sans jamais toucher à la base elle-même.
              const s = store.userData.settings;
              const namesOv = { ...(s.exerciseNames || {}) };
              namesOv[existing.id] = name;
              const musclesOv = { ...(s.exerciseMuscleOverrides || {}) };
              musclesOv[existing.id] = { primaryMuscles: draft.primary, secondaryMuscles: draft.secondary };
              const equipOv = { ...(s.exerciseEquip || {}) };
              equipOv[existing.id] = draft.equip;
              const refsOv = { ...(s.exerciseRefs || {}) };
              if (draft.refExercise) refsOv[existing.id] = { refExercise: draft.refExercise, refCoef: draft.refCoef };
              else delete refsOv[existing.id];
              store.saveUserData({
                settings: {
                  exerciseNames: namesOv,
                  exerciseMuscleOverrides: musclesOv,
                  exerciseEquip: equipOv,
                  exerciseRefs: refsOv,
                },
              });
            }
            saveById(existing.id);
            toast('Exercice modifié', 'success');
            if (onSaved) onSaved(exerciseLookup(existing.id));
          } else {
            const exo = {
              id: 'custom_' + crypto.randomUUID().slice(0, 8),
              name,
              category: 'Custom',
              isCustom: true,
              primaryMuscles: draft.primary,
              secondaryMuscles: draft.secondary,
              equip: draft.equip,
              difficulty: 'Custom',
              equipment: draft.equip.includes('machine') ? 'Machine' : 'Other',
              refExercise: draft.refExercise,
              refCoef: draft.refCoef,
            };
            store.saveUserData({ settings: { customExercises: [...(store.userData.settings.customExercises || []), exo] } });
            saveById(exo.id);
            if (onSaved) onSaved(exo);
          }
        },
      },
    ],
  });
}

// ============================================================
// RÉORGANISATION (drag & drop tactile, réutilisé séance + routines)
// ============================================================
function openReorderSheet(labels, onDone) {
  const form = el(`<div>
    <div id="reorder-list"></div>
    <button class="btn btn-primary btn-block" id="reorder-save" style="margin-top:6px">Valider l'ordre</button>
  </div>`);
  const sheet = openSheet({ title: 'Réorganiser', content: form });
  const list = form.querySelector('#reorder-list');

  labels.forEach((lbl, i) => {
    list.appendChild(el(`<div class="reorder-row" data-i="${i}">
      <span class="drag-handle">${icons.drag}</span>
      <span class="reorder-label">${lbl}</span>
    </div>`));
  });

  let dragged = null;
  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    dragged = handle.closest('.reorder-row');
    dragged.classList.add('dragging');
    dragged.setPointerCapture && handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  list.addEventListener('pointermove', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const row = target && target.closest ? target.closest('.reorder-row') : null;
    if (row && row !== dragged) {
      const r = row.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      list.insertBefore(dragged, before ? row : row.nextSibling);
    }
  });
  const endDrag = () => { if (dragged) { dragged.classList.remove('dragging'); dragged = null; } };
  list.addEventListener('pointerup', endDrag);
  list.addEventListener('pointercancel', endDrag);

  form.querySelector('#reorder-save').addEventListener('click', () => {
    const order = [...list.querySelectorAll('.reorder-row')].map((r) => +r.dataset.i);
    sheet.close();
    onDone(order);
  });
}

// ============================================================
// TIMER DE REPOS — barre sticky en haut, toujours visible
// ============================================================
// Le repos est calculé sur l'horloge murale (instant de fin), et non par
// décrémentation d'un compteur : iOS gèle les setInterval quand la PWA passe en
// arrière-plan, ce qui faisait revenir sur un timer figé à la valeur qu'il avait
// au moment de quitter l'app. Même principe que le chrono de séance.
function startRestTimer(exerciseId) {
  if (!sessionUI) return;
  clearInterval(restInterval);
  const bar = sessionUI.overlay.querySelector('#rest-topbar');
  let total = exoRestDuration(exerciseId);
  let endsAt = Date.now() + total * 1000;
  restRemaining = total;

  bar.classList.add('active');
  bar.classList.remove('pulse');
  const render = () => {
    bar.querySelector('.rt-time').textContent = formatTime(restRemaining);
    bar.querySelector('.progress-bar > div').style.width = `${Math.max(0, (restRemaining / total) * 100)}%`;
  };
  render();

  const finish = () => {
    stopRestTimer();
    if (store.userData.settings.soundEnabled) { beep(880); setTimeout(() => beep(1100), 180); }
    haptic();
  };

  restInterval = setInterval(() => {
    restRemaining = Math.ceil((endsAt - Date.now()) / 1000);
    if (restRemaining <= 0) { finish(); return; }
    render();
    if (restRemaining <= 5) bar.classList.add('pulse');
  }, 250);

  bar.querySelector('#rt-skip').onclick = () => stopRestTimer();
  bar.querySelector('#rt-plus').onclick = () => {
    endsAt += 30000; total += 30;
    restRemaining = Math.ceil((endsAt - Date.now()) / 1000);
    render();
  };
}
function stopRestTimer() {
  clearInterval(restInterval);
  restInterval = null;
  restRemaining = 0;
  if (sessionUI) {
    const bar = sessionUI.overlay.querySelector('#rest-topbar');
    if (bar) { bar.classList.remove('active', 'pulse'); }
  }
}

// ============================================================
// MINI-BARRE (séance minimisée)
// ============================================================
function showMiniBar() {
  removeMiniBar();
  const bar = el(`<div id="mini-session">
    <span class="ms-label">${icons.play} Séance en cours <span class="ms-rest" id="ms-rest"></span></span>
    <span class="num ms-time" id="ms-time">${formatTime(elapsedSeconds())}</span>
  </div>`);
  bar.addEventListener('click', () => restoreSession());
  document.body.appendChild(bar);
}
function removeMiniBar() {
  const b = document.getElementById('mini-session');
  if (b) b.remove();
}
function minimizeSession() {
  if (!sessionUI) return;
  sessionUI.overlay.classList.add('minimized');
  document.body.classList.remove('overlay-open');
  showMiniBar();
}
function restoreSession() {
  if (!sessionUI) return;
  sessionUI.overlay.classList.remove('minimized');
  document.body.classList.add('overlay-open');
  removeMiniBar();
}

// ============================================================
// DÉTAIL EXO (rang, muscles, matériel, historique)
// ============================================================
// Le contenu est redessiné SUR PLACE (`paint`) plutôt que par réouverture :
// modifier l'exercice depuis le crayon laisse donc la fiche ouverte, à jour,
// là où on l'avait laissée.
function openExerciseDetailSheet(exerciseId) {
  if (!exerciseLookup(exerciseId)) return;
  const host = el('<div></div>');
  let sheet = null;
  const paint = () => {
    host.innerHTML = '';
    host.appendChild(buildExerciseDetail(exerciseId));
    if (sheet) sheet.setTitle(exerciseLookup(exerciseId).name);
  };
  sheet = openSheet({
    title: exerciseLookup(exerciseId).name,
    content: host,
    // Crayon en haut à droite : édition complète de l'exercice. La fiche reste
    // ouverte derrière et se met à jour à l'enregistrement.
    headerAction: {
      icon: icons.edit,
      label: 'Modifier l\'exercice',
      onClick: () => openExerciseEditor(paint, exerciseLookup(exerciseId)),
    },
  });
  paint();
  return sheet;
}

function buildExerciseDetail(exerciseId) {
  const def = exerciseLookup(exerciseId);
  const entries = exoEntries(exerciseId);
  const history = entries.slice(-12).reverse();

  // Meilleur 1RM estimé (Epley : poids × (1 + reps/30)) sur cet historique
  let best1rm = null;
  for (const { workout: w, wx } of entries) {
    for (const s of wx.sets) {
      if (!s.weight || !s.reps) continue;
      const orm = s.weight * (1 + s.reps / 30);
      if (!best1rm || orm > best1rm.orm) best1rm = { orm, weight: s.weight, reps: s.reps, date: w.date };
    }
  }

  // Carte recto-verso : au recto les muscles de l'exercice, au verso son rang.
  const rk = exerciseRank(exerciseId);
  const rankName = rk ? (rk.division ? `${rk.name} ${rk.division}` : rk.name) : '';
  const rankBlock = `<div class="rank-flip" id="ed-rank" title="Toucher pour voir le rang">
      <div class="rank-flip-inner">
        <div class="rank-face rank-front">
          ${bodyMapSVG(exerciseIntensity(def), { size: 214, label: 'Muscles sollicités par l\'exercice' })}
          <div class="flip-hint">${icons.swap} Rang</div>
        </div>
        <div class="rank-face rank-back"${rk ? ` style="border-color:${rk.color}"` : ''}>
          ${rk ? `${rankBadge(rk.id, 120)}
            <div class="rank-name" style="color:${rk.color}">${rankName}</div>
            <div class="rank-back-lp">${rk.division ? `${rk.lp} / ${rk.lpNeeded} LP` : `${rk.lp} LP`}</div>
            ${rk.division ? `<div class="rank-back-bar"><div style="width:${rk.lp}%;background:${rk.color}"></div></div>` : '<div class="rank-back-sub">Rang ultime atteint</div>'}`
    : '<div class="rank-back-sub" style="padding:0 24px;text-align:center">Non classé — réalise cet exercice pour obtenir un rang</div>'}
        </div>
      </div>
    </div>`;

  const form = el(`<div>
    ${rankBlock}
    ${best1rm ? `<div class="orm-card">
      <div class="orm-head">Meilleure série</div>
      <div class="orm-value">${best1rm.weight} kg × ${best1rm.reps}</div>
      <div class="orm-sub">${fmtDateFull(best1rm.date)}</div>
    </div>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">
      ${def.primaryMuscles.map((m) => `<span class="badge">${muscleLabel(m.m)} ${m.p}%</span>`).join('')}
      ${def.secondaryMuscles.map((m) => `<span class="badge violet">${muscleLabel(m.m)} ${m.p}%</span>`).join('')}
      ${(def.equip || []).map((q) => `<span class="badge equip-badge">${esc(equipLabel(q))}</span>`).join('')}
    </div>
    <div class="ed-hist-title">
      <h3 style="margin:0">Historique</h3>
    </div>
    <div id="ed-history">${history.length
    ? ''
    : '<div class="empty-state">Jamais réalisé</div>'}</div>
  </div>`);

  const rankEl = form.querySelector('#ed-rank');
  if (rankEl) rankEl.addEventListener('click', () => rankEl.classList.toggle('flipped'));

  const hostH = form.querySelector('#ed-history');
  // Séance retenue comme référence (colonne PRÉC) : on la met en évidence.
  const refEntry = bestEntry(exerciseId);
  const refId = refEntry && refEntry.workout ? refEntry.workout.id : null;
  // Variation de la meilleure série par rapport à la séance précédente
  const impById = {};
  for (const e of exoHistory(exerciseId)) impById[e.id] = e.imp;
  for (const h of history) {
    const w = h.workout; const wx = h.wx;
    const imp = impById[w.id];
    const isRef = refId && w.id === refId;
    // La série qui sert à la comparaison est mise en avant : on voit tout de
    // suite CE QUI a progressé (ou non) d'une séance à l'autre.
    const top = topSet(wx);
    const labels = setLabels(wx.sets);
    const setsHtml = wx.sets.map((s, i) => `<div class="ed-set${s === top ? ' is-top' : ''}">
      <span class="ed-set-n ${labels[i].cls}">${labels[i].text}</span>
      <span class="ed-set-v">${s.weight} kg × ${s.reps}</span>
      ${s === top ? '<span class="ed-set-tag">Meilleure</span>' : ''}
    </div>`).join('');
    const row = el(`<div class="ed-hist-item${isRef ? ' ed-hist-best' : ''}">
      ${isRef ? '<span class="ed-best-tag">Référence</span>' : ''}
      <div class="ed-hist-head">
        <span class="ed-hist-date">${fmtDateFull(w.date)}</span>
        <span style="display:flex;align-items:center;gap:6px">
          ${imp == null ? '<span class="ed-imp first">1re</span>' : `<span class="ed-imp ${imp > 0 ? 'up' : imp < 0 ? 'down' : 'flat'}" title="Meilleure série vs séance précédente">${imp > 0 ? '+' : ''}${imp} %</span>`}
          <button class="icon-btn" aria-label="Voir la séance" style="width:38px;height:38px">${icons.history}</button>
        </span>
      </div>
      <div class="ed-sets">${setsHtml}</div>
    </div>`);
    row.querySelector('.icon-btn').addEventListener('click', () => openWorkoutDetail(w, exerciseId));
    hostH.appendChild(row);
  }
  return form;
}

// Vue d'une séance complète (séries empilées, coefficient d'amélioration, exos cliquables)
function openWorkoutDetail(w, highlightId = null) {
  const sessImp = sessionImprovement(w);
  const lpMap = lpMapAll();
  const content = el(`<div>
    <div class="wd-top">
      <span class="muted">${formatTime(w.totalTime || 0)}</span>
      <div style="display:flex;align-items:center;gap:8px">
        ${sessImp != null
          ? `<span class="wd-sess-imp ${sessImp >= 0 ? 'up' : 'down'}">Amélioration ${sessImp >= 0 ? '+' : ''}${sessImp}%</span>`
          : '<span class="muted">Séance de référence</span>'}
        <button class="icon-btn" id="wd-edit" aria-label="Modifier la séance">${icons.edit}</button>
      </div>
    </div>
    <div class="bm-card">${bodyMapSVG(workoutIntensity(w), { size: 210, label: 'Muscles travaillés pendant la séance' })}</div>
    ${w.notes ? `<div class="wd-note">${esc(w.notes)}</div>` : ''}
    ${w.exercises.map((wx, i) => {
      const def = exerciseLookup(wx.exerciseId) || { name: wx.exerciseId };
      const hl = wx.exerciseId === highlightId;
      const imp = exoImprovementAt(wx.exerciseId, w);
      const rk = exerciseRank(wx.exerciseId, lpMap);
      const labels = setLabels(wx.sets);
      const vol = exoVolume(wx);
      return `<div class="wd-exo${hl ? ' hl' : ''}" data-exo="${wx.exerciseId}">
        <div class="wd-exo-head">
          <span class="wd-exo-rank">${rk ? rankBadge(rk.id, 44) : ''}</span>
          <span class="wd-exo-title">
            <span class="wd-exo-name">${esc(def.name)}</span>
            <span class="wd-exo-sub">
              ${rk ? `<b style="color:${rk.color}">${rk.division ? `${rk.name} ${rk.division}` : rk.name}</b> · ` : ''}
              ${wx.sets.length} série${wx.sets.length > 1 ? 's' : ''} · ${vol.toLocaleString('fr-FR')} kg
            </span>
          </span>
          <span class="wd-exo-meta">
            ${wx.ss ? `<span class="ss-chip">SS${wx.ss}</span>` : ''}
            ${imp != null ? impBadge(imp, false) : '<span class="badge" style="font-size:0.58rem">nouveau</span>'}
          </span>
        </div>
        <div class="wd-sets">
          ${wx.sets.map((s, j) => `<div class="wd-set"><span class="wd-set-n ${labels[j].cls}">${labels[j].text}</span><span class="wd-set-v">${s.weight} kg × ${s.reps}</span></div>`).join('')}
        </div>
      </div>`;
    }).join('')}
    <div class="muted" style="text-align:center;font-size:0.7rem;margin-top:6px">Touchez un exercice pour ses statistiques</div>
  </div>`);
  content.addEventListener('click', (e) => {
    const exo = e.target.closest('.wd-exo');
    if (exo) openExerciseDetailSheet(exo.dataset.exo);
  });
  const { close } = openModal({
    title: `Séance du ${fmtDateFull(w.date)}`,
    content,
    wide: true,
    actions: [
      { label: 'Supprimer', variant: 'btn-danger', onClick: (body, closeModal) => {
        closeModal();
        confirmModal('Supprimer la séance', `Supprimer définitivement la séance du ${fmtDateFull(w.date)} ?`, () => {
          store.deleteWorkout(w.id);
          toast('Séance supprimée', 'success');
          if (pageRerender) pageRerender();
        }, true);
        return 'keep';
      } },
      { label: 'Ajouter aux routines', onClick: () => { addSessionToRoutine(w); } },
    ],
  });
  content.querySelector('#wd-edit').addEventListener('click', () => {
    close();
    // On vient souvent d'une fiche exercice restée ouverte derrière : sans ça,
    // la séance s'ouvrirait sous elle et il faudrait la fermer à la main.
    closeAllOverlays();
    if (pageRerender) openSession(pageRerender, null, w);
  });
}

// Crée une routine à partir d'une séance (les séries seront pré-remplies via la colonne PRÉC)
function addSessionToRoutine(w) {
  const ids = w.exercises.map((wx) => wx.exerciseId);
  const input = el(`<div class="field-stack">
    <label class="field"><span>Nom de la routine</span><input type="text" class="rt-name-input" placeholder="Push A" value="Séance du ${fmtDateFull(w.date)}" autofocus></label>
    <div class="muted" style="font-size:0.75rem">${ids.length} exercice${ids.length > 1 ? 's' : ''} · les séries précédentes s'afficheront dans la colonne PRÉC quand tu lanceras la routine.</div>
  </div>`);
  openModal({
    title: 'Ajouter aux routines',
    content: input,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Créer', variant: 'btn-primary',
        onClick: (body) => {
          const name = body.querySelector('.rt-name-input').value.trim();
          if (!name) { toast('Nom requis', 'error'); return 'keep'; }
          store.saveRoutine({ id: crypto.randomUUID(), name, exercises: ids });
          toast('Routine créée', 'success');
          if (pageRerender) pageRerender();
        },
      },
    ],
  });
}

// ============================================================
// MENU ⋯ D'UN EXO
// ============================================================
function openExoMenu(idx) {
  const wx = session.exercises[idx];
  const def = exerciseLookup(wx.exerciseId) || { name: '?' };
  const form = el(`<div>
    <button class="menu-item" data-a="reorder">${icons.drag} Réorganiser les exercices</button>
    <button class="menu-item" data-a="superset">${icons.link} Superset…</button>
    <button class="menu-item" data-a="replace">${icons.swap} Remplacer l'exercice</button>
    <button class="menu-item danger" data-a="delete">${icons.trash} Supprimer</button>
  </div>`);
  const sheet = openSheet({ title: def.name, content: form });

  form.addEventListener('click', (e) => {
    const btn = e.target.closest('.menu-item');
    if (!btn) return;
    const a = btn.dataset.a;
    sheet.close();

    if (a === 'delete') {
      confirmModal('Supprimer', `Retirer « ${esc(def.name)} » de la séance ?`, () => {
        session.exercises.splice(idx, 1);
        sessionUI.renderExos();
      }, true);
    } else if (a === 'replace') {
      openExercisePicker((exo) => {
        session.exercises[idx].exerciseId = exo.id;
        sessionUI.renderExos();
        toast(`Remplacé par ${exo.name}`, 'success');
      }, 'Remplacer par…');
    } else if (a === 'reorder') {
      const labels = session.exercises.map((x) => (exerciseLookup(x.exerciseId) || { name: '?' }).name);
      openReorderSheet(labels, (order) => {
        session.exercises = order.map((i) => session.exercises[i]);
        sessionUI.renderExos();
      });
    } else if (a === 'superset') {
      openSupersetSheet(idx);
    }
  });
}

// Choix du type d'une série. Un appui sur un des trois boutons applique et
// referme aussitôt (pas de validation supplémentaire).
function openSetKindSheet(set, onDone) {
  const current = set.kind || 'normal';
  const form = el(`<div>
    <div class="muted" style="font-size:0.78rem;line-height:1.5;margin-bottom:12px">
      Les séries d'échauffement et dégressives ne comptent pas comme performance :
      elles sont exclues de la séance de référence affichée en colonne PRÉC.
    </div>
    <div class="set-kind-list">
      ${SET_KINDS.map((k) => `<button class="set-kind-btn ${k.cls} ${k.id === current ? 'active' : ''}" data-k="${k.id}">
        <span class="set-kind-badge ${k.cls}">${k.short || '#'}</span>
        <span>${k.label}</span>
      </button>`).join('')}
    </div>
  </div>`);
  const sheet = openSheet({ title: 'Type de série', content: form });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('.set-kind-btn');
    if (!b) return;
    const k = b.dataset.k;
    if (k === 'normal') delete set.kind; else set.kind = k;
    haptic();
    sheet.close();
    if (onDone) onDone();
  });
}

function openSupersetSheet(idx) {
  const wx = session.exercises[idx];
  const others = session.exercises.map((x, i) => ({ x, i })).filter((o) => o.i !== idx);
  if (!others.length) { toast('Ajoute d\'abord un autre exercice', 'error'); return; }

  const form = el(`<div>
    <div class="muted" style="margin-bottom:10px">Sélectionne les exercices à lier en superset :</div>
    ${others.map((o) => {
      const d = exerciseLookup(o.x.exerciseId) || { name: '?' };
      const checked = wx.ss && o.x.ss === wx.ss;
      return `<label class="settings-row" style="cursor:pointer">
        <span class="row-label">${d.name} ${o.x.ss ? `<span class="ss-chip">SS${o.x.ss}</span>` : ''}</span>
        <input type="checkbox" data-i="${o.i}" ${checked ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent)">
      </label>`;
    }).join('')}
    <button class="btn btn-primary btn-block" id="ss-save" style="margin-top:10px">Lier</button>
  </div>`);
  const sheet = openSheet({ title: 'Superset', content: form });

  form.querySelector('#ss-save').addEventListener('click', () => {
    const selected = [...form.querySelectorAll('input:checked')].map((c) => +c.dataset.i);
    // Groupe : réutilise celui de l'exo s'il existe, sinon nouveau numéro
    const used = new Set(session.exercises.map((x) => x.ss).filter(Boolean));
    const group = wx.ss || (Math.max(0, ...used) + 1);
    // Détacher les anciens membres de ce groupe
    session.exercises.forEach((x, i) => { if (x.ss === group && i !== idx && !selected.includes(i)) delete x.ss; });
    if (selected.length) {
      wx.ss = group;
      selected.forEach((i) => { session.exercises[i].ss = group; });
      toast(`Superset SS${group} créé`, 'success');
    } else {
      delete wx.ss;
    }
    sheet.close();
    sessionUI.renderExos();
  });
}

// Choix au démarrage : partir d'une routine (les exercices sont déjà en place)
// ou d'une séance vide. Évite d'avoir à passer par la liste des routines.
function openStartSessionSheet(rerender) {
  const routines = store.userData.routines || [];
  const form = el(`<div class="ns-list">
    <button class="ns-item ns-empty" data-r="">${icons.plus} Séance vide</button>
    ${routines.map((r) => {
      const noms = r.exercises.map((id) => (exerciseLookup(id) || { name: id }).name);
      return `<button class="ns-item" data-r="${r.id}">
        <span class="ns-item-t">${esc(r.name)}</span>
        ${noms.length ? `<span class="ns-item-exos">${noms.map((n) => `<i>${esc(n)}</i>`).join('')}</span>` : ''}
      </button>`;
    }).join('')}
  </div>`);
  const sheet = openSheet({ title: 'Nouvelle séance', content: form });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('.ns-item');
    if (!b) return;
    const routine = b.dataset.r ? routines.find((r) => r.id === b.dataset.r) : null;
    haptic();
    sheet.close();
    // La séance plein écran passe SOUS les panneaux (z-index inférieur) :
    // on retire ceux-ci tout de suite plutôt que d'attendre l'animation.
    closeAllOverlays();
    openSession(rerender, routine);
  });
}

// ============================================================
// MODE SÉANCE
// ============================================================
function openSession(rerenderPage, fromRoutine = null, editWorkout = null, resumeState = null) {
  if (session && sessionUI) { restoreSession(); return; }

  if (resumeState) {
    // Reprise d'une séance persistée (retour dans l'app après l'avoir quittée)
    session = resumeState;
  } else {
    session = {
      accumulated: editWorkout ? (editWorkout.totalTime || 0) : 0, // secondes déjà écoulées (hors période active en cours)
      startedAt: editWorkout ? null : Date.now(),                  // instant (epoch ms) du début de la période active en cours, ou null si en pause
      running: !editWorkout,
      date: editWorkout ? editWorkout.date : todayISO(),
      notes: editWorkout ? (editWorkout.notes || '') : '',
      editingId: editWorkout ? editWorkout.id : null,
      exercises: editWorkout
        ? editWorkout.exercises.map((wx) => ({ exerciseId: wx.exerciseId, ss: wx.ss, sets: wx.sets.map((s) => ({ ...s })) }))
        : (fromRoutine ? fromRoutine.exercises.map((id) => ({ exerciseId: id, sets: [] })) : []),
    };
  }
  persistSession();

  const overlay = el(`<div class="session-overlay">
    <div class="session-top">
      <div class="session-header">
        <span class="num session-chrono" id="s-chrono">00:00</span>
        <div style="display:flex;gap:2px">
          <button class="icon-btn" id="s-playpause" aria-label="Pause">${icons.pause}</button>
          <button class="icon-btn" id="s-minimize" aria-label="Réduire">${icons.chevronDown}</button>
        </div>
      </div>
      <div class="rest-topbar" id="rest-topbar">
        <span class="num rt-time">00:00</span>
        <div class="progress-bar"><div style="width:100%"></div></div>
        <button class="btn btn-ghost btn-sm" id="rt-plus" style="min-height:32px;padding:4px 8px">+30s</button>
        <button class="btn btn-secondary btn-sm" id="rt-skip" style="min-height:32px;padding:4px 10px">Skip</button>
      </div>
    </div>
    <div id="s-exos" style="margin-top:12px"></div>
    <button class="btn btn-secondary btn-block" id="s-add-exo" style="margin:6px 0 14px">${icons.plus} Ajouter un exercice</button>
    <button class="btn btn-primary btn-block" id="s-finish">${icons.check} ${session.editingId ? 'Valider les modifications' : 'Terminer la séance'}</button>
    <button class="btn btn-ghost btn-block" id="s-quit" style="margin-top:8px">${session.editingId ? 'Annuler les modifications' : 'Abandonner'}</button>
  </div>`);
  document.body.appendChild(overlay);
  document.body.classList.add('overlay-open');

  const chronoEl = overlay.querySelector('#s-chrono');
  const tick = () => {
    if (!session) return;
    const secs = elapsedSeconds();
    chronoEl.textContent = formatTime(secs);
    const msTime = document.getElementById('ms-time');
    if (msTime) msTime.textContent = formatTime(secs);
    const msRest = document.getElementById('ms-rest');
    if (msRest) msRest.textContent = restInterval ? `· Repos ${formatTime(restRemaining)}` : '';
  };
  tick(); // affichage immédiat (utile à la reprise)
  chronoInterval = setInterval(tick, 1000);
  // À la reprise (retour dans l'app), recale l'affichage tout de suite
  overlay.querySelector('#s-playpause').innerHTML = session.running ? icons.pause : icons.play;

  const closeSession = () => {
    clearInterval(chronoInterval);
    stopRestTimer();
    store.clearActiveSession();
    session = null;
    sessionUI = null;
    removeMiniBar();
    document.body.classList.remove('overlay-open');
    overlay.remove();
    rerenderPage();
  };

  const renderExos = () => {
    const exosHost = overlay.querySelector('#s-exos');
    exosHost.innerHTML = session.exercises.length ? '' : '<div class="empty-state">Ajoute un premier exercice</div>';
    const lpMap = lpMapAll();
    session.exercises.forEach((wx, idx) => {
      const def = exerciseLookup(wx.exerciseId);
      if (!def) return;
      // Référence = meilleure séance du dernier mois (séries de travail seules)
      const best = bestEntry(wx.exerciseId);
      const prevSets = best ? best.sets : [];
      const imp = exoImprovement(wx);
      const rk = exerciseRank(wx.exerciseId, lpMap);

      // Une ligne par série de l'exo — validée ou non : dévalider ne fait donc
      // pas disparaître la ligne, ses valeurs restent en place et il suffit de
      // la revalider. On complète ensuite avec des lignes vides jusqu'au nombre
      // de séries de la référence, à reproduire.
      const rowSets = [...wx.sets];
      while (rowSets.length < prevSets.length) rowSets.push(null);
      if (!rowSets.length) rowSets.push(null); // exo sans historique : une ligne pour démarrer
      const labels = setLabels(rowSets);
      let rowsHtml = '';
      rowSets.forEach((s, i) => {
        const live = i < wx.sets.length; // ligne réelle (supprimable), même vide
        const done = isDone(s);
        const prev = prevSets[i];
        const lab = labels[i];
        rowsHtml += `<div class="set-row${done ? ' done' : ''}${live ? ' sr-live' : ''}" data-idx="${idx}" data-set="${i}">
          ${live ? '<button class="sr-del" data-del aria-label="Supprimer la série">' + icons.trash + '</button>' : ''}
          <div class="sr-content">
            <button class="sr-n ${lab.cls}" data-kind="${i}" aria-label="Type de série">${lab.text}</button>
            <button class="sr-prev" data-prev="${i}" ${prev ? '' : 'disabled'}>${prev ? `${prev.weight} × ${prev.reps}` : '–'}</button>
            <input class="sr-kg" type="number" inputmode="decimal" step="0.5" min="0" value="${s && s.weight != null ? s.weight : ''}" placeholder="${prev ? prev.weight : ''}">
            <input class="sr-reps" type="number" inputmode="numeric" min="1" value="${s && s.reps != null ? s.reps : ''}" placeholder="${prev ? prev.reps : ''}">
            <button class="sr-check${done ? ' on' : ''}" data-check="${i}" aria-label="Valider la série">${icons.check}</button>
          </div>
        </div>`;
      });

      const card = el(`<div class="card exo-card">
        <div class="exo-head">
          <button class="exo-name-btn" data-detail="${idx}">
            <span class="exo-name-group">
              ${rk ? `<span class="rank-inline rank-inline-session">${rankBadge(rk.id, 76)}</span>` : ''}
              <span>${esc(def.name)} ${wx.ss ? `<span class="ss-chip">SS${wx.ss}</span>` : ''} ${impBadge(imp)}</span>
            </span>
            ${icons.chevron}
          </button>
          <button class="icon-btn" data-menu="${idx}" aria-label="Options">${icons.dots}</button>
        </div>
        <div class="set-table">
          <div class="set-thead"><span>SÉRIE</span><span>PRÉC</span><span>KG</span><span>RÉPS</span><span></span></div>
          ${rowsHtml}
        </div>
        <button class="btn btn-ghost btn-sm sr-add" data-add="${idx}">${icons.plus} Ajouter une série</button>
      </div>`);
      exosHost.appendChild(card);
    });
    persistSession();
  };

  sessionUI = { overlay, renderExos, close: closeSession };
  renderExos();

  overlay.querySelector('#s-exos').addEventListener('click', (e) => {
    const prevBtn = e.target.closest('.sr-prev');
    if (prevBtn) {
      if (prevBtn.disabled) return;
      const row = prevBtn.closest('.set-row');
      const exoIdx = +row.dataset.idx; const i = +row.dataset.set;
      const ref = bestEntry(session.exercises[exoIdx].exerciseId);
      const prev = ref && ref.sets[i];
      if (prev) {
        row.querySelector('.sr-kg').value = prev.weight;
        row.querySelector('.sr-reps').value = prev.reps;
        haptic();
      }
      return;
    }
    // « Ajouter une série » : ajoute une série vide, non validée. C'est une
    // vraie ligne (et non un compteur) : si la série n'est finalement pas
    // faite, elle se supprime au doigt comme n'importe quelle autre.
    const addBtn = e.target.closest('.sr-add');
    if (addBtn) {
      const wxa = session.exercises[+addBtn.dataset.add];
      const refA = bestEntry(wxa.exerciseId);
      // Les lignes issues de la référence sont d'abord matérialisées, sinon le
      // bouton n'ajouterait rien de visible tant qu'elles ne sont pas remplies.
      const target = Math.max(wxa.sets.length, refA ? refA.sets.length : 0) + 1;
      while (wxa.sets.length < target) wxa.sets.push({ weight: null, reps: null, done: false });
      haptic();
      renderExos();
      return;
    }
    // Clic sur le numéro de série → choix du type (normal / échauffement / dégressive)
    const kindBtn = e.target.closest('.sr-n');
    if (kindBtn) {
      const row = kindBtn.closest('.set-row');
      const exoIdx = +row.dataset.idx; const i = +row.dataset.set;
      const wxk = session.exercises[exoIdx];
      if (i >= wxk.sets.length) return; // série pas encore validée : rien à typer
      openSetKindSheet(wxk.sets[i], () => { persistSession(); renderExos(); });
      return;
    }
    const checkBtn = e.target.closest('.sr-check');
    if (checkBtn) {
      const row = checkBtn.closest('.set-row');
      const exoIdx = +row.dataset.idx; const i = +row.dataset.set;
      const wxx = session.exercises[exoIdx];
      if (isDone(wxx.sets[i])) {
        // Dévalider : la ligne RESTE, avec les valeurs saisies. Il faudra la
        // revalider pour qu'elle recompte dans l'amélioration de l'exercice.
        const s = wxx.sets[i];
        const kg = parseFloat(row.querySelector('.sr-kg').value);
        const reps = parseInt(row.querySelector('.sr-reps').value, 10);
        if (!isNaN(kg)) s.weight = kg;
        if (reps) s.reps = reps;
        s.done = false;
        haptic();
        renderExos();
      } else {
        // Valider une série située après des lignes remplies mais non cochées
        // (ex. on saisit la série 1 sans la valider, puis on valide la série 2) :
        // on enregistre AUSSI ces lignes intermédiaires remplies, dans l'ordre,
        // sinon le re-rendu effacerait leurs valeurs restées dans le DOM.
        const card = row.closest('.exo-card');
        const rows = [...card.querySelectorAll('.set-row')];
        const captured = [];
        for (const r of rows) {
          const j = +r.dataset.set;
          if (j > i || isDone(wxx.sets[j])) continue; // au-delà, ou déjà validée
          const kg = parseFloat(r.querySelector('.sr-kg').value);
          const reps = parseInt(r.querySelector('.sr-reps').value, 10);
          if (j === i && (isNaN(kg) || !reps)) { toast('Poids et reps requis', 'error'); return; }
          if (isNaN(kg) || !reps) continue; // ligne intermédiaire vide : ignorée
          captured.push({ j, weight: kg, reps });
        }
        captured.sort((a, b) => a.j - b.j);
        for (const c of captured) {
          // Les lignes vides qui précèdent (venues de la référence) deviennent
          // de vraies séries non validées : chaque série garde ainsi son rang.
          while (wxx.sets.length <= c.j) wxx.sets.push({ weight: null, reps: null, done: false });
          const s = wxx.sets[c.j];
          s.weight = c.weight; s.reps = c.reps; s.done = true;
        }
        haptic();
        renderExos();
        startRestTimer(wxx.exerciseId);
      }
      return;
    }
    const delBtn = e.target.closest('.sr-del');
    if (delBtn) {
      const row = delBtn.closest('.set-row');
      session.exercises[+row.dataset.idx].sets.splice(+row.dataset.set, 1);
      renderExos();
      return;
    }
    const detailBtn = e.target.closest('[data-detail]');
    if (detailBtn) { openExerciseDetailSheet(session.exercises[+detailBtn.dataset.detail].exerciseId); return; }
    const menuBtn = e.target.closest('[data-menu]');
    if (menuBtn) openExoMenu(+menuBtn.dataset.menu);
  });

  // Au clic sur un champ poids/reps déjà rempli : sélectionne tout (ou curseur à la fin)
  overlay.querySelector('#s-exos').addEventListener('focusin', (e) => {
    const inp = e.target.closest('.sr-kg, .sr-reps');
    if (!inp || !inp.value) return;
    setTimeout(() => {
      try { inp.select(); } catch (_) {
        try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (_) { /* noop */ }
      }
    }, 0);
  });

  // Édition inline d'une série déjà validée
  overlay.querySelector('#s-exos').addEventListener('change', (e) => {
    const inp = e.target.closest('.sr-kg, .sr-reps');
    if (!inp) return;
    const row = inp.closest('.set-row');
    const exoIdx = +row.dataset.idx; const i = +row.dataset.set;
    const wxx = session.exercises[exoIdx];
    if (i < wxx.sets.length) {
      const s = wxx.sets[i];
      const w = parseFloat(row.querySelector('.sr-kg').value);
      const r = parseInt(row.querySelector('.sr-reps').value, 10);
      if (!isNaN(w)) s.weight = w;
      if (r) s.reps = r;
      // Modifier une série validée la DÉVALIDE : les valeurs restent, mais il
      // faut recocher pour que la performance de l'exo soit recalculée.
      // On ne re-rend pas la carte ici : le clavier est encore ouvert.
      if (isDone(s)) {
        s.done = false;
        row.classList.remove('done');
        const chk = row.querySelector('.sr-check');
        if (chk) chk.classList.remove('on');
      }
      persistSession();
    }
  });

  // Swipe vers la gauche sur une série validée → révèle la poubelle rouge
  (() => {
    const exosHost = overlay.querySelector('#s-exos');
    let row = null; let startX = 0; let startY = 0; let dx = 0; let mode = null; // null | 'h' | 'v'
    let openRow = null;
    const closeOpen = (except) => {
      if (openRow && openRow !== except) { openRow.querySelector('.sr-content').style.transform = ''; openRow.classList.remove('swiped'); openRow = null; }
    };
    exosHost.addEventListener('touchstart', (e) => {
      // `.sr-live` : toute ligne portée par une série, validée ou non — une
      // série ajoutée puis laissée vide se supprime donc comme les autres.
      const r = e.target.closest('.set-row.sr-live');
      closeOpen(r);
      if (!r) { row = null; return; }
      row = r; startX = e.touches[0].clientX; startY = e.touches[0].clientY; dx = 0; mode = null;
    }, { passive: true });
    exosHost.addEventListener('touchmove', (e) => {
      if (!row) return;
      const cx = e.touches[0].clientX; const cy = e.touches[0].clientY;
      dx = cx - startX; const dy = cy - startY;
      if (mode === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      if (mode !== 'h') return;
      e.preventDefault(); // bloque le scroll vertical pendant le swipe
      const base = row.classList.contains('swiped') ? -76 : 0;
      const t = Math.max(-76, Math.min(0, base + dx));
      row.querySelector('.sr-content').style.transform = `translateX(${t}px)`;
    }, { passive: false });
    exosHost.addEventListener('touchend', () => {
      if (!row || mode !== 'h') { row = null; mode = null; return; }
      const content = row.querySelector('.sr-content');
      const wasOpen = row.classList.contains('swiped');
      const open = wasOpen ? dx < 40 : dx < -40; // ouvrir si glissé assez à gauche
      if (open) { content.style.transform = 'translateX(-76px)'; row.classList.add('swiped'); openRow = row; }
      else { content.style.transform = ''; row.classList.remove('swiped'); if (openRow === row) openRow = null; }
      row = null; mode = null;
    });
  })();

  overlay.querySelector('#s-playpause').addEventListener('click', (e) => {
    if (session.running) {
      // On met en pause : on banque le temps couru dans accumulated
      session.accumulated = elapsedSeconds();
      session.startedAt = null;
      session.running = false;
    } else {
      // On reprend : nouvelle période active
      session.startedAt = Date.now();
      session.running = true;
    }
    e.currentTarget.innerHTML = session.running ? icons.pause : icons.play;
    persistSession();
    tick();
  });
  overlay.querySelector('#s-minimize').addEventListener('click', minimizeSession);
  overlay.querySelector('#s-quit').addEventListener('click', () => {
    confirmModal(
      session.editingId ? 'Annuler les modifications' : 'Abandonner',
      session.editingId ? 'Les modifications ne seront pas enregistrées. Continuer ?' : 'La séance sera perdue. Continuer ?',
      closeSession, true,
    );
  });
  overlay.querySelector('#s-add-exo').addEventListener('click', () => {
    openExercisePicker((exo) => {
      session.exercises.push({ exerciseId: exo.id, sets: [] });
      renderExos();
    });
  });
  overlay.querySelector('#s-finish').addEventListener('click', () => {
    // Seules les séries validées partent au résumé (et donc à l'enregistrement) :
    // les lignes ouvertes puis laissées en plan ne comptent pas.
    const withSets = session.exercises
      .map(savedExercise)
      .filter((x) => x.sets.length);
    if (!withSets.length) { toast('Aucune série enregistrée', 'error'); return; }
    showSummary(withSets, closeSession);
  });
}

function showSummary(exercises, closeSession) {
  const s = store.userData.settings;
  const totalVolume = exercises.reduce((a, x) => a + exoVolume(x), 0);
  const totalSets = exercises.reduce((a, x) => a + x.sets.length, 0);
  const byMuscle = workoutMuscleVolume({ exercises }, exerciseLookup, s.secondaryRatio);
  const atten = muscleAttenuation({ exercises }, exerciseLookup, s.secondaryRatio);
  const breakdown = Object.keys(atten).sort((a, b) => atten[b] - atten[a]);
  const impVals = exercises.map((x) => exoImprovement(x)).filter((v) => v != null);
  const sessImp = impVals.length ? Math.round(impVals.reduce((a, b) => a + b, 0) / impVals.length) : null;
  const progress = exercises
    .map((x) => ({ name: (exerciseLookup(x.exerciseId) || { name: x.exerciseId }).name, imp: exoImprovement(x) }))
    .filter((p) => p.imp != null && p.imp > 0)
    .sort((a, b) => b.imp - a.imp);

  // Gains de LP par exercice + changements de rang — simulation sans sauvegarder
  const TEMP_ID = '__pending_summary__';
  const base = store.userData.workouts.filter((w) => w.id !== (session.editingId || '__never__'));
  const tempWorkout = { id: TEMP_ID, date: session.date, exercises };
  const detail = computeExerciseLPDetailed([...base, tempWorkout], {
    bodyweight: store.userData.profile.weight,
    weights: store.userData.weights,
    standards: getStandards(),
    customRefs: customRefMap(),
  });
  const lpRows = (detail.perWorkout[TEMP_ID] || []).map((r) => {
    const def = exerciseLookup(r.exerciseId) || { name: r.exerciseId };
    const beforeRank = rankFromLP(r.before);
    const afterRank = rankFromLP(r.after);
    const promoted = afterRank.id !== beforeRank.id || afterRank.division !== beforeRank.division;
    return { name: def.name, gain: r.gain, afterRank, promoted };
  });
  const promotions = lpRows.filter((r) => r.promoted);

  const content = el(`<div>
    <div class="grid-2" style="margin-bottom:12px">
      <div class="card" style="margin:0;text-align:center;padding:10px"><div class="muted">Durée</div><div class="num" style="font-size:1.2rem;color:var(--accent)">${formatTime(elapsedSeconds())}</div></div>
      <div class="card" style="margin:0;text-align:center;padding:10px"><div class="muted">Séries</div><div class="num" style="font-size:1.2rem;color:var(--accent)">${totalSets}</div></div>
    </div>
    ${sessImp != null ? `<div class="wd-sess-imp ${sessImp >= 0 ? 'up' : 'down'}" style="text-align:center;margin-bottom:12px">Amélioration de la séance : ${sessImp >= 0 ? '+' : ''}${sessImp}%</div>` : ''}
    ${promotions.length ? `<div class="rank-promo-banner">
      ${promotions.map((p) => `<div class="rank-promo-row">
        ${rankBadge(p.afterRank.id, 44)}
        <div><div class="rank-promo-title">Nouveau rang !</div><div class="rank-promo-name" style="color:${p.afterRank.color}">${p.name} → ${p.afterRank.division ? `${p.afterRank.name} ${p.afterRank.division}` : p.afterRank.name}</div></div>
      </div>`).join('')}
    </div>` : ''}
    ${lpRows.length ? `<h3 style="margin:2px 0 6px">Gains de LP</h3>
      <div class="recap-list">${lpRows.map((r) => `<div class="recap-row"><span>${esc(r.name)}</span><span class="lp-gain-badge">+${r.gain} LP</span></div>`).join('')}</div>` : ''}
    ${progress.length ? `<h3 style="margin:14px 0 6px">Tu as progressé sur</h3>
      <div class="recap-list">${progress.map((p) => `<div class="recap-row"><span>${esc(p.name)}</span>${impBadge(p.imp, false)}</div>`).join('')}</div>` : ''}
    <h3 style="margin:14px 0 6px">Coefficients d'atténuation</h3>
    <div class="muted" style="font-size:0.72rem;margin-bottom:8px">Implication moyenne par muscle (1.0 = moteur principal) · Δ vs dernière séance</div>
    <table class="volume-table">
      <thead><tr><th>Muscle</th><th>Atténuation</th><th>Δ</th></tr></thead>
      <tbody>${breakdown.map((m) => {
        const v = byMuscle[m] || 0;
        const lastV = lastMuscleVolume(m);
        const imp = lastV ? Math.round(((v / lastV) - 1) * 100) : null;
        return `<tr><td>${muscleLabel(m)}</td><td class="tnum" style="color:var(--accent)">${atten[m].toFixed(2)}</td><td>${imp != null ? impBadge(imp, false) : '<span class="muted">—</span>'}</td></tr>`;
      }).join('')}</tbody>
    </table>
    <button class="btn btn-secondary btn-block" id="sum-note" style="margin-top:14px">${icons.edit} <span id="sum-note-lbl">${session.notes ? 'Modifier la note' : 'Note de séance'}</span></button>
    ${session.notes ? `<div class="wd-note" id="sum-note-preview" style="margin-top:8px">${esc(session.notes)}</div>` : '<div id="sum-note-preview"></div>'}
  </div>`);

  content.querySelector('#sum-note').addEventListener('click', () => {
    const ta = el(`<textarea class="note-input" rows="4" placeholder="Ressenti, charges, douleurs…">${esc(session.notes)}</textarea>`);
    openModal({
      title: 'Note de séance',
      content: ta,
      actions: [
        { label: 'Annuler' },
        {
          label: 'Enregistrer', variant: 'btn-primary',
          onClick: (body) => {
            session.notes = body.querySelector('.note-input').value.trim();
            persistSession();
            content.querySelector('#sum-note-lbl').textContent = session.notes ? 'Modifier la note' : 'Note de séance';
            content.querySelector('#sum-note-preview').outerHTML = session.notes
              ? `<div class="wd-note" id="sum-note-preview" style="margin-top:8px">${esc(session.notes)}</div>`
              : '<div id="sum-note-preview"></div>';
          },
        },
      ],
    });
  });

  openModal({
    title: 'Résumé de séance',
    content,
    wide: true,
    actions: [
      { label: 'Retour' },
      {
        label: 'Valider', variant: 'btn-primary',
        onClick: () => {
          const save = (totalTime) => {
            const payload = {
              id: session.editingId || crypto.randomUUID(),
              date: session.date,
              notes: session.notes,
              exercises,
              totalVolume: Math.round(totalVolume),
              totalTime,
            };
            if (session.editingId) store.updateWorkout(payload);
            else store.addWorkout(payload);
            toast(session.editingId ? 'Séance mise à jour' : 'Séance enregistrée', 'success');
            // Une séance enregistrée valide/contribue au pilier entraînement → LP
            if (!session.editingId) {
              const btn = document.querySelector('#s-finish') || document.querySelector('.modal .btn-primary');
              celebrateLP(btn, { label: '+ LP' });
            }
            closeSession();
          };
          const secs = elapsedSeconds();
          // Au-delà de 2 h, on demande confirmation : le cas typique est d'avoir
          // oublié d'arrêter le chrono. On propose alors de saisir la vraie durée.
          if (secs > 7200) confirmSessionDuration(secs, save);
          else save(secs);
        },
      },
    ],
  });
}

// Séance anormalement longue (> 2 h) : on demande si la durée est correcte.
// « Oui » -> enregistrement classique. « Corriger » -> saisie h / min / s.
function confirmSessionDuration(seconds, onConfirm) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const content = el(`<div>
    <p class="confirm-text" style="margin-bottom:12px">
      Cette séance a duré <b style="color:var(--accent)">${formatTime(seconds)}</b>.
      Est-ce la bonne durée ? Si tu as oublié d'arrêter le chrono, corrige-la ci-dessous.
    </p>
    <div class="field-row" id="sd-fields" style="display:none">
      <label class="field"><span>Heures</span><input id="sd-h" type="number" inputmode="numeric" min="0" max="23" value="${h}"></label>
      <label class="field"><span>Minutes</span><input id="sd-m" type="number" inputmode="numeric" min="0" max="59" value="${m}"></label>
      <label class="field"><span>Secondes</span><input id="sd-s" type="number" inputmode="numeric" min="0" max="59" value="${s}"></label>
    </div>
  </div>`);

  openModal({
    title: 'Durée de la séance',
    content,
    actions: [
      {
        label: 'Corriger', variant: 'btn-secondary',
        onClick: (body) => {
          const fields = body.querySelector('#sd-fields');
          if (fields.style.display === 'none') {
            // 1er appui : on révèle les champs sans fermer la fenêtre
            fields.style.display = '';
            body.querySelector('#sd-h').focus();
            return 'keep';
          }
          const hh = Math.max(0, parseInt(body.querySelector('#sd-h').value, 10) || 0);
          const mm = Math.max(0, parseInt(body.querySelector('#sd-m').value, 10) || 0);
          const ss = Math.max(0, parseInt(body.querySelector('#sd-s').value, 10) || 0);
          const total = hh * 3600 + mm * 60 + ss;
          if (total <= 0) { toast('Durée invalide', 'error'); return 'keep'; }
          onConfirm(total);
        },
      },
      { label: 'Oui, c\'est correct', variant: 'btn-primary', onClick: () => onConfirm(seconds) },
    ],
  });
}

// ============================================================
// ROUTINES
// ============================================================
function openRoutineEditor(routine, rerender) {
  const r = routine
    ? { ...routine, exercises: [...routine.exercises] }
    : { id: crypto.randomUUID(), name: '', exercises: [] };
  const form = el(`<div>
    <label class="field"><span>Nom</span><input id="r-name" type="text" value="${esc(r.name)}" placeholder="Push A"></label>
    <div id="r-exos"></div>
    <div class="routine-editor-actions">
      <button class="btn btn-secondary btn-sm" id="r-add">${icons.plus} Exercice</button>
      <button class="btn btn-secondary btn-sm" id="r-reorder">${icons.drag} Réorganiser</button>
    </div>
  </div>`);

  const listEl = form.querySelector('#r-exos');
  const renderList = () => {
    listEl.innerHTML = r.exercises.length ? '' : '<div class="empty-state">Aucun exercice</div>';
    r.exercises.forEach((id, i) => {
      const def = exerciseLookup(id);
      const row = el(`<div class="card-row" style="padding:7px 0;border-bottom:1px solid rgba(0,217,255,0.08)">
        <span style="font-size:0.9rem">${i + 1}. ${esc(def ? def.name : id)}</span>
        <button class="icon-btn danger" aria-label="Retirer" style="width:38px;height:38px">${icons.trash}</button>
      </div>`);
      row.querySelector('button').addEventListener('click', () => { r.exercises.splice(i, 1); renderList(); });
      listEl.appendChild(row);
    });
  };
  renderList();
  form.querySelector('#r-add').addEventListener('click', () => {
    openExercisePicker((exo) => { r.exercises.push(exo.id); renderList(); });
  });
  form.querySelector('#r-reorder').addEventListener('click', () => {
    if (r.exercises.length < 2) return;
    const labels = r.exercises.map((id) => (exerciseLookup(id) || { name: id }).name);
    openReorderSheet(labels, (order) => {
      r.exercises = order.map((i) => r.exercises[i]);
      renderList();
    });
  });

  openModal({
    title: routine ? 'Modifier la routine' : 'Nouvelle routine',
    content: form,
    actions: [
      { label: 'Annuler' },
      ...(routine ? [{ label: 'Supprimer', variant: 'btn-danger', onClick: () => { store.deleteRoutine(r.id); rerender(); } }] : []),
      {
        label: 'Enregistrer', variant: 'btn-primary',
        onClick: (body) => {
          r.name = body.querySelector('#r-name').value.trim() || 'Routine';
          store.saveRoutine(r);
          rerender();
        },
      },
    ],
  });
}

// ============================================================
// VOLUME DASHBOARD
// ============================================================
// ============================================================
// OBJECTIFS DE VOLUME (déplacés depuis les réglages)
// ============================================================
function openVolumeGoalsModal(rerender) {
  const goals = store.userData.settings.volumeGoals;
  const form = el(`<div>${MUSCLES.map((m, i) => `
    ${i === 0 || MUSCLES[i - 1].group !== m.group ? `<div class="mus-group">${m.group}</div>` : ''}
    <div class="settings-row" style="padding:7px 0">
      <span class="row-label">${m.label}</span>
      <input type="number" inputmode="numeric" data-m="${m.id}" min="0" max="40" value="${goals[m.id] || 0}" style="width:80px;min-height:40px">
    </div>`).join('')}
    <div class="muted" style="margin-top:8px">Sets / semaine / muscle</div>
  </div>`);
  openModal({
    title: 'Objectifs de volume',
    content: form,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Enregistrer', variant: 'btn-primary',
        onClick: (body) => {
          const vg = {};
          body.querySelectorAll('input[data-m]').forEach((inp) => { vg[inp.dataset.m] = parseInt(inp.value, 10) || 0; });
          store.saveUserData({ settings: { volumeGoals: vg } });
          rerender();
        },
      },
    ],
  });
}

// ============================================================
// CALENDRIER DES SÉANCES
// ============================================================
const WD = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const pad2 = (n) => String(n).padStart(2, '0');

function workoutsByDate() {
  const map = {};
  for (const w of store.userData.workouts) (map[w.date] = map[w.date] || []).push(w);
  return map;
}
function isoOf(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function mondayOf(d) { const x = new Date(d); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); return x; }

function earliestDataDate() {
  const dates = [];
  store.userData.workouts.forEach((w) => dates.push(w.date));
  store.userData.weights.forEach((w) => dates.push(w.date));
  Object.keys(store.userData.nutrition.byDate).forEach((d) => dates.push(d));
  Object.keys(store.userData.steps.byDate).forEach((d) => dates.push(d));
  if (!dates.length) return todayISO();
  return dates.sort()[0];
}

function dayCell(iso, byDate, todayIso, dim) {
  const ws = byDate[iso];
  const has = ws && ws.length;
  // Plusieurs séances le même jour : on cumule leurs muscles.
  const body = has ? bodyMapSVG(normalizeLoad(muscleLoad(ws.flatMap((w) => w.exercises))), { size: 64, gap: 4, cls: 'bm-cal' }) : '';
  return el(`<button class="cal-day${has ? ' has-session' : ''}${iso === todayIso ? ' is-today' : ''}${dim ? ' dim' : ''}" ${has ? '' : 'disabled'} data-date="${iso}">
    ${body}
    <span class="cal-dnum">${Number(iso.slice(8))}</span>
  </button>`);
}

function renderTwoWeekCalendar(host) {
  const byDate = workoutsByDate();
  const t = new Date();
  const todayIso = isoOf(t);
  const start = mondayOf(t);
  start.setDate(start.getDate() - 7); // lundi il y a deux semaines

  const card = el(`<div class="card card-glow">
    <div class="card-row" style="margin-bottom:8px">
      <h3 style="margin:0">Calendrier</h3>
      <button class="btn btn-ghost btn-sm" id="cal-more">${icons.calendar} Voir plus</button>
    </div>
    <div class="cal-wd">${WD.map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid" id="cal-grid"></div>
  </div>`);
  const grid = card.querySelector('#cal-grid');
  for (let i = 0; i < 14; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const iso = isoOf(d);
    grid.appendChild(dayCell(iso, byDate, todayIso, iso > todayIso));
  }
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.cal-day'); if (!b || b.disabled) return;
    const ws = byDate[b.dataset.date]; if (!ws) return;
    openWorkoutDetail(ws[ws.length - 1]);
  });
  card.querySelector('#cal-more').addEventListener('click', () => openFullCalendar());
  host.appendChild(card);
}

function monthGrid(year, month, byDate, todayIso) {
  const first = new Date(year, month, 1);
  const monthName = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const wrap = el(`<div class="cal-month">
    <div class="cal-month-title">${monthName}</div>
    <div class="cal-wd">${WD.map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid"></div>
  </div>`);
  const grid = wrap.querySelector('.cal-grid');
  for (let i = 0; i < offset; i++) grid.appendChild(el('<span class="cal-empty"></span>'));
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    grid.appendChild(dayCell(iso, byDate, todayIso, iso > todayIso));
  }
  return wrap;
}

function openFullCalendar() {
  const byDate = workoutsByDate();
  const todayIso = todayISO();
  const overlay = el(`<div class="picker-overlay cal-overlay">
    <div class="picker-topbar">
      <h3 style="margin:0;flex:1">Historique complet</h3>
      <button class="icon-btn" id="cal-close" aria-label="Fermer">${icons.close}</button>
    </div>
    <div class="cal-scroll" id="cal-scroll"></div>
  </div>`);
  document.body.appendChild(overlay);
  const wasOpen = document.body.classList.contains('overlay-open');
  document.body.classList.add('overlay-open');
  const close = () => { overlay.remove(); if (!wasOpen) document.body.classList.remove('overlay-open'); };

  const scroll = overlay.querySelector('#cal-scroll');
  const start = parseISO(earliestDataDate());
  const end = new Date();
  const months = [];
  let y = start.getFullYear(); let m = start.getMonth();
  while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
    months.push([y, m]);
    m++; if (m > 11) { m = 0; y++; }
  }
  months.forEach(([yy, mm]) => scroll.appendChild(monthGrid(yy, mm, byDate, todayIso)));
  // À l'ouverture : positionné en bas, sur le mois en cours
  requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });

  scroll.addEventListener('click', (e) => {
    const b = e.target.closest('.cal-day'); if (!b || b.disabled) return;
    const ws = byDate[b.dataset.date]; if (!ws) return;
    openWorkoutDetail(ws[ws.length - 1]);
  });
  overlay.querySelector('#cal-close').addEventListener('click', close);
}

function renderVolumeDashboard(host, rerender) {
  const s = store.userData.settings;
  const volumeOpen = s.volumeSectionOpen !== false; // persisté (comme les routines, mais gardé après un rechargement)
  const end = todayISO();
  const start = todayISO(-6);
  const sets = weeklySetsByMuscle(store.userData.workouts, exerciseLookup, start, end, s.secondaryRatio);
  const goals = s.volumeGoals;

  const rows = MUSCLES.map((m) => {
    const done = Math.round((sets[m.id] || 0) * 10) / 10;
    const goal = goals[m.id] || 0;
    const pct = goal ? Math.round((done / goal) * 100) : 0;
    return { m, done, goal, pct };
  });
  // La carte se colore selon l'avancement vers l'objectif de la semaine :
  // un muscle à 100 % (ou plus) prend la teinte la plus soutenue.
  const progress = {};
  for (const r of rows) if (r.goal) progress[r.m.id] = Math.min(1, r.done / r.goal);

  const card = el(`<div class="card${volumeOpen ? '' : ' collapsed'}">
    <div class="card-row collapse-head" id="vol-toggle" style="margin-bottom:6px;cursor:pointer">
      <h3 style="margin:0;display:flex;align-items:center;gap:6px"><span class="collapse-caret">${icons.chevron}</span> Volume hebdo</h3>
      <button class="btn btn-secondary btn-sm" id="vol-goals-btn">${icons.edit} Objectifs</button>
    </div>

    <div class="collapse-body collapse-body-tall">
      <div class="bm-card bm-week">${bodyMapSVG(progress, { size: 190, label: 'Avancement des objectifs de la semaine' })}
        <div class="bm-legend"><span>0 %</span><i></i><span>Objectif atteint</span></div>
      </div>
      <table class="volume-table" id="vol-table">
        <thead><tr><th>Muscle</th><th>Sets</th><th>Obj.</th><th>%</th></tr></thead>
        <tbody>
          ${rows.map((r, i) => `${i === 0 || rows[i - 1].m.group !== r.m.group ? `<tr class="vol-group"><td colspan="4">${r.m.group}</td></tr>` : ''}<tr class="vol-row" data-m="${r.m.id}">
            <td>${r.m.label}</td>
            <td class="tnum">${r.done}</td>
            <td class="tnum">${r.goal}</td>
            <td class="tnum ${r.pct >= 100 ? 'pct-ok' : r.pct >= 50 ? '' : 'pct-warn'}">${r.goal ? r.pct + '%' : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="muted" style="font-size:0.68rem;margin-top:4px">Touchez un muscle pour sa progression</div>
      <div class="chart-wrap" style="margin-top:14px;height:180px"><canvas id="vol-chart"></canvas></div>
      <h3 style="margin-top:16px;margin-bottom:2px">Amélioration des séances</h3>
      <div class="muted" style="font-size:0.7rem;margin-bottom:6px">Coefficient d'amélioration (%) au fil du temps</div>
      <div class="chart-wrap" style="height:170px"><canvas id="imp-chart"></canvas></div>
    </div>
  </div>`);
  host.appendChild(card);

  card.querySelector('#vol-toggle').addEventListener('click', (e) => {
    if (e.target.closest('#vol-goals-btn')) return;
    // On relit l'état AU MOMENT DU CLIC : une valeur capturée au rendu resterait
    // figée et le second appui ne rouvrirait jamais la section.
    const current = store.userData.settings.volumeSectionOpen !== false;
    const next = !current;
    store.saveUserData({ settings: { volumeSectionOpen: next } });
    card.classList.toggle('collapsed', !next);
  });

  card.querySelector('#vol-table').addEventListener('click', (e) => {
    const tr = e.target.closest('.vol-row');
    if (tr) openMuscleChart(tr.dataset.m);
  });

  const acc = {};
  for (const w of store.userData.workouts) {
    if (w.date < start || w.date > end) continue;
    const bm = workoutMuscleVolume(w, exerciseLookup, s.secondaryRatio);
    for (const [m, v] of Object.entries(bm)) acc[m] = (acc[m] || 0) + v;
  }
  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#9CA3AF', font: { size: 8, family: 'Archivo' } }, grid: { color: 'rgba(0,217,255,0.06)' } },
      y: { ticks: { color: '#9CA3AF', font: { size: 9, family: 'Archivo' } }, grid: { color: 'rgba(0,217,255,0.06)' } },
    },
  };
  volumeChart = makeChart(card.querySelector('#vol-chart'), {
    type: 'bar',
    data: { labels: MUSCLES.map((m) => m.short), datasets: [{ data: MUSCLES.map((m) => Math.round(acc[m.id] || 0)), backgroundColor: 'rgba(0,217,255,0.55)', borderRadius: 5 }] },
    options: chartOpts,
  }, volumeChart);

  // Graphe amélioration des séances — 2 dernières semaines, axe vertical fixé à [-100, 100] %
  const sorted = [...store.userData.workouts].sort((a, b) => a.date.localeCompare(b.date));
  const weekStart = todayISO(-13);
  const impPts = [];
  for (const w of sorted) {
    if (w.date < weekStart) continue;
    const si = sessionImprovement(w);
    if (si != null) impPts.push({ date: w.date, v: Math.max(-100, Math.min(100, si)) });
  }
  impChart = makeChart(card.querySelector('#imp-chart'), {
    type: 'line',
    data: {
      labels: impPts.map((p) => p.date.slice(5)),
      datasets: [lineDataset('Amélioration', impPts.map((p) => p.v), '#22D3A6')],
    },
    options: lineChartOptions({ yMin: -100, yMax: 100, ySuffix: '%', yTicks: 5, xTicks: 4 }),
  }, impChart);

  const vgBtn = card.querySelector('#vol-goals-btn');
  if (vgBtn && rerender) vgBtn.addEventListener('click', () => openVolumeGoalsModal(rerender));
}

// Navigateur d'exercices : liste + recherche (sans accents) + tri → statistiques
function openExerciseBrowser() {
  let sortMode = 'alpha'; // 'alpha' | 'rank'
  const overlay = el(`<div class="picker-overlay">
    <div class="picker-topbar">
      <input id="xb-search" type="text" placeholder="Rechercher un exercice…" autocomplete="off">
      <button class="icon-btn" id="xb-close" aria-label="Fermer">${icons.close}</button>
    </div>
    <div class="segment" id="xb-sort" style="margin:0 0 8px">
      <button data-s="alpha" class="active">A → Z</button>
      <button data-s="rank">Par rang</button>
    </div>
    <div class="picker-list" id="xb-list"></div>
    <button class="btn btn-secondary btn-block" id="xb-custom" style="margin:8px 0 calc(10px + var(--safe-b))">${icons.plus} Ajouter un exercice custom</button>
  </div>`);
  document.body.appendChild(overlay);
  const wasOpen = document.body.classList.contains('overlay-open');
  document.body.classList.add('overlay-open');
  const close = () => { overlay.remove(); if (!wasOpen) document.body.classList.remove('overlay-open'); };
  const list = overlay.querySelector('#xb-list');
  const draw = (q = '') => {
    const nq = normalizeStr(q);
    const lpMap = lpMapAll();
    const items = allExercises()
      .map((e) => ({ e, name: (exerciseLookup(e.id) || e).name, lp: lpMap[e.id] }))
      .filter((x) => exoMatches(x.e, nq));
    if (sortMode === 'rank') {
      items.sort((a, b) => (b.lp ?? -1) - (a.lp ?? -1) || a.name.localeCompare(b.name));
    } else {
      items.sort((a, b) => a.name.localeCompare(b.name));
    }
    list.innerHTML = items.length ? '' : '<div class="empty-state">Aucun résultat</div>';
    for (const { e, name, lp } of items.slice(0, 150)) {
      const rk = lp !== undefined ? rankFromLP(lp) : null;
      const chip = rk ? `<span class="rank-inline" title="${rk.name}${rk.division ? ' ' + rk.division : ''}">${rankBadge(rk.id, 46)}</span>` : '<span class="rank-inline muted" style="font-size:0.66rem">non classé</span>';
      // Un exercice custom est glissable vers la gauche pour révéler une
      // poubelle (même geste que la suppression d'un repas ou d'une série).
      // Les exercices de la base intégrée ne sont pas supprimables.
      if (e.isCustom) {
        const wrap = el(`<div class="exo-swipe-row" data-cx="${e.id}">
          <button class="exo-del" data-del aria-label="Supprimer l'exercice">${icons.trash}</button>
          <button class="exo-search-item"><span>${esc(name)}</span>${chip}</button>
        </div>`);
        wrap.querySelector('.exo-search-item').addEventListener('click', () => {
          if (wrap.classList.contains('swiped')) return; // poubelle ouverte : on n'ouvre pas la fiche
          openExerciseDetailSheet(e.id);
        });
        wrap.querySelector('[data-del]').addEventListener('click', () => {
          confirmModal('Supprimer l\'exercice', `Supprimer définitivement « ${esc(name)} » ? Les séances déjà enregistrées le conserveront.`, () => {
            const rest = (store.userData.settings.customExercises || []).filter((x) => x.id !== e.id);
            store.saveUserData({ settings: { customExercises: rest } });
            toast('Exercice supprimé', 'success');
            draw(overlay.querySelector('#xb-search').value);
          }, true);
        });
        list.appendChild(wrap);
      } else {
        const b = el(`<button class="exo-search-item"><span>${esc(name)}</span>${chip}</button>`);
        b.addEventListener('click', () => { openExerciseDetailSheet(e.id); });
        list.appendChild(b);
      }
    }
  };
  draw();

  // Glissement horizontal sur les exercices custom → révèle la poubelle.
  (() => {
    let row = null; let startX = 0; let startY = 0; let dx = 0; let mode = null;
    let openRow = null;
    const closeOpen = (except) => {
      if (openRow && openRow !== except) {
        openRow.querySelector('.exo-search-item').style.transform = '';
        openRow.classList.remove('swiped');
        openRow = null;
      }
    };
    list.addEventListener('touchstart', (ev) => {
      const r = ev.target.closest('.exo-swipe-row');
      closeOpen(r);
      if (!r) { row = null; return; }
      row = r; startX = ev.touches[0].clientX; startY = ev.touches[0].clientY; dx = 0; mode = null;
    }, { passive: true });
    list.addEventListener('touchmove', (ev) => {
      if (!row) return;
      dx = ev.touches[0].clientX - startX;
      const dy = ev.touches[0].clientY - startY;
      if (mode === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      if (mode !== 'h') return;
      ev.preventDefault();
      const base = row.classList.contains('swiped') ? -76 : 0;
      const t = Math.max(-76, Math.min(0, base + dx));
      row.querySelector('.exo-search-item').style.transform = `translateX(${t}px)`;
    }, { passive: false });
    list.addEventListener('touchend', () => {
      if (!row || mode !== 'h') { row = null; mode = null; return; }
      const content = row.querySelector('.exo-search-item');
      const wasOpen = row.classList.contains('swiped');
      const open = wasOpen ? dx < 40 : dx < -40;
      if (open) { content.style.transform = 'translateX(-76px)'; row.classList.add('swiped'); openRow = row; }
      else {
        content.style.transform = ''; row.classList.remove('swiped');
        if (openRow === row) openRow = null;
      }
      row = null; mode = null;
    });
  })();
  const searchInput = overlay.querySelector('#xb-search');
  searchInput.addEventListener('input', (e) => draw(e.target.value));
  overlay.querySelector('#xb-sort').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-s]');
    if (!btn) return;
    sortMode = btn.dataset.s;
    overlay.querySelectorAll('#xb-sort button').forEach((b) => b.classList.toggle('active', b === btn));
    draw(searchInput.value);
  });
  overlay.querySelector('#xb-custom').addEventListener('click', () => {
    openExerciseEditor((exo) => {
      toast(`« ${exo.name} » créé`, 'success');
      draw(searchInput.value); // rafraîchit la liste avec le nouvel exo
    });
  });
  overlay.querySelector('#xb-close').addEventListener('click', close);
  setTimeout(() => searchInput.focus(), 250);
}

// Clic sur un muscle : exercices de la semaine qui l'ont travaillé + amélioration dans le temps
function openMuscleChart(muscleId) {
  const ratio = store.userData.settings.secondaryRatio;
  const sorted = [...store.userData.workouts].sort((a, b) => a.date.localeCompare(b.date));

  const weekStart = todayISO(-6);
  const perExo = {};
  for (const w of store.userData.workouts) {
    if (w.date < weekStart) continue;
    for (const wx of w.exercises) {
      const def = exerciseLookup(wx.exerciseId);
      if (!def) continue;
      const pm = def.primaryMuscles.find((m) => m.m === muscleId);
      const sm = def.secondaryMuscles.find((m) => m.m === muscleId);
      if (!pm && !sm) continue;
      const share = pm ? pm.p / 100 : (sm.p / 100) * ratio;
      const e = perExo[wx.exerciseId] || (perExo[wx.exerciseId] = { name: def.name, sets: 0, vol: 0, primary: !!pm });
      e.sets += wx.sets.length;
      e.vol += exoVolume(wx) * share;
    }
  }
  const exoRows = Object.entries(perExo).sort((a, b) => b[1].sets - a[1].sets);

  const series = [];
  for (const w of sorted) {
    const bm = workoutMuscleVolume(w, exerciseLookup, ratio);
    if (bm[muscleId]) series.push({ date: w.date, v: bm[muscleId] });
  }
  let pts = [];
  for (let i = 1; i < series.length; i++) {
    if (!series[i - 1].v) continue;
    pts.push({ date: series[i].date, v: Math.max(-100, Math.min(100, Math.round(((series[i].v / series[i - 1].v) - 1) * 100))) });
  }
  pts = pts.slice(-6); // zoom sur les 6 derniers entraînements

  const content = el(`<div>
    <h3 style="margin:0 0 4px">Exercices cette semaine</h3>
    <div class="muted" style="font-size:0.7rem;margin-bottom:8px">Ce qui a compté pour ${muscleLabel(muscleId)} sur 7 jours</div>
    <div id="mus-exos">${exoRows.length ? '' : '<div class="empty-state">Aucun exercice cette semaine</div>'}</div>
    <h3 style="margin:16px 0 6px">Amélioration</h3>
    <div class="chart-wrap" style="height:170px"><canvas id="mus-chart"></canvas></div>
  </div>`);
  const listHost = content.querySelector('#mus-exos');
  for (const [id, e] of exoRows) {
    const row = el(`<div class="mus-exo-row" data-exo="${id}">
      <div>
        <div class="mus-exo-name">${esc(e.name)} ${e.primary ? '' : '<span class="badge violet" style="font-size:0.56rem">secondaire</span>'}</div>
        <div class="muted">${e.sets} série${e.sets > 1 ? 's' : ''} · ${Math.round(e.vol).toLocaleString('fr-FR')} kg pondérés</div>
      </div>
      ${icons.chevron}
    </div>`);
    row.addEventListener('click', () => openExerciseDetailSheet(id));
    listHost.appendChild(row);
  }

  // Ce graphique était recréé sans jamais être détruit : chaque ouverture
  // laissait une instance Chart.js vivante. On le détruit à la fermeture.
  let musChart = null;
  openModal({
    title: `${muscleLabel(muscleId)}`,
    content,
    wide: true,
    actions: [{ label: 'Fermer', variant: 'btn-primary' }],
    onClose: () => {
      if (musChart) { try { musChart.destroy(); } catch (_) { /* déjà détruit */ } musChart = null; }
    },
  });
  if (!pts.length) return;
  musChart = makeChart(content.querySelector('#mus-chart'), {
    type: 'line',
    data: {
      labels: pts.map((p) => p.date.slice(5)),
      datasets: [lineDataset('Amélioration', pts.map((p) => p.v), '#00D9FF')],
    },
    options: lineChartOptions({ yMin: -100, yMax: 100, ySuffix: '%', yTicks: 5, xTicks: 4 }),
  });
}

// ============================================================
// RENDER PAGE
// ============================================================
export function render(container) {
  const rerender = () => render(container);
  pageRerender = rerender;
  const routines = store.userData.routines;
  const active = !!session;

  container.innerHTML = '';
  const root = el(`<div>
    <div class="page-title"><h1>Entraînement</h1></div>
    <button class="btn btn-primary btn-block" id="btn-new-session" style="margin-bottom:var(--space)">
      ${icons.play} ${active ? 'Reprendre la séance' : 'Nouvelle séance'}
    </button>
    <div id="calendar-host"></div>
    <div class="card">
      <div class="card-row collapse-head" id="routine-toggle" style="margin-bottom:8px;cursor:pointer">
        <h3 style="margin:0;display:flex;align-items:center;gap:6px"><span class="collapse-caret">${icons.chevron}</span> Routines <span class="muted" style="font-size:0.72rem">(${routines.length})</span></h3>
        <button class="btn btn-secondary btn-sm" id="btn-new-routine">${icons.plus}</button>
      </div>
      <div id="routine-list" class="collapse-body">${routines.length ? '' : '<div class="empty-state">Aucune routine</div>'}</div>
    </div>
    <div id="volume-host"></div>
    <button class="btn btn-secondary btn-block" id="btn-exo-browser" style="margin-top:6px">${icons.book} Exercices & statistiques</button>
  </div>`);
  container.appendChild(root);

  const rlist = root.querySelector('#routine-list');
  for (const r of routines) {
    // Exercices listés les uns sous les autres (plus lisible qu'une ligne
    // à rallonge tronquée quand la routine en compte beaucoup).
    const names = r.exercises.map((id) => (exerciseLookup(id) || { name: id }).name);
    const listHtml = names.length
      ? `<ol class="routine-exos">${names.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>`
      : '<div class="muted" style="margin:4px 0 10px">Vide</div>';
    const card = el(`<div class="card" style="background:var(--surface-2);padding:12px">
      <div class="card-row"><h3 style="margin:0">${esc(r.name)}</h3>
        <button class="icon-btn" aria-label="Modifier">${icons.edit}</button></div>
      ${listHtml}
      <button class="btn btn-primary btn-sm btn-block">Lancer</button>
    </div>`);
    card.querySelector('.icon-btn').addEventListener('click', () => openRoutineEditor(r, rerender));
    card.querySelector('.btn-primary').addEventListener('click', () => openSession(rerender, r));
    rlist.appendChild(card);
  }

  root.querySelector('#btn-new-session').addEventListener('click', () => {
    if (session) { openSession(rerender); return; } // reprise : pas de choix à faire
    openStartSessionSheet(rerender);
  });
  root.querySelector('#btn-new-routine').addEventListener('click', () => openRoutineEditor(null, rerender));
  const rtCard = root.querySelector('#routine-toggle').closest('.card');
  rtCard.classList.toggle('collapsed', !routinesOpen);
  root.querySelector('#routine-toggle').addEventListener('click', (e) => {
    if (e.target.closest('#btn-new-routine')) return;
    routinesOpen = !routinesOpen;
    rtCard.classList.toggle('collapsed', !routinesOpen);
  });

  renderVolumeDashboard(root.querySelector('#volume-host'), rerender);
  renderTwoWeekCalendar(root.querySelector('#calendar-host'));
  root.querySelector('#btn-exo-browser').addEventListener('click', openExerciseBrowser);
}

// Restaure une séance en cours persistée (retour dans l'app après l'avoir
// quittée). Rouvre l'overlay puis le minimise : l'utilisateur voit la mini-barre
// « Séance en cours » et n'a qu'à la toucher pour reprendre. Appelée au boot.
export function resumeActiveSession(rerenderPage) {
  if (session) return; // déjà une séance en mémoire
  const saved = store.loadActiveSession();
  if (!saved || !saved.exercises) return;
  openSession(rerenderPage || (() => {}), null, null, saved);
  minimizeSession();
}

// Rafraîchit l'affichage d'une séance en cours (ex. quand les standards de rang
// finissent de charger après la reprise) sans rien perdre de l'état.
export function refreshActiveSession() {
  if (session && sessionUI) sessionUI.renderExos();
}
