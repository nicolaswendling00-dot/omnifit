// OmniFit — utils/globalRank.js
// RANG GLOBAL : mesure la CONSTANCE (et non la performance brute, qui est déjà
// couverte par le rang par exercice dans ranks.js).
//
// Principes
//  - L'unité est le JOUR. Le LP quotidien est plafonné : impossible de rattraper
//    des semaines d'inactivité en une grosse journée.
//  - 3 piliers par jour : nutrition, pas, entraînement.
//  - Rendement DÉGRESSIF : un pilier rapporte de moins en moins à mesure qu'on
//    monte (même philosophie que les coefficients α de ranks.js).
//  - Multiplicateur de SÉRIE : la régularité est ce qui paie vraiment.
//  - DÉCLIN au-delà de 3 jours d'inactivité, uniquement à partir de Diamant :
//    on ne peut pas atteindre Onyx puis s'arrêter. Un débutant n'est jamais puni.
//  - SOFT RESET chaque 1er janvier (voir softReset).
//
// Tout est recalculé À PARTIR DE L'HISTORIQUE (nutrition/pas/séances), donc
// corriger un repas d'hier met le rang à jour correctement. Aucun compteur
// dérivant n'est stocké.

import { rankFromLP, ONYX_LP, DIV_LP } from './ranks.js';

// ---- Constantes de calibrage (issues des simulations de constance) ----
// Valeur d'un pilier selon le rang atteint (bronze → onyx).
export const PILLAR_LP = [2.5, 2.5, 2.0, 2.0, 1.5, 1.5, 1.0, 0.75];

// Multiplicateur de série (jours consécutifs « valides », c.-à-d. score ≥ 2).
export function streakMultiplier(streak) {
  if (streak >= 60) return 1.5;
  if (streak >= 30) return 1.35;
  if (streak >= 14) return 1.2;
  if (streak >= 7) return 1.1;
  return 1.0;
}

// Déclin quotidien après 3 jours consécutifs sans aucune activité.
export function decayFor(lp) {
  if (lp >= 1800) return -8;  // Rubis / Onyx
  if (lp >= 900) return -4;   // Diamant / Émeraude / Saphir
  return 0;                   // sous Diamant : aucun déclin
}

// Bonus appliqué au pilier entraînement quand la séance du jour a battu un record
// (1RM estimé) sur au moins un exercice : progresser rapporte un peu plus.
export const IMPROVEMENT_BONUS = 0.25;

// ---- Facteur d'exigence de l'objectif de pas ----
// Empêche de valider le pilier avec un objectif dérisoire (100 pas/jour) et
// récompense les objectifs ambitieux.
//   ~0 à 100 pas · 0.35 à 5 000 · 1.0 à 10 000 (référence) · 1.4 à 20 000 · plafond 1.5
export function stepsGoalFactor(goal) {
  const g = Math.max(0, goal || 0);
  if (g <= 0) return 0;
  if (g <= 10000) return Math.pow(g / 10000, 1.5); // pénalise fortement les objectifs bas
  return Math.min(1.5, 1 + 0.4 * ((g - 10000) / 10000));
}

// ---- Soft reset annuel (1er janvier) ----
// Compression linéaire vers le milieu du classement, plafonnée pour ne JAMAIS
// promouvoir personne. Le haut du classement redescend beaucoup, les débutants
// ne perdent rien (ils n'ont rien à re-prouver).
//   Onyx 2100 → Émeraude I 1460 · Saphir II 1600 → Diamant I 1160 · Or III 300 → inchangé
export function softReset(lp) {
  return Math.min(lp, Math.round(lp * 0.6 + 200));
}

// 1RM estimé (Epley) d'une série d'exercice.
function ormOfSets(sets) {
  let orm = 0;
  for (const s of sets || []) if (s.weight && s.reps) orm = Math.max(orm, s.weight * (1 + s.reps / 30));
  return orm;
}

const dayMs = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (dateStr, n) => iso(new Date(Date.parse(dateStr + 'T00:00:00Z') + n * dayMs));

// ---- Piliers d'une journée ----
// Retourne { nutrition, steps, training, improved, score } (chaque pilier ∈ [0,1],
// training pouvant atteindre 1.25 avec le bonus de progression).
export function dayPillars(date, ctx) {
  const nutritionByDate = ctx.nutritionByDate || {};
  const stepsByDate = ctx.stepsByDate || {};
  const stepsGoalByDate = ctx.stepsGoalByDate || {};
  const sessionsByDate = ctx.sessionsByDate || {};
  const prDates = ctx.prDates || {};
  const liveStepsGoal = ctx.liveStepsGoal || 0;
  const liveMacroGoal = ctx.liveMacroGoal || null;
  const weeklyGoal = ctx.weeklyGoal || 0;

  // --- Nutrition : calories dans ±10 % ET protéines ≥ 90 % de l'objectif ---
  let nutrition = 0;
  const nd = nutritionByDate[date];
  if (nd && nd.meals && nd.meals.length) {
    const g = nd.goal || liveMacroGoal;
    const kcalGoal = g && g.kcalGoal ? g.kcalGoal : 0;
    const protGoal = g && g.protG ? g.protG : 0;
    let kcal = 0; let prot = 0;
    for (const m of nd.meals) { kcal += m.kcal || 0; prot += m.prot || 0; }
    if (kcalGoal > 0) {
      const rel = Math.abs(kcal - kcalGoal) / kcalGoal;
      const protOk = protGoal <= 0 || prot >= protGoal * 0.9;
      if (rel <= 0.10 && protOk) nutrition = 1;
      else if (rel <= 0.15) nutrition = 0.5;
    }
  }

  // --- Pas : atteinte de l'objectif, pondérée par l'exigence de cet objectif ---
  let steps = 0;
  const count = stepsByDate[date];
  if (count != null) {
    const goal = (stepsGoalByDate && stepsGoalByDate[date] != null) ? stepsGoalByDate[date] : liveStepsGoal;
    if (goal > 0) {
      const ratio = count / goal;
      const base = ratio >= 1 ? 1 : (ratio >= 0.75 ? 0.5 : 0);
      steps = base * stepsGoalFactor(goal);
    }
  }

  // --- Entraînement : quota HEBDOMADAIRE glissant (tolère les jours de repos) ---
  let sessions7 = 0;
  for (let i = 0; i < 7; i++) sessions7 += sessionsByDate[addDays(date, -i)] || 0;
  let training = weeklyGoal > 0 ? Math.min(1, sessions7 / weeklyGoal) : 0;
  // Bonus de progression : une séance du jour a battu un record personnel
  const improved = !!prDates[date];
  if (improved) training = Math.min(1.25, training * (1 + IMPROVEMENT_BONUS));

  const score = nutrition + steps + training;
  return { nutrition, steps, training, improved, score };
}

// ---- Calcul complet du rang global ----
// userData : l'objet store.userData. today : date ISO (par défaut aujourd'hui).
// opts.liveMacroGoal : objectif macro courant (pour les jours sans objectif figé).
// Retourne { lp, rank, streak, today, season, peak, lastSeasonPeak, days }
export function computeGlobalRank(userData, today = null, opts = {}) {
  const todayStr = today || iso(new Date());
  const nutritionByDate = (userData.nutrition && userData.nutrition.byDate) || {};
  const stepsByDate = (userData.steps && userData.steps.byDate) || {};
  const stepsGoalByDate = (userData.steps && userData.steps.goalByDate) || {};
  const workouts = userData.workouts || [];
  const settings = userData.settings || {};
  const weeklyGoal = settings.weeklySessionGoal || 4;

  // Séances par date + dates où un record a été battu (bonus de progression)
  const sessionsByDate = {};
  const prDates = {};
  const bestOrm = {};
  const sortedW = [...workouts].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  for (const w of sortedW) {
    sessionsByDate[w.date] = (sessionsByDate[w.date] || 0) + 1;
    for (const wx of w.exercises || []) {
      const orm = ormOfSets(wx.sets);
      if (orm <= 0) continue;
      const prev = bestOrm[wx.exerciseId] || 0;
      if (prev > 0 && orm > prev * 1.001) prDates[w.date] = true;
      if (orm > prev) bestOrm[wx.exerciseId] = orm;
    }
  }

  const ctx = {
    nutritionByDate, stepsByDate, stepsGoalByDate,
    liveStepsGoal: settings.stepsGoal || 10000,
    liveMacroGoal: opts.liveMacroGoal || null,
    sessionsByDate, prDates, weeklyGoal,
  };

  // Première date d'activité : avant, l'utilisateur n'existe pas pour le classement
  const allDates = [
    ...Object.keys(nutritionByDate),
    ...Object.keys(stepsByDate),
    ...sortedW.map((w) => w.date),
  ].filter(Boolean).sort();
  if (!allDates.length) {
    return {
      lp: 0, rank: rankFromLP(0), streak: 0,
      today: { nutrition: 0, steps: 0, training: 0, improved: false, score: 0, lp: 0 },
      season: Number(todayStr.slice(0, 4)), peak: 0, lastSeasonPeak: 0, days: [],
    };
  }

  let lp = 0;
  let streak = 0;
  let idle = 0;
  let peak = 0;
  let lastSeasonPeak = 0;
  let season = Number(allDates[0].slice(0, 4));
  const days = [];
  let cursor = allDates[0];
  let guard = 0;

  while (cursor <= todayStr && guard++ < 20000) {
    // Soft reset au passage d'une nouvelle année
    const y = Number(cursor.slice(0, 4));
    if (y > season) {
      for (let k = season; k < y; k++) {
        lastSeasonPeak = peak;
        lp = softReset(lp);
      }
      season = y;
      peak = lp;
      streak = 0;
    }

    const p = dayPillars(cursor, ctx);
    const rk = rankFromLP(lp);
    const rankIndex = rk.id === 'onyx' ? 7 : Math.min(6, Math.floor(lp / (DIV_LP * 3)));

    if (p.score >= 2) { streak++; idle = 0; }
    else if (p.score <= 0) { streak = 0; idle++; }
    else { streak = 0; idle = 0; }

    let gain;
    if (idle >= 3) gain = decayFor(lp);
    else gain = p.score * PILLAR_LP[rankIndex] * streakMultiplier(streak);

    lp = Math.max(0, lp + gain);
    if (lp > peak) peak = lp;
    days.push({ date: cursor, ...p, gain: Math.round(gain * 10) / 10, lp: Math.round(lp) });

    if (cursor === todayStr) break;
    cursor = addDays(cursor, 1);
  }

  const last = days[days.length - 1] || { nutrition: 0, steps: 0, training: 0, improved: false, score: 0, gain: 0 };
  return {
    lp: Math.round(lp),
    rank: rankFromLP(lp),
    streak,
    today: {
      nutrition: last.date === todayStr ? last.nutrition : 0,
      steps: last.date === todayStr ? last.steps : 0,
      training: last.date === todayStr ? last.training : 0,
      improved: last.date === todayStr ? last.improved : false,
      score: last.date === todayStr ? last.score : 0,
      lp: last.date === todayStr ? last.gain : 0,
    },
    season,
    peak: Math.round(peak),
    lastSeasonPeak: Math.round(lastSeasonPeak),
    days,
  };
}

// LP restant avant le rang suivant (null si Onyx).
export function lpToNextRank(lp) {
  if (lp >= ONYX_LP) return null;
  const nextDiv = (Math.floor(lp / DIV_LP) + 1) * DIV_LP;
  return Math.max(0, Math.ceil(nextDiv - lp));
}
