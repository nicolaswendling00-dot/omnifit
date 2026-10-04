// OmniFit — Carte du corps (face + dos), muscles colorés selon l'intensité.
//
// Le dessin n'est défini qu'UNE fois, dans un « sprite » SVG caché injecté
// dans la page ; chaque carte n'est ensuite qu'une poignée de <use> qui
// reprennent ces formes avec leur propre couleur. Un calendrier affiche des
// centaines de silhouettes : sans ce partage, il faudrait recréer des milliers
// de tracés.
//
// Repère : chaque silhouette tient dans 120 × 306, axe de symétrie en x = 60.
// Les proportions reprennent la maquette de référence (épaules larges, taille
// fine, jambes longues). Les formes ne sont dessinées que pour la moitié
// DROITE puis recopiées en miroir.
//
// Rendu en couches, comme la maquette :
//   1. silhouette pleine avec un fin contour sombre (deux passes de trait) ;
//   2. zones claires (visage, mains, genoux, chevilles, pieds) ;
//   3. muscles, séparés par des liserés clairs ;
//   4. liserés clairs par-dessus, tête ronde et uniforme.

const W = 120;
const H = 306;
// Les mains, écartées, dépassent de l'axe de 65 unités : marge de chaque côté
const PAD = 7;
const FIG_W = W + 2 * PAD;

const rr = (x, y, w, h, r) => `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;

// ---------------------------------------------------------------- FACE
// Repères relevés sur la maquette (unités du viewBox, axe en x = 60) :
//   cheveux 3–30 · visage 19–51 · cou 46–60 · deltoïde 101 à y 73
//   coude y 112 · poignet y 137 · main 137–159 (écartée) · taille x 79 à y 122
//   entrejambe y 149 · genou 206–218 · mollet 218–271 · cheville 271–288 · pied 288–304
const ARM_LIGHT = [
  'M92.5,113 L104.5,114 C105.5,115.5 106,116.5 106.2,117.6 L94,117.6 C93.2,116.2 92.8,114.6 92.5,113 Z', // pli du coude
  'M104.5,137.6 L116.4,138 C119.8,140.6 123.2,144.2 124.6,147.6 C124.4,150.2 122.6,150.8 121,149.6 C121.4,152.6 121,155.6 119.4,157.8 C116.8,159.6 112.4,159.6 109.8,157.4 C107.2,154.8 105.4,149.8 104.5,144 Z', // main (pouce écarté)
];
const ARM_FOREARM = [
  'M94,117.6 C100,116.6 104,121 106,127 C107.4,131 108.4,134.6 109,137.6 L104.5,137.6 C101,131 97,124 94,117.6 Z',
  'M100,117.6 L106.2,117.6 C110.2,121.2 113.6,127 115,133 C115.8,135 116.2,136.6 116.2,138 L109,137.6 C108.4,134.6 107.4,131 106,127 C104.6,123.2 102.6,120 100,117.6 Z',
];
const ARM_BASE = 'M87,86 L100,72 C106,82 108.4,96 108,108 L108.6,116 C112.8,122 116.4,130 116.4,138 L104.5,138 C99,129 94,121 92.4,113 C89.4,104 87,95 87,86 Z';

const FRONT = {
  traps: ['M67.6,53 C73,58 82,60.6 92,62.6 L80,65 C75,63 70.6,60 67.6,57 Z'],
  frontDelts: ['M80,64.6 C86,62 91.6,62.6 94.6,66 C96,73 94.6,81 91.6,88 C89,82 85,75.6 80.6,70.6 Z'],
  sideDelts: ['M92,62.6 C98.6,64.6 102,69 102,76.6 C102,82.6 99.6,87.6 96,90.6 L91.6,88 C94.6,81 96,73 94.6,66 C93.8,64.6 93,63.4 92,62.6 Z'],
  chest: [
    'M60.6,60.6 L80,64.6 C85.6,70.6 90.6,79 91.6,87.6 C88,92 80.6,94.6 72,94.6 C66,94.6 62,93 60.6,90.6 Z',
  ],
  biceps: ['M87.6,86.4 C94,84.4 100,89 101.4,97 C102.4,104 100.6,110 97.6,113 L92.6,113 C89.6,105 87.6,96 87.6,86.4 Z'],
  triceps: ['M101.4,89.6 C105.4,92 107.8,97.6 107.6,104.4 C107.4,109 106.4,112 104.6,114 L100.2,113.6 C102.6,108 103.4,99.6 101.4,89.6 Z'],
  forearms: ARM_FOREARM,
  abs: [
    rr(61, 96.2, 7.9, 10.8, 2.6), rr(61, 108, 7.9, 10.8, 2.6), rr(61, 119.8, 7.9, 10.8, 2.6),
    'M61,131.6 H68.9 C69.5,137 68.5,143.8 65,148.6 C62.8,149.8 61,149.2 61,146.8 Z',
  ],
  obliques: ['M70.2,95.6 C77.4,95.6 82,100 82.6,108 C83,120 81.6,131 78,140 L70.4,143.6 C71.4,131 71.4,108 70.2,95.6 Z'],
  quads: [
    'M82,146 C89,151 93.6,163 93.6,177 C93.6,191 90,201 86,208 L82,207 C84.6,190 85,168 82,146 Z',
    'M71,151 C75,148 79,146.6 82,146 C85,168 84.6,190 82,207 L75,205 C72,190 70,170 71,151 Z',
    'M67,186 C72,189 74.6,196 75,205 L70,207.6 C67,202 66,194 67,186 Z',
  ],
  adductors: ['M61.4,151.6 C65,151 68.6,151 71,151 C70,170 69.6,179 67,186 C66,194 66.6,201 68,206 C63.6,192 61.4,172 61.4,151.6 Z'],
  calves: [
    'M67.6,219.6 C71.6,218.6 74.6,222 74.8,230 C75,245 73.6,259 71.6,270 L68.6,270 C66.6,258 66,234 67.6,219.6 Z',
    'M77.6,219 C82.6,219.6 87,227 87.6,236 C88,249 85,261 81,271 L77,271 C78.6,257 79,234 77.6,219 Z',
  ],
};
// Zones qui ne sont pas des muscles (cou, flancs, bras, cuisses sous les
// muscles) : peintes en BLANC, comme la maquette. Elles remplissent la
// silhouette sous les muscles ; seuls de fins liserés restent visibles.
const FRONT_NEUTRAL = [
  'M53,46 L67,46 L68,57 L60.6,60 L52,57 Z',
  'M60.6,58 L80,64 C90,74 92,85 86,96 C84,110 82,125 84,140 C88,144 90,147 89,150 L60.6,152 Z',
  'M61,150 C70,146 82,143 89,146 C95,160 95,190 87,209 L66,210 C62,195 61,170 61,150 Z', // cuisse
  ARM_BASE,
];
const FRONT_LIGHT = [
  ...ARM_LIGHT,
  'M68,206 L70,207.6 L75,205 L82,207 L86,208 C86.6,212 86,215 85,218 C82,218.6 79,218.6 77.6,219 L74.8,222 C72.6,218.6 70,218.2 67.6,219.6 C67,215 67,210 68,206 Z', // genou
  'M74.8,226 C75.8,224 76.8,221.6 77.6,219 C79,234 78.6,257 77,271 L71.6,270 C73.6,259 75,245 74.8,230 Z', // tibia
  'M68.6,270 L81,271 C80.6,277 80.6,283 81,288 L70.6,288 C70,282 69.6,276 68.6,270 Z', // cheville
  'M70.6,288 L81,288 C86,291 93,294.6 96.6,297.6 C98.6,300.6 96,303.8 91,303.8 L70,303.8 C68.6,298.6 69,293 70.6,288 Z', // pied, pointe vers l'extérieur
];
const HEAD = 'M60,10 C68.6,10 74.6,17.6 74.6,27.6 C74.6,37.6 68.6,45.6 60,45.6 C51.4,45.6 45.4,37.6 45.4,27.6 C45.4,17.6 51.4,10 60,10 Z';

// ---------------------------------------------------------------- DOS
const BACK = {
  traps: ['M60.6,47 L67,47.6 C69,53.6 77,58.6 92,62.6 C83.6,65.6 75.6,68.6 70,71 L65,88 L60.6,98 Z'],
  rearDelts: [
    'M80.6,64.6 C88.6,61.6 95.6,63 99,68 C100,75 98.6,82 95.6,88 C92,80.6 86.6,72.6 79.6,67.6 Z',
    'M70.6,75 C76.6,69.6 84.6,69.6 90.6,76 C91.6,83 88.6,89 83,91 C77.6,92 73,88.6 71,84 Z', // sous-épineux, petit rond
  ],
  sideDelts: ['M96,63 C100.6,65.6 102.6,70 102.6,77 C102.6,83 100,88 96.6,91 L95.6,88 C98.6,82 100,75 99,68 C98.3,66 97.3,64.4 96,63 Z'],
  rhomboids: ['M65,88 L70,71 C70.4,72.6 70.6,73.8 70.6,75 L71,84 C70,88.6 67.6,92.6 63.6,95 Z'],
  lats: ['M71,92 C78,93 86,91.6 92,87 C94,97 92.6,107 88,114 C85,118 82,119 79,115.6 C73,111 66,107 60.6,103 L63.6,95 C67,93.6 69.4,92.8 71,92 Z'],
  lowerback: ['M60.6,103 C66,107 73,111 79,115.6 C77,124 72,134 66,141 L60.6,147 Z'],
  triceps: [
    'M87.6,87 C95,85 101.6,91 102.6,99 C103.2,105.6 101.6,110.6 98.6,113 L92.6,113 C89.6,105 87.6,96 87.6,87 Z',
    'M101.6,90 C105.6,92.6 107.8,98 107.6,104.6 C107.4,109 106.4,112 104.6,114 L100.2,113.6 C102.6,108 103,99 101.6,90 Z',
  ],
  forearms: ARM_FOREARM,
  glutes: ['M60.6,140 C66,133.5 76,131.5 84,134 C89.6,138.5 90.2,148 85.4,153.6 C79,157.8 67.6,157.4 60.6,153 Z'],
  hamstrings: [
    'M62,155 C64.6,154 67.6,154.6 70,155.6 C70.2,173 69.6,190 68.2,206 L65.2,206 C62.8,190 61.8,172 62,155 Z',
    'M70,155.6 C74,154.6 78,154.6 81,155.8 C81.2,173 80,190 77.8,206 L68.2,206 C69.6,190 70.2,173 70,155.6 Z',
    'M81,155.8 C87.6,155.6 92.6,160 92.6,170 C92.6,183 88.6,196 84,206 L77.8,206 C80,190 81.2,173 81,155.8 Z',
  ],
  adductors: ['M60.8,153 C61.2,153.8 61.6,154.4 62,155 C61.8,172 62.8,190 65.2,206 C62,192 60.6,172 60.8,153 Z'],
  calves: [
    'M65.8,219 C70.6,217 74.6,221 75,229 C75.3,242 73.6,253 70.6,261 L66.8,261 C64.6,250 64,232 65.8,219 Z',
    'M75,221 C80,217 85.6,220.6 87,229 C88.6,242 84.6,253 79.6,261 L72,261 C74.6,252 75.3,239 75,221 Z',
  ],
};
const BACK_NEUTRAL = [
  'M60.6,46 L80,64 C90,74 93,85 89,96 C86,110 85,125 89,131 C93,137 93,146 90,154 L60.6,155 Z',
  'M60.6,152 C70,153 84,152 92,157 C95,175 91,195 85,208 L64,208 C61,190 60.4,170 60.6,152 Z', // cuisse
  ARM_BASE,
];
const BACK_LIGHT = [
  ...ARM_LIGHT,
  'M65.2,206 L84,206 C85.6,210 85.8,214 85,218 C82,217 78.6,217.6 75.6,219.6 C74.6,218 72,217 70,217 C68.6,217.3 67,218 65.8,219 C65,215 64.8,210 65.2,206 Z', // creux poplité
  'M66.8,261 L79.6,261 C78,268 77.6,276 78.6,288 L70,288 C70,278 68.6,268 66.8,261 Z', // tendon d'Achille
  'M70,288 L78.6,288 C82,292 86,296 86.6,299.6 C86.6,302.6 83.6,303.8 80,303.8 L69.6,303.8 C68.6,298.6 68.6,293 70,288 Z', // talon
];

const MIRROR = `matrix(-1 0 0 1 ${W} 0)`;
const both = (d) => `<path d="${d}"/><path d="${d}" transform="${MIRROR}"/>`;

let spriteReady = false;
// Injecte une seule fois le sprite dans la page (idempotent).
export function ensureBodySprite(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc || spriteReady || doc.getElementById('bm-sprite')) { spriteReady = true; return; }
  const defs = [];
  const views = [
    ['f', FRONT, FRONT_NEUTRAL, FRONT_LIGHT, '', `<path d="${HEAD}"/>`],
    ['b', BACK, BACK_NEUTRAL, BACK_LIGHT, '', `<path d="${HEAD}"/>`],
  ];
  for (const [v, map, neutral, light, , face] of views) {
    for (const [m, paths] of Object.entries(map)) defs.push(`<g id="bm-${v}-${m}">${paths.map(both).join('')}</g>`);
    defs.push(`<g id="bm-${v}-neutral">${neutral.map(both).join('')}</g>`);
    defs.push(`<g id="bm-${v}-light">${light.map(both).join('')}</g>`);
    if (face) defs.push(`<g id="bm-${v}-face">${face}</g>`);
    // Silhouette pleine : toutes les formes réunies, utilisées avec un trait
    // épais pour combler les interstices et tracer le contour d'un seul tenant.
    defs.push(`<g id="bm-${v}-sil">${Object.values(map).flat().map(both).join('')}${neutral.map(both).join('')}${light.map(both).join('')}${face}</g>`);
  }
  const holder = doc.createElement('div');
  holder.innerHTML = `<svg id="bm-sprite" xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>${defs.join('')}</defs></svg>`;
  doc.body.appendChild(holder.firstElementChild);
  spriteReady = true;
}

export const FRONT_MUSCLES = Object.keys(FRONT);
export const BACK_MUSCLES = Object.keys(BACK);

// Dégradé d'intensité : bleu clair (peu sollicité) → bleu foncé (muscle le
// plus travaillé).
const STOPS = [[0, [158, 182, 246]], [0.55, [92, 124, 250]], [1, [52, 66, 214]]];
export function intensityColor(t) {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1]; const [b, cb] = STOPS[i];
      const k = (x - a) / ((b - a) || 1);
      return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * k)).join(',')})`;
    }
  }
  return `rgb(${STOPS[STOPS.length - 1][1].join(',')})`;
}
export const INTENSITY_GRADIENT = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map(intensityColor).join(', ')})`;

// En dessous de ce seuil, un muscle n'est pas coloré (sollicitation anecdotique).
const MIN_T = 0.06;

function figure(v, muscles, intensity, x, small) {
  // Sur les petites cartes (calendrier), les traits sont épaissis en
  // proportion pour rester lisibles.
  const k = small ? 1.6 : 1;
  const colors = muscles.map((m) => {
    const t = intensity[m] || 0;
    return [m, t >= MIN_T ? intensityColor(t) : 'var(--body-muscle)'];
  });
  const fills = colors.map(([m, c]) => `<use href="#bm-${v}-${m}" fill="${c}" stroke="${c}"/>`).join('');
  const lines = muscles.map((m) => `<use href="#bm-${v}-${m}"/>`).join('');
  return `<g transform="translate(${x + PAD} 0)" stroke-linejoin="round">
    <use href="#bm-${v}-sil" fill="var(--body-muscle)" stroke="var(--body-outline)" stroke-width="${(4.6 * k).toFixed(1)}"/>
    <use href="#bm-${v}-sil" fill="var(--body-muscle)" stroke="var(--body-muscle)" stroke-width="${(3.2 * k).toFixed(1)}"/>
    <g stroke="var(--body-line)" stroke-width="${(1.1 * k).toFixed(2)}">
      <use href="#bm-${v}-neutral" fill="var(--body-skin)"/>
      <use href="#bm-${v}-light" fill="var(--body-skin)"/>
      <use href="#bm-${v}-face" fill="var(--body-skin)"/>
    </g>
    <g stroke-width="${(1.6 * k).toFixed(2)}">${fills}</g>
    <g fill="none" stroke="var(--body-line)" stroke-width="${(0.9 * k).toFixed(2)}">${lines}</g>
  </g>`;
}

// Carte complète, face à gauche et dos à droite.
//   intensity : { muscleId: 0..1 }
//   opts.size : hauteur en px (la largeur suit) ; opts.cls : classe CSS
export function bodyMapSVG(intensity = {}, opts = {}) {
  ensureBodySprite();
  const h = opts.size || 200;
  const gap = opts.gap ?? 4;
  const small = h < 110;
  const vbW = FIG_W * 2 + gap;
  const w = Math.round((h * vbW) / H);
  return `<svg class="body-map ${opts.cls || ''}" viewBox="-3 -3 ${vbW + 6} ${H + 6}" width="${w}" height="${h}" role="img" aria-label="${opts.label || 'Muscles sollicités'}">
    ${figure('f', FRONT_MUSCLES, intensity, 0, small)}
    ${figure('b', BACK_MUSCLES, intensity, FIG_W + gap, small)}
  </svg>`;
}
