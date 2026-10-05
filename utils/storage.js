// OmniFit — StorageManager : persistance localStorage avec merge profond
import { splitLegacyMuscles, EXERCISES } from '../data/exercises.js';

const STORAGE_KEY = 'omniffit_userData';

export function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Séries hebdomadaires visées par muscle (anatomie détaillée v6.1).
export const DEFAULT_VOLUME_GOALS = {
  upperChest: 10, lowerChest: 10, frontDelts: 6, sideDelts: 10, rearDelts: 8,
  traps: 6, rhomboids: 8, lats: 12, lowerback: 4,
  biceps: 8, triceps: 8, forearms: 4, abs: 8, obliques: 4,
  glutes: 10, quads: 12, hamstrings: 8, adductors: 4, calves: 6,
};

// v6.1 : les grands groupes « épaules », « dos » et « abdos » sont éclatés en
// muscles fins. On convertit tout ce que l'utilisateur a pu enregistrer avec
// l'ancienne anatomie. Sans effet sur des données déjà converties.
// Identifiants d'exercices remplacés : l'ancien est réécrit partout.
// v6.7 : la « Machine Chest Press Incline » intégrée (jamais utilisée) cède la
// place à celle de la bibliothèque perso, qui porte déjà l'historique.
const ID_RENAMES = { custom_1ad5f699: 'custom_93e720d5' };

// Exercices perso devenus des exercices de la base (même identifiant) : on
// retire le doublon perso, la base prend le relais avec le même historique.
// Les anciens identifiants renommés sont réécrits dans les séances, routines
// et réglages par exercice.
function migrateExerciseIds(data) {
  const s = data.settings;
  const builtIn = new Set(EXERCISES.map((e) => e.id));
  if (Array.isArray(s.customExercises)) s.customExercises = s.customExercises.filter((e) => !builtIn.has(e.id));
  const ren = (id) => ID_RENAMES[id] || id;
  for (const w of data.workouts || []) for (const wx of w.exercises || []) wx.exerciseId = ren(wx.exerciseId);
  for (const r of data.routines || []) if (Array.isArray(r.exercises)) r.exercises = r.exercises.map((x) => (typeof x === 'string' ? ren(x) : x));
  for (const k of ['exerciseNames', 'exerciseMuscleOverrides', 'exerciseEquip', 'exerciseRefs', 'restByExercise']) {
    const m = s[k];
    if (!m || typeof m !== 'object') continue;
    for (const [from, to] of Object.entries(ID_RENAMES)) {
      if (from in m) { if (!(to in m)) m[to] = m[from]; delete m[from]; }
    }
  }
}

export function migrateMuscleData(data) {
  const s = data && data.settings;
  if (!s) return data;
  migrateExerciseIds(data);
  for (const e of s.customExercises || []) {
    e.primaryMuscles = splitLegacyMuscles(e.primaryMuscles);
    e.secondaryMuscles = splitLegacyMuscles(e.secondaryMuscles);
  }
  // Répartition modifiée d'un exercice de la BASE, écrite avec l'ancienne
  // anatomie : la nouvelle répartition de la base, muscle par muscle, est plus
  // juste qu'un découpage automatique (qui mettrait par ex. 45 % de deltoïde
  // antérieur sur des élévations latérales). On retire donc la surcharge ; le
  // nom personnalisé, stocké à part, est conservé.
  const ov = s.exerciseMuscleOverrides || {};
  const legacy = (l) => (l || []).some((x) => ['shoulders', 'back', 'core', 'chest'].includes(x.m));
  for (const id of Object.keys(ov)) {
    if (legacy(ov[id].primaryMuscles) || legacy(ov[id].secondaryMuscles)) delete ov[id];
  }
  // Objectifs de volume : les anciens groupes n'ont plus d'équivalent direct
  // (14 séries de « dos » ne disent pas combien pour les trapèzes) ; on les
  // remplace par les valeurs par défaut des nouveaux muscles et on garde
  // celles que l'utilisateur avait réglées sur les muscles inchangés.
  if (s.volumeGoals) {
    const vg = s.volumeGoals;
    // v6.7 : un objectif « pectoraux » s'applique au haut ET au bas (un
    // développé couché compte une série pour chacun).
    if ('chest' in vg) {
      if (!('upperChest' in vg)) vg.upperChest = vg.chest;
      if (!('lowerChest' in vg)) vg.lowerChest = vg.chest;
      delete vg.chest;
    }
    if ('shoulders' in vg || 'back' in vg || 'core' in vg || !('lats' in vg) || !('upperChest' in vg)) {
      for (const k of ['shoulders', 'back', 'core']) delete vg[k];
      for (const [k, v] of Object.entries(DEFAULT_VOLUME_GOALS)) if (!(k in vg)) vg[k] = v;
    }
  }
  return data;
}

function defaultUserData() {
  return {
    profile: { name: '', age: 25, weight: 75, height: 178, sex: 'M' },
    // Pas de poids cible : on choisit une PHASE (sèche / maintenance / prise),
    // on s'arrête quand on est satisfait de son physique, pas à un chiffre.
    goal: { type: 'Prise de muscle' },
    settings: {
      calorieGoal: 2500,
      calorieAuto: true,
      proteinGoal: 120,
      macroMode: 'grams',
      carbsGoalG: 250,
      fatGoalG: 83,
      protPct: 30,
      carbsPct: 40,
      fatPct: 30,
      protMult: 2.2,
      fatMult: 1.0,
      waterGoal: 3,
      stepsGoal: 10000,
      weeklySessionGoal: 4,
      fiberPer1000: 15,
      unitSystem: 'kg',
      restTimerDefault: 120,
      restByExercise: {},
      exerciseNames: {},
      volumeTrackingEnabled: true,
      volumeSectionOpen: true,
      exerciseMuscleOverrides: {},
      exerciseEquip: {},        // { exoId: ['barbell','bench'] } — matériel redéfini
      exerciseRefs: {},         // { exoId: { refExercise, refCoef } } — classement redéfini
      showCExo: true,
      secondaryRatio: 0.5,
      exerciseDbFull: true,
      equipmentFilter: [],
      customExercises: [],
      volumeGoals: { ...DEFAULT_VOLUME_GOALS },
      theme: 'amoled',
      palette: 'dark',
      density: 'spacious',
      soundEnabled: false,
      hapticEnabled: true,
      notificationsEnabled: false,
      notifWeight: false,
      notifWorkout: false,
      notifMacro: false,
    },
    weights: [],
    nutrition: { byDate: {} },
    water: { byDate: {} },
    workouts: [],
    routines: [],
    recipes: [],
    steps: { byDate: {}, goalByDate: {} },
  };
}

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Concatène deux listes en dédupliquant par clé ; les entrées `incoming`
// (importées) l'emportent sur les existantes de même clé. Les entrées sans clé
// exploitable sont toujours conservées (jamais fusionnées par erreur).
function concatDedup(existing = [], incoming = [], key) {
  const out = [];
  const idx = new Map();
  const add = (item) => {
    const k = item && item[key] != null ? item[key] : undefined;
    if (k === undefined) { out.push(item); return; }
    if (idx.has(k)) out[idx.get(k)] = item;
    else idx.set(k, out.push(item) - 1);
  };
  for (const item of (existing || [])) add(item);
  for (const item of (incoming || [])) add(item);
  return out;
}

// Analyse une charge « pas » venant d'un raccourci iOS (URL ?steps=… ou
// presse-papier). Accepte :
//   - un nombre seul  → attribué à `today`  (ex : "8532")
//   - des paires date:count séparées par saut de ligne ou point-virgule
//     (ex : "2026-07-15:8000\n2026-07-16:9500" ou "…;…")
//     séparateurs date/nombre tolérés : ':' , '=' , espace
// Les séparateurs de milliers (virgule/espace) dans le nombre sont tolérés.
// Retourne un tableau [{date, count}] dédupliqué par date (dernière valeur gagne).
export function parseStepsPayload(text, today) {
  const day = today || new Date().toISOString().slice(0, 10);
  const map = new Map();
  if (text == null) return [];
  const raw = String(text).trim();
  if (!raw) return [];
  for (const part of raw.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean)) {
    const dm = part.match(/(\d{4}-\d{2}-\d{2})/);
    const stripped = part.replace(/[\s\u00A0]/g, '');
    const numSrc = dm ? stripped.replace(dm[1], '') : stripped;
    const nm = numSrc.match(/\d[\d.,]*/);
    if (!nm) continue;
    const count = Math.round(parseFloat(nm[0].replace(/,/g, '')));
    if (isNaN(count) || count < 0) continue;
    map.set(dm ? dm[1] : day, count);
  }
  return [...map.entries()].map(([date, count]) => ({ date, count }));
}

export function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (isObj(source[key]) && isObj(target[key])) {
      out[key] = deepMerge(target[key], source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

class StorageManager {
  constructor() {
    this.userData = this.loadUserData();
    this.listeners = [];
    // Incrémenté à chaque écriture : la navigation s'en sert pour savoir si une
    // page doit être redessinée (données changées) ou peut être montrée telle quelle.
    this.version = 0;
  }

  loadUserData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultUserData();
      const data = deepMerge(defaultUserData(), JSON.parse(raw));
      // Migration v3.3 : ratio secondaires fixé à 0.5 et badges C_exo/C_muscle activés
      if (!data.settings._v33) {
        data.settings.secondaryRatio = 0.5;
        data.settings.showCExo = true;
        data.settings._v33 = true;
      }
      // Migration v3.7 : thème AMOLED + densité spacieuse par défaut, sons retirés
      if (!data.settings._v37) {
        data.settings.theme = 'amoled';
        data.settings.density = 'spacious';
        data.settings.soundEnabled = false;
        data.settings._v37 = true;
      }
      // Migration v3.8 : objectif fibres à 15 g / 1000 kcal par défaut
      if (!data.settings._v38) {
        data.settings.fiberPer1000 = 15;
        data.settings._v38 = true;
      }
      // Migration v3.31 : l'option de thème « Sombre » a été retirée (remplacée
      // par « 8-bit ») ; les utilisateurs concernés basculent sur AMOLED.
      if (!data.settings._v331) {
        if (data.settings.theme === 'dark') data.settings.theme = 'amoled';
        data.settings._v331 = true;
      }
      // Migration v3.33 : l'ancien thème « clair » devient la palette claire.
      if (!data.settings._v333) {
        data.settings.palette = data.settings.theme === 'light' ? 'light' : (data.settings.palette || 'dark');
        data.settings.density = 'spacious';
        data.settings._v333 = true;
      }
      // v6.0 : le thème 8-bit a disparu (une seule forme) et les marques de
      // machines ont été abandonnées : on retire les réglages devenus sans objet.
      delete data.settings.shape;
      delete data.settings.exerciseBrand;
      delete data.settings.customBrands;
      migrateMuscleData(data);
      return data;
    } catch (e) {
      console.error('Erreur chargement userData', e);
      return defaultUserData();
    }
  }

  persist() {
    this.version += 1;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.userData));
    } catch (e) {
      console.error('Erreur sauvegarde userData', e);
    }
    this.listeners.forEach((fn) => fn(this.userData));
  }

  saveUserData(updates) {
    this.userData = deepMerge(this.userData, updates);
    this.persist();
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  // ---------- Helpers spécifiques ----------

  addWeightLog(date, value) {
    this.userData.weights = this.userData.weights.filter((w) => w.date !== date);
    this.userData.weights.push({ date, value });
    this.userData.weights.sort((a, b) => a.date.localeCompare(b.date));
    this.userData.profile.weight = value;
    this.persist();
  }

  // Retire la pesée d'une date. `profile.weight` retombe sur la pesée la plus
  // récente restante : il sert de repli partout où l'historique est vide.
  removeWeightLog(date) {
    this.userData.weights = this.userData.weights.filter((w) => w.date !== date);
    const last = this.userData.weights[this.userData.weights.length - 1];
    if (last) this.userData.profile.weight = last.value;
    this.persist();
  }

  // Retire le relevé de pas d'une date (et son objectif figé associé).
  removeStepsLog(date) {
    delete this.userData.steps.byDate[date];
    if (this.userData.steps.goalByDate) delete this.userData.steps.goalByDate[date];
    this.persist();
  }

  addNutritionLog(date, meal) {
    if (!this.userData.nutrition.byDate[date]) {
      this.userData.nutrition.byDate[date] = { meals: [] };
    }
    this.userData.nutrition.byDate[date].meals.push({ id: crypto.randomUUID(), ...meal });
    this.persist();
  }

  // Lissage calorique : répartit un écart `delta` (kcal, signé) du jour `sourceDate`
  // sur `days` jours à venir en ajustant leur objectif calorique figé (day.goal).
  //   delta > 0 : excès mangé → on RÉDUIT l'objectif des jours suivants
  //   delta < 0 : déficit    → on AUGMENTE l'objectif des jours suivants
  // Chaque jour touché est marqué { smoothed: true } pour l'affichage (cercle
  // creux sur le graphe de poids). Les jours affectés commencent le LENDEMAIN du
  // jour source. Retourne le nombre de jours effectivement ajustés.
  applyCalorieSmoothing(sourceDate, delta, days, perDay, liveGoalForDay) {
    const n = Math.max(1, Math.floor(days));
    const adj = Math.round(perDay); // kcal/jour à appliquer (signe déjà porté par perDay)
    const dayMs = 86400000;
    for (let i = 1; i <= n; i++) {
      const d = new Date(Date.parse(sourceDate + 'T00:00:00Z') + i * dayMs).toISOString().slice(0, 10);
      if (!this.userData.nutrition.byDate[d]) this.userData.nutrition.byDate[d] = { meals: [] };
      const day = this.userData.nutrition.byDate[d];
      // Objectif de base du jour : celui déjà figé, sinon l'objectif courant fourni.
      const base = (day.goal && day.goal.kcalGoal) ? day.goal : (liveGoalForDay || {});
      const baseKcal = base.kcalGoal || 0;
      const factor = baseKcal ? (baseKcal + adj) / baseKcal : 1;
      day.goal = {
        kcalGoal: Math.max(0, baseKcal + adj),
        protG: base.protG != null ? Math.round(base.protG * factor) : base.protG,
        carbsG: base.carbsG != null ? Math.round(base.carbsG * factor) : base.carbsG,
        fatG: base.fatG != null ? Math.round(base.fatG * factor) : base.fatG,
      };
      // Mémorise le lissage pour pouvoir l'expliquer / l'annuler.
      // `baseGoal` garde l'objectif AVANT ajustement : l'annulation est ainsi
      // exacte, sans dépendre d'un calcul inverse sensible aux arrondis.
      day.smoothed = { delta: adj, from: sourceDate, at: Date.now(), baseGoal: { ...base } };
    }
    this.persist();
    return n;
  }

  // Jours actuellement ajustés par le lissage parti de `sourceDate`.
  findCalorieSmoothing(sourceDate) {
    const days = [];
    for (const [d, day] of Object.entries(this.userData.nutrition.byDate || {})) {
      if (day && day.smoothed && day.smoothed.from === sourceDate) days.push({ date: d, ...day.smoothed });
    }
    days.sort((a, b) => a.date.localeCompare(b.date));
    return days.length
      ? { sourceDate, days, perDay: days[0].delta, total: days.reduce((a, x) => a + x.delta, 0) }
      : null;
  }

  // Annule le lissage parti de `sourceDate` : chaque jour retrouve l'objectif
  // qu'il avait avant. Pour les lissages d'avant cette version (sans
  // `baseGoal`), on retire l'ajustement à rebours — au pire à l'arrondi près.
  removeCalorieSmoothing(sourceDate) {
    let n = 0;
    for (const day of Object.values(this.userData.nutrition.byDate || {})) {
      if (!day || !day.smoothed || day.smoothed.from !== sourceDate) continue;
      const s = day.smoothed;
      if (s.baseGoal && s.baseGoal.kcalGoal != null) {
        day.goal = { ...s.baseGoal };
      } else if (day.goal && day.goal.kcalGoal != null) {
        const cur = day.goal.kcalGoal;
        const base = Math.max(0, cur - s.delta);
        const f = cur ? base / cur : 1;
        day.goal = {
          kcalGoal: base,
          protG: day.goal.protG != null ? Math.round(day.goal.protG * f) : day.goal.protG,
          carbsG: day.goal.carbsG != null ? Math.round(day.goal.carbsG * f) : day.goal.carbsG,
          fatG: day.goal.fatG != null ? Math.round(day.goal.fatG * f) : day.goal.fatG,
        };
      }
      delete day.smoothed;
      n++;
    }
    if (n) this.persist();
    return n;
  }

  removeMeal(date, mealId) {
    const day = this.userData.nutrition.byDate[date];
    if (!day) return;
    day.meals = day.meals.filter((m) => m.id !== mealId);
    this.persist();
  }

  updateMeal(date, mealId, meal) {
    const day = this.userData.nutrition.byDate[date];
    if (!day) return;
    const idx = day.meals.findIndex((m) => m.id === mealId);
    if (idx >= 0) day.meals[idx] = { ...day.meals[idx], ...meal, id: mealId };
    this.persist();
  }

  dayTotals(date) {
    const day = this.userData.nutrition.byDate[date];
    const t = { kcal: 0, prot: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
    if (!day) return t;
    for (const m of day.meals) {
      t.kcal += m.kcal; t.prot += m.prot; t.carbs += m.carbs;
      t.fat += m.fat; t.fiber += m.fiber || 0; t.sugar += m.sugar || 0;
    }
    return t;
  }

  addWater(date, liters) {
    const cur = this.userData.water.byDate[date] || 0;
    this.userData.water.byDate[date] = Math.max(0, Math.round((cur + liters) * 100) / 100);
    this.persist();
  }

  addStepsLog(date, count) {
    this.userData.steps.byDate[date] = count;
    this.persist();
  }

  addWorkout(workout) {
    this.userData.workouts.push(workout);
    this.userData.workouts.sort((a, b) => a.date.localeCompare(b.date));
    this.persist();
  }

  updateWorkout(workout) {
    const idx = this.userData.workouts.findIndex((w) => w.id === workout.id);
    if (idx >= 0) this.userData.workouts[idx] = workout;
    else this.userData.workouts.push(workout);
    this.userData.workouts.sort((a, b) => a.date.localeCompare(b.date));
    this.persist();
  }

  deleteWorkout(id) {
    this.userData.workouts = this.userData.workouts.filter((w) => w.id !== id);
    this.persist();
  }

  saveRoutine(routine) {
    const idx = this.userData.routines.findIndex((r) => r.id === routine.id);
    if (idx >= 0) this.userData.routines[idx] = routine;
    else this.userData.routines.push(routine);
    this.persist();
  }

  deleteRoutine(id) {
    this.userData.routines = this.userData.routines.filter((r) => r.id !== id);
    this.persist();
  }

  saveRecipe(recipe) {
    if (!this.userData.recipes) this.userData.recipes = [];
    const idx = this.userData.recipes.findIndex((r) => r.id === recipe.id);
    if (idx >= 0) this.userData.recipes[idx] = recipe;
    else this.userData.recipes.push(recipe);
    this.persist();
  }

  deleteRecipe(id) {
    this.userData.recipes = (this.userData.recipes || []).filter((r) => r.id !== id);
    this.persist();
  }

  getStorageSize() {
    return new Blob([JSON.stringify(this.userData)]).size;
  }

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.userData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `omniffit_backup_${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Export sélectif : opts = { weights, steps, nutrition, workouts } (booléens).
  // Les catégories décochées sont vidées ; réglages/profil/routines/recettes restent
  // toujours inclus (ce sont des définitions, pas des logs de données).
  exportJSONSelective(opts = {}) {
    const data = JSON.parse(JSON.stringify(this.userData));
    if (!opts.weights) data.weights = [];
    if (!opts.steps) data.steps = { byDate: {} };
    if (!opts.nutrition) data.nutrition = { byDate: {} };
    if (!opts.workouts) data.workouts = [];
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `omniffit_export_${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  importJSON(data, mode = 'merge') {
    if (mode === 'overwrite') {
      this.userData = deepMerge(defaultUserData(), data);
    } else {
      // Fusion. deepMerge REMPLACE les tableaux ; on recompose donc ensuite les
      // collections cumulatives (historique, routines, recettes, exos custom)
      // pour ne rien écraser. Idempotent : ré-importer le même fichier ne crée
      // pas de doublons (déduplication par clé, l'import l'emportant).
      const prev = this.userData;
      const merged = deepMerge(prev, data);
      if (Array.isArray(data.workouts)) merged.workouts = concatDedup(prev.workouts, data.workouts, 'id');
      if (Array.isArray(data.weights)) merged.weights = concatDedup(prev.weights, data.weights, 'date');
      if (Array.isArray(data.routines)) merged.routines = concatDedup(prev.routines, data.routines, 'id');
      if (Array.isArray(data.recipes)) merged.recipes = concatDedup(prev.recipes, data.recipes, 'id');
      if (data.settings && Array.isArray(data.settings.customExercises)) {
        const prevCx = (prev.settings && prev.settings.customExercises) || [];
        merged.settings.customExercises = concatDedup(prevCx, data.settings.customExercises, 'id');
      }
      merged.workouts.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      merged.weights.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      this.userData = merged;
    }
    // Une sauvegarde ancienne peut contenir l'anatomie d'avant la v6.1
    migrateMuscleData(this.userData);
    this.persist();
  }

  resetAll() {
    this.userData = defaultUserData();
    this.persist();
  }

  // Effacement sélectif de l'historique.
  // opts = { workouts, nutrition, weights, steps } (booléens). Une catégorie à
  // true est vidée ; les réglages/profil/routines/recettes restent intacts.
  // Sans opts (ou objet vide) → efface tout (compatibilité ascendante).
  clearHistory(opts = null) {
    const o = opts && Object.keys(opts).length ? opts : { workouts: true, nutrition: true, weights: true, steps: true };
    if (o.weights) this.userData.weights = [];
    if (o.nutrition) this.userData.nutrition = { byDate: {} };
    if (o.workouts) this.userData.workouts = [];
    if (o.steps) this.userData.steps = { byDate: {}, goalByDate: {} };
    // L'eau suit la nutrition (même onglet, même logique de journal quotidien)
    if (o.nutrition) this.userData.water = { byDate: {} };
    this.persist();
  }

  // ---------- Séance en cours (persistance inter-sessions) ----------
  // Sauvegarde l'état d'une séance active pour la retrouver même après avoir
  // quitté l'app (l'iPhone décharge la PWA de la mémoire quand on la quitte).
  saveActiveSession(sessionState) {
    this.userData.activeSession = sessionState;
    this.persist();
  }

  loadActiveSession() {
    return this.userData.activeSession || null;
  }

  clearActiveSession() {
    if (this.userData.activeSession) {
      delete this.userData.activeSession;
      this.persist();
    }
  }

  // ---------- Historique des aliments saisis (pour ré-ajout rapide) ----------
  // Parcourt tous les repas de tous les jours et renvoie une liste dédupliquée
  // par macros/100g, triée du plus récent au plus ancien. Chaque entrée garde
  // les valeurs pour 100 g (per100) si disponibles, sinon les macros absolues.
  nutritionEntryHistory() {
    const byDate = this.userData.nutrition.byDate || {};
    const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a)); // récent d'abord
    const seen = new Set();
    const out = [];
    for (const date of dates) {
      const meals = byDate[date].meals || [];
      // Parcours en ordre inverse d'ajout → le plus récent du jour en premier
      for (let i = meals.length - 1; i >= 0; i--) {
        const m = meals[i];
        const key = `${(m.baseName || m.name || '').toLowerCase()}|${m.per100 ? `${m.per100.prot}|${m.per100.carbs}|${m.per100.fat}|${m.per100.fiber || 0}` : `${m.prot}|${m.carbs}|${m.fat}`}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...m, date });
      }
    }
    return out;
  }
}

export const store = new StorageManager();
