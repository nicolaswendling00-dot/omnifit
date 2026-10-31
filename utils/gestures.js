// OmniFit : gestes animés, portés en JS natif depuis trois composants
// React Bits (reactbits.dev, variante JS-CSS) : RubberSegment, SwipeRow et
// Shredder (déplacement seulement). On n'en garde que la mécanique (ressorts, élastique, lancer) :
// couleurs, polices et formes restent celles de l'app (jetons de style.css).
//
// Tout passe par un petit moteur de ressorts partagé, qui n'écrit que des
// transform, des clip-path et des largeurs, une seule boucle rAF pour toute
// l'app. Avec « réduire les animations » (ou sans matchMedia, cas des tests),
// les gestes s'appliquent sans animation.

import { createHolo } from './holo.js';

const reduced = () => !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const now = () => performance.now();
// Élastique : au-delà d'une butée, le déplacement est freiné (formule iOS).
const rubber = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
const easeOut = (t) => 1 - Math.pow(1 - t, 4);

// ------------------------------------------------------------------ ressorts
// Un « canal » est une valeur animée (équivalent d'une motion value) :
//   jump(x)  : place sans animation ; set(x) : suit le doigt (vitesse mesurée)
//   to(x, { duration, bounce, velocity }) : ressort, renvoie une promesse
//   tween(x, ms) : interpolation à sortie douce
const live = new Set();
let raf = 0;
let last = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000) || 0.016;
  last = t;
  for (const ch of [...live]) {
    const prev = ch.x;
    if (ch.mode === 'tween') {
      const p = Math.min(1, (t - ch.t0) / ch.dur);
      ch.x = ch.from + (ch.target - ch.from) * easeOut(p);
      ch.v = (ch.x - prev) / dt;
      if (p >= 1) ch.finish();
    } else {
      const n = Math.ceil(dt * 240);
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        ch.v += (-ch.k * (ch.x - ch.target) - ch.c * ch.v) * h;
        ch.x += ch.v * h;
      }
      if (Math.abs(ch.x - ch.target) < 0.05 && Math.abs(ch.v) < 1) { ch.x = ch.target; ch.v = 0; ch.finish(); }
    }
    ch.apply(ch.x);
  }
  raf = live.size ? window.requestAnimationFrame(frame) : 0;
}
function kick() { if (!raf) { last = now(); raf = window.requestAnimationFrame(frame); } }

export function channel(apply, x0 = 0) {
  const ch = {
    x: x0, v: 0, target: x0, k: 0, c: 0, mode: 'spring', res: null, ts: 0,
    apply,
    get: () => ch.x,
    stop() { live.delete(ch); ch.res = null; },
    finish() { live.delete(ch); const r = ch.res; ch.res = null; if (r) r(); },
    jump(x) { ch.stop(); ch.x = x; ch.target = x; ch.v = 0; apply(x); },
    set(x) {
      ch.stop();
      const t = now();
      const dt = (t - ch.ts) / 1000;
      if (ch.ts && dt > 0 && dt < 0.1) ch.v = ch.v * 0.4 + ((x - ch.x) / dt) * 0.6;
      else ch.v = 0;
      ch.ts = t; ch.x = x; ch.target = x; apply(x);
    },
    to(target, { duration = 0.3, bounce = 0, velocity, stiffness, damping } = {}) {
      const w = (2 * Math.PI) / duration;
      ch.mode = 'spring'; ch.target = target;
      if (stiffness) { ch.k = stiffness; ch.c = damping; } else { ch.k = w * w; ch.c = 2 * (1 - bounce) * w; }
      if (velocity !== undefined) ch.v = velocity;
      return ch.start();
    },
    tween(target, ms) {
      ch.mode = 'tween'; ch.from = ch.x; ch.target = target; ch.t0 = now(); ch.dur = ms;
      return ch.start();
    },
    start() {
      if (reduced()) { ch.x = ch.target; ch.v = 0; ch.stop(); apply(ch.x); return Promise.resolve(); }
      live.add(ch); kick();
      return new Promise((r) => { ch.res = r; });
    },
  };
  return ch;
}

const SPRING_UI = { duration: 0.3, bounce: 0 };

// ============================================================
// SÉLECTEUR SEGMENTÉ ÉLASTIQUE (RubberSegment)
// ============================================================
// La pastille active est une couche par dessus les boutons, découpée par un
// clip-path dont chaque bord est un ressort. Au changement, le bord de tête
// part devant, la pastille s'étire sur les deux options puis le bord de queue
// rattrape avec un léger tassement. On peut aussi saisir la pastille et la
// lancer : élastique aux extrémités, la vitesse décide de l'option visée.
// Dans la pastille, une copie des libellés en couleur « sur accent » : le
// texte change de couleur exactement sous la pastille, même en mouvement.
//
// Appliqué automatiquement à tout `.segment` de l'app (observateur plus bas) :
// le code des pages ne change pas, il continue de poser la classe `active`.
// Barre de navigation (nav = true) : la pastille suit la pastille d'icône de
// l'onglet actif, sans copie de texte ni saisie au doigt (le glissement entre
// onglets appartient déjà au carrousel).
const lastIndex = new Map(); // id du segment -> { i, t } pour enchaîner après un re-rendu

function rubberSegment(seg, nav = false) {
  if (seg._rs) return;
  seg._rs = true;
  seg.classList.add(nav ? 'rs-nav' : 'rs');
  const thumb = document.createElement('div');
  thumb.className = 'rs-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  seg.appendChild(thumb);

  let btns = [];
  let slots = [];
  let committed = -1;
  let gen = 0;
  let handoff = 0;
  let drag = null;
  let W = 0; let H = 0;
  const paint = () => {
    thumb.style.width = `${W}px`;
    thumb.style.clipPath = `inset(${T.x}px ${Math.max(0, W - R.x)}px ${Math.max(0, H - B.x)}px ${Math.max(0, L.x)}px round ${nav ? 999 : 11}px)`;
  };
  const L = channel(paint); const R = channel(paint); const T = channel(paint); const B = channel(paint);

  const activeIndex = () => btns.findIndex((b) => b.classList.contains('active'));
  const jumpTo = (i) => {
    clearTimeout(handoff); gen++;
    const s = slots[i];
    thumb.style.opacity = s ? '1' : '0';
    if (!s) return;
    L.jump(s.l); R.jump(s.r); T.jump(s.t); B.jump(s.b);
  };
  const measure = () => {
    btns = [...seg.children].filter((c) => c.tagName === 'BUTTON');
    W = seg.scrollWidth; H = seg.clientHeight;
    if (!seg.offsetWidth) return false;
    if (nav) {
      const o = seg.getBoundingClientRect();
      slots = btns.map((b) => {
        const r = (b.querySelector('svg') || b).getBoundingClientRect();
        return { l: r.left - o.left, r: r.right - o.left, t: r.top - o.top, b: r.bottom - o.top };
      });
      return true;
    }
    slots = btns.map((b) => ({ l: b.offsetLeft, r: b.offsetLeft + b.offsetWidth, t: b.offsetTop, b: b.offsetTop + b.offsetHeight }));
    thumb.textContent = '';
    btns.forEach((b, i) => {
      const s = slots[i];
      const cs = window.getComputedStyle(b);
      const copy = document.createElement('span');
      copy.className = 'rs-copy';
      copy.innerHTML = b.innerHTML;
      Object.assign(copy.style, {
        left: `${s.l}px`, top: `${s.t}px`, width: `${s.r - s.l}px`, height: `${s.b - s.t}px`,
        fontSize: cs.fontSize, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing, textTransform: cs.textTransform,
      });
      thumb.appendChild(copy);
    });
    return true;
  };

  // Un axe = deux bords (lo, hi). Le bord dans le sens du trajet mène.
  function landAxis(lo, hi, toLo, toHi, v, flick, squash, g) {
    const dir = Math.sign((toLo + toHi) / 2 - (lo.x + hi.x) / 2) || 1;
    const [lead, leadTo, trail, trailTo] = dir > 0 ? [hi, toHi, lo, toLo] : [lo, toLo, hi, toHi];
    const vel = (ch) => clamp(v === null ? ch.v : v, -2000, 2000);
    lead.to(leadTo, flick ? { duration: 0.4, bounce: 0.2, velocity: vel(lead) } : { ...SPRING_UI, velocity: vel(lead) });
    if (!squash) { trail.to(trailTo, { ...SPRING_UI, velocity: vel(trail) }); return; }
    trail.to(trailTo + dir * 3, { ...SPRING_UI, velocity: vel(trail) }).then(() => {
      if (gen === g) trail.to(trailTo, { duration: 0.16, bounce: 0 });
    });
  }
  const land = (to, v, flick, squash) => {
    const s = slots[to];
    if (!s) return;
    const g = ++gen;
    landAxis(L, R, s.l, s.r, v, flick, squash, g);
    landAxis(T, B, s.t, s.b, null, false, false, g);
  };
  const travel = (from, to) => {
    const a = slots[from]; const b = slots[to];
    if (!a || !b || reduced()) { jumpTo(to); return; }
    clearTimeout(handoff); gen++;
    thumb.style.opacity = '1';
    // Étirement : la pastille couvre les deux options, puis se pose.
    L.tween(Math.min(a.l, b.l), 190); R.tween(Math.max(a.r, b.r), 190);
    T.tween(Math.min(a.t, b.t), 190); B.tween(Math.max(a.b, b.b), 190);
    handoff = setTimeout(() => land(to, null, false, true), 150);
  };

  const sync = () => {
    const i = activeIndex();
    if (i === committed || drag) return;
    const from = committed;
    committed = i;
    if (seg.id) lastIndex.set(seg.id, { i, t: now() });
    if (from < 0 || i < 0) jumpTo(i); else travel(from, i);
  };
  const init = () => {
    if (!measure()) return;
    committed = activeIndex();
    const prev = seg.id && lastIndex.get(seg.id);
    // Re-rendu juste après un clic : on repart de l'ancienne option.
    if (prev && prev.i !== committed && prev.i >= 0 && prev.i < slots.length && now() - prev.t < 800) {
      jumpTo(prev.i);
      travel(prev.i, committed);
    } else jumpTo(committed);
    if (seg.id) lastIndex.set(seg.id, { i: committed, t: 0 });
  };

  new window.MutationObserver((muts) => {
    if (muts.every((m) => thumb.contains(m.target))) return;
    if (muts.some((m) => m.type === 'childList' && m.target === seg)) { init(); return; }
    if (!slots.length) init(); else sync();
  }).observe(seg, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  if (window.ResizeObserver) new ResizeObserver(() => { if (measure()) { if (committed < 0) committed = activeIndex(); jumpTo(committed); } }).observe(seg);
  init();

  // Saisir la pastille et la lancer
  const localX = (e) => e.clientX - seg.getBoundingClientRect().left + seg.scrollLeft;
  seg.addEventListener('pointerdown', (e) => {
    if (nav || e.button !== 0 || committed < 0 || !slots.length) return;
    const x = localX(e);
    const s = slots[committed];
    const y = e.clientY - seg.getBoundingClientRect().top;
    if (x < L.x || x > R.x || y < s.t || y > s.b) return;
    drag = { id: e.pointerId, x0: x, live: false, offset: 0, w: 0, hist: [[e.timeStamp, x]] };
  });
  seg.addEventListener('pointermove', (e) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    const x = localX(e);
    d.hist.push([e.timeStamp, x]);
    if (d.hist.length > 8) d.hist.shift();
    if (!d.live) {
      if (Math.abs(x - d.x0) < 4) return;
      d.live = true;
      d.offset = x - L.x; d.w = R.x - L.x;
      clearTimeout(handoff); gen++;
      seg.dataset.held = '';
      try { seg.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    }
    const row = slots[committed];
    const rowSlots = slots.filter((s) => s.t === row.t);
    const minL = Math.min(...rowSlots.map((s) => s.l));
    const maxR = Math.max(...rowSlots.map((s) => s.r));
    const l = x - d.offset;
    const maxL = maxR - d.w;
    if (l < minL) { L.set(minL); R.set(minL + d.w - rubber(minL - l, d.w)); } else if (l > maxL) { R.set(maxR); L.set(maxL + rubber(l - maxL, d.w)); } else { L.set(l); R.set(l + d.w); }
  });
  const release = (e, cancel) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    drag = null;
    delete seg.dataset.held;
    if (!d.live) return;
    if (cancel) { land(committed, null, false, false); return; }
    const recent = d.hist.filter(([t]) => e.timeStamp - t <= 100);
    let v = 0;
    if (recent.length > 1) {
      const [t0, x0] = recent[0]; const [t1, x1] = recent[recent.length - 1];
      if (t1 - t0 >= 8) v = ((x1 - x0) / (t1 - t0)) * 1000;
    }
    const flick = Math.abs(v) > 110;
    // Projection du lancer (glisse 75) puis option la plus proche sur la même ligne
    const dd = 1 - 0.1 * Math.pow(0.05, 0.75);
    const mid = (L.x + R.x) / 2 + ((v / 1000) * dd) / (1 - dd);
    const row = slots[committed].t;
    let to = committed;
    slots.forEach((s, i) => { if (s.t === row && Math.abs((s.l + s.r) / 2 - mid) < Math.abs((slots[to].l + slots[to].r) / 2 - mid)) to = i; });
    if (flick && to === committed) {
      const next = committed + Math.sign(v);
      if (slots[next] && slots[next].t === row) to = next;
    }
    committed = to;
    if (seg.id) lastIndex.set(seg.id, { i: to, t: now() });
    land(to, v, flick, flick);
    // Le bouton reçoit un vrai clic : la page applique son propre choix.
    if (!btns[to].classList.contains('active')) btns[to].click();
  };
  seg.addEventListener('pointerup', (e) => release(e, false));
  seg.addEventListener('pointercancel', (e) => release(e, true));
}

// Tout `.segment` ajouté au DOM devient élastique.
function enhanceAll(root) {
  if (root.nodeType !== 1) return;
  if (root.classList.contains('segment')) rubberSegment(root);
  root.querySelectorAll('.segment').forEach((s) => rubberSegment(s));
}
if (typeof document !== 'undefined' && document.body) {
  enhanceAll(document.body);
  const nav = document.getElementById('bottom-nav');
  if (nav) rubberSegment(nav, true);
  new window.MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach(enhanceAll);
  }).observe(document.body, { childList: true, subtree: true });
}

// ============================================================
// GLISSER POUR SUPPRIMER (SwipeRow)
// ============================================================
// Même balisage qu'avant : une ligne, son contenu (fond opaque) et un bouton
// `[data-del]` dessous. Le contenu suit le doigt avec élastique, le bouton
// rouge entre par la droite. Au delà de 60 % de la largeur, le bouton s'étire
// sous tout le contenu (vibration) : lâcher supprime. Relâché avant, la ligne
// se cale ouverte ou fermée selon la vitesse du geste. La suppression replie
// la ligne (hauteur, opacité) puis déclenche le clic du bouton, donc le code
// de suppression de chaque page reste inchangé.
//
//   collapse : false pour une suppression qui demande confirmation (la ligne
//              revient en place et la fenêtre de confirmation s'ouvre).
// La classe `swiped` reste posée sur une ligne ouverte : les pages s'en
// servent pour ignorer le tap qui la referme.
//   onCommit : appelé dès le début de la suppression (avant l'animation),
//              par exemple pour retirer la donnée et mettre à jour les totaux.
export function attachSwipeToDelete(list, { rowSelector, contentSelector, width = 80, collapse = true, onCommit = null } = {}) {
  if (!list || list._sw) return;
  list._sw = true;
  const D = width;
  const contentOf = (r) => r.querySelector(contentSelector);
  const delOf = (r) => r.querySelector('[data-del]');
  const commitPoint = (r) => Math.max(0.6 * r.offsetWidth, D + D / 2);

  // Position « exposée » (px révélés) de chaque ligne, animée par ressort.
  const state = (r) => {
    if (r._swS) return r._swS;
    const c = contentOf(r); const del = delOf(r);
    if (c) c.style.transition = 'none';
    // Ligne basse (pesées) : icône seule, le libellé serait coupé.
    if (del) del.classList.toggle('sw-compact', r.offsetHeight < 56);
    const s = { open: false };
    const paint = () => {
      const e = s.x.x;
      if (c) c.style.transform = e ? `translateX(${-e}px)` : '';
      if (del) {
        del.style.transform = `translateX(${Math.max(0, D - e)}px)`;
        del.style.width = `${D + s.spread.x * Math.max(0, e - D)}px`;
      }
    };
    s.x = channel(paint); s.spread = channel(paint);
    r._swS = s;
    return s;
  };
  const setOpen = (r, open) => { state(r).open = open; r.classList.toggle('swiped', open); };
  const settle = (r, target, v = 0) => {
    const s = state(r);
    setOpen(r, target > 0);
    s.spread.to(0, SPRING_UI);
    s.x.to(target, Math.abs(v) >= 110 ? { duration: 0.4, bounce: 0.2, velocity: clamp(v, -1500, 1500) } : { ...SPRING_UI, velocity: v });
  };
  let openRow = null;

  // dispatchEvent et non click() : click() est ignoré pendant le clic du même bouton.
  const fire = (r) => { const del = delOf(r); if (!del) return; del._swGo = true; del.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); del._swGo = false; };
  const commit = (r, v = 0) => {
    const s = state(r);
    if (navigator.vibrate) navigator.vibrate(8);
    if (onCommit && collapse) onCommit(r);
    if (!collapse) { settle(r, 0); fire(r); return; }
    setOpen(r, false);
    if (reduced()) { fire(r); return; }
    // 1. la ligne file à gauche et le rouge couvre toute la largeur ;
    // 2. le bord droit du rouge part vers la gauche, en gelée (ressort qui
    //    rebondit) ; 3. une fois le rouge disparu, la ligne se referme et
    //    l'élément est supprimé.
    const W = r.offsetWidth;
    const del = delOf(r);
    s.spread.to(1, SPRING_UI);
    s.x.to(W, { duration: 0.25, bounce: 0, velocity: v });
    let done = false;
    const gone = channel((k) => {
      if (del) del.style.clipPath = `inset(0 ${Math.max(0, k) * W}px 0 0 round 12px)`;
      if (!done && k > 0.96) {
        done = true;
        r.style.height = `${r.offsetHeight}px`;
        void r.offsetHeight; // fige la hauteur de départ avant la transition
        r.classList.add('sw-collapsing');
        setTimeout(() => fire(r), 160);
      }
    });
    setTimeout(() => gone.to(1, { duration: 0.42, bounce: 0.35 }), 140);
  };

  // Un tap sur le bouton rouge passe aussi par l'animation de repli.
  list.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    const r = del && del.closest(rowSelector);
    if (!r || !list.contains(r) || del._swGo) return;
    e.stopPropagation(); e.preventDefault();
    commit(r, 0);
  }, true);

  let g = null;
  list.addEventListener('touchstart', (e) => {
    const r = e.target.closest(rowSelector);
    if (openRow && openRow !== r) { settle(openRow, 0); openRow = null; }
    if (!r || e.target.closest('[data-del]')) { g = null; return; }
    state(r).x.stop();
    const t = e.touches[0];
    g = { r, x0: t.clientX, y0: t.clientY, grab: null, hist: [], moved: false };
  }, { passive: true });

  list.addEventListener('touchmove', (e) => {
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x0; const dy = t.clientY - g.y0;
    const s = state(g.r);
    const Wd = g.r.offsetWidth;
    const C = commitPoint(g.r);
    if (g.grab === null) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) {
        if (Math.abs(dy) > 10) g = null; // geste vertical : on laisse défiler
        return;
      }
      // Reprise d'une ligne déjà ouverte : on repart de sa position.
      g.grab = -(g.x0 + Math.sign(dx) * 10) - inv(s.x.x, Wd, C);
      g.moved = true;
    }
    e.preventDefault(); // bloque le défilement vertical pendant le glissement
    const ex = map(-t.clientX - g.grab, Wd, C);
    s.x.set(ex);
    g.hist.push([now(), ex]);
    if (g.hist.length > 4) g.hist.shift();
    const over = ex >= C;
    if (over !== (s.spread.target === 1)) {
      s.spread.to(over ? 1 : 0, SPRING_UI);
      if (over && navigator.vibrate) navigator.vibrate(8);
    }
  }, { passive: false });

  // Correspondance doigt -> position, avec élastique avant 0, après le tiroir
  // et un palier de résistance jusqu'au seuil de suppression.
  function map(raw, Wd, C) {
    const c = 0.55;
    if (raw < 0) return rubber(raw, Wd, c);
    if (raw <= D) return raw;
    const knee = D + (C - D) / c;
    return raw <= knee ? D + c * (raw - D) : C + rubber(raw - knee, Wd, c);
  }
  function inv(ex, Wd, C) {
    const c = 0.55;
    const un = (y) => (y * Wd) / (c * Math.max(1, Wd - Math.abs(y)));
    if (ex < 0) return un(ex);
    if (ex <= D) return ex;
    const knee = D + (C - D) / c;
    return ex <= C ? D + (ex - D) / c : knee + un(ex - C);
  }

  const end = () => {
    const cur = g;
    g = null;
    if (!cur || !cur.moved) return;
    const r = cur.r;
    const s = state(r);
    const ex = s.x.x;
    const h = cur.hist;
    const v = h.length > 1 ? ((h[h.length - 1][1] - h[0][1]) / Math.max(1, h[h.length - 1][0] - h[0][0])) * 1000 : 0;
    if (ex >= commitPoint(r)) { if (openRow === r) openRow = null; commit(r, v); return; }
    const proj = ex + ((v / 1000) * 0.998) / 0.002;
    const target = Math.abs(v) >= 110 ? (v > 0 ? D : 0) : proj > D / 2 ? D : 0;
    settle(r, target, v);
    openRow = target ? r : (openRow === r ? null : openRow);
  };
  list.addEventListener('touchend', end, { passive: true });
  list.addEventListener('touchcancel', end, { passive: true });
}

// ============================================================
// RÉORGANISER (mécanique de Shredder, sans la broyeuse)
// ============================================================
// Liste que l'on réordonne en faisant glisser les lignes. La ligne saisie se
// soulève (léger agrandissement), suit le doigt par ressort et penche selon
// sa vitesse ; les autres s'écartent, chacune avec son ressort.
//
//   host   : conteneur vide qui reçoit la liste
//   labels : textes des lignes (HTML déjà échappé)
// Renvoie { order() } : indices d'origine des lignes, dans le nouvel ordre.
export function reorderList(host, labels, { dragIcon = '' } = {}) {
  const list = document.createElement('div');
  list.className = 'reorder-list';
  host.appendChild(list);
  labels.forEach((lbl, i) => {
    const row = document.createElement('div');
    row.className = 'reorder-row';
    row.dataset.i = i;
    row.tabIndex = 0;
    row.innerHTML = `<span class="drag-handle">${dragIcon}</span><span class="reorder-label">${lbl}</span>`;
    row.setAttribute('aria-label', `${row.querySelector('.reorder-label').textContent}. Glisser pour déplacer, ou Alt et flèches`);
    list.appendChild(row);
  });

  let drag = null;
  // Décalage animé des autres lignes (FLIP par ressort) quand l'ordre change.
  const flip = (mutate) => {
    const rows = [...list.children];
    const before = new Map(rows.map((row) => [row, row.getBoundingClientRect().top]));
    mutate();
    rows.forEach((row) => {
      if (drag && row === drag.row) return;
      const d = before.get(row) - row.getBoundingClientRect().top;
      if (Math.abs(d) < 0.5) return;
      const ch = row._y || (row._y = channel((y) => { row.style.transform = y ? `translateY(${y}px)` : ''; }));
      ch.jump(ch.x + d);
      ch.to(0, { duration: 0.35, bounce: 0.15 });
    });
  };
  const paint = (d) => () => {
    d.ghost.style.transform = `translate(${d.gx.x}px, ${d.gy.x}px) rotate(${d.tilt}deg) scale(${d.lift})`;
  };

  list.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.reorder-row');
    if (!row || e.button !== 0 || drag) return;
    e.preventDefault();
    try { row.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    const b = row.getBoundingClientRect();
    const ghost = row.cloneNode(true);
    ghost.classList.add('reorder-ghost', 'dragging');
    ghost.removeAttribute('tabindex');
    Object.assign(ghost.style, { width: `${b.width}px`, height: `${b.height}px`, left: '0px', top: '0px' });
    document.body.appendChild(ghost);
    row.classList.add('reorder-placeholder');
    const d = { row, ghost, h: b.height, id: e.pointerId, offX: e.clientX - b.left, offY: e.clientY - b.top, tilt: 0, lift: 1 };
    const p = paint(d);
    d.gx = channel(p, b.left); d.gy = channel(p, b.top);
    d.liftCh = channel((v) => { d.lift = v; p(); }, 1);
    drag = d;
    p();
    d.liftCh.to(1.03, { duration: 0.25 });
  });
  list.addEventListener('pointermove', (e) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    e.preventDefault();
    const x = e.clientX - d.offX; const y = e.clientY - d.offY;
    d.tilt = clamp((x - d.gx.target) * 0.25, -6, 6);
    d.gx.to(x, { duration: 0.2 }); d.gy.to(y, { duration: 0.2 });
    // Place du trou : au-dessus de la première ligne dont le milieu est sous le doigt.
    const cy = y + d.h / 2;
    let target = null;
    for (const row of list.children) {
      if (row === d.row) continue;
      const b = row.getBoundingClientRect();
      if (cy < b.top + b.height / 2 - (row._y ? row._y.x : 0)) { target = row; break; }
    }
    if (d.row.nextElementSibling !== target && !(target === null && d.row === list.lastElementChild)) {
      flip(() => list.insertBefore(d.row, target));
    }
  });
  const up = (e) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    drag = null;
    const b = d.row.getBoundingClientRect();
    d.tilt = 0;
    d.liftCh.to(1, SPRING_UI);
    Promise.all([d.gx.to(b.left, { duration: 0.35 }), d.gy.to(b.top, { duration: 0.35 })]).then(() => {
      d.ghost.remove();
      d.row.classList.remove('reorder-placeholder');
    });
  };
  list.addEventListener('pointerup', up);
  list.addEventListener('pointercancel', up);
  // Clavier : Alt + flèches déplacent la ligne.
  list.addEventListener('keydown', (e) => {
    const row = e.target.closest('.reorder-row');
    if (!row || drag || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const sib = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
    if (!sib) return;
    flip(() => list.insertBefore(row, e.key === 'ArrowUp' ? sib : sib.nextElementSibling));
    row.focus();
  });

  return { order: () => [...list.querySelectorAll('.reorder-row')].map((row) => +row.dataset.i) };
}

// ============================================================
// CARTE À RETOURNER (FlipCard) + REFLET HOLOGRAPHIQUE (HoloCard)
// ============================================================
// Carte en 3D : un tap la retourne (ressort raideur 170, amortissement 20),
// on peut aussi la faire tourner au doigt et la lancer, la vitesse décide de
// la face qui reste. Au repos, elle oscille doucement (comme HoloCard) pour
// faire vivre le reflet ; à la souris, elle s'incline vers le pointeur. Son
// ombre s'affine quand la carte est de profil. Pas d'agrandissement au toucher.
//
//   front, back : HTML des deux faces
//   holo        : { art(w, h) -> Promise<canvas> } : le recto est redessiné
//                 dans un canvas, sur lequel le shader pose le motif holographique
// Renvoie l'élément .flip-card (à insérer), avec .flip() pour la retourner.
export function flipCard({ front, back, label = 'Carte', width = 280, holo = null } = {}) {
  const card = document.createElement('div');
  card.className = 'flip-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-pressed', 'false');
  card.setAttribute('aria-label', `${label}. Toucher pour retourner`);
  card.style.setProperty('--fc-w', `${width}px`);
  card.innerHTML = `<span class="flip-card__shadow" aria-hidden="true"></span>
    <div class="flip-card__rotor">
      <div class="flip-card__face flip-card__face--front">${front}${holo ? '<canvas class="flip-card__holo" aria-hidden="true"></canvas>' : ''}<span class="flip-card__glare" aria-hidden="true"></span></div>
      <div class="flip-card__face flip-card__face--back" aria-hidden="true">${back}<span class="flip-card__glare" aria-hidden="true"></span></div>
    </div>`;
  const rotor = card.querySelector('.flip-card__rotor');
  const shadow = card.querySelector('.flip-card__shadow');
  const faces = card.querySelectorAll('.flip-card__face');
  const snap = (deg) => Math.round(deg / 180) * 180;
  const isBack = (deg) => Math.abs(Math.round(deg / 180)) % 2 === 1;
  let shown = false;
  // Oscillation au repos (amplitude 0..1) et lumière du reflet
  const drift = { x: 0, y: 0, amp: 0, clock: Math.random() * 40 };
  const light = { x: 0.36, y: 0.26, tx: 0.36, ty: 0.26 };
  let hovering = false;
  const paint = () => {
    rotor.style.transform = `perspective(1100px) rotateX(${tx.x + drift.x}deg) rotateY(${turn.x + ty.x + drift.y}deg)`;
    // Safari ignore backface-visibility sur un canvas WebGL : sans ça, le recto
    // réapparaît en miroir au dos. On masque donc la face qui tourne le dos.
    const facing = Math.cos(((turn.x + ty.x + drift.y) * Math.PI) / 180) >= 0;
    if (facing !== card._facing) {
      card._facing = facing;
      faces[0].style.visibility = facing ? '' : 'hidden';
      faces[1].style.visibility = facing ? 'hidden' : '';
    }
    const f = Math.abs(Math.cos((turn.x * Math.PI) / 180));
    shadow.style.transform = `translate(${-(ty.x + drift.y) * 0.7}px, ${(tx.x + drift.x) * 0.7}px) scaleX(${0.08 + 0.92 * f})`;
    shadow.style.opacity = String(0.1 + 0.9 * f * f);
    rotor.style.setProperty('--fc-sheen', String(sheen.x));
  };
  const turn = channel(paint); const tx = channel(paint); const ty = channel(paint); const sheen = channel(paint);
  const TILT = { stiffness: 400, damping: 40 };
  const LIFT = { stiffness: 320, damping: 26 };

  const settle = (to, velocity = 0) => {
    turn.to(to, { stiffness: 170, damping: 20, velocity });
    const next = isBack(to);
    if (next === shown) return;
    shown = next;
    card.setAttribute('aria-pressed', String(shown));
    faces[0].setAttribute('aria-hidden', String(shown));
    faces[1].setAttribute('aria-hidden', String(!shown));
  };
  card.flip = () => { const base = snap(turn.x); settle(isBack(base) ? base - 180 : base + 180); };
  const rest = () => { tx.to(0, TILT); ty.to(0, TILT); sheen.to(0, LIFT); };
  const aimLight = (e) => {
    const r = card.getBoundingClientRect();
    light.tx = clamp((e.clientX - r.left) / r.width, 0, 1);
    light.ty = clamp((e.clientY - r.top) / r.height, 0, 1);
    return light;
  };

  let g = null;
  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || g) return;
    try { card.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    turn.stop();
    aimLight(e);
    g = { id: e.pointerId, x: e.clientX, base: turn.x, moved: false, slop: e.pointerType === 'touch' ? 8 : 4, hist: [] };
  });
  card.addEventListener('pointermove', (e) => {
    if (g && g.id === e.pointerId) {
      aimLight(e); // le reflet suit le doigt
      const d = e.clientX - g.x;
      if (!g.moved) {
        if (Math.abs(d) < g.slop || reduced()) return;
        g.moved = true;
        card.dataset.dragging = '';
        tx.to(0, TILT); ty.to(0, TILT); sheen.to(0, LIFT);
      }
      const deg = g.base + (d / card.offsetWidth) * 180;
      turn.set(deg);
      const t = now();
      g.hist.push([t, deg]);
      while (g.hist.length > 2 && t - g.hist[0][0] > 90) g.hist.shift();
      return;
    }
    // Inclinaison vers le pointeur (souris seulement, comme l'original)
    if (e.pointerType === 'touch' || reduced()) return;
    hovering = true;
    const p = aimLight(e);
    tx.to((0.5 - p.ty) * 24, TILT); ty.to((p.tx - 0.5) * 24, TILT);
    rotor.style.setProperty('--fc-gx', `${p.tx * 100}%`);
    rotor.style.setProperty('--fc-gy', `${p.ty * 100}%`);
    sheen.to(1, LIFT);
  });
  const release = (e, cancelled) => {
    if (!g || g.id !== e.pointerId) return;
    const cur = g;
    g = null;
    delete card.dataset.dragging;
    if (e.pointerType === 'touch' || !card.matches(':hover')) { hovering = false; rest(); }
    if (!cur.moved) { if (!cancelled) card.flip(); return; }
    const here = turn.x;
    let v = 0;
    const a = cur.hist[0]; const b = cur.hist[cur.hist.length - 1];
    if (!cancelled && a && b && b[0] > a[0] && now() - b[0] < 60) v = ((b[1] - a[1]) / (b[0] - a[0])) * 1000;
    settle(cancelled ? snap(cur.base) : clamp(snap(here + v * 0.16), snap(here) - 180, snap(here) + 180), v);
  };
  card.addEventListener('pointerup', (e) => release(e, false));
  card.addEventListener('pointercancel', (e) => release(e, true));
  card.addEventListener('pointerleave', () => { if (!g) { hovering = false; rest(); } });
  card.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (!e.repeat) card.flip();
  });
  paint();

  // Boucle de vie de la carte : oscillation au repos et reflet holographique.
  // Elle tourne tant que la carte est affichée, et s'arrête quand on la retire.
  let gl = null; let artPending = false; let seen = false; let last = now();
  const live = (t) => {
    if (!card.isConnected) { if (seen || t - last > 3000) return; window.requestAnimationFrame(live); return; }
    seen = true;
    const dt = Math.min(0.05, (t - last) / 1000) || 0.016;
    last = t;
    const calm = !g && !hovering && !reduced();
    drift.amp += ((calm ? 1 : 0) - drift.amp) * Math.min(1, dt * 3);
    drift.clock += dt * (calm ? 1 : 0);
    drift.x = Math.sin(drift.clock * 0.7) * 14 * 0.28 * drift.amp;
    drift.y = Math.sin(drift.clock * 0.53 + 1.2) * 14 * 0.4 * drift.amp;
    if (calm) {
      light.tx = 0.5 + Math.sin(drift.clock * 0.41) * 0.42;
      light.ty = 0.38 + Math.sin(drift.clock * 0.33 + 0.6) * 0.3;
    }
    light.x += (light.tx - light.x) * Math.min(1, dt * 8);
    light.y += (light.ty - light.y) * Math.min(1, dt * 8);
    paint();
    if (holo) {
      const cv = faces[0].querySelector('.flip-card__holo');
      if (!gl && !artPending && cv.clientWidth) {
        artPending = true;
        gl = createHolo(cv);
        if (gl) {
          holo.art(cv.clientWidth, cv.clientHeight).then((art) => { gl.setArt(art); card.dataset.holo = 'ready'; }).catch(() => {});
        }
      }
      // Face visible seulement (inutile de dessiner le recto quand il est de dos)
      if (gl && Math.cos(((turn.x + ty.x + drift.y) * Math.PI) / 180) > -0.05) {
        gl.draw({ tiltX: tx.x + drift.x, tiltY: turn.x + ty.x + drift.y, lightX: light.x, lightY: light.y });
      }
    }
    window.requestAnimationFrame(live);
  };
  window.requestAnimationFrame(live);
  return card;
}

// ============================================================
// COMPTEUR À ROULEAUX (Counter)
// ============================================================
// Chaque chiffre est une bande 0..9 qui défile verticalement par ressort
// (durée 0,7 s, rebond 0,2), les unités d'abord puis les dizaines 40 ms plus
// tard. Les bords du rouleau s'estompent (masque). Pour une durée « mm:ss »,
// le chiffre des dizaines de secondes ne compte que jusqu'à 5 : il passe de 5
// à 0 sans dérouler 6, 7, 8, 9.
//   host : élément qui contenait le texte ; renvoie { set(texte) }
export function rollingCounter(host) {
  host.classList.add('roll');
  host.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'roll-sr';
  const row = document.createElement('span');
  row.className = 'roll-row';
  row.setAttribute('aria-hidden', 'true');
  host.append(sr, row);
  let shape = '';
  let slots = [];
  let value = null;
  const wrap = (off, base) => (((off + base / 2) % base) + base) % base - base / 2;

  const build = (text) => {
    row.textContent = '';
    const time = /^\d+:\d\d$/.test(text);
    slots = [...text].map((ch, i) => {
      const el = document.createElement('span');
      if (!/\d/.test(ch)) { el.className = 'roll-sym'; el.textContent = ch; row.appendChild(el); return null; }
      const base = time && text[i - 1] === ':' ? 6 : 10;
      el.className = 'roll-digit';
      el.innerHTML = `<span class="roll-sizer">0</span><span class="roll-window">${Array.from({ length: base }, (_, n) => `<span class="roll-num">${n}</span>`).join('')}</span>`;
      row.appendChild(el);
      const nums = [...el.querySelectorAll('.roll-num')];
      const s = { base, digit: +ch };
      s.pos = channel((p) => { nums.forEach((nEl, n) => { nEl.style.transform = `translateY(${(wrap(n - p, base) * 100).toFixed(2)}%)`; }); }, +ch);
      s.pos.jump(+ch);
      return s;
    });
  };
  return {
    set(text) {
      text = String(text);
      sr.textContent = text;
      const nextShape = text.replace(/\d/g, '0');
      const num = parseInt(text.replace(/\D/g, ''), 10) || 0;
      if (nextShape !== shape) { shape = nextShape; value = num; build(text); return; }
      const up = num >= value;
      value = num;
      // Des unités vers les chiffres de gauche, avec un léger décalage
      let order = 0;
      for (let i = text.length - 1; i >= 0; i--) {
        const s = slots[i];
        if (!s) continue;
        const d = +text[i];
        if (d === s.digit) continue;
        const raw = (((d - s.digit) % s.base) + s.base) % s.base;
        const step = up ? raw : raw - s.base;
        s.digit = d;
        const target = s.pos.target + step;
        setTimeout(() => s.pos.to(target, { duration: 0.7, bounce: 0.2 }), order++ * 40);
      }
    },
  };
}

// ============================================================
// LISTES ANIMÉES (AnimatedList)
// ============================================================
// Les lignes des listes apparaissent en « pop » (petit agrandissement depuis
// 80 %, montée de 12 px, ressort), en cascade de 50 ms. Une ligne qui sort à
// moitié de la zone visible en défilant se rétracte vers le haut ou le bas,
// et ressurgit en revenant. Appliqué automatiquement aux lignes connues de
// l'app ; les propriétés `translate` / `scale` sont utilisées pour ne pas
// toucher au `transform` des lignes glissables.
const LIST_ITEMS = '.meal-row, .hist-item, .exo-swipe-row, .exo-search-item, .swipe-row, .wd-exo, .ed-hist-item, .ns-item, .recap-row, .mus-exo-row, .ladder-row, .routine-exos > li';
let listIO = null;
let popBatch = 0;
function popState(el, state) {
  if (el.dataset.al === state) return;
  el.dataset.al = state;
}
function watchListItem(el) {
  if (el._al || !listIO || el.closest('.no-al')) return;
  // Une ligne dans une autre ligne déjà animée (bouton dans une ligne glissable) : on laisse le parent.
  if (el.parentElement && el.parentElement.closest(LIST_ITEMS)) return;
  el._al = true;
  el.dataset.al = 'below';
  listIO.observe(el);
}
if (typeof window !== 'undefined' && window.IntersectionObserver && document.body && !reduced()) {
  listIO = new window.IntersectionObserver((entries) => {
    const batch = ++popBatch;
    let order = 0;
    for (const e of entries) {
      const el = e.target;
      if (!el.isConnected) { listIO.unobserve(el); continue; }
      const r = e.boundingClientRect;
      // Hors champ sur le côté (onglet voisin du carrousel) : on ne touche à rien.
      if (!e.isIntersecting && (r.right <= 0 || r.left >= window.innerWidth)) continue;
      if (e.isIntersecting) {
        el.style.transitionDelay = `${Math.min(order++, 10) * 50}ms`;
        popState(el, 'in');
        setTimeout(() => { if (popBatch === batch || el.dataset.al === 'in') el.style.transitionDelay = ''; }, 700);
      } else {
        el.style.transitionDelay = '';
        popState(el, r.top + r.height / 2 < window.innerHeight / 2 ? 'above' : 'below');
      }
    }
  }, { threshold: 0.5 });
  const scan = (root) => {
    if (root.nodeType !== 1) return;
    if (root.matches(LIST_ITEMS)) watchListItem(root);
    root.querySelectorAll(LIST_ITEMS).forEach(watchListItem);
  };
  scan(document.body);
  new window.MutationObserver((muts) => { for (const m of muts) m.addedNodes.forEach(scan); })
    .observe(document.body, { childList: true, subtree: true });
}
