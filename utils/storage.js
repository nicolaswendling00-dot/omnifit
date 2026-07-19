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
      fiberPer1000: 15,
      unitSystem: 'kg',
      restTimerDefault: 120,
      restByExercise: {},
      exerciseNames: {},
      volumeTrackingEnabled: true,
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
      this.userData = deepMerge(this.userData, data);
    }
    this.persist();
  }

  resetAll() {
    this.userData = defaultUserData();
    this.persist();
  }

  clearHistory() {
    this.userData.weights = [];
    this.userData.nutrition = { byDate: {} };
    this.userData.water = { byDate: {} };
    this.userData.workouts = [];
    this.userData.steps = { byDate: {} };
    this.persist();
  }
}

export const store = new StorageManager();
