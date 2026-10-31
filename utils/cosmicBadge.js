// OmniFit — Badges de rang : un objet céleste par rang, du plus modeste au plus
// impressionnant. Bronze = Lune, Or = Planète, Platine = Géante gazeuse,
// Diamant = Comète, Émeraude = Étoile, Saphir = Nébuleuse, Rubis = Pulsar,
// Onyx = Trou noir. Le ciel se remplit d'étoiles à chaque rang.

// Teintes de chaque rang, du plus clair au plus sombre
const PALETTES = {
  bronze: ['#F6D2B0', '#D68A4E', '#9A5A2C', '#3E2210'],
  gold: ['#FFF0B8', '#FBD250', '#E0A322', '#7A520E'],
  plat: ['#FFFFFF', '#E6E4EE', '#B4B2C2', '#5E5C6E'],
  diam: ['#F2FCFF', '#BDEBFA', '#7FD8F5', '#2E7FA6'],
  emer: ['#F0FFF5', '#9BF7C2', '#34E884', '#0C6A34'],
  saph: ['#DCEAFF', '#7FB0FF', '#3E7EF0', '#122A6E'],
  ruby: ['#FFE4E2', '#FF8A84', '#F0404E', '#6E0E14'],
  onyx: ['#7FE8FF', '#4AA0FF', '#7C3AED', '#05050A'],
};

const f = (n) => n.toFixed(1);
const rnd = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const sparkle = (x, y, r) => `<path d="M ${x} ${y - r} Q ${x} ${y} ${x + r} ${y} Q ${x} ${y} ${x} ${y + r} Q ${x} ${y} ${x - r} ${y} Q ${x} ${y} ${x} ${y - r} Z"/>`;

function draw(R, t, uid, size) {
  const u = R.id + uid; const P = R.P; const c = R.color; const r = rnd(97 + t * 31);
  const defs = [
    `<radialGradient id="${u}-halo"><stop offset="0" stop-color="${c}" stop-opacity="${0.18 + t * 0.035}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="${u}-ball" cx="34%" cy="30%" r="80%"><stop offset="0" stop-color="${P[0]}"/><stop offset=".42" stop-color="${P[1]}"/><stop offset=".78" stop-color="${P[2]}"/><stop offset="1" stop-color="${P[3]}"/></radialGradient>`,
    `<radialGradient id="${u}-limb" cx="50%" cy="50%" r="50%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>`,
    `<linearGradient id="${u}-holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00D9FF"/><stop offset=".5" stop-color="#4AA0FF"/><stop offset="1" stop-color="#7C3AED"/></linearGradient>`,
    `<filter id="${u}-gl" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
    `<filter id="${u}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>`,
    `<filter id="${u}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>`,
    `<clipPath id="${u}-clip"><circle cx="200" cy="200" r="96"/></clipPath>`,
  ];
  // Ciel : plus d'étoiles à chaque rang
  let b = `<circle cx="200" cy="200" r="190" fill="url(#${u}-halo)"/>`;
  for (let i = 0; i < 5 + t * 6; i++) {
    const x = 20 + r() * 360; const y = 20 + r() * 360;
    b += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.7 + r() * 1.6)}" fill="#fff" opacity="${f(0.25 + r() * 0.6)}"/>`;
  }

  switch (R.id) {
    case 'bronze': { // Lune : cratères, mers sombres, ombre du croissant
      b += `<circle cx="200" cy="200" r="96" fill="url(#${u}-ball)"/>`;
      b += `<g clip-path="url(#${u}-clip)">
        <ellipse cx="172" cy="176" rx="34" ry="24" fill="${P[2]}" opacity=".55"/><ellipse cx="222" cy="226" rx="26" ry="18" fill="${P[2]}" opacity=".5"/>
        ${[[150, 230, 10], [240, 160, 13], [196, 140, 7], [250, 250, 6], [140, 170, 6]].map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="${s}" fill="${P[3]}" opacity=".35" stroke="${P[0]}" stroke-width="1.5"/>`).join('')}
        <circle cx="250" cy="182" r="104" fill="#05060A" opacity=".62"/>
      </g>`;
      b += `<circle cx="200" cy="200" r="96" fill="none" stroke="${P[0]}" stroke-width="2" opacity=".5"/>`;
      break;
    }
    case 'gold': { // Planète tellurique : relief, canyons, calotte, fine atmosphère
      b += `<circle cx="200" cy="200" r="104" fill="none" stroke="${P[0]}" stroke-width="5" opacity=".35" filter="url(#${u}-soft)"/>`;
      b += `<circle cx="200" cy="200" r="96" fill="url(#${u}-ball)"/>`;
      b += `<g clip-path="url(#${u}-clip)">
        <path d="M 112 178 C 140 150 170 170 186 152 C 204 132 236 146 228 172 C 220 196 186 188 176 208 C 164 230 128 226 116 210 Z" fill="${P[2]}" opacity=".75"/>
        <path d="M 214 222 C 236 206 270 214 286 236 C 298 254 276 284 250 280 C 226 276 230 254 210 250 Z" fill="${P[2]}" opacity=".7"/>
        <path d="M 130 250 C 160 244 196 262 232 248" fill="none" stroke="${P[3]}" stroke-width="4" stroke-linecap="round" opacity=".6"/>
        <path d="M 150 120 C 176 128 196 118 214 128" fill="none" stroke="${P[3]}" stroke-width="3" stroke-linecap="round" opacity=".45"/>
        ${[[244, 160, 8], [168, 284, 6], [270, 200, 5]].map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="${s}" fill="${P[3]}" opacity=".45"/>`).join('')}
        <ellipse cx="200" cy="106" rx="46" ry="14" fill="#FFFDF3" opacity=".9"/>
      </g>`;
      b += `<circle cx="200" cy="200" r="96" fill="url(#${u}-limb)"/>`;
      break;
    }
    case 'plat': { // Planète à anneaux : anneaux fins nacrés, deux lunes
      const tilt = 'translate(200 200) rotate(-16)';
      const rings = (half) => [0, 1, 2, 3, 4].map((i) => {
        const rx = 118 + i * 11; const ry = 30 + i * 3;
        const d = half === 'back' ? `M ${-rx} 0 A ${rx} ${ry} 0 0 1 ${rx} 0` : `M ${-rx} 0 A ${rx} ${ry} 0 0 0 ${rx} 0`;
        return `<path d="${d}" fill="none" stroke="${i % 2 ? P[2] : P[0]}" stroke-width="${i === 2 ? 7 : 4}" opacity="${half === 'back' ? 0.5 : 0.95}"/>`;
      }).join('');
      b += `<g transform="${tilt}">${rings('back')}</g>`;
      b += `<circle cx="200" cy="200" r="82" fill="url(#${u}-ball)"/><circle cx="200" cy="200" r="82" fill="url(#${u}-limb)"/>`;
      b += `<g transform="${tilt}">${rings('front')}</g>`;
      b += `<circle cx="94" cy="118" r="10" fill="${P[1]}"/><circle cx="320" cy="292" r="7" fill="${P[2]}"/>`;
      break;
    }
    case 'diam': { // Comète : noyau glacé, chevelure, deux queues
      b += `<path d="M 268 132 C 200 170 130 230 40 340 C 150 252 210 196 284 150 Z" fill="${P[1]}" opacity=".35" filter="url(#${u}-soft)"/>`;
      b += `<path d="M 262 126 C 190 150 110 190 30 250 C 130 205 200 172 278 144 Z" fill="${P[0]}" opacity=".55" filter="url(#${u}-soft)"/>`;
      b += `<path d="M 270 134 L 60 318 L 72 326 L 282 146 Z" fill="${P[2]}" opacity=".7" filter="url(#${u}-soft)"/>`;
      b += `<circle cx="274" cy="138" r="46" fill="${P[1]}" opacity=".35" filter="url(#${u}-blur)"/>`;
      b += `<circle cx="274" cy="138" r="24" fill="url(#${u}-ball)" filter="url(#${u}-gl)"/><circle cx="268" cy="132" r="9" fill="#fff"/>`;
      break;
    }
    case 'emer': { // Étoile : sphère ardente, aigrettes, protubérances
      let spikes = '';
      for (let i = 0; i < 8; i++) {
        const a = (i * 45) * Math.PI / 180; const L = i % 2 ? 120 : 176; const w = i % 2 ? 4 : 7;
        const x = 200 + L * Math.cos(a); const y = 200 + L * Math.sin(a);
        const px = -Math.sin(a) * w; const py = Math.cos(a) * w;
        spikes += `<polygon points="${f(200 + px)},${f(200 + py)} ${f(x)},${f(y)} ${f(200 - px)},${f(200 - py)}"/>`;
      }
      b += `<g fill="${P[0]}" opacity=".8" filter="url(#${u}-gl)">${spikes}</g>`;
      b += `<circle cx="200" cy="200" r="92" fill="${P[2]}" opacity=".45" filter="url(#${u}-blur)"/>`;
      // Protubérances : des boucles qui partent de la surface et y retombent
      const prom = (deg, h, span) => {
        const a1 = (deg - span) * Math.PI / 180; const a2 = (deg + span) * Math.PI / 180; const am = deg * Math.PI / 180;
        const R0 = 62; const x1 = 200 + R0 * Math.cos(a1); const y1 = 200 + R0 * Math.sin(a1);
        const x2 = 200 + R0 * Math.cos(a2); const y2 = 200 + R0 * Math.sin(a2);
        // Chaque pied monte droit depuis la surface, puis l'arche se referme
        const k = h * 1.35;
        const c1x = x1 + k * Math.cos(a1); const c1y = y1 + k * Math.sin(a1);
        const c2x = x2 + k * Math.cos(a2); const c2y = y2 + k * Math.sin(a2);
        void am;
        return `<path d="M ${f(x1)} ${f(y1)} C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(x2)} ${f(y2)}"/>`;
      };
      // Entre les aigrettes (tous les 45°), pour ne pas les croiser
      b += `<g fill="none" stroke="${P[1]}" stroke-width="6" stroke-linecap="round" opacity=".9" filter="url(#${u}-gl)">${prom(-112.5, 40, 14)}${prom(-22.5, 32, 12)}${prom(67.5, 38, 14)}</g>`;
      b += `<circle cx="200" cy="200" r="66" fill="url(#${u}-ball)" filter="url(#${u}-gl)"/><circle cx="188" cy="186" r="30" fill="#fff" opacity=".55" filter="url(#${u}-soft)"/>`;
      break;
    }
    case 'saph': { // Nébuleuse : nuages superposés, étoiles qui y naissent
      b += `<g filter="url(#${u}-blur)">
        <ellipse cx="170" cy="190" rx="110" ry="64" fill="${P[3]}" opacity=".9" transform="rotate(-24 170 190)"/>
        <ellipse cx="230" cy="214" rx="96" ry="54" fill="${P[2]}" opacity=".8" transform="rotate(30 230 214)"/>
        <ellipse cx="196" cy="168" rx="70" ry="40" fill="${P[1]}" opacity=".75" transform="rotate(-10 196 168)"/>
        <ellipse cx="248" cy="240" rx="44" ry="28" fill="#9F7CFF" opacity=".55"/>
        <ellipse cx="200" cy="196" rx="36" ry="24" fill="${P[0]}" opacity=".85"/>
      </g>`;
      b += `<g fill="none" stroke="${P[0]}" stroke-width="2" opacity=".45" filter="url(#${u}-soft)"><path d="M 90 230 C 140 180 190 250 250 190 S 320 170 330 140"/><path d="M 110 160 C 170 130 210 200 290 250"/></g>`;
      b += `<g fill="#fff" filter="url(#${u}-gl)">${sparkle(200, 196, 16)}${sparkle(150, 230, 9)}${sparkle(262, 160, 10)}${sparkle(236, 258, 7)}</g>`;
      break;
    }
    case 'ruby': { // Pulsar : astre dense, deux faisceaux, lignes de champ
      b += `<g transform="rotate(-28 200 200)">
        <polygon points="200,200 176,8 224,8" fill="url(#${u}-beam)" filter="url(#${u}-soft)"/>
        <polygon points="200,200 176,392 224,392" fill="url(#${u}-beam2)" filter="url(#${u}-soft)"/>
        <g fill="none" stroke="${P[1]}" stroke-width="2.5" opacity=".7">
          <ellipse cx="200" cy="200" rx="110" ry="46"/><ellipse cx="200" cy="200" rx="78" ry="30"/><ellipse cx="200" cy="200" rx="140" ry="62" opacity=".5"/>
        </g>
      </g>`;
      defs.push(`<linearGradient id="${u}-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${P[1]}"/><stop offset="1" stop-color="${P[2]}" stop-opacity="0"/></linearGradient>`);
      defs.push(`<linearGradient id="${u}-beam2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${P[1]}"/><stop offset="1" stop-color="${P[2]}" stop-opacity="0"/></linearGradient>`);
      b += `<circle cx="200" cy="200" r="54" fill="${P[2]}" opacity=".6" filter="url(#${u}-blur)"/>`;
      b += `<circle cx="200" cy="200" r="26" fill="url(#${u}-ball)" filter="url(#${u}-gl)"/><circle cx="200" cy="200" r="11" fill="#fff"/>`;
      for (const rr of [150, 172]) b += `<circle cx="200" cy="200" r="${rr}" fill="none" stroke="${P[2]}" stroke-width="1.5" opacity=".35"/>`;
      break;
    }
    case 'onyx': { // Trou noir vu presque par la tranche (d'après la visualisation de la NASA)
      // Du bord intérieur, très chaud (blanc bleuté), vers l'extérieur (bleu puis violet)
      const tone = (k) => ['#FFFFFF', '#E2FAFF', '#B8F1FF', '#8FE6FF', '#6FD2FF', '#5AB4FF', '#5B95FA', '#6876F2', '#7656EC', '#7C3AED'][Math.min(9, Math.max(0, Math.round(k * 9)))];
      const cx = 200; const cy = 204;
      b += `<ellipse cx="${cx}" cy="${cy - 20}" rx="160" ry="110" fill="#4AA0FF" opacity=".14" filter="url(#${u}-blur)"/>`;
      // Anneau du dessous : la face cachée du disque, renvoyée sous le trou,
      // séparée du disque par une bande sombre
      let low = '';
      for (let i = 0; i < 12; i++) {
        const k = i / 11; const rx = 60 + i * 4.2; const ry = 46 + i * 3.6;
        low += `<path d="M ${f(cx - rx)} ${cy + 22} A ${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${cy + 22}" stroke="${tone(k)}" stroke-width="${f(3 - k)}" opacity="${f(0.95 - k * 0.5 - (i % 3 === 1 ? 0.3 : 0))}"/>`;
      }
      b += `<g fill="none" filter="url(#${u}-soft)" opacity=".7">${low}</g><g fill="none">${low}</g>`;
      // Grande arche : la lumière de l'arrière du disque courbée par-dessus le
      // trou ; ses pieds s'évasent et se fondent dans le disque
      let arch = '';
      for (let i = 0; i < 22; i++) {
        const k = i / 21; const rx = 66 + i * 3.8; const ry = 64 + i * 3.2; const spread = i * i * 0.1;
        arch += `<path d="M ${f(cx - rx - spread)} ${cy} C ${f(cx - rx + 4)} ${f(cy - ry * 0.3)} ${f(cx - rx * 0.6)} ${f(cy - ry)} ${cx} ${f(cy - ry)} C ${f(cx + rx * 0.6)} ${f(cy - ry)} ${f(cx + rx - 4)} ${f(cy - ry * 0.3)} ${f(cx + rx + spread)} ${cy}" stroke="${tone(k)}" stroke-width="${f(3.6 - k * 1.8)}" opacity="${f(Math.max(0.12, 1 - k * 0.75 - (i % 3 === 1 ? 0.3 : 0) - (i % 5 === 3 ? 0.15 : 0)))}"/>`;
      }
      b += `<g fill="none" filter="url(#${u}-soft)" opacity=".75">${arch}</g><g fill="none">${arch}</g>`;
      // L'ombre du trou et l'anneau de photons, très fin
      b += `<circle cx="${cx}" cy="${cy}" r="58" fill="#000"/>`;
      b += `<path d="M ${cx - 52} ${cy} A 52 50 0 0 1 ${cx + 52} ${cy}" fill="none" stroke="#E9FBFF" stroke-width="1.6" opacity=".9"/>`;
      // Le disque, vu par la tranche : épais et brillant au centre, effacé aux bords
      defs.push(`<linearGradient id="${u}-disk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7C3AED" stop-opacity="0"/><stop offset=".1" stop-color="#7656EC" stop-opacity=".8"/><stop offset=".28" stop-color="#6FD2FF"/><stop offset=".4" stop-color="#B8F1FF"/><stop offset=".5" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#B8F1FF"/><stop offset=".72" stop-color="#6FD2FF"/><stop offset=".9" stop-color="#7656EC" stop-opacity=".8"/><stop offset="1" stop-color="#7C3AED" stop-opacity="0"/></linearGradient>`);
      b += `<path d="M 14 ${cy} Q ${cx} ${cy - 22} 386 ${cy} Q ${cx} ${cy + 22} 14 ${cy} Z" fill="url(#${u}-disk)" opacity=".9" filter="url(#${u}-soft)"/>`;
      let disk = '';
      for (let i = 0; i < 7; i++) disk += `<path d="M ${18 + i * 10} ${cy} Q ${cx} ${f(cy - 14 + i * 4.6)} ${382 - i * 10} ${cy}" fill="none" stroke="url(#${u}-disk)" stroke-width="1.4" opacity="${f(0.9 - i * 0.1)}"/>`;
      b += disk;
      b += `<g fill="#fff" filter="url(#${u}-gl)">${sparkle(70, 76, 13)}${sparkle(332, 330, 11)}</g>`;
      break;
    }
  }
  return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs>${defs.join('')}</defs>${b}</svg>`;
}

let uid = 0;
// t : position du rang (0 = Bronze … 7 = Onyx)
export function cosmicBadge(id, t, color, size = 120) {
  const key = PALETTES[id] ? id : 'bronze';
  // Identifiant unique : plusieurs badges cohabitent dans la page (dégradés, filtres)
  return draw({ id: key, color, P: PALETTES[key] }, t, 'cb' + (++uid), size);
}
