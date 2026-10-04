// OmniFit — Carte du corps (face + dos), muscles colorés selon l'intensité.
//
// Le dessin n'est défini qu'UNE fois, dans un « sprite » SVG caché injecté
// dans la page ; chaque carte n'est ensuite qu'une poignée de <use> qui
// reprennent ces formes avec leur propre couleur. Un calendrier affiche des
// dizaines de silhouettes : sans ce partage, il faudrait recréer des milliers
// de tracés.
//
// Repère : chaque silhouette tient dans 100 × 250, axe de symétrie en x = 50.
// Les muscles ne sont dessinés que pour la moitié DROITE (x ≥ 50) puis
// recopiés en miroir.

const rr = (x, y, w, h, r) => `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;

// ---- Vue de FACE ----
const FRONT = {
  traps: ['M55,31 C59,35 65,38 72,40 L60,43 C58,40 56.5,36 55,31 Z'],
  frontDelts: ['M60,43 C66,40.5 72,41 75,45 C76.5,51 75.5,58 73.5,64 C70.5,57 66,50.5 60,46.5 Z'],
  sideDelts: ['M72,40 C79,41 83.5,46 83.5,54 C83.5,60 80.5,66 77,68.5 L73.5,64 C75.5,58 76.5,51 75,45 C74.5,43 73.5,41.5 72,40 Z'],
  chest: ['M50,43 L60,43 C66.5,48 72,55 73.5,64 C71,72.5 64,77.5 55,77.5 C52,77.5 50,76.5 50,74.5 Z'],
  biceps: ['M74.5,68 C80.5,67 83.5,75 83.5,85 C83.5,93 80.5,98 77.5,99 C74.5,93 73.5,84 74.5,68 Z'],
  forearms: ['M76.5,101 C82.5,100.5 87.5,107 88.5,117 C88.5,125 86.5,133 84.5,139 L79.5,139 C78,129 76.5,115 76.5,101 Z'],
  abs: [rr(50.8, 80, 8, 10, 2), rr(50.8, 92, 8, 10, 2), rr(50.8, 104, 8, 10, 2), rr(50.8, 116, 7.5, 14, 2.5)],
  obliques: ['M61,79 C66.5,79.5 70.5,85 70.5,95 C70.5,107 68.5,119 64.5,131 L60.5,131 L60.5,80 Z'],
  quads: [
    'M64.5,136 C70.5,138 73.5,148 73.5,162 C73.5,174 70.5,184 66.5,190 L63.5,188 C66.5,172 66.5,152 64.5,136 Z',
    'M57.5,139 C60,136 62.5,135.5 64.5,136 C66.5,152 66.5,172 63.5,188 L58.5,186 C56.5,172 56.5,154 57.5,139 Z',
    'M54.5,167 C57.5,169 58.5,177 58.5,186 L55.5,188 C53.5,182 53.5,174 54.5,167 Z',
  ],
  adductors: ['M50.5,141 L57.5,139 C56.5,153 56.5,163 54.5,167 C53.5,173 53.5,179 54.5,184 C51.5,172 50.5,158 50.5,141 Z'],
  calves: [
    'M55.5,199 C59.5,197 63.5,198 65.5,202 C66.5,214 65.5,226 62.5,236 L58.5,236 C56.5,224 54.5,210 55.5,199 Z',
  ],
};
// Peau (non musculaire) — face
const FRONT_SKIN = [
  'M40,17 C40,7 44.5,3.5 50,3.5 C55.5,3.5 60,7 60,17 C60,25 56,30.5 50,30.5 C44,30.5 40,25 40,17 Z', // tête
  'M44.5,27 L55.5,27 L57.5,45 L42.5,45 Z', // cou (prolongé sous les pectoraux : pas d'interstice)
  'M50,130 L60.5,130 L64.5,131 C65.5,133.5 65,135 64.5,136 L57.5,139 L50.5,141 L50,141 L49.5,141 L42.5,139 L35.5,136 C35,135 34.5,133.5 35.5,131 L39.5,130 Z', // bassin
  'M79.5,139 L84.5,139 C88,145 88.5,151 86,156 C83,157.5 80,155.5 78.5,150.5 Z', // main droite
  'M20.5,139 L15.5,139 C12,145 11.5,151 14,156 C17,157.5 20,155.5 21.5,150.5 Z', // main gauche
  'M55,188 C58,186.5 62.5,187 66.5,190 C66,194 65.5,197 65.5,202 C63.5,198 59.5,197 55.5,199 C54.5,195 54.5,191 55,188 Z', // genou droit
  'M45,188 C42,186.5 37.5,187 33.5,190 C34,194 34.5,197 34.5,202 C36.5,198 40.5,197 44.5,199 C45.5,195 45.5,191 45,188 Z', // genou gauche
  'M58.5,236 L62.5,236 C65,241 68,245 66.5,247.5 L56.5,247.5 C55.5,243 57,239.5 58.5,236 Z', // pied droit
  'M41.5,236 L37.5,236 C35,241 32,245 33.5,247.5 L43.5,247.5 C44.5,243 43,239.5 41.5,236 Z', // pied gauche
  'M73.5,64 L77,68.5 L74.5,68 Z', // aisselle
  'M26.5,64 L23,68.5 L25.5,68 Z',
  'M77.5,99 L83.5,94 C84.5,97 84.5,99 83.5,101 L76.5,101 Z', // coude
  'M22.5,99 L16.5,94 C15.5,97 15.5,99 16.5,101 L23.5,101 Z',
];

// ---- Vue de DOS ----
const BACK = {
  traps: [
    'M50,27 L54.5,27 C56.5,32.5 62,37 70,40 C64,42 58,44.5 54,46.5 L50,48 Z',
    'M50,48 L54,46.5 L56.5,52 L53.5,63 L50,71 Z',
  ],
  rhomboids: ['M54,46.5 C58,46 62,47.5 64.5,50 L62.5,62 L53.5,63 L56.5,52 Z'],
  rearDelts: [
    'M66,42 C72,40.5 78,41 81,46 C81.5,52 80.5,57 78.5,62 C74.5,56 70.5,50.5 64.5,47.5 Z',
    'M64.5,50 C70.5,48.5 76,52 78.5,58.5 C76.5,64 70.5,67.5 63,66 L62.5,62 Z', // sous-épineux, petit rond
  ],
  sideDelts: ['M78,41 C83,43 85.5,48 85.5,55 C85.5,61 82.5,66 79.5,68.5 L78.5,62 C80.5,57 81.5,52 81,46 C80.5,44 79.5,42.5 78,41 Z'],
  lats: ['M63,66 C70.5,67.5 76.5,64.5 78.5,62 C80.5,72 78.5,84 72.5,96 C68.5,104 62.5,108 56.5,110.5 L54.5,97 C58.5,88 60.5,77 63,66 Z'],
  lowerback: ['M50,71 L53.5,63 L58.5,66 C58.5,80 57.5,96 56.5,110.5 C56.5,116 55.5,120 54.5,124 L50,126 Z'],
  triceps: ['M75.5,68 C81.5,67 84.5,75 84.5,85 C84.5,93 81.5,98 78.5,99 C75.5,93 74.5,84 75.5,68 Z'],
  forearms: ['M76.5,101 C82.5,100.5 87.5,107 88.5,117 C88.5,125 86.5,133 84.5,139 L79.5,139 C78,129 76.5,115 76.5,101 Z'],
  glutes: ['M50,126 C56,121 66,121 72,127 C76,135 74,147 66,151 C58,153 52,151 50,147 Z'],
  hamstrings: [
    'M54.5,153 C57.5,152 61,152 63,152 C63,165 62,177 61,187 L59,187 C56,177 54.5,165 54.5,153 Z',
    'M63,152 C67,152 70,153 72,155 C73,167 72,179 68,187 L61,187 C62,177 63,165 63,152 Z',
  ],
  adductors: ['M50.5,149 L54.5,151 C54.5,163 55.5,173 57.5,183 C53.5,175 51.5,163 50.5,151 Z'],
  calves: [
    'M55.5,196 C58.5,194 61.5,195 62.5,199 C62.5,211 61.5,221 59.5,227 L56.5,227 C54.5,217 54.5,205 55.5,196 Z',
    'M62.5,199 C64.5,195 67.5,197 68.5,201 C69.5,211 67.5,221 64.5,227 L59.5,227 C61.5,221 62.5,211 62.5,199 Z',
  ],
};
const BACK_SKIN = [
  'M40,17 C40,7 44.5,3.5 50,3.5 C55.5,3.5 60,7 60,17 C60,25 56,30.5 50,30.5 C44,30.5 40,25 40,17 Z',
  'M44.5,27 L55.5,27 L57.5,45 L42.5,45 Z',
  'M79.5,139 L84.5,139 C88,145 88.5,151 86,156 C83,157.5 80,155.5 78.5,150.5 Z',
  'M20.5,139 L15.5,139 C12,145 11.5,151 14,156 C17,157.5 20,155.5 21.5,150.5 Z',
  'M59,187 C62,186 66,186 68,187 C67.5,191 68,195 68.5,201 C67.5,197 64.5,195 62.5,199 C61.5,195 58.5,194 55.5,196 C55.5,192 57,189 59,187 Z',
  'M41,187 C38,186 34,186 32,187 C32.5,191 32,195 31.5,201 C32.5,197 35.5,195 37.5,199 C38.5,195 41.5,194 44.5,196 C44.5,192 43,189 41,187 Z',
  'M56.5,227 L64.5,227 L63.5,237 C65.5,241 67.5,245 66.5,247.5 L56.5,247.5 C55.5,243 57,239 57.5,237 Z',
  'M43.5,227 L35.5,227 L36.5,237 C34.5,241 32.5,245 33.5,247.5 L43.5,247.5 C44.5,243 43,239 42.5,237 Z',
  'M78.5,99 L84.5,94 C85.5,97 85.5,99 84.5,101 L76.5,101 Z',
  'M21.5,99 L15.5,94 C14.5,97 14.5,99 15.5,101 L23.5,101 Z',
];

const MIRROR = 'matrix(-1 0 0 1 100 0)';
const both = (d) => `<path d="${d}"/><path d="${d}" transform="${MIRROR}"/>`;

let spriteReady = false;
// Injecte une seule fois le sprite dans la page (idempotent).
export function ensureBodySprite(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc || spriteReady || doc.getElementById('bm-sprite')) { spriteReady = true; return; }
  const defs = [];
  for (const [view, map, skin] of [['f', FRONT, FRONT_SKIN], ['b', BACK, BACK_SKIN]]) {
    for (const [m, paths] of Object.entries(map)) defs.push(`<g id="bm-${view}-${m}">${paths.map(both).join('')}</g>`);
    defs.push(`<g id="bm-${view}-skin">${skin.map((d) => `<path d="${d}"/>`).join('')}</g>`);
    // Silhouette pleine : tous les muscles avec un trait épais, pour combler les
    // interstices et dessiner un contour organique d'un seul tenant.
    defs.push(`<g id="bm-${view}-sil">${Object.values(map).flat().map(both).join('')}${skin.map((d) => `<path d="${d}"/>`).join('')}</g>`);
  }
  const holder = doc.createElement('div');
  holder.innerHTML = `<svg id="bm-sprite" xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>${defs.join('')}</defs></svg>`;
  doc.body.appendChild(holder.firstElementChild);
  spriteReady = true;
}

export const FRONT_MUSCLES = Object.keys(FRONT);
export const BACK_MUSCLES = Object.keys(BACK);

// Dégradé d'intensité : du bleu clair (peu sollicité) au bleu-violet profond
// (muscle le plus travaillé), dans la famille cyan / violet de l'app.
const STOPS = [[0, [158, 182, 246]], [0.55, [92, 124, 250]], [1, [70, 72, 230]]];
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

// En dessous de ce seuil, un muscle n'est pas coloré (sollicitation anecdotique).
const MIN_T = 0.06;

function figure(view, muscles, intensity, x) {
  const uses = muscles.map((m) => {
    const t = intensity[m] || 0;
    const fill = t >= MIN_T ? intensityColor(t) : 'var(--body-muscle)';
    return `<use href="#bm-${view}-${m}" fill="${fill}"/>`;
  }).join('');
  return `<g transform="translate(${x} 0)">
    <use href="#bm-${view}-sil" fill="var(--body-muscle)" stroke="var(--body-muscle)" stroke-width="3.2" stroke-linejoin="round"/>
    <use href="#bm-${view}-skin" fill="var(--body-skin)" stroke="var(--body-line)" stroke-width="0.7"/>
    <g stroke="var(--body-line)" stroke-width="0.7" stroke-linejoin="round">${uses}</g>
  </g>`;
}

// Carte complète, face à gauche et dos à droite.
//   intensity : { muscleId: 0..1 }
//   opts.size : hauteur en px (la largeur suit) ; opts.cls : classe CSS
export function bodyMapSVG(intensity = {}, opts = {}) {
  ensureBodySprite();
  const h = opts.size || 200;
  const gap = opts.gap ?? 8;
  const w = Math.round((h * (200 + gap)) / 250);
  return `<svg class="body-map ${opts.cls || ''}" viewBox="0 0 ${200 + gap} 250" width="${w}" height="${h}" role="img" aria-label="${opts.label || 'Muscles sollicités'}">
    ${figure('f', FRONT_MUSCLES, intensity, 0)}
    ${figure('b', BACK_MUSCLES, intensity, 100 + gap)}
  </svg>`;
}
