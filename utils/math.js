// OmniFit — Calculs mathématiques centralisés

// C_exo : coefficient exercice spécifique (volume × facteur RPE)
export function calculateCExo(weight, reps, sets, rpeMax = 10) {
  const volume = weight * reps * sets;
  const rpeFactor = rpeMax / 10; // 0.8–1.0 généralement
  return volume * rpeFactor;
}

// C_muscle : répartition principaux vs secondaires (ratio 0–1)
export function calculateCMuscle(primaryVolume, secondaryVolume) {
  const total = primaryVolume + secondaryVolume;
  if (total === 0) return 0;
  return primaryVolume / total;
}

// Moyenne mobile simple (SMA)
export function calculateSMA(values, period = 5) {
  return values.map((_, i) => {
    const start = Math.max(0, i - period + 1);
    const slice = values.slice(start, i + 1).filter((v) => v != null);
    if (!slice.length) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// Tendance : % de variation vs période précédente
export function calculateTrend(current, previous) {
  if (!previous) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

// Kcal auto : (Prot × 4) + (Glu × 4) + (Lip × 9)
export function calcKcal(prot, carbs, fat) {
  return Math.round(prot * 4 + carbs * 4 + fat * 9);
}

// Objectif fibres : 10 g pour 1000 kcal ingérées
export function fiberGoalFromKcal(kcal) {
  return Math.round((kcal / 1000) * 10);
}

// Coefficient d'atténuation par muscle sur une séance.
// Pour chaque set, un muscle reçoit p/100 s'il est principal, p/100 × secondaryRatio s'il est secondaire.
// Le coefficient = moyenne pondérée (par le nb de sets) de ce facteur d'implication (0–1+).
export function muscleAttenuation(workout, exerciseLookup, secondaryRatio = 1.0) {
  const acc = {}; // { muscle: { sum, sets } }
  for (const wx of workout.exercises) {
    const def = exerciseLookup(wx.exerciseId);
    if (!def) continue;
    const n = wx.sets.length;
    if (!n) continue;
    for (const pm of def.primaryMuscles) {
      acc[pm.m] = acc[pm.m] || { sum: 0, sets: 0 };
      acc[pm.m].sum += (pm.p / 100) * n;
      acc[pm.m].sets += n;
    }
    for (const sm of def.secondaryMuscles) {
      acc[sm.m] = acc[sm.m] || { sum: 0, sets: 0 };
      acc[sm.m].sum += (sm.p / 100) * secondaryRatio * n;
      acc[sm.m].sets += n;
    }
  }
  const out = {};
  for (const [m, v] of Object.entries(acc)) out[m] = v.sets ? v.sum / v.sets : 0;
  return out;
}

// Harris-Benedict révisée + facteur activité modéré
export function harrisBenedict(profile, goalType) {
  const { weight: W, height: H, age: A, sex } = profile;
  let bmr;
  if (sex === 'F') bmr = 447.593 + 9.247 * W + 3.098 * H - 4.33 * A;
  else bmr = 88.362 + 13.397 * W + 4.799 * H - 5.677 * A;
  let tdee = bmr * 1.45;
  if (goalType === 'Perte de poids') tdee -= 350;
  else if (goalType === 'Prise de muscle') tdee += 250;
  return Math.round(tdee / 10) * 10;
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------- Volume par muscle ----------
// Un exercice répartit son volume (poids × reps) selon les % d'implication.
// secondaryRatio (0.5–2.0) pondère la contribution des muscles secondaires.

export function workoutMuscleVolume(workout, exerciseLookup, secondaryRatio = 1.0) {
  const byMuscle = {};
  for (const wx of workout.exercises) {
    const def = exerciseLookup(wx.exerciseId);
    if (!def) continue;
    const vol = wx.sets.reduce((a, s) => a + s.weight * s.reps, 0);
    for (const pm of def.primaryMuscles) {
      byMuscle[pm.m] = (byMuscle[pm.m] || 0) + vol * (pm.p / 100);
    }
    for (const sm of def.secondaryMuscles) {
      byMuscle[sm.m] = (byMuscle[sm.m] || 0) + vol * (sm.p / 100) * secondaryRatio;
    }
  }
  return byMuscle;
}

// Sets hebdo par muscle : principal = 1 set, secondaire = 0.5 × ratio
export function weeklySetsByMuscle(workouts, exerciseLookup, dateStart, dateEnd, secondaryRatio = 1.0) {
  const byMuscle = {};
  for (const w of workouts) {
    if (w.date < dateStart || w.date > dateEnd) continue;
    for (const wx of w.exercises) {
      const def = exerciseLookup(wx.exerciseId);
      if (!def) continue;
      const n = wx.sets.length;
      for (const pm of def.primaryMuscles) {
        byMuscle[pm.m] = (byMuscle[pm.m] || 0) + n;
      }
      for (const sm of def.secondaryMuscles) {
        byMuscle[sm.m] = (byMuscle[sm.m] || 0) + n * 0.5 * secondaryRatio;
      }
    }
  }
  return byMuscle;
}

export function topExercisesByVolume(workouts, exerciseLookup, dateStart, dateEnd, limit = 5) {
  const byEx = {};
  for (const w of workouts) {
    if (w.date < dateStart || w.date > dateEnd) continue;
    for (const wx of w.exercises) {
      const vol = wx.sets.reduce((a, s) => a + s.weight * s.reps, 0);
      byEx[wx.exerciseId] = (byEx[wx.exerciseId] || 0) + vol;
    }
  }
  return Object.entries(byEx)
    .map(([id, vol]) => ({ id, vol, name: (exerciseLookup(id) || { name: id }).name }))
    .sort((a, b) => b.vol - a.vol)
    .slice(0, limit);
}
