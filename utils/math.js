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

// Objectif fibres : g de fibres pour 1000 kcal d'objectif (défaut 10, réglable)
export function fiberGoalFromKcal(kcal, per1000 = 15) {
  return Math.round((kcal / 1000) * per1000);
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
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  // Au-delà d'une heure on affiche h:mm:ss (sinon « 125:30 » prête à confusion)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

// ============================================================
// COACH MÉTABOLIQUE — maintenance optimisée & détection de stagnation
// ============================================================
// Esprit « maintenance optimisée » de Lucas Gouiffe : on ne se fie pas à une
// formule figée, on OBSERVE la réponse du poids à un apport donné et on calibre.
//
// Physiologie : ~7700 kcal ≈ 1 kg de masse corporelle. Un écart calorique
// quotidien D produit donc une variation hebdomadaire de D × 7 / 7700 kg.
// À l'inverse, connaissant l'apport moyen et la pente hebdomadaire du poids, on
// remonte à la maintenance réelle :
//     maintenance ≈ apportMoyen − penteHebdoKg × 1100     (1100 = 7700 / 7)
//
// La pente du poids vient d'une régression linéaire (moindres carrés) sur les
// pesées de la fenêtre : robuste au bruit quotidien (eau, glycogène) tant qu'il
// y a assez de points étalés dans le temps.
const KCAL_PER_KG = 7700;

// Jours depuis l'epoch, sans effet de fuseau (on parse Y-M-D).
function isoToDayNumber(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// Direction attendue du poids selon l'objectif :
//   'down' = sèche (perte)   'up' = prise   'hold' = maintenance/recomp
function goalDirection(goalType) {
  if (goalType === 'Perte de poids') return 'down';
  if (goalType === 'Prise de muscle') return 'up';
  return 'hold'; // Recomposition ≈ maintenance : le poids stable EST le but
}

// opts = { weights:[{date,value}], intakeByDate:{date:kcal}, goalType, today,
//          bodyweight, windowDays=21, lastAdjustDate=null, cooldownDays=10 }
// Retour : { status, weeklyRateKg, daysSpan, nWeights, avgIntake, nFoodDays,
//            maintenanceEst, suggestedDelta, direction, stallThreshold, daysSinceAdjust }
//   status ∈ 'insufficient' | 'on_track' | 'plateau' | 'overshoot' | 'hold' | 'cooldown'
export function metabolicInsight(opts = {}) {
  const {
    weights = [], intakeByDate = {}, goalType = 'Recomposition',
    today = null, bodyweight = 0, windowDays = 21,
    lastAdjustDate = null, cooldownDays = 10,
  } = opts;

  const dir = goalDirection(goalType);
  const base = { status: 'insufficient', weeklyRateKg: null, daysSpan: 0, nWeights: 0,
    avgIntake: null, nFoodDays: 0, maintenanceEst: null, suggestedDelta: null,
    direction: dir, stallThreshold: null, daysSinceAdjust: null };

  const anchor = today
    || (weights.length ? weights[weights.length - 1].date : null);
  if (!anchor) return base;
  const todayN = isoToDayNumber(anchor);
  const minDay = todayN - windowDays;

  const pts = weights
    .filter((w) => typeof w.value === 'number')
    .map((w) => ({ x: isoToDayNumber(w.date), y: w.value }))
    .filter((p) => p.x > minDay && p.x <= todayN)
    .sort((a, b) => a.x - b.x);

  const nWeights = pts.length;
  const daysSpan = nWeights >= 2 ? pts[nWeights - 1].x - pts[0].x : 0;
  const bw = bodyweight || (nWeights ? pts[nWeights - 1].y : 0);
  base.nWeights = nWeights; base.daysSpan = daysSpan;

  // Assez de pesées, assez étalées, pour dégager une tendance fiable.
  const MIN_WEIGHTS = 4;
  const MIN_SPAN = 10;
  if (nWeights < MIN_WEIGHTS || daysSpan < MIN_SPAN) return base;

  // Régression linéaire : pente en kg/jour → kg/semaine.
  const n = nWeights;
  const sx = pts.reduce((a, p) => a + p.x, 0);
  const sy = pts.reduce((a, p) => a + p.y, 0);
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  const slopePerDay = denom ? (n * sxy - sx * sy) / denom : 0;
  const weeklyRateKg = Math.round(slopePerDay * 7 * 100) / 100;

  // Apport moyen sur les jours réellement loggés de la fenêtre → maintenance.
  // On EXCLUT le jour courant : encore partiel, il sous-estimerait l'apport.
  const foodDays = Object.keys(intakeByDate).filter((d) => {
    const dn = isoToDayNumber(d);
    return dn > minDay && dn < todayN && intakeByDate[d] > 0;
  });
  const nFoodDays = foodDays.length;
  const MIN_FOOD_DAYS = 8;
  let avgIntake = null; let maintenanceEst = null;
  if (nFoodDays >= MIN_FOOD_DAYS) {
    avgIntake = Math.round(foodDays.reduce((a, d) => a + intakeByDate[d], 0) / nFoodDays);
    maintenanceEst = Math.round((avgIntake - weeklyRateKg * (KCAL_PER_KG / 7)) / 10) * 10;
  }

  // Seuil de stagnation : proportionnel au poids de corps, plancher 0.15 kg/sem.
  const stall = Math.max(0.15, bw * 0.002);

  let status = 'on_track'; let suggestedDelta = null;
  if (dir === 'hold') {
    status = 'hold'; // aucun ajustement : on ne « détecte » pas pour une maintenance
  } else if (dir === 'down') {          // sèche
    if (weeklyRateKg <= -stall) status = 'on_track';
    else if (weeklyRateKg >= stall) { status = 'overshoot'; suggestedDelta = -200; }
    else { status = 'plateau'; suggestedDelta = -200; }
  } else {                              // prise / reverse diet
    if (weeklyRateKg >= stall) status = 'on_track';
    else if (weeklyRateKg <= -stall) { status = 'overshoot'; suggestedDelta = 200; }
    else { status = 'plateau'; suggestedDelta = 200; }
  }

  // Anti-spam : après un ajustement, on laisse le poids répondre avant de
  // reproposer un changement (sinon on empile les ±200 trop vite).
  let daysSinceAdjust = null;
  if (suggestedDelta != null && lastAdjustDate) {
    daysSinceAdjust = todayN - isoToDayNumber(lastAdjustDate);
    if (daysSinceAdjust >= 0 && daysSinceAdjust < cooldownDays) {
      status = 'cooldown';
      suggestedDelta = null;
    }
  }

  return {
    status, weeklyRateKg, daysSpan, nWeights, avgIntake, nFoodDays,
    maintenanceEst, suggestedDelta, direction: dir,
    stallThreshold: Math.round(stall * 100) / 100, daysSinceAdjust,
  };
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
