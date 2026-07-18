// OmniFit / GymBruh — Système de rangs & calcul de LP
// Rangs : Bronze → Or → Platine → Diamant → Émeraude → Saphir → Rubis → Onyx (ultime).

export const RANK_ORDER = ['bronze', 'gold', 'plat', 'diam', 'emer', 'saph', 'ruby', 'onyx'];

export const RANK_META = {
  bronze: { name: 'Bronze', color: '#D68A4E' },
  gold: { name: 'Or', color: '#F5C542' },
  plat: { name: 'Platine', color: '#C7C7D0' },
  diam: { name: 'Diamant', color: '#7FD8F5' },
  emer: { name: 'Émeraude', color: '#34E884' },
  saph: { name: 'Saphir', color: '#3E7EF0' },
  ruby: { name: 'Rubis', color: '#F0404E' },
  onyx: { name: 'Onyx', color: '#9F7CFF' },
};

// ============================================================
//  ALGORITHME DE GAIN DE LP
//  Gain = α · (V/100) + β · ΔP
//   V  : volume de la séance sur l'exo (Σ poids×reps). Récompense la CONSTANCE.
//   ΔP : gain de perf = hausse du 1RM estimé vs le record précédent (kg). Récompense la PERFORMANCE.
//   α, β : coefficients qui évoluent avec le rang.
//
//  Courbe de difficulté (choix des valeurs) :
//   - Bas niveau (Bronze→Diamant) : α élevé, β faible. Faire du volume suffit à monter vite :
//     un débutant régulier atteint Diamant sans forcément battre des records.
//   - Haut niveau (Émeraude→Rubis) : α chute fortement, β grimpe. Le volume ne rapporte presque
//     plus rien ; il faut battre ses 1RM pour continuer à gagner du LP.
//   - Onyx : α = 0. La régularité ne rapporte STRICTEMENT rien. Seule la performance pure
//     (nouveaux records) fait gagner du LP → rang réservé à l'élite.
// ============================================================
export const COEFFS = {
  //          α (volume)   β (perf)
  bronze: { a: 1.00, b: 0.30 },
  gold: { a: 0.85, b: 0.55 },
  plat: { a: 0.62, b: 0.85 },
  diam: { a: 0.42, b: 1.20 },
  emer: { a: 0.24, b: 1.70 }, // bascule : la perf prend le dessus
  saph: { a: 0.12, b: 2.30 },
  ruby: { a: 0.05, b: 3.00 },
  onyx: { a: 0.00, b: 3.60 }, // volume inutile, seule la perf compte
};

// Gain de LP d'une séance pour un exo donné, selon le rang actuel de l'exo.
// V en kg (volume total), dP en kg (hausse de 1RM ; 0 si pas de record battu).
export function lpGain(V, dP, rankId) {
  const c = COEFFS[rankId] || COEFFS.bronze;
  const gain = c.a * (Math.max(0, V) / 100) + c.b * Math.max(0, dP);
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
    return { id: 'onyx', name: 'Onyx', color: RANK_META.onyx.color, division: null, lp: total - ONYX_LP, lpNeeded: null, total };
  }
  const ri = Math.floor(total / (DIV_LP * 3)); // 0..6
  const inRank = total - ri * DIV_LP * 3;
  const division = ['III', 'II', 'I'][Math.floor(inRank / DIV_LP)];
  const id = RANK_ORDER[ri];
  return { id, name: RANK_META[id].name, color: RANK_META[id].color, division, lp: inRank % DIV_LP, lpNeeded: DIV_LP, total };
}

// 1RM estimé (Epley)
function ormOfSets(sets) {
  let orm = 0;
  for (const s of sets) if (s.weight && s.reps) orm = Math.max(orm, s.weight * (1 + s.reps / 30));
  return orm;
}

// Cumul du LP de TOUS les exos en un seul passage chronologique sur l'historique.
// Retourne { exerciseId: totalLp }. Le rang utilisé à chaque étape dépend du LP déjà cumulé
// sur cet exo (la difficulté augmente au fur et à mesure qu'on monte).
export function computeExerciseLP(workouts) {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const state = {}; // id -> { lp, bestOrm }
  for (const w of sorted) {
    for (const wx of w.exercises) {
      if (!wx.sets || !wx.sets.length) continue;
      const st = state[wx.exerciseId] || (state[wx.exerciseId] = { lp: 0, bestOrm: 0 });
      const V = wx.sets.reduce((acc, s) => acc + (s.weight || 0) * (s.reps || 0), 0);
      const orm = ormOfSets(wx.sets);
      const dP = Math.max(0, orm - st.bestOrm);
      st.bestOrm = Math.max(st.bestOrm, orm);
      st.lp += lpGain(V, dP, rankFromLP(st.lp).id);
    }
  }
  const out = {};
  for (const [id, st] of Object.entries(state)) out[id] = st.lp;
  return out;
}

// ============================================================
//  BADGES SVG (inline)
//  Palettes cohérentes avec la planche. Platine = argent pur (pas de bleu),
//  Diamant = bleu polaire cristallin.
// ============================================================
const PAL = {
  bronze: { plate: ['#F0C79A', '#D68A4E', '#A85E2A', '#5E3316'], edge: ['#FBE3C4', '#C77B3C', '#7A421C'], wing: ['#E0A165', '#B06A30', '#6E3E1C'], gem: ['#FFF3E6', '#FFC98A', '#E07A2E', '#8A3E0E'], glow: '#FFD9A8', istroke: '#5E3316' },
  gold: { plate: ['#FFF0B8', '#FBD250', '#E0A322', '#8A5E12'], edge: ['#FFFBE6', '#E9B534', '#9A6E16'], wing: ['#FFE68A', '#D89E24', '#7E560F'], gem: ['#FFFDF3', '#FFE58A', '#F5B321', '#A9640A'], glow: '#FFF3C0', istroke: '#6E4A0E' },
  plat: { plate: ['#F5F5F8', '#D2D2D9', '#9A9AA6', '#5E5E68'], edge: ['#FFFFFF', '#DADAE2', '#8A8A96'], wing: ['#ECECF2', '#B8B8C2', '#7A7A86'], gem: ['#FFFFFF', '#ECECF2', '#C2C2CC', '#78788A'], glow: '#F2F2F7', istroke: '#4A4A54' },
  diam: { plate: ['#EAF9FF', '#C4ECFA', '#8FD0EC', '#4E90B0'], edge: ['#F5FDFF', '#C0EBFA', '#6EAECC'], wing: ['#DAF4FF', '#A6DCF0', '#5E9EC0'], gem: ['#F2FCFF', '#CBF2FF', '#7FDAF5', '#2E9AC8'], glow: '#DFF6FF', istroke: '#3E7A96' },
  emer: { plate: ['#CFF7DD', '#5FE38A', '#22A855', '#0C5C2E'], edge: ['#E6FFEE', '#48D877', '#137A3E'], wing: ['#A8F0C2', '#3EC46E', '#127A40'], gem: ['#EBFFF2', '#7BFFB0', '#22E86E', '#0A9648'], glow: '#C8FFDC', istroke: '#0C5230' },
  saph: { plate: ['#CFE2FF', '#5B8CE8', '#2A4EC0', '#122A6E'], edge: ['#E6F0FF', '#4E86F0', '#1E3E9E'], wing: ['#B0CCFF', '#3E72E0', '#1E3E9E'], gem: ['#EAF3FF', '#7FB0FF', '#2E6EF5', '#0E3AAE'], glow: '#CFE4FF', istroke: '#14205E' },
  ruby: { plate: ['#FFD0CE', '#F0555E', '#C41E2E', '#6E0E14'], edge: ['#FFE6E4', '#F04452', '#A81422'], wing: ['#FFB0AE', '#E03A48', '#A81422'], gem: ['#FFECEA', '#FF8A7E', '#F0303E', '#A00E1A'], glow: '#FFD4D0', istroke: '#5E0C12' },
  onyx: { plate: ['#33333D', '#141418', '#0A0A0E', '#040406'], edge: ['#00D9FF', '#4AA0FF', '#7C3AED'], wing: ['#2A2A34', '#141418', '#040406'], gem: ['#FFFFFF', '#7FE8FF', '#7C3AED', '#0A0A16'], glow: '#9F7CFF', istroke: '#2A2A34', holo: true },
};

let _uid = 0;

// Badge complet (stats). size ~120.
export function rankBadge(rankId, size = 120) {
  const id = RANK_META[rankId] ? rankId : 'bronze';
  const P = PAL[id];
  const u = 'rb' + (++_uid);
  const rim = P.holo ? `url(#${u}-holo)` : `url(#${u}-edge)`;
  const lin = (n, arr, x2 = 0, y2 = 1) => `<linearGradient id="${u}-${n}" x1="0" y1="0" x2="${x2}" y2="${y2}">${arr.map((c, i) => `<stop offset="${Math.round((i / (arr.length - 1)) * 100)}%" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const feathers = ['M 240 190 Q 312 146 362 116 Q 322 168 250 206 Z', 'M 240 204 Q 308 176 356 150 Q 316 192 250 220 Z', 'M 240 218 Q 302 202 344 186 Q 310 216 250 232 Z', 'M 240 232 Q 296 224 328 216 Q 300 236 250 244 Z'];
  const wingPaths = feathers.map((d) => `<path d="${d}"/>`).join('');
  return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs>
      ${lin('plate', P.plate)}${lin('edge', P.edge, 1, 1)}${lin('wing', P.wing)}
      ${P.holo ? `<linearGradient id="${u}-holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00D9FF"/><stop offset="50%" stop-color="#4AA0FF"/><stop offset="100%" stop-color="#7C3AED"/></linearGradient>` : ''}
      <radialGradient id="${u}-gem" cx="42%" cy="36%" r="72%">${P.gem.map((c, i) => `<stop offset="${[0, 26, 62, 100][i]}%" stop-color="${c}"/>`).join('')}</radialGradient>
      <radialGradient id="${u}-halo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${P.glow}" stop-opacity="0.55"/><stop offset="100%" stop-color="${P.glow}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${u}-gg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${P.glow}" stop-opacity="0.9"/><stop offset="100%" stop-color="${P.glow}" stop-opacity="0"/></radialGradient>
      <filter id="${u}-sh" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.5"/></filter>
      <filter id="${u}-gl" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <ellipse cx="200" cy="206" rx="160" ry="154" fill="url(#${u}-halo)"/>
    <g filter="url(#${u}-sh)" stroke="${P.holo ? '#000' : P.istroke}" stroke-width="1.6" stroke-linejoin="round">
      <g fill="url(#${u}-wing)">${wingPaths}</g>
      <g fill="url(#${u}-wing)" transform="translate(400,0) scale(-1,1)">${wingPaths}</g>
    </g>
    <g fill="url(#${u}-plate)" stroke="${rim}" stroke-width="4" stroke-linejoin="round" filter="url(#${u}-sh)">
      <polygon points="189,109 200,74 211,109"/>
      <polygon points="229,118 244,84 245,125"/>
      <polygon points="171,118 156,84 155,125"/>
    </g>
    <g filter="url(#${u}-sh)">
      <path d="M 200 104 L 298 150 L 298 248 L 200 342 L 102 248 L 102 150 Z" fill="url(#${u}-plate)" stroke="${rim}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M 200 132 L 268 166 L 268 242 L 200 310 L 132 242 L 132 166 Z" fill="url(#${u}-plate)" opacity="0.35" stroke="${P.istroke}" stroke-width="2" stroke-linejoin="round"/>
    </g>
    <circle cx="200" cy="205" r="58" fill="url(#${u}-gg)"/>
    <g filter="url(#${u}-gl)">
      <polygon points="200,160 240,184 240,226 200,250 160,226 160,184" fill="url(#${u}-gem)" stroke="${P.holo ? rim : P.glow}" stroke-width="2.5"/>
      <polygon points="200,160 240,184 200,205 160,184" fill="#FFFFFF" opacity="0.30"/>
    </g>
  </svg>`;
}

// Puce compacte (listes / séance). size ~30.
export function rankChip(rankId, size = 30) {
  const id = RANK_META[rankId] ? rankId : 'bronze';
  const P = PAL[id];
  const u = 'rc' + (++_uid);
  const rim = P.holo ? `url(#${u}-holo)` : P.edge[1];
  return `<svg viewBox="0 0 100 110" width="${size}" height="${size * 1.1}" class="rank-chip-svg">
    <defs>
      <radialGradient id="${u}-gem" cx="42%" cy="36%" r="75%">${P.gem.map((c, i) => `<stop offset="${[0, 26, 62, 100][i]}%" stop-color="${c}"/>`).join('')}</radialGradient>
      <linearGradient id="${u}-pl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${P.plate[0]}"/><stop offset="55%" stop-color="${P.plate[2]}"/><stop offset="100%" stop-color="${P.plate[3]}"/></linearGradient>
      ${P.holo ? `<linearGradient id="${u}-holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00D9FF"/><stop offset="100%" stop-color="#7C3AED"/></linearGradient>` : ''}
    </defs>
    <polygon points="50,6 90,28 90,72 50,104 10,72 10,28" fill="url(#${u}-pl)" stroke="${rim}" stroke-width="4" stroke-linejoin="round"/>
    <polygon points="50,30 72,44 72,66 50,80 28,66 28,44" fill="url(#${u}-gem)" stroke="${P.glow}" stroke-width="1.5"/>
  </svg>`;
}
