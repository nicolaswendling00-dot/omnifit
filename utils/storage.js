// OmniFit — StorageManager : persistance localStorage avec merge profond

const STORAGE_KEY = 'omniffit_userData';

export function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultUserData() {
  return {
    profile: { name: '', age: 25, weight: 75, height: 178, sex: 'M' },
    goal: { type: 'Prise de muscle', targetWeight: 80, targetDate: todayISO(90) },
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
      showCExo: true,
      secondaryRatio: 0.5,
      exerciseDbFull: true,
      equipmentFilter: [],
      customExercises: [],
      volumeGoals: {
        chest: 12, back: 14, shoulders: 10, biceps: 8, triceps: 8, forearms: 4,
        quads: 12, hamstrings: 8, glutes: 10, calves: 6, core: 8, lowerback: 4,
      },
      theme: 'amoled',
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
      return data;
    } catch (e) {
      console.error('Erreur chargement userData', e);
      return defaultUserData();
    }
  }

  persist() {
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

  addNutritionLog(date, meal) {
    if (!this.userData.nutrition.byDate[date]) {
      this.userData.nutrition.byDate[date] = { meals: [] };
    }
    this.userData.nutrition.byDate[date].meals.push({ id: crypto.randomUUID(), ...meal });
    this.persist();
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
