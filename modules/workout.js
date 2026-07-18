// OmniFit — PAGE 2 : Entraînement v2
// Séance minimisable, timer sticky, menu ⋯ (suppr/réorg/superset/remplacer),
// détail exo (muscles, historique, repos perso), coefficients d'amélioration.
import { store, todayISO } from '../utils/storage.js';
import { EXERCISES, MUSCLES, muscleLabel } from '../data/exercises.js';
import { formatTime, workoutMuscleVolume, weeklySetsByMuscle, muscleAttenuation } from '../utils/math.js';
import { el, icons, openModal, openSheet, toast, confirmModal, beep, haptic, fmtDateShort, fmtDateLong } from '../utils/ui.js';

let volumeChart = null;
let impChart = null;
let pageRerender = null;
let session = null; // { elapsed, running, date, notes, exercises:[{exerciseId, sets:[{weight,reps}], ss}] }
let sessionUI = null; // { overlay, renderExos, close }
let chronoInterval = null;
let restInterval = null;
let restRemaining = 0;

// ---------- Lookup ----------
export function allExercises() {
  return [...EXERCISES, ...(store.userData.settings.customExercises || [])];
}
export function exerciseLookup(id) {
  const e = allExercises().find((x) => x.id === id);
  if (!e) return undefined;
  const ov = store.userData.settings.exerciseNames;
  return ov && ov[id] ? { ...e, name: ov[id] } : e;
}
// Normalisation pour recherche : minuscules, sans accents
function normalizeStr(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function filteredExercises() {  const s = store.userData.settings;
  let list = allExercises();
  if (!s.exerciseDbFull) list = list.filter((e) => e.difficulty === 'Beginner' || e.isCustom);
  if (s.equipmentFilter && s.equipmentFilter.length) {
    list = list.filter((e) => s.equipmentFilter.includes(e.equipment) || e.isCustom);
  }
  return list;
}

function exoRestDuration(exerciseId) {
  const s = store.userData.settings;
  return (s.restByExercise && s.restByExercise[exerciseId]) || s.restTimerDefault;
}

// Volume total d'un exo dans un workout
const exoVolume = (wx) => wx.sets.reduce((a, s) => a + s.weight * s.reps, 0);

// Dernier workout contenant l'exo → { workout, wx }
function lastEntry(exerciseId) {
  for (let i = store.userData.workouts.length - 1; i >= 0; i--) {
    const wx = store.userData.workouts[i].exercises.find((x) => x.exerciseId === exerciseId);
    if (wx && wx.sets.length) return { workout: store.userData.workouts[i], wx };
  }
  return null;
}

// Coefficient d'amélioration exo : volume courant vs dernier volume (%)
function exoImprovement(exerciseId, currentVolume) {
  const last = lastEntry(exerciseId);
  if (!last || !currentVolume) return null;
  const lv = exoVolume(last.wx);
  if (!lv) return null;
  return Math.round(((currentVolume / lv) - 1) * 100);
}

// Dernier volume d'un muscle dans les séances passées
function lastMuscleVolume(muscle) {
  const ratio = store.userData.settings.secondaryRatio;
  for (let i = store.userData.workouts.length - 1; i >= 0; i--) {
    const bm = workoutMuscleVolume(store.userData.workouts[i], exerciseLookup, ratio);
    if (bm[muscle]) return bm[muscle];
  }
  return null;
}

const impBadge = (imp, small = true) => {
  if (imp == null) return '';
  const cls = imp >= 0 ? 'green' : 'red';
  const sign = imp >= 0 ? '+' : '';
  return `<span class="badge ${cls}" style="${small ? 'font-size:0.62rem;padding:2px 6px' : ''}">${sign}${imp}%</span>`;
};

// Libellés courts des muscles (cases du calendrier)
const MUSCLE_SHORT = {
  chest: 'Pecs', back: 'Dos', shoulders: 'Delts', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Av-B', quads: 'Quads', hamstrings: 'Ischio', glutes: 'Fess.', calves: 'Mollet',
  core: 'Abdos', lowerback: 'Lomb.',
};

// Muscle le plus travaillé d'une séance — pondéré par le NOMBRE DE SÉRIES
// (et non le volume : sinon les mollets/presse à fortes charges faussent tout)
function topMuscle(w) {
  const ratio = store.userData.settings.secondaryRatio;
  const acc = {};
  for (const wx of w.exercises) {
    const def = exerciseLookup(wx.exerciseId);
    if (!def || !wx.sets.length) continue;
    const n = wx.sets.length;
    for (const pm of def.primaryMuscles) acc[pm.m] = (acc[pm.m] || 0) + (pm.p / 100) * n;
    for (const sm of def.secondaryMuscles) acc[sm.m] = (acc[sm.m] || 0) + (sm.p / 100) * ratio * n;
  }
  let best = null; let bv = -1;
  for (const [m, v] of Object.entries(acc)) if (v > bv) { bv = v; best = m; }
  return best;
}

// Historique {date,id,vol} d'un exo, trié par date
function exoHistory(exerciseId) {
  const h = [];
  for (const w of store.userData.workouts) {
    const wx = w.exercises.find((x) => x.exerciseId === exerciseId);
    if (wx && wx.sets.length) h.push({ date: w.date, id: w.id, vol: exoVolume(wx) });
  }
  h.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return h;
}

// Amélioration (%) d'un exo dans une séance donnée vs l'occurrence précédente
function exoImprovementAt(exerciseId, workout) {
  const h = exoHistory(exerciseId);
  const idx = h.findIndex((e) => e.id === workout.id);
  if (idx <= 0) return null;
  const prev = h[idx - 1].vol;
  if (!prev) return null;
  return Math.round(((h[idx].vol / prev) - 1) * 100);
}

// Coefficient d'amélioration d'une séance = moyenne des améliorations d'exos ayant un précédent
function sessionImprovement(workout) {
  const vals = [];
  for (const wx of workout.exercises) {
    const imp = exoImprovementAt(wx.exerciseId, workout);
    if (imp != null) vals.push(imp);
  }
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// ============================================================
// PICKER PLEIN ÉCRAN (recherche en haut → jamais derrière le clavier)
// ============================================================
function openExercisePicker(onPick, title = 'Ajouter un exercice') {
  const overlay = el(`<div class="picker-overlay">
    <div class="picker-topbar">
      <input id="exo-search" type="text" placeholder="Rechercher…" autocomplete="off">
      <button class="icon-btn" id="picker-close" aria-label="Fermer">${icons.close}</button>
    </div>
    <div class="picker-list" id="exo-list"></div>
    <button class="btn btn-secondary btn-block" id="btn-custom" style="margin:8px 0 calc(10px + var(--safe-b))">${icons.plus} Exercice custom</button>
  </div>`);
  document.body.appendChild(overlay);
  const wasOpen = document.body.classList.contains('overlay-open');
  document.body.classList.add('overlay-open');

  const close = () => {
    overlay.remove();
    if (!wasOpen) document.body.classList.remove('overlay-open');
  };
  const list = overlay.querySelector('#exo-list');
  const renderList = (q = '') => {
    const nq = normalizeStr(q);
    const items = filteredExercises().filter((e) => normalizeStr(e.name).includes(nq));
    list.innerHTML = items.length ? '' : '<div class="empty-state">Aucun résultat</div>';
    for (const e of items.slice(0, 80)) {
      const b = el(`<button class="exo-search-item"><span>${e.name}</span><span class="cat">${e.category}</span></button>`);
      b.addEventListener('click', () => { close(); onPick(e); });
      list.appendChild(b);
    }
  };
  renderList();
  const input = overlay.querySelector('#exo-search');
  input.addEventListener('input', (e) => renderList(e.target.value));
  setTimeout(() => input.focus(), 250);
  overlay.querySelector('#picker-close').addEventListener('click', close);
  overlay.querySelector('#btn-custom').addEventListener('click', () => {
    close();
    openCustomExerciseModal((exo) => onPick(exo));
  });
}

// ============================================================
// CRÉATEUR D'EXERCICE CUSTOM
// ============================================================
function openCustomExerciseModal(onCreated) {
  const muscleRows = (label) => MUSCLES.map((m) => `
    <div class="card-row" style="padding:3px 0">
      <label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;flex:1">
        <input type="checkbox" class="${label}-chk" data-m="${m.id}" style="width:18px;height:18px;accent-color:var(--accent)"> ${m.label}
      </label>
      <input type="number" class="${label}-pct" data-m="${m.id}" min="0" max="100" placeholder="%" style="width:70px;min-height:36px;padding:6px">
    </div>`).join('');

  const form = el(`<div>
    <label class="field"><span>Nom</span><input id="cx-name" type="text" placeholder="Mon exercice"></label>
    <h3 style="font-size:0.85rem;margin:8px 0 4px">Muscles principaux</h3>
    <div style="max-height:150px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px 10px">${muscleRows('prim')}</div>
    <h3 style="font-size:0.85rem;margin:12px 0 4px">Muscles secondaires</h3>
    <div style="max-height:150px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px 10px">${muscleRows('sec')}</div>
  </div>`);

  openModal({
    title: 'Créer un exercice',
    content: form,
    wide: true,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Créer', variant: 'btn-primary',
        onClick: (body) => {
          const name = body.querySelector('#cx-name').value.trim();
          if (!name) { toast('Nom requis', 'error'); return 'keep'; }
          const collect = (cls) => [...body.querySelectorAll(`.${cls}-chk:checked`)].map((chk) => {
            const pct = parseFloat(body.querySelector(`.${cls}-pct[data-m="${chk.dataset.m}"]`).value) || 0;
            return { m: chk.dataset.m, p: pct };
          }).filter((x) => x.p > 0);
          const primary = collect('prim');
          const secondary = collect('sec');
          if (!primary.length) { toast('Au moins 1 muscle principal avec %', 'error'); return 'keep'; }
          const totalPct = [...primary, ...secondary].reduce((a, x) => a + x.p, 0);
          if (totalPct > 100) { toast(`Total ${totalPct}% > 100%`, 'error'); return 'keep'; }
          const exo = {
            id: 'custom_' + crypto.randomUUID().slice(0, 8),
            name, category: 'Custom', isCustom: true,
            primaryMuscles: primary, secondaryMuscles: secondary,
            difficulty: 'Custom', equipment: 'Other',
          };
          store.saveUserData({ settings: { customExercises: [...(store.userData.settings.customExercises || []), exo] } });
          if (onCreated) onCreated(exo);
        },
      },
    ],
  });
}

// ============================================================
// RÉORGANISATION (drag & drop tactile, réutilisé séance + routines)
// ============================================================
function openReorderSheet(labels, onDone) {
  const form = el(`<div>
    <div id="reorder-list"></div>
    <button class="btn btn-primary btn-block" id="reorder-save" style="margin-top:6px">Valider l'ordre</button>
  </div>`);
  const sheet = openSheet({ title: 'Réorganiser', content: form });
  const list = form.querySelector('#reorder-list');

  labels.forEach((lbl, i) => {
    list.appendChild(el(`<div class="reorder-row" data-i="${i}">
      <span class="drag-handle">${icons.drag}</span>
      <span class="reorder-label">${lbl}</span>
    </div>`));
  });

  let dragged = null;
  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    dragged = handle.closest('.reorder-row');
    dragged.classList.add('dragging');
    dragged.setPointerCapture && handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  list.addEventListener('pointermove', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const row = target && target.closest ? target.closest('.reorder-row') : null;
    if (row && row !== dragged) {
      const r = row.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      list.insertBefore(dragged, before ? row : row.nextSibling);
    }
  });
  const endDrag = () => { if (dragged) { dragged.classList.remove('dragging'); dragged = null; } };
  list.addEventListener('pointerup', endDrag);
  list.addEventListener('pointercancel', endDrag);

  form.querySelector('#reorder-save').addEventListener('click', () => {
    const order = [...list.querySelectorAll('.reorder-row')].map((r) => +r.dataset.i);
    sheet.close();
    onDone(order);
  });
}

// ============================================================
// TIMER DE REPOS — barre sticky en haut, toujours visible
// ============================================================
function startRestTimer(exerciseId) {
  if (!sessionUI) return;
  clearInterval(restInterval);
  const bar = sessionUI.overlay.querySelector('#rest-topbar');
  let total = exoRestDuration(exerciseId);
  restRemaining = total;

  bar.classList.add('active');
  bar.classList.remove('pulse');
  const render = () => {
    bar.querySelector('.rt-time').textContent = formatTime(restRemaining);
    bar.querySelector('.progress-bar > div').style.width = `${(restRemaining / total) * 100}%`;
  };
  render();

  restInterval = setInterval(() => {
    restRemaining--;
    if (restRemaining <= 0) {
      stopRestTimer();
      if (store.userData.settings.soundEnabled) { beep(880); setTimeout(() => beep(1100), 180); }
      haptic();
      return;
    }
    render();
    if (restRemaining <= 5) bar.classList.add('pulse');
  }, 1000);

  bar.querySelector('#rt-skip').onclick = () => stopRestTimer();
  bar.querySelector('#rt-plus').onclick = () => { restRemaining += 30; total += 30; render(); };
}
function stopRestTimer() {
  clearInterval(restInterval);
  restInterval = null;
  restRemaining = 0;
  if (sessionUI) {
    const bar = sessionUI.overlay.querySelector('#rest-topbar');
    if (bar) { bar.classList.remove('active', 'pulse'); }
  }
}

// ============================================================
// MINI-BARRE (séance minimisée)
// ============================================================
function showMiniBar() {
  removeMiniBar();
  const bar = el(`<div id="mini-session">
    <span class="ms-label">${icons.play} Séance en cours <span class="ms-rest" id="ms-rest"></span></span>
    <span class="num ms-time" id="ms-time">${formatTime(session.elapsed)}</span>
  </div>`);
  bar.addEventListener('click', () => restoreSession());
  document.body.appendChild(bar);
}
function removeMiniBar() {
  const b = document.getElementById('mini-session');
  if (b) b.remove();
}
function minimizeSession() {
  if (!sessionUI) return;
  sessionUI.overlay.classList.add('minimized');
  document.body.classList.remove('overlay-open');
  showMiniBar();
}
function restoreSession() {
  if (!sessionUI) return;
  sessionUI.overlay.classList.remove('minimized');
  document.body.classList.add('overlay-open');
  removeMiniBar();
}

// ============================================================
// DÉTAIL EXO (muscles, repos perso, historique + vue séance)
// ============================================================
function openExerciseDetailSheet(exerciseId) {
  const def = exerciseLookup(exerciseId);
  if (!def) return;
  const rest = exoRestDuration(exerciseId);
  const history = store.userData.workouts
    .map((w) => ({ w, wx: w.exercises.find((x) => x.exerciseId === exerciseId) }))
    .filter((h) => h.wx && h.wx.sets.length)
    .slice(-12).reverse();

  // Meilleur 1RM estimé (Epley : poids × (1 + reps/30)) sur tout l'historique
  let best1rm = null;
  for (const w of store.userData.workouts) {
    const wx = w.exercises.find((x) => x.exerciseId === exerciseId);
    if (!wx) continue;
    for (const s of wx.sets) {
      if (!s.weight || !s.reps) continue;
      const orm = s.weight * (1 + s.reps / 30);
      if (!best1rm || orm > best1rm.orm) best1rm = { orm, weight: s.weight, reps: s.reps, date: w.date };
    }
  }

  const form = el(`<div>
    <button class="btn btn-secondary btn-sm btn-block" id="ed-rename" style="margin-bottom:12px">${icons.edit} Modifier le nom</button>
    ${best1rm ? `<div class="orm-card">
      <div class="orm-head">Meilleur 1RM estimé</div>
      <div class="orm-value">${Math.round(best1rm.orm)} kg</div>
      <div class="orm-sub">${best1rm.weight} kg × ${best1rm.reps} · ${best1rm.date}</div>
    </div>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">
      ${def.primaryMuscles.map((m) => `<span class="badge">${muscleLabel(m.m)} ${m.p}%</span>`).join('')}
      ${def.secondaryMuscles.map((m) => `<span class="badge violet">${muscleLabel(m.m)} ${m.p}%</span>`).join('')}
    </div>
    <div class="card-row" style="margin-bottom:6px">
      <span style="font-size:0.85rem">Repos pour cet exercice</span>
      <span class="num" id="ed-rest-val" style="color:var(--accent)">${rest}s</span>
    </div>
    <input id="ed-rest" type="range" min="30" max="300" step="15" value="${rest}" style="margin-bottom:14px">
    <h3 style="margin-bottom:6px">Historique</h3>
    <div id="ed-history">${history.length ? '' : '<div class="empty-state">Jamais réalisé</div>'}</div>
  </div>`);

  const sheet = openSheet({ title: def.name, content: form });

  form.querySelector('#ed-rename').addEventListener('click', () => {
    const input = el(`<input type="text" class="rename-input" value="${def.name.replace(/"/g, '&quot;')}" style="width:100%">`);
    openModal({
      title: 'Modifier le nom',
      content: input,
      actions: [
        { label: 'Annuler' },
        {
          label: 'Enregistrer', variant: 'btn-primary',
          onClick: (body) => {
            const name = body.querySelector('.rename-input').value.trim();
            if (!name) { toast('Nom requis', 'error'); return 'keep'; }
            const ov = { ...(store.userData.settings.exerciseNames || {}) };
            ov[exerciseId] = name;
            store.saveUserData({ settings: { exerciseNames: ov } });
            toast('Nom modifié', 'success');
            sheet.close();
          },
        },
      ],
    });
  });

  const slider = form.querySelector('#ed-rest');
  slider.addEventListener('input', () => { form.querySelector('#ed-rest-val').textContent = slider.value + 's'; });
  slider.addEventListener('change', () => {
    const rbe = { ...(store.userData.settings.restByExercise || {}) };
    rbe[exerciseId] = +slider.value;
    store.saveUserData({ settings: { restByExercise: rbe } });
    toast(`Repos mémorisé : ${slider.value}s`, 'success');
  });

  const hostH = form.querySelector('#ed-history');
  for (const h of history) {
    const vol = exoVolume(h.wx);
    const row = el(`<div class="steps-list-item" style="gap:8px">
      <div>
        <div style="font-weight:600;font-size:0.82rem">${h.w.date}</div>
        <div class="muted">${h.wx.sets.map((s) => `${s.weight}×${s.reps}`).join(' · ')}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="num" style="color:var(--accent);font-size:0.85rem">${vol.toLocaleString('fr-FR')} kg</span>
        <button class="icon-btn" aria-label="Voir la séance" style="width:38px;height:38px">${icons.history}</button>
      </div>
    </div>`);
    row.querySelector('.icon-btn').addEventListener('click', () => openWorkoutDetail(h.w, exerciseId));
    hostH.appendChild(row);
  }
  return sheet;
}

// Vue d'une séance complète (séries empilées, coefficient d'amélioration, exos cliquables)
function openWorkoutDetail(w, highlightId = null) {
  const sessImp = sessionImprovement(w);
  const content = el(`<div>
    <div class="wd-top">
      <span class="muted">${formatTime(w.totalTime || 0)}</span>
      ${sessImp != null
        ? `<span class="wd-sess-imp ${sessImp >= 0 ? 'up' : 'down'}">Amélioration ${sessImp >= 0 ? '+' : ''}${sessImp}%</span>`
        : '<span class="muted">Séance de référence</span>'}
    </div>
    ${w.notes ? `<div class="wd-note">${String(w.notes).replace(/</g, '&lt;')}</div>` : ''}
    ${w.exercises.map((wx, i) => {
      const def = exerciseLookup(wx.exerciseId) || { name: wx.exerciseId };
      const hl = wx.exerciseId === highlightId;
      const imp = exoImprovementAt(wx.exerciseId, w);
      return `<div class="wd-exo${hl ? ' hl' : ''}" data-exo="${wx.exerciseId}">
        <div class="wd-exo-head">
          <span class="wd-exo-name">${i + 1}. ${def.name} ${wx.ss ? `<span class="ss-chip">SS${wx.ss}</span>` : ''}</span>
          ${imp != null ? impBadge(imp, false) : '<span class="muted" style="font-size:0.68rem">nouveau</span>'}
        </div>
        <div class="wd-sets">
          ${wx.sets.map((s, j) => `<div class="wd-set"><span class="wd-set-n">${j + 1}</span><span class="wd-set-v">${s.weight} kg × ${s.reps}</span></div>`).join('')}
        </div>
      </div>`;
    }).join('')}
    <div class="muted" style="text-align:center;font-size:0.7rem;margin-top:6px">Touchez un exercice pour ses statistiques</div>
  </div>`);
  content.addEventListener('click', (e) => {
    const exo = e.target.closest('.wd-exo');
    if (exo) openExerciseDetailSheet(exo.dataset.exo);
  });
  openModal({
    title: `Séance du ${w.date}`,
    content,
    wide: true,
    actions: [
      { label: 'Fermer' },
      { label: 'Ajouter aux routines', onClick: () => { addSessionToRoutine(w); } },
      { label: 'Modifier', variant: 'btn-primary', onClick: () => { if (pageRerender) openSession(pageRerender, null, w); } },
    ],
  });
}

// Crée une routine à partir d'une séance (les séries seront pré-remplies via la colonne PRÉC)
function addSessionToRoutine(w) {
  const ids = w.exercises.map((wx) => wx.exerciseId);
  const input = el(`<div class="field-stack">
    <label class="field"><span>Nom de la routine</span><input type="text" class="rt-name-input" placeholder="Push A" value="Séance du ${w.date}" autofocus></label>
    <div class="muted" style="font-size:0.75rem">${ids.length} exercice${ids.length > 1 ? 's' : ''} · les séries précédentes s'afficheront dans la colonne PRÉC quand tu lanceras la routine.</div>
  </div>`);
  openModal({
    title: 'Ajouter aux routines',
    content: input,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Créer', variant: 'btn-primary',
        onClick: (body) => {
          const name = body.querySelector('.rt-name-input').value.trim();
          if (!name) { toast('Nom requis', 'error'); return 'keep'; }
          store.saveRoutine({ id: crypto.randomUUID(), name, exercises: ids });
          toast('Routine créée', 'success');
          if (pageRerender) pageRerender();
        },
      },
    ],
  });
}

// ============================================================
// MENU ⋯ D'UN EXO
// ============================================================
function openExoMenu(idx) {
  const wx = session.exercises[idx];
  const def = exerciseLookup(wx.exerciseId) || { name: '?' };
  const form = el(`<div>
    <button class="menu-item" data-a="reorder">${icons.drag} Réorganiser les exercices</button>
    <button class="menu-item" data-a="superset">${icons.link} Superset…</button>
    <button class="menu-item" data-a="replace">${icons.swap} Remplacer l'exercice</button>
    <button class="menu-item danger" data-a="delete">${icons.trash} Supprimer</button>
  </div>`);
  const sheet = openSheet({ title: def.name, content: form });

  form.addEventListener('click', (e) => {
    const btn = e.target.closest('.menu-item');
    if (!btn) return;
    const a = btn.dataset.a;
    sheet.close();

    if (a === 'delete') {
      confirmModal('Supprimer', `Retirer « ${def.name} » de la séance ?`, () => {
        session.exercises.splice(idx, 1);
        sessionUI.renderExos();
      }, true);
    } else if (a === 'replace') {
      openExercisePicker((exo) => {
        session.exercises[idx].exerciseId = exo.id;
        sessionUI.renderExos();
        toast(`Remplacé par ${exo.name}`, 'success');
      }, 'Remplacer par…');
    } else if (a === 'reorder') {
      const labels = session.exercises.map((x) => (exerciseLookup(x.exerciseId) || { name: '?' }).name);
      openReorderSheet(labels, (order) => {
        session.exercises = order.map((i) => session.exercises[i]);
        sessionUI.renderExos();
      });
    } else if (a === 'superset') {
      openSupersetSheet(idx);
    }
  });
}

function openSupersetSheet(idx) {
  const wx = session.exercises[idx];
  const others = session.exercises.map((x, i) => ({ x, i })).filter((o) => o.i !== idx);
  if (!others.length) { toast('Ajoute d\'abord un autre exercice', 'error'); return; }

  const form = el(`<div>
    <div class="muted" style="margin-bottom:10px">Sélectionne les exercices à lier en superset :</div>
    ${others.map((o) => {
      const d = exerciseLookup(o.x.exerciseId) || { name: '?' };
      const checked = wx.ss && o.x.ss === wx.ss;
      return `<label class="settings-row" style="cursor:pointer">
        <span class="row-label">${d.name} ${o.x.ss ? `<span class="ss-chip">SS${o.x.ss}</span>` : ''}</span>
        <input type="checkbox" data-i="${o.i}" ${checked ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent)">
      </label>`;
    }).join('')}
    <button class="btn btn-primary btn-block" id="ss-save" style="margin-top:10px">Lier</button>
  </div>`);
  const sheet = openSheet({ title: 'Superset', content: form });

  form.querySelector('#ss-save').addEventListener('click', () => {
    const selected = [...form.querySelectorAll('input:checked')].map((c) => +c.dataset.i);
    // Groupe : réutilise celui de l'exo s'il existe, sinon nouveau numéro
    const used = new Set(session.exercises.map((x) => x.ss).filter(Boolean));
    const group = wx.ss || (Math.max(0, ...used) + 1);
    // Détacher les anciens membres de ce groupe
    session.exercises.forEach((x, i) => { if (x.ss === group && i !== idx && !selected.includes(i)) delete x.ss; });
    if (selected.length) {
      wx.ss = group;
      selected.forEach((i) => { session.exercises[i].ss = group; });
      toast(`Superset SS${group} créé`, 'success');
    } else {
      delete wx.ss;
    }
    sheet.close();
    sessionUI.renderExos();
  });
}

// ============================================================
// MODE SÉANCE
// ============================================================
function openSession(rerenderPage, fromRoutine = null, editWorkout = null) {
  if (session && sessionUI) { restoreSession(); return; }

  session = {
    elapsed: editWorkout ? (editWorkout.totalTime || 0) : 0,
    running: !editWorkout,
    date: editWorkout ? editWorkout.date : todayISO(),
    notes: editWorkout ? (editWorkout.notes || '') : '',
    editingId: editWorkout ? editWorkout.id : null,
    exercises: editWorkout
      ? editWorkout.exercises.map((wx) => ({ exerciseId: wx.exerciseId, ss: wx.ss, sets: wx.sets.map((s) => ({ ...s })) }))
      : (fromRoutine ? fromRoutine.exercises.map((id) => ({ exerciseId: id, sets: [] })) : []),
  };

  const overlay = el(`<div class="session-overlay">
    <div class="session-top">
      <div class="session-header">
        <span class="num session-chrono" id="s-chrono">00:00</span>
        <div style="display:flex;gap:2px">
          <button class="icon-btn" id="s-playpause" aria-label="Pause">${icons.pause}</button>
          <button class="icon-btn" id="s-minimize" aria-label="Réduire">${icons.chevronDown}</button>
        </div>
      </div>
      <div class="rest-topbar" id="rest-topbar">
        <span class="num rt-time">00:00</span>
        <div class="progress-bar"><div style="width:100%"></div></div>
        <button class="btn btn-ghost btn-sm" id="rt-plus" style="min-height:32px;padding:4px 8px">+30s</button>
        <button class="btn btn-secondary btn-sm" id="rt-skip" style="min-height:32px;padding:4px 10px">Skip</button>
      </div>
    </div>
    <div id="s-exos" style="margin-top:12px"></div>
    <button class="btn btn-secondary btn-block" id="s-add-exo" style="margin:6px 0 14px">${icons.plus} Ajouter un exercice</button>
    <button class="btn btn-primary btn-block" id="s-finish">${icons.check} ${session.editingId ? 'Valider les modifications' : 'Terminer la séance'}</button>
    <button class="btn btn-ghost btn-block" id="s-quit" style="margin-top:8px">${session.editingId ? 'Annuler les modifications' : 'Abandonner'}</button>
  </div>`);
  document.body.appendChild(overlay);
  document.body.classList.add('overlay-open');

  const chronoEl = overlay.querySelector('#s-chrono');
  chronoInterval = setInterval(() => {
    if (!session) return;
    if (session.running) session.elapsed++;
    chronoEl.textContent = formatTime(session.elapsed);
    const msTime = document.getElementById('ms-time');
    if (msTime) msTime.textContent = formatTime(session.elapsed);
    const msRest = document.getElementById('ms-rest');
    if (msRest) msRest.textContent = restInterval ? `· Repos ${formatTime(restRemaining)}` : '';
  }, 1000);

  const closeSession = () => {
    clearInterval(chronoInterval);
    stopRestTimer();
    session = null;
    sessionUI = null;
    removeMiniBar();
    document.body.classList.remove('overlay-open');
    overlay.remove();
    rerenderPage();
  };

  const renderExos = () => {
    const exosHost = overlay.querySelector('#s-exos');
    exosHost.innerHTML = session.exercises.length ? '' : '<div class="empty-state">Ajoute un premier exercice</div>';
    session.exercises.forEach((wx, idx) => {
      const def = exerciseLookup(wx.exerciseId);
      if (!def) return;
      const last = lastEntry(wx.exerciseId);
      const prevSets = last ? last.wx.sets : [];
      const curVol = exoVolume(wx);
      const imp = exoImprovement(wx.exerciseId, curVol);

      const rowCount = Math.max(wx.sets.length + 1, prevSets.length);
      let rowsHtml = '';
      for (let i = 0; i < rowCount; i++) {
        const confirmed = i < wx.sets.length;
        const s = confirmed ? wx.sets[i] : null;
        const prev = prevSets[i];
        rowsHtml += `<div class="set-row${confirmed ? ' done' : ''}" data-idx="${idx}" data-set="${i}">
          ${confirmed ? '<button class="sr-del" data-del aria-label="Supprimer la série">' + icons.trash + '</button>' : ''}
          <div class="sr-content">
            <span class="sr-n">${i + 1}</span>
            <button class="sr-prev" data-prev="${i}" ${prev ? '' : 'disabled'}>${prev ? `${prev.weight} × ${prev.reps}` : '–'}</button>
            <input class="sr-kg" type="number" inputmode="decimal" step="0.5" min="0" value="${confirmed ? s.weight : ''}" placeholder="${prev ? prev.weight : ''}">
            <input class="sr-reps" type="number" inputmode="numeric" min="1" value="${confirmed ? s.reps : ''}" placeholder="${prev ? prev.reps : ''}">
            <button class="sr-check${confirmed ? ' on' : ''}" data-check="${i}" aria-label="Valider la série">${icons.check}</button>
          </div>
        </div>`;
      }

      const card = el(`<div class="card exo-card">
        <div class="exo-head">
          <button class="exo-name-btn" data-detail="${idx}">
            <span>${def.name} ${wx.ss ? `<span class="ss-chip">SS${wx.ss}</span>` : ''} ${impBadge(imp)}</span>
            ${icons.chevron}
          </button>
          <button class="icon-btn" data-menu="${idx}" aria-label="Options">${icons.dots}</button>
        </div>
        <div class="set-table">
          <div class="set-thead"><span>SÉRIE</span><span>PRÉC</span><span>KG</span><span>RÉPS</span><span></span></div>
          ${rowsHtml}
        </div>
      </div>`);
      exosHost.appendChild(card);
    });
  };

  sessionUI = { overlay, renderExos, close: closeSession };
  renderExos();

  overlay.querySelector('#s-exos').addEventListener('click', (e) => {
    const prevBtn = e.target.closest('.sr-prev');
    if (prevBtn) {
      if (prevBtn.disabled) return;
      const row = prevBtn.closest('.set-row');
      const exoIdx = +row.dataset.idx; const i = +row.dataset.set;
      const last = lastEntry(session.exercises[exoIdx].exerciseId);
      const prev = last && last.wx.sets[i];
      if (prev) {
        row.querySelector('.sr-kg').value = prev.weight;
        row.querySelector('.sr-reps').value = prev.reps;
        haptic();
      }
      return;
    }
    const checkBtn = e.target.closest('.sr-check');
    if (checkBtn) {
      const row = checkBtn.closest('.set-row');
      const exoIdx = +row.dataset.idx; const i = +row.dataset.set;
      const wxx = session.exercises[exoIdx];
      if (i < wxx.sets.length) {
        wxx.sets.splice(i, 1); // décocher = retirer la série
        renderExos();
      } else {
        const w = parseFloat(row.querySelector('.sr-kg').value);
        const r = parseInt(row.querySelector('.sr-reps').value, 10);
        if (isNaN(w) || !r) { toast('Poids et reps requis', 'error'); return; }
        wxx.sets.push({ weight: w, reps: r });
        haptic();
        renderExos();
        startRestTimer(wxx.exerciseId);
      }
      return;
    }
    const delBtn = e.target.closest('.sr-del');
    if (delBtn) {
      const row = delBtn.closest('.set-row');
      session.exercises[+row.dataset.idx].sets.splice(+row.dataset.set, 1);
      renderExos();
      return;
    }
    const detailBtn = e.target.closest('[data-detail]');
    if (detailBtn) { openExerciseDetailSheet(session.exercises[+detailBtn.dataset.detail].exerciseId); return; }
    const menuBtn = e.target.closest('[data-menu]');
    if (menuBtn) openExoMenu(+menuBtn.dataset.menu);
  });

  // Édition inline d'une série déjà validée
  overlay.querySelector('#s-exos').addEventListener('change', (e) => {
    const inp = e.target.closest('.sr-kg, .sr-reps');
    if (!inp) return;
    const row = inp.closest('.set-row');
    const exoIdx = +row.dataset.idx; const i = +row.dataset.set;
    const wxx = session.exercises[exoIdx];
    if (i < wxx.sets.length) {
      const w = parseFloat(row.querySelector('.sr-kg').value);
      const r = parseInt(row.querySelector('.sr-reps').value, 10);
      if (!isNaN(w)) wxx.sets[i].weight = w;
      if (r) wxx.sets[i].reps = r;
    }
  });

  // Swipe vers la gauche sur une série validée → révèle la poubelle rouge
  (() => {
    const exosHost = overlay.querySelector('#s-exos');
    let row = null; let startX = 0; let startY = 0; let dx = 0; let mode = null; // null | 'h' | 'v'
    let openRow = null;
    const closeOpen = (except) => {
      if (openRow && openRow !== except) { openRow.querySelector('.sr-content').style.transform = ''; openRow.classList.remove('swiped'); openRow = null; }
    };
    exosHost.addEventListener('touchstart', (e) => {
      const r = e.target.closest('.set-row.done');
      closeOpen(r);
      if (!r) { row = null; return; }
      row = r; startX = e.touches[0].clientX; startY = e.touches[0].clientY; dx = 0; mode = null;
    }, { passive: true });
    exosHost.addEventListener('touchmove', (e) => {
      if (!row) return;
      const cx = e.touches[0].clientX; const cy = e.touches[0].clientY;
      dx = cx - startX; const dy = cy - startY;
      if (mode === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      if (mode !== 'h') return;
      e.preventDefault(); // bloque le scroll vertical pendant le swipe
      const base = row.classList.contains('swiped') ? -76 : 0;
      const t = Math.max(-76, Math.min(0, base + dx));
      row.querySelector('.sr-content').style.transform = `translateX(${t}px)`;
    }, { passive: false });
    exosHost.addEventListener('touchend', () => {
      if (!row || mode !== 'h') { row = null; mode = null; return; }
      const content = row.querySelector('.sr-content');
      const wasOpen = row.classList.contains('swiped');
      const open = wasOpen ? dx < 40 : dx < -40; // ouvrir si glissé assez à gauche
      if (open) { content.style.transform = 'translateX(-76px)'; row.classList.add('swiped'); openRow = row; }
      else { content.style.transform = ''; row.classList.remove('swiped'); if (openRow === row) openRow = null; }
      row = null; mode = null;
    });
  })();

  overlay.querySelector('#s-playpause').addEventListener('click', (e) => {
    session.running = !session.running;
    e.currentTarget.innerHTML = session.running ? icons.pause : icons.play;
  });
  overlay.querySelector('#s-minimize').addEventListener('click', minimizeSession);
  overlay.querySelector('#s-quit').addEventListener('click', () => {
    confirmModal(
      session.editingId ? 'Annuler les modifications' : 'Abandonner',
      session.editingId ? 'Les modifications ne seront pas enregistrées. Continuer ?' : 'La séance sera perdue. Continuer ?',
      closeSession, true,
    );
  });
  overlay.querySelector('#s-add-exo').addEventListener('click', () => {
    openExercisePicker((exo) => {
      session.exercises.push({ exerciseId: exo.id, sets: [] });
      renderExos();
    });
  });
  overlay.querySelector('#s-finish').addEventListener('click', () => {
    const withSets = session.exercises.filter((x) => x.sets.length);
    if (!withSets.length) { toast('Aucune série enregistrée', 'error'); return; }
    showSummary(withSets, closeSession);
  });
}

function showSummary(exercises, closeSession) {
  const s = store.userData.settings;
  const totalVolume = exercises.reduce((a, x) => a + exoVolume(x), 0);
  const totalSets = exercises.reduce((a, x) => a + x.sets.length, 0);
  const byMuscle = workoutMuscleVolume({ exercises }, exerciseLookup, s.secondaryRatio);
  const atten = muscleAttenuation({ exercises }, exerciseLookup, s.secondaryRatio);
  const breakdown = Object.keys(atten).sort((a, b) => atten[b] - atten[a]);
  const impVals = exercises.map((x) => exoImprovement(x.exerciseId, exoVolume(x))).filter((v) => v != null);
  const sessImp = impVals.length ? Math.round(impVals.reduce((a, b) => a + b, 0) / impVals.length) : null;
  const progress = exercises
    .map((x) => ({ name: (exerciseLookup(x.exerciseId) || { name: x.exerciseId }).name, imp: exoImprovement(x.exerciseId, exoVolume(x)) }))
    .filter((p) => p.imp != null && p.imp > 0)
    .sort((a, b) => b.imp - a.imp);

  const content = el(`<div>
    <div class="grid-2" style="margin-bottom:12px">
      <div class="card" style="margin:0;text-align:center;padding:10px"><div class="muted">Durée</div><div class="num" style="font-size:1.2rem;color:var(--accent)">${formatTime(session.elapsed)}</div></div>
      <div class="card" style="margin:0;text-align:center;padding:10px"><div class="muted">Séries</div><div class="num" style="font-size:1.2rem;color:var(--accent)">${totalSets}</div></div>
    </div>
    ${sessImp != null ? `<div class="wd-sess-imp ${sessImp >= 0 ? 'up' : 'down'}" style="text-align:center;margin-bottom:12px">Amélioration de la séance : ${sessImp >= 0 ? '+' : ''}${sessImp}%</div>` : ''}
    ${progress.length ? `<h3 style="margin:2px 0 6px">Tu as progressé sur</h3>
      <div class="recap-list">${progress.map((p) => `<div class="recap-row"><span>${p.name}</span>${impBadge(p.imp, false)}</div>`).join('')}</div>` : ''}
    <h3 style="margin:14px 0 6px">Coefficients d'atténuation</h3>
    <div class="muted" style="font-size:0.72rem;margin-bottom:8px">Implication moyenne par muscle (1.0 = moteur principal) · Δ vs dernière séance</div>
    <table class="volume-table">
      <thead><tr><th>Muscle</th><th>Atténuation</th><th>Δ</th></tr></thead>
      <tbody>${breakdown.map((m) => {
        const v = byMuscle[m] || 0;
        const lastV = lastMuscleVolume(m);
        const imp = lastV ? Math.round(((v / lastV) - 1) * 100) : null;
        return `<tr><td>${muscleLabel(m)}</td><td class="tnum" style="color:var(--accent)">${atten[m].toFixed(2)}</td><td>${imp != null ? impBadge(imp, false) : '<span class="muted">—</span>'}</td></tr>`;
      }).join('')}</tbody>
    </table>
    <button class="btn btn-secondary btn-block" id="sum-note" style="margin-top:14px">${icons.edit} <span id="sum-note-lbl">${session.notes ? 'Modifier la note' : 'Note de séance'}</span></button>
    ${session.notes ? `<div class="wd-note" id="sum-note-preview" style="margin-top:8px">${session.notes}</div>` : '<div id="sum-note-preview"></div>'}
  </div>`);

  content.querySelector('#sum-note').addEventListener('click', () => {
    const ta = el(`<textarea class="note-input" rows="4" placeholder="Ressenti, charges, douleurs…">${(session.notes || '').replace(/</g, '&lt;')}</textarea>`);
    openModal({
      title: 'Note de séance',
      content: ta,
      actions: [
        { label: 'Annuler' },
        {
          label: 'Enregistrer', variant: 'btn-primary',
          onClick: (body) => {
            session.notes = body.querySelector('.note-input').value.trim();
            content.querySelector('#sum-note-lbl').textContent = session.notes ? 'Modifier la note' : 'Note de séance';
            content.querySelector('#sum-note-preview').outerHTML = session.notes
              ? `<div class="wd-note" id="sum-note-preview" style="margin-top:8px">${session.notes.replace(/</g, '&lt;')}</div>`
              : '<div id="sum-note-preview"></div>';
          },
        },
      ],
    });
  });

  openModal({
    title: 'Résumé de séance',
    content,
    wide: true,
    actions: [
      { label: 'Retour' },
      {
        label: 'Valider', variant: 'btn-primary',
        onClick: () => {
          const payload = {
            id: session.editingId || crypto.randomUUID(),
            date: session.date,
            notes: session.notes,
            exercises,
            totalVolume: Math.round(totalVolume),
            totalTime: session.elapsed,
          };
          if (session.editingId) store.updateWorkout(payload);
          else store.addWorkout(payload);
          toast(session.editingId ? 'Séance mise à jour' : 'Séance enregistrée', 'success');
          closeSession();
        },
      },
    ],
  });
}

// ============================================================
// ROUTINES
// ============================================================
function openRoutineEditor(routine, rerender) {
  const r = routine
    ? { ...routine, exercises: [...routine.exercises] }
    : { id: crypto.randomUUID(), name: '', exercises: [] };
  const form = el(`<div>
    <label class="field"><span>Nom</span><input id="r-name" type="text" value="${r.name}" placeholder="Push A"></label>
    <div id="r-exos"></div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-secondary btn-sm" id="r-add" style="flex:1">${icons.plus} Exercice</button>
      <button class="btn btn-secondary btn-sm" id="r-reorder" style="flex:1">${icons.drag} Réorganiser</button>
    </div>
  </div>`);

  const listEl = form.querySelector('#r-exos');
  const renderList = () => {
    listEl.innerHTML = r.exercises.length ? '' : '<div class="empty-state">Aucun exercice</div>';
    r.exercises.forEach((id, i) => {
      const def = exerciseLookup(id);
      const row = el(`<div class="card-row" style="padding:7px 0;border-bottom:1px solid rgba(0,217,255,0.08)">
        <span style="font-size:0.9rem">${i + 1}. ${def ? def.name : id}</span>
        <button class="icon-btn danger" aria-label="Retirer" style="width:38px;height:38px">${icons.trash}</button>
      </div>`);
      row.querySelector('button').addEventListener('click', () => { r.exercises.splice(i, 1); renderList(); });
      listEl.appendChild(row);
    });
  };
  renderList();
  form.querySelector('#r-add').addEventListener('click', () => {
    openExercisePicker((exo) => { r.exercises.push(exo.id); renderList(); });
  });
  form.querySelector('#r-reorder').addEventListener('click', () => {
    if (r.exercises.length < 2) return;
    const labels = r.exercises.map((id) => (exerciseLookup(id) || { name: id }).name);
    openReorderSheet(labels, (order) => {
      r.exercises = order.map((i) => r.exercises[i]);
      renderList();
    });
  });

  openModal({
    title: routine ? 'Modifier la routine' : 'Nouvelle routine',
    content: form,
    actions: [
      { label: 'Annuler' },
      ...(routine ? [{ label: 'Supprimer', variant: 'btn-danger', onClick: () => { store.deleteRoutine(r.id); rerender(); } }] : []),
      {
        label: 'Enregistrer', variant: 'btn-primary',
        onClick: (body) => {
          r.name = body.querySelector('#r-name').value.trim() || 'Routine';
          store.saveRoutine(r);
          rerender();
        },
      },
    ],
  });
}

// ============================================================
// VOLUME DASHBOARD
// ============================================================
// ============================================================
// OBJECTIFS DE VOLUME (déplacés depuis les réglages)
// ============================================================
function openVolumeGoalsModal(rerender) {
  const goals = store.userData.settings.volumeGoals;
  const form = el(`<div>${MUSCLES.map((m) => `
    <div class="settings-row" style="padding:7px 0">
      <span class="row-label">${m.label}</span>
      <input type="number" inputmode="numeric" data-m="${m.id}" min="0" max="40" value="${goals[m.id] || 0}" style="width:80px;min-height:40px">
    </div>`).join('')}
    <div class="muted" style="margin-top:8px">Sets / semaine / muscle</div>
  </div>`);
  openModal({
    title: 'Objectifs de volume',
    content: form,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Enregistrer', variant: 'btn-primary',
        onClick: (body) => {
          const vg = {};
          body.querySelectorAll('input[data-m]').forEach((inp) => { vg[inp.dataset.m] = parseInt(inp.value, 10) || 0; });
          store.saveUserData({ settings: { volumeGoals: vg } });
          rerender();
        },
      },
    ],
  });
}

// ============================================================
// CALENDRIER DES SÉANCES
// ============================================================
const WD = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const pad2 = (n) => String(n).padStart(2, '0');

function workoutsByDate() {
  const map = {};
  for (const w of store.userData.workouts) (map[w.date] = map[w.date] || []).push(w);
  return map;
}
function isoOf(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function mondayOf(d) { const x = new Date(d); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); return x; }

function earliestDataDate() {
  const dates = [];
  store.userData.workouts.forEach((w) => dates.push(w.date));
  store.userData.weights.forEach((w) => dates.push(w.date));
  Object.keys(store.userData.nutrition.byDate).forEach((d) => dates.push(d));
  Object.keys(store.userData.steps.byDate).forEach((d) => dates.push(d));
  if (!dates.length) return todayISO();
  return dates.sort()[0];
}

function dayCell(iso, byDate, todayIso, dim) {
  const ws = byDate[iso];
  const has = ws && ws.length;
  let extra = '';
  if (has) {
    const w = ws[ws.length - 1];
    const tm = topMuscle(w);
    const imp = sessionImprovement(w);
    extra = `<span class="cal-mus">${tm ? (MUSCLE_SHORT[tm] || muscleLabel(tm)) : ''}</span>
      ${imp != null ? `<span class="cal-imp ${imp >= 0 ? 'up' : 'down'}">${imp >= 0 ? '+' : ''}${imp}%</span>` : ''}`;
  }
  return el(`<button class="cal-day${has ? ' has-session' : ''}${iso === todayIso ? ' is-today' : ''}${dim ? ' dim' : ''}" ${has ? '' : 'disabled'} data-date="${iso}">
    <span class="cal-dnum">${Number(iso.slice(8))}</span>
    ${extra}
  </button>`);
}

function renderTwoWeekCalendar(host) {
  const byDate = workoutsByDate();
  const t = new Date();
  const todayIso = isoOf(t);
  const start = mondayOf(t);
  start.setDate(start.getDate() - 7); // lundi il y a deux semaines

  const card = el(`<div class="card">
    <div class="card-row" style="margin-bottom:8px">
      <h3 style="margin:0">Calendrier</h3>
      <button class="btn btn-ghost btn-sm" id="cal-more">${icons.calendar} Voir plus</button>
    </div>
    <div class="cal-wd">${WD.map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid" id="cal-grid"></div>
  </div>`);
  const grid = card.querySelector('#cal-grid');
  for (let i = 0; i < 14; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const iso = isoOf(d);
    grid.appendChild(dayCell(iso, byDate, todayIso, iso > todayIso));
  }
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.cal-day'); if (!b || b.disabled) return;
    const ws = byDate[b.dataset.date]; if (!ws) return;
    openWorkoutDetail(ws[ws.length - 1]);
  });
  card.querySelector('#cal-more').addEventListener('click', () => openFullCalendar());
  host.appendChild(card);
}

function monthGrid(year, month, byDate, todayIso) {
  const first = new Date(year, month, 1);
  const monthName = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const wrap = el(`<div class="cal-month">
    <div class="cal-month-title">${monthName}</div>
    <div class="cal-wd">${WD.map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid"></div>
  </div>`);
  const grid = wrap.querySelector('.cal-grid');
  for (let i = 0; i < offset; i++) grid.appendChild(el('<span class="cal-empty"></span>'));
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    grid.appendChild(dayCell(iso, byDate, todayIso, iso > todayIso));
  }
  return wrap;
}

function openFullCalendar() {
  const byDate = workoutsByDate();
  const todayIso = todayISO();
  const overlay = el(`<div class="picker-overlay cal-overlay">
    <div class="picker-topbar">
      <h3 style="margin:0;flex:1">Historique complet</h3>
      <button class="icon-btn" id="cal-close" aria-label="Fermer">${icons.close}</button>
    </div>
    <div class="cal-scroll" id="cal-scroll"></div>
  </div>`);
  document.body.appendChild(overlay);
  const wasOpen = document.body.classList.contains('overlay-open');
  document.body.classList.add('overlay-open');
  const close = () => { overlay.remove(); if (!wasOpen) document.body.classList.remove('overlay-open'); };

  const scroll = overlay.querySelector('#cal-scroll');
  const start = parseISO(earliestDataDate());
  const end = new Date();
  const months = [];
  let y = start.getFullYear(); let m = start.getMonth();
  while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
    months.push([y, m]);
    m++; if (m > 11) { m = 0; y++; }
  }
  months.reverse().forEach(([yy, mm]) => scroll.appendChild(monthGrid(yy, mm, byDate, todayIso)));

  scroll.addEventListener('click', (e) => {
    const b = e.target.closest('.cal-day'); if (!b || b.disabled) return;
    const ws = byDate[b.dataset.date]; if (!ws) return;
    close();
    openWorkoutDetail(ws[ws.length - 1]);
  });
  overlay.querySelector('#cal-close').addEventListener('click', close);
}

function renderVolumeDashboard(host, rerender) {
  const s = store.userData.settings;
  if (!s.volumeTrackingEnabled) return;
  const end = todayISO();
  const start = todayISO(-6);
  const sets = weeklySetsByMuscle(store.userData.workouts, exerciseLookup, start, end, s.secondaryRatio);
  const goals = s.volumeGoals;

  const rows = MUSCLES.map((m) => {
    const done = Math.round((sets[m.id] || 0) * 10) / 10;
    const goal = goals[m.id] || 0;
    const pct = goal ? Math.round((done / goal) * 100) : 0;
    return { m, done, goal, pct };
  });

  const card = el(`<div class="card">
    <div class="card-row" style="margin-bottom:6px">
      <h3 style="margin:0">Volume hebdo</h3>
      <button class="btn btn-secondary btn-sm" id="vol-goals-btn">${icons.edit} Objectifs</button>
    </div>

    <table class="volume-table" id="vol-table">
      <thead><tr><th>Muscle</th><th>Sets</th><th>Obj.</th><th>%</th></tr></thead>
      <tbody>
        ${rows.map((r) => `<tr class="vol-row" data-m="${r.m.id}">
          <td>${r.m.label}</td>
          <td class="tnum">${r.done}</td>
          <td class="tnum">${r.goal}</td>
          <td class="tnum ${r.pct >= 100 ? 'pct-ok' : r.pct >= 50 ? '' : 'pct-warn'}">${r.goal ? r.pct + '%' : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="muted" style="font-size:0.68rem;margin-top:4px">Touchez un muscle pour sa progression</div>
    <div class="chart-wrap" style="margin-top:14px;height:180px"><canvas id="vol-chart"></canvas></div>
    <h3 style="margin-top:16px;margin-bottom:2px">Amélioration des séances</h3>
    <div class="muted" style="font-size:0.7rem;margin-bottom:6px">Coefficient d'amélioration (%) au fil du temps</div>
    <div class="chart-wrap" style="height:170px"><canvas id="imp-chart"></canvas></div>
  </div>`);
  host.appendChild(card);

  card.querySelector('#vol-table').addEventListener('click', (e) => {
    const tr = e.target.closest('.vol-row');
    if (tr) openMuscleChart(tr.dataset.m);
  });

  const acc = {};
  for (const w of store.userData.workouts) {
    if (w.date < start || w.date > end) continue;
    const bm = workoutMuscleVolume(w, exerciseLookup, s.secondaryRatio);
    for (const [m, v] of Object.entries(bm)) acc[m] = (acc[m] || 0) + v;
  }
  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#9CA3AF', font: { size: 8, family: 'Inter' } }, grid: { color: 'rgba(0,217,255,0.06)' } },
      y: { ticks: { color: '#9CA3AF', font: { size: 9, family: 'Inter' } }, grid: { color: 'rgba(0,217,255,0.06)' } },
    },
  };
  if (volumeChart) volumeChart.destroy();
  volumeChart = new Chart(card.querySelector('#vol-chart'), {
    type: 'bar',
    data: { labels: MUSCLES.map((m) => m.label), datasets: [{ data: MUSCLES.map((m) => Math.round(acc[m.id] || 0)), backgroundColor: 'rgba(0,217,255,0.55)', borderRadius: 5 }] },
    options: chartOpts,
  });

  // Graphe amélioration des séances — 2 dernières semaines, axe vertical fixé à [-100, 100] %
  const sorted = [...store.userData.workouts].sort((a, b) => a.date.localeCompare(b.date));
  const weekStart = todayISO(-13);
  const impPts = [];
  for (const w of sorted) {
    if (w.date < weekStart) continue;
    const si = sessionImprovement(w);
    if (si != null) impPts.push({ date: w.date, v: Math.max(-100, Math.min(100, si)) });
  }
  if (impChart) impChart.destroy();
  impChart = new Chart(card.querySelector('#imp-chart'), {
    type: 'line',
    data: {
      labels: impPts.map((p) => p.date.slice(5)),
      datasets: [{ data: impPts.map((p) => p.v), borderColor: '#22D3A6', backgroundColor: 'rgba(34,211,166,0.14)', fill: true, tension: 0.3, pointRadius: 3 }],
    },
    options: {
      ...chartOpts,
      scales: {
        x: chartOpts.scales.x,
        y: { ...chartOpts.scales.y, min: -100, max: 100, ticks: { ...chartOpts.scales.y.ticks, callback: (v) => v + '%' } },
      },
    },
  });

  const vgBtn = card.querySelector('#vol-goals-btn');
  if (vgBtn && rerender) vgBtn.addEventListener('click', () => openVolumeGoalsModal(rerender));
}

// Navigateur d'exercices : liste + recherche (sans accents) → statistiques
function openExerciseBrowser() {
  const overlay = el(`<div class="picker-overlay">
    <div class="picker-topbar">
      <input id="xb-search" type="text" placeholder="Rechercher un exercice…" autocomplete="off">
      <button class="icon-btn" id="xb-close" aria-label="Fermer">${icons.close}</button>
    </div>
    <div class="picker-list" id="xb-list"></div>
  </div>`);
  document.body.appendChild(overlay);
  const wasOpen = document.body.classList.contains('overlay-open');
  document.body.classList.add('overlay-open');
  const close = () => { overlay.remove(); if (!wasOpen) document.body.classList.remove('overlay-open'); };
  const list = overlay.querySelector('#xb-list');
  const draw = (q = '') => {
    const nq = normalizeStr(q);
    const items = allExercises()
      .map((e) => ({ e, name: (exerciseLookup(e.id) || e).name }))
      .filter((x) => normalizeStr(x.name).includes(nq))
      .sort((a, b) => a.name.localeCompare(b.name));
    list.innerHTML = items.length ? '' : '<div class="empty-state">Aucun résultat</div>';
    for (const { e, name } of items.slice(0, 150)) {
      const b = el(`<button class="exo-search-item"><span>${name}</span><span class="cat">${e.category}</span></button>`);
      b.addEventListener('click', () => { close(); openExerciseDetailSheet(e.id); });
      list.appendChild(b);
    }
  };
  draw();
  overlay.querySelector('#xb-search').addEventListener('input', (e) => draw(e.target.value));
  overlay.querySelector('#xb-close').addEventListener('click', close);
  setTimeout(() => overlay.querySelector('#xb-search').focus(), 250);
}

// Clic sur un muscle : exercices de la semaine qui l'ont travaillé + amélioration dans le temps
function openMuscleChart(muscleId) {
  const ratio = store.userData.settings.secondaryRatio;
  const sorted = [...store.userData.workouts].sort((a, b) => a.date.localeCompare(b.date));

  const weekStart = todayISO(-6);
  const perExo = {};
  for (const w of store.userData.workouts) {
    if (w.date < weekStart) continue;
    for (const wx of w.exercises) {
      const def = exerciseLookup(wx.exerciseId);
      if (!def) continue;
      const pm = def.primaryMuscles.find((m) => m.m === muscleId);
      const sm = def.secondaryMuscles.find((m) => m.m === muscleId);
      if (!pm && !sm) continue;
      const share = pm ? pm.p / 100 : (sm.p / 100) * ratio;
      const e = perExo[wx.exerciseId] || (perExo[wx.exerciseId] = { name: def.name, sets: 0, vol: 0, primary: !!pm });
      e.sets += wx.sets.length;
      e.vol += exoVolume(wx) * share;
    }
  }
  const exoRows = Object.entries(perExo).sort((a, b) => b[1].sets - a[1].sets);

  const series = [];
  for (const w of sorted) {
    const bm = workoutMuscleVolume(w, exerciseLookup, ratio);
    if (bm[muscleId]) series.push({ v: bm[muscleId] });
  }
  const pts = [];
  for (let i = 1; i < series.length; i++) {
    if (!series[i - 1].v) continue;
    pts.push(Math.max(-100, Math.min(100, Math.round(((series[i].v / series[i - 1].v) - 1) * 100))));
  }

  const content = el(`<div>
    <h3 style="margin:0 0 4px">Exercices cette semaine</h3>
    <div class="muted" style="font-size:0.7rem;margin-bottom:8px">Ce qui a compté pour ${muscleLabel(muscleId)} sur 7 jours</div>
    <div id="mus-exos">${exoRows.length ? '' : '<div class="empty-state">Aucun exercice cette semaine</div>'}</div>
    <h3 style="margin:16px 0 6px">Amélioration</h3>
    <div class="chart-wrap" style="height:170px"><canvas id="mus-chart"></canvas></div>
  </div>`);
  const listHost = content.querySelector('#mus-exos');
  for (const [id, e] of exoRows) {
    const row = el(`<div class="mus-exo-row" data-exo="${id}">
      <div>
        <div class="mus-exo-name">${e.name} ${e.primary ? '' : '<span class="badge violet" style="font-size:0.56rem">secondaire</span>'}</div>
        <div class="muted">${e.sets} série${e.sets > 1 ? 's' : ''} · ${Math.round(e.vol).toLocaleString('fr-FR')} kg pondérés</div>
      </div>
      ${icons.chevron}
    </div>`);
    row.addEventListener('click', () => openExerciseDetailSheet(id));
    listHost.appendChild(row);
  }

  openModal({ title: `${muscleLabel(muscleId)}`, content, wide: true, actions: [{ label: 'Fermer', variant: 'btn-primary' }] });
  if (!pts.length) return;
  const opts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#9CA3AF', font: { size: 8, family: 'Inter' } }, grid: { color: 'rgba(0,217,255,0.06)' } },
      y: { min: -100, max: 100, ticks: { color: '#9CA3AF', font: { size: 9, family: 'Inter' }, callback: (v) => v + '%' }, grid: { color: 'rgba(0,217,255,0.06)' } },
    },
  };
  new Chart(content.querySelector('#mus-chart'), {
    type: 'line',
    data: { labels: pts.map((_, i) => i + 1), datasets: [{ data: pts, borderColor: '#00D9FF', backgroundColor: 'rgba(0,217,255,0.15)', fill: true, tension: 0.3, pointRadius: 3 }] },
    options: opts,
  });
}

// ============================================================
// RENDER PAGE
// ============================================================
export function render(container) {
  const rerender = () => render(container);
  pageRerender = rerender;
  const routines = store.userData.routines;
  const recent = [...store.userData.workouts].reverse().slice(0, 5);
  const active = !!session;

  container.innerHTML = '';
  const root = el(`<div>
    <div class="page-title"><h1>Entraînement</h1></div>
    <button class="btn btn-primary btn-block" id="btn-new-session" style="margin-bottom:var(--space)">
      ${icons.play} ${active ? 'Reprendre la séance' : 'Nouvelle séance'}
    </button>
    <div id="calendar-host"></div>
    <div class="card">
      <div class="card-row" style="margin-bottom:8px">
        <h3 style="margin:0">Routines</h3>
        <button class="btn btn-secondary btn-sm" id="btn-new-routine">${icons.plus}</button>
      </div>
      <div id="routine-list">${routines.length ? '' : '<div class="empty-state">Aucune routine</div>'}</div>
    </div>
    <div id="volume-host"></div>
    <button class="btn btn-secondary btn-block" id="btn-exo-browser" style="margin-top:6px">${icons.book} Exercices & statistiques</button>
  </div>`);
  container.appendChild(root);

  const rlist = root.querySelector('#routine-list');
  for (const r of routines) {
    const names = r.exercises.map((id) => (exerciseLookup(id) || { name: id }).name).join(' · ');
    const card = el(`<div class="card" style="background:var(--surface-2);padding:12px">
      <div class="card-row"><h3 style="margin:0">${r.name}</h3>
        <button class="icon-btn" aria-label="Modifier">${icons.edit}</button></div>
      <div class="muted" style="margin:4px 0 10px">${names || 'Vide'}</div>
      <button class="btn btn-primary btn-sm btn-block">Lancer</button>
    </div>`);
    card.querySelector('.icon-btn').addEventListener('click', () => openRoutineEditor(r, rerender));
    card.querySelector('.btn-primary').addEventListener('click', () => openSession(rerender, r));
    rlist.appendChild(card);
  }

  const recList = root.querySelector('#recent-list');
  if (recList) {
    for (const w of recent) {
      const row = el(`<div class="steps-list-item" style="cursor:pointer">
        <span>${w.date} · ${w.exercises.length} exos</span>
        <span class="num" style="color:var(--accent)">${w.totalVolume.toLocaleString('fr-FR')} kg</span>
      </div>`);
      row.addEventListener('click', () => openWorkoutDetail(w));
      recList.appendChild(row);
    }
  }

  root.querySelector('#btn-new-session').addEventListener('click', () => openSession(rerender));
  root.querySelector('#btn-new-routine').addEventListener('click', () => openRoutineEditor(null, rerender));

  renderVolumeDashboard(root.querySelector('#volume-host'), rerender);
  renderTwoWeekCalendar(root.querySelector('#calendar-host'));
  root.querySelector('#btn-exo-browser').addEventListener('click', openExerciseBrowser);
}
