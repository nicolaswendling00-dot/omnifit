// OmniFit / GymBruh — Système de rangs & calcul de LP
// Rangs (identifiants historiques → noms affichés) : bronze Moon, gold Planet,
// plat Gas Giant, diam Comet, emer Star, saph Nebula, ruby Pulsar, onyx Black Hole (ultime).

import { cosmicBadge } from './cosmicBadge.js';

export const RANK_ORDER = ['bronze', 'gold', 'plat', 'diam', 'emer', 'saph', 'ruby', 'onyx'];

export const RANK_META = {
  bronze: { name: 'Moon', color: '#D68A4E' },
  gold: { name: 'Planet', color: '#F5C542' },
  plat: { name: 'Gas Giant', color: '#C7C7D0' },
  diam: { name: 'Comet', color: '#7FD8F5' },
  emer: { name: 'Star', color: '#34E884' },
  saph: { name: 'Nebula', color: '#3E7EF0' },
  ruby: { name: 'Pulsar', color: '#F0404E' },
  onyx: { name: 'Black Hole', color: '#9F7CFF' },
};

//   V_relatif  = (volume de la séance / volume moyen historique) × 100  (100 = séance "normale")
//   ΔP_relatif = % d'augmentation du 1RM estimé vs record perso (ex : +5 % → 5 ; 0 si pas de record)
//   α, β évoluent avec le rang.
//
//  Cibles de calibrage (volume normal = V_relatif 100, record = ΔP_relatif 5) :
//   - Bronze/Or        : ~25 LP en volume normal (α·100 = 25 → α = 0.25).
//   - Platine/Diamant  : ~15 normal, ~25 avec record  → α = 0.15 ; 15 + β·5 = 25 → β = 2.0.
//   - Émeraude/Saphir  : ~8 normal, ~20 avec record   → α = 0.08 ; 8 + β·5 = 20 → β = 2.4.
//   - Rubis            : ~3 normal, ~15 avec record    → α = 0.03 ; 3 + β·5 = 15 → β = 2.4.
//   - Onyx             : α = 0 (le volume ne rapporte plus rien) ; seule la perf compte, β = 2.6.
//  Conséquence : plus on monte, plus il faut battre ses records ; l'assiduité seule plafonne.
// ============================================================
export const COEFFS = {
  bronze: { a: 0.25, b: 1.5 },
  gold: { a: 0.25, b: 1.5 },
  plat: { a: 0.15, b: 2.0 },
  diam: { a: 0.15, b: 2.0 },
  emer: { a: 0.08, b: 2.4 },
  saph: { a: 0.08, b: 2.4 },
  ruby: { a: 0.03, b: 2.4 },
  onyx: { a: 0.00, b: 2.6 },
};

// Gain de LP d'une séance. vRel = volume relatif (100 = normal), dPRel = % de hausse du 1RM.
export function lpGain(vRel, dPRel, rankId) {
  const c = COEFFS[rankId] || COEFFS.bronze;
  const gain = c.a * Math.max(0, vRel) + c.b * Math.max(0, dPRel);
  return Math.max(0, Math.round(gain));
}

// ============================================================
//  SEUILS DE RANG
//  3 divisions par rang (III → II → I), 100 LP par division ⇒ 300 LP par rang.
//  Bronze..Rubis = 7 rangs × 300 = 2100 LP pour atteindre Onyx (terminal, sans division).
// ============================================================
export const DIV_LP = 100;
export const ONYX_LP = 2100;

export function rankFromLP(totalLp) {
  const total = Math.max(0, Math.round(totalLp || 0));
  if (total >= ONYX_LP) {
    return { id: 'onyx', name: RANK_META.onyx.name, color: RANK_META.onyx.color, division: null, lp: total - ONYX_LP, lpNeeded: null, total };
  }
  const ri = Math.floor(total / (DIV_LP * 3)); // 0..6
  const inRank = total - ri * DIV_LP * 3;
  const division = ['III', 'II', 'I'][Math.floor(inRank / DIV_LP)];
  const id = RANK_ORDER[ri];
  return { id, name: RANK_META[id].name, color: RANK_META[id].color, division, lp: inRank % DIV_LP, lpNeeded: DIV_LP, total };
}

// Libellé des LP : toujours le TOTAL cumulé, jamais les LP dans la division.
// Diamant II à 10 LP s'affiche « 1010 / 1100 LP » (le palier suivant), pas
// « 10 / 100 LP ». Onyx, sans palier suivant : « 2140 LP ».
export function lpLabel(rank) {
  if (!rank) return '0 LP';
  const total = rank.total ?? rank.lp;
  return rank.lpNeeded ? `${total} / ${total - rank.lp + rank.lpNeeded} LP` : `${total} LP`;
}

// 1RM estimé (Epley)
function ormOfSets(sets) {
  let orm = 0;
  for (const s of sets) if (s.weight && s.reps) orm = Math.max(orm, s.weight * (1 + s.reps / 30));
  return orm;
}

// ============================================================
//  STANDARDS StrengthLevel (chargés depuis standards.json au boot)
//  Sert au "raccourci Onyx" : 1RM séance ≥ Élite × 1.15 × poids_de_corps → Onyx direct.
// ============================================================
let STANDARDS = null;
const STANDARDS_LS_KEY = 'omnifit_standards_v1';
// Au chargement du module, on tente de récupérer les standards mis en cache lors
// d'un précédent lancement. Ainsi ils sont disponibles SYNCHRONEMENT dès le boot
// (avant tout rendu), ce qui évite que les rangs soient calculés sans référence
// tant que standards.json n'est pas re-téléchargé (source du « rang qui change »
// à la reprise d'une séance).
try {
  const cached = (typeof localStorage !== 'undefined') && localStorage.getItem(STANDARDS_LS_KEY);
  if (cached) STANDARDS = JSON.parse(cached);
} catch (_) { /* cache illisible : on ignore */ }

export function setStandards(obj) {
  STANDARDS = obj || null;
  try {
    if (typeof localStorage !== 'undefined') {
      if (obj) localStorage.setItem(STANDARDS_LS_KEY, JSON.stringify(obj));
    }
  } catch (_) { /* quota/permissions : on ignore, le fetch refera le travail */ }
}
export function getStandards() { return STANDARDS; }

// Standard "Élite" (ratio 1RM/poids) d'un exo, résolu via l'héritage parent-enfant.
export function eliteStandard(exerciseId, standards = STANDARDS, _seen = {}) {
  if (!standards || _seen[exerciseId]) return null;
  _seen[exerciseId] = true;
  const d = standards.standards && standards.standards[exerciseId];
  if (d && d.elite != null) return d.elite;
  const inh = standards.inheritance && standards.inheritance[exerciseId];
  if (inh) {
    const parent = eliteStandard(inh.parent, standards, _seen);
    return parent != null ? parent * inh.muscle_ratio : null;
  }
  return null;
}

// Marge de sécurité du raccourci Onyx : le 1RM doit dépasser l'Élite de 40 % (pas 15 %).
// "Augmenter la difficulté d'Onyx" : un rang aussi élitiste doit rester rare.
const ONYX_OVERRIDE_MULT = 1.4;
// Plancher de fiabilité : sous ce ratio (mouvements d'isolation légers — élévations,
// oiseau, etc.), le standard "Élite" en % du poids de corps devient minuscule (parfois
// <25 kg), donc trivialement franchissable et peu significatif. On ignore l'ancrage
// sur les standards pour ces exercices : seule la progression normale (V/ΔP) s'applique.
const ONYX_OVERRIDE_MIN_RATIO = 0.6;

// Résout les 5 niveaux (Débutant→Élite) d'un exo via l'héritage parent-enfant
// (contrairement à eliteStandard, qui ne renvoie que le niveau Élite).
export function resolveStandardLevels(exerciseId, standards, _seen = {}) {
  if (!standards || _seen[exerciseId]) return null;
  _seen[exerciseId] = true;
  const d = standards.standards && standards.standards[exerciseId];
  if (d) return d;
  const inh = standards.inheritance && standards.inheritance[exerciseId];
  if (inh) {
    const parent = resolveStandardLevels(inh.parent, standards, _seen);
    if (!parent) return null;
    const out = {};
    for (const lvl of Object.keys(parent)) out[lvl] = parent[lvl] * inh.muscle_ratio;
    return out;
  }
  return null;
}

// ============================================================
//  CORRESPONDANCE CONTINUE standard StrengthLevel <-> rang de l'app
//  Le rang doit refléter le niveau ACTUEL (pas seulement l'historique de séances) :
//  un utilisateur déjà "Avancé" sur un exercice doit voir un rang cohérent dès sa
//  première séance loggée, pas grimper lentement depuis Bronze. On ancre chaque
//  palier StrengthLevel sur un jalon de LP, puis on interpole entre les jalons.
//  Au-delà d'Élite, on rejoint le seuil Onyx existant (Élite × 1.4 → 2100 LP).
// ============================================================
const STANDARD_LP_ANCHORS = { beginner: 300, novice: 600, intermediate: 1050, advanced: 1500, elite: 2000 };

function interpLP(ratio, points) {
  if (ratio <= points[0].ratio) return points[0].lp;
  for (let i = 1; i < points.length; i++) {
    if (ratio <= points[i].ratio) {
      const p0 = points[i - 1]; const p1 = points[i];
      const t = (ratio - p0.ratio) / ((p1.ratio - p0.ratio) || 1);
      return p0.lp + t * (p1.lp - p0.lp);
    }
  }
  return points[points.length - 1].lp;
}

// LP "plancher" dérivé du niveau StrengthLevel actuel d'un exo (null si non applicable).
export function standardBasedLP(exerciseId, bestOrm, bodyweight, standards) {
  if (!bodyweight || !standards) return null;
  const levels = resolveStandardLevels(exerciseId, standards);
  if (!levels || levels.elite < ONYX_OVERRIDE_MIN_RATIO) return null;
  const ratio = bestOrm / bodyweight;
  const points = [
    { ratio: 0, lp: 0 },
    { ratio: levels.beginner, lp: STANDARD_LP_ANCHORS.beginner },
    { ratio: levels.novice, lp: STANDARD_LP_ANCHORS.novice },
    { ratio: levels.intermediate, lp: STANDARD_LP_ANCHORS.intermediate },
    { ratio: levels.advanced, lp: STANDARD_LP_ANCHORS.advanced },
    { ratio: levels.elite, lp: STANDARD_LP_ANCHORS.elite },
    { ratio: levels.elite * ONYX_OVERRIDE_MULT, lp: ONYX_LP },
  ];
  return interpLP(ratio, points);
}

// ============================================================
//  PERCENTILE PARMI LES PRATIQUANTS
//  Les niveaux StrengthLevel sont définis par la part des pratiquants qu'ils
//  dépassent : Débutant = plus fort que 5 % d'entre eux, Novice 20 %,
//  Intermédiaire 50 %, Avancé 80 %, Élite 95 %. On interpole entre ces
//  repères (en ratio 1RM / poids de corps) pour situer n'importe quelle série.
//  Au-delà d'Élite, la courbe tend vers 100 % sans l'atteindre : à 1,4 × le
//  standard Élite, on est autour du top 0,5 %.
// ============================================================
export const LEVEL_PERCENTILE = { beginner: 5, novice: 20, intermediate: 50, advanced: 80, elite: 95 };
const PERCENTILE_LEVELS = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'];

export function percentileFromRatio(ratio, levels) {
  if (!levels || !(ratio > 0)) return 0;
  const pts = [{ r: 0, p: 0 }, ...PERCENTILE_LEVELS.map((l) => ({ r: levels[l], p: LEVEL_PERCENTILE[l] }))];
  for (let i = 1; i < pts.length; i++) {
    if (ratio <= pts[i].r) {
      const a = pts[i - 1]; const b = pts[i];
      return a.p + ((ratio - a.r) / ((b.r - a.r) || 1)) * (b.p - a.p);
    }
  }
  const over = ratio / levels.elite - 1;
  return Math.min(99.9, 95 + 4.9 * (1 - Math.exp(-6.26 * over)));
}

// Où se situe une série (poids × reps) parmi les pratiquants ?
//   ref : { refId, coef } pour un exercice classé via un mouvement de
//         référence (les kilos sont convertis en équivalent sur ce dernier).
// → { orm, percentile, top, level, hasStandard }
//   percentile = part des pratiquants dépassés ; top = 100 − percentile.
export function liftPercentile(exerciseId, weight, reps, bodyweight, standards = STANDARDS, ref = null) {
  const orm = weight > 0 && reps > 0 ? weight * (1 + reps / 30) : 0;
  const stdId = ref && ref.refId ? ref.refId : exerciseId;
  const stdOrm = ref && ref.coef > 0 ? orm / ref.coef : orm;
  const levels = resolveStandardLevels(stdId, standards);
  if (!levels || !bodyweight || !orm) {
    return { orm: Math.round(orm), percentile: null, top: null, level: null, hasStandard: !!levels };
  }
  const ratio = stdOrm / bodyweight;
  const percentile = percentileFromRatio(ratio, levels);
  let level = null;
  for (const l of PERCENTILE_LEVELS) if (ratio >= levels[l]) level = l;
  // Arrondi lisible : au pour-cent près, au dixième dans le haut du tableau.
  const rawTop = 100 - percentile;
  const top = rawTop < 1 ? Math.max(0.1, Math.round(rawTop * 10) / 10) : Math.round(rawTop);
  return { orm: Math.round(orm), percentile, top, level, hasStandard: true };
}

// Résout le poids de corps EFFECTIF à une date donnée à partir du journal de pesées :
// la pesée la plus récente à cette date ou avant ; sinon la plus ancienne connue ;
// sinon le poids statique fourni en repli. Ainsi, mettre à jour son poids actuel
// NE CHANGE PAS l'interprétation des séances passées (chacune garde "son" poids).
function bodyweightAt(date, weightsSorted, fallback) {
  if (!weightsSorted || !weightsSorted.length) return fallback;
  let best = null;
  for (const w of weightsSorted) {
    if (w.date <= date) best = w.value;
    else break;
  }
  return best != null ? best : weightsSorted[0].value;
}

// Cumul du LP de TOUS les exos en un passage chronologique.
// opts : { bodyweight, weights, standards }
//   - weights (recommandé) : journal des pesées [{date, value}] — chaque séance utilise
//     le poids réel enregistré à SA date, pas le poids actuel. Ainsi, changer son poids
//     aujourd'hui ne modifie jamais le rang calculé pour les séances passées.
//   - bodyweight : poids statique de repli, utilisé si `weights` est vide/absent
//     (comportement plus simple, mais qui peut réinterpréter tout l'historique si le
//     poids change — à éviter si un journal de pesées existe).
// Retourne { exerciseId: totalLp }.
export function computeExerciseLP(workouts, opts = {}) {
  return computeExerciseLPDetailed(workouts, opts).totals;
}

// Variante détaillée : renvoie aussi, pour CHAQUE (séance, exo), le LP gagné et un
// éventuel changement de rang — utilisé pour le récapitulatif de fin de séance.
// { totals: {id: lp}, perWorkout: { [workoutId]: [{exerciseId, gain, before, after}] } }
export function computeExerciseLPDetailed(workouts, opts = {}) {
  const std = opts.standards || STANDARDS;
  const weightsSorted = opts.weights ? [...opts.weights].sort((a, b) => a.date.localeCompare(b.date)) : null;
  const staticBw = opts.bodyweight;
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const state = {}; // id -> { lp, bestOrm, volSum, volCount }
  const perWorkout = {};
  for (const w of sorted) {
    const bw = weightsSorted && weightsSorted.length ? bodyweightAt(w.date, weightsSorted, staticBw) : staticBw;
    const rows = [];
    for (const wx of w.exercises) {
      if (!wx.sets || !wx.sets.length) continue;
      const st = state[wx.exerciseId] || (state[wx.exerciseId] = { lp: 0, bestOrm: 0, volSum: 0, volCount: 0 });
      const before = st.lp;
      const V = wx.sets.reduce((acc, s) => acc + (s.weight || 0) * (s.reps || 0), 0);
      const orm = ormOfSets(wx.sets);
      // Volume relatif vs moyenne historique (avant cette séance)
      const avg = st.volCount > 0 ? st.volSum / st.volCount : V;
      const vRel = avg > 0 ? (V / avg) * 100 : 100;
      // % de hausse du 1RM vs record perso
      const dPRel = st.bestOrm > 0 ? Math.max(0, ((orm - st.bestOrm) / st.bestOrm) * 100) : 0;

      const sessionGain = lpGain(vRel, dPRel, rankFromLP(st.lp).id);
      st.bestOrm = Math.max(st.bestOrm, orm);
      let next = Math.max(0, st.lp + sessionGain);

      // Plancher StrengthLevel : le rang reflète aussi le niveau ACTUEL (pas seulement
      // l'historique de séances) — un exo déjà "Avancé/Élite" n'a pas besoin de des
      // dizaines de séances pour que le rang le reconnaisse.
      // Exercice custom rattaché à une référence : on convertit sa performance en
      // équivalent sur l'exercice de référence (coef 0.5 → 40 kg valent 80 kg),
      // puis on applique les standards de CE dernier.
      const ref = opts.customRefs && opts.customRefs[wx.exerciseId];
      const floorId = ref && ref.refId ? ref.refId : wx.exerciseId;
      const floorOrm = ref && ref.coef > 0 ? st.bestOrm / ref.coef : st.bestOrm;
      const floor = bw ? standardBasedLP(floorId, floorOrm, bw, std) : null;
      if (floor != null) next = Math.max(next, floor);

      st.volSum += V; st.volCount += 1;
      st.lp = next;
      rows.push({ exerciseId: wx.exerciseId, gain: Math.round(next - before), before: Math.round(before), after: Math.round(next) });
    }
    if (rows.length) perWorkout[w.id] = rows;
  }
  const totals = {};
  for (const [id, st] of Object.entries(state)) totals[id] = Math.round(st.lp);
  return { totals, perWorkout };
}

// ============================================================
//  BADGES : un objet céleste par rang (utils/cosmicBadge.js)
// ============================================================
export function rankBadge(rankId, size = 120) {
  const id = RANK_META[rankId] ? rankId : 'bronze';
  return cosmicBadge(id, RANK_ORDER.indexOf(id), RANK_META[id].color, size);
}
