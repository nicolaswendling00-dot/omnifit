// OmniFit — PAGE 2 : Entraînement (routines, séances, volume tracking)
import { store, todayISO } from '../utils/storage.js';
import { EXERCISES, MUSCLES, muscleLabel, EQUIPMENT_TYPES } from '../data/exercises.js';
import {
  calculateCExo, calculateCMuscle, formatTime,
  workoutMuscleVolume, weeklySetsByMuscle, topExercisesByVolume,
} from '../utils/math.js';
import { el, icons, openModal, openSheet, toast, confirmModal, beep, haptic } from '../utils/ui.js';

let volumeChart = null;
let trendChart = null;
let session = null; // { startTs, elapsed, running, date, notes, exercises: [{exerciseId, sets:[{weight,reps}]}] }
let chronoInterval = null;
let restInterval = null;

// ---------- Lookup exercices (base + customs, filtres settings) ----------
export function allExercises() {
  return [...EXERCISES, ...(store.userData.settings.customExercises || [])];
}
export function exerciseLookup(id) {
  return allExercises().find((e) => e.id === id);
}
function filteredExercises() {
  const s = store.userData.settings;
  let list = allExercises();
  if (!s.exerciseDbFull) list = list.filter((e) => e.difficulty === 'Beginner' || e.isCustom);
  if (s.equipmentFilter && s.equipmentFilter.length) {
    list = list.filter((e) => s.equipmentFilter.includes(e.equipment) || e.isCustom);
  }
  return list;
}

function lastPerf(exerciseId) {
  for (let i = store.userData.workouts.length - 1; i >= 0; i--) {
    const wx = store.userData.workouts[i].exercises.find((x) => x.exerciseId === exerciseId);
    if (wx && wx.sets.length) {
      const best = wx.sets.reduce((a, s) => (s.weight > a.weight ? s : a), wx.sets[0]);
      return `${best.weight}kg × ${best.reps} reps (${store.userData.workouts[i].date})`;
    }
  }
  return null;
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
    <label class="field"><span>Nom de l'exercice</span><input id="cx-name" type="text" placeholder="Mon exercice"></label>
    <h3 style="font-size:0.85rem;margin:8px 0 4px">Muscles principaux</h3>
    <div style="max-height:150px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px 10px">${muscleRows('prim')}</div>
    <h3 style="font-size:0.85rem;margin:12px 0 4px">Muscles secondaires</h3>
    <div style="max-height:150px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px 10px">${muscleRows('sec')}</div>
    <label class="field" style="margin-top:12px"><span>Notes (optionnel)</span><input id="cx-notes" type="text"></label>
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
            notes: body.querySelector('#cx-notes').value.trim(),
          };
          const customs = [...(store.userData.settings.customExercises || []), exo];
          store.saveUserData({ settings: { customExercises: customs } });
          toast('Exercice créé', 'success');
          if (onCreated) onCreated(exo);
        },
      },
    ],
  });
}

// ============================================================
// SÉLECTEUR D'EXERCICE (dropdown searchable)
// ============================================================
function openExercisePicker(onPick) {
  const form = el(`<div>
    <input id="exo-search" type="text" placeholder="Rechercher un exercice…" autocomplete="off">
    <div class="exo-search-list" id="exo-list"></div>
    <button class="btn btn-secondary btn-block" id="btn-custom" style="margin-top:10px">${icons.plus} Custom</button>
  </div>`);
  const sheet = openSheet({ title: 'Ajouter un exercice', content: form });

  const list = form.querySelector('#exo-list');
  const renderList = (q = '') => {
    const items = filteredExercises().filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
    list.innerHTML = items.length ? '' : '<div class="empty-state">Aucun résultat</div>';
    for (const e of items.slice(0, 80)) {
      const b = el(`<button class="exo-search-item">
        <span>${e.name}</span>
        <span class="cat">${e.category} · ${e.equipment}</span>
      </button>`);
      b.addEventListener('click', () => { sheet.close(); onPick(e); });
      list.appendChild(b);
    }
  };
  renderList();
  form.querySelector('#exo-search').addEventListener('input', (e) => renderList(e.target.value));
  form.querySelector('#btn-custom').addEventListener('click', () => {
    sheet.close();
    openCustomExerciseModal((exo) => onPick(exo));
  });
}

// ============================================================
// TIMER DE REPOS (anneau SVG décomptant)
// ============================================================
function startRestTimer(host, duration) {
  clearInterval(restInterval);
  let remaining = duration;
  const size = 110, stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  host.innerHTML = `<div class="rest-timer-wrap">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(0,217,255,0.12)" stroke-width="${stroke}"/>
      <circle id="rt-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="0" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <text id="rt-txt" x="50%" y="54%" text-anchor="middle" class="ring-label" style="font-size:20px">${formatTime(remaining)}</text>
    </svg>
    <div class="rest-buttons">
      <button class="btn btn-ghost btn-sm" id="rt-skip">Skip repos</button>
      <button class="btn btn-secondary btn-sm" id="rt-plus">Repos +30s</button>
    </div>
  </div>`;

  const fg = host.querySelector('#rt-fg');
  const txt = host.querySelector('#rt-txt');
  const wrap = host.querySelector('.rest-timer-wrap');
  let total = duration;

  const tick = () => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(restInterval);
      if (store.userData.settings.soundEnabled) { beep(880); setTimeout(() => beep(1100), 180); }
      haptic();
      host.innerHTML = '';
      return;
    }
    txt.textContent = formatTime(remaining);
    fg.style.strokeDashoffset = c * (1 - remaining / total);
    if (remaining <= 5) wrap.classList.add('pulse');
  };
  restInterval = setInterval(tick, 1000);

  host.querySelector('#rt-skip').addEventListener('click', () => { clearInterval(restInterval); host.innerHTML = ''; });
  host.querySelector('#rt-plus').addEventListener('click', () => { remaining += 30; total += 30; txt.textContent = formatTime(remaining); });
}

// ============================================================
// MODE SÉANCE (overlay fullscreen)
// ============================================================
function openSession(rerenderPage, fromRoutine = null) {
  session = {
    startTs: Date.now(),
    elapsed: 0,
    running: true,
    date: todayISO(),
    notes: '',
    exercises: fromRoutine ? fromRoutine.exercises.map((id) => ({ exerciseId: id, sets: [] })) : [],
  };

  const overlay = el(`<div class="session-overlay">
    <div class="session-header">
      <div>
        <div class="session-chrono" id="s-chrono">00:00</div>
        <input id="s-date" type="date" value="${session.date}" style="margin-top:4px;max-width:160px;min-height:38px;padding:6px 10px;font-size:0.8rem">
      </div>
      <div style="display:flex;gap:6px">
        <button class="icon-btn" id="s-playpause" aria-label="Pause">${icons.pause}</button>
        <button class="btn btn-danger btn-sm" id="s-quit">Quitter</button>
      </div>
    </div>
    <label class="field"><span>Notes de séance</span><input id="s-notes" type="text" placeholder="Ressenti, remarques…"></label>
    <div id="s-exos"></div>
    <button class="btn btn-secondary btn-block" id="s-add-exo" style="margin:6px 0 14px">${icons.plus} Ajouter un exercice</button>
    <button class="btn btn-primary btn-block" id="s-finish">${icons.check} Terminer la séance</button>
  </div>`);
  document.body.appendChild(overlay);
  document.body.classList.add('overlay-open');

  const chronoEl = overlay.querySelector('#s-chrono');
  chronoInterval = setInterval(() => {
    if (session && session.running) {
      session.elapsed++;
      chronoEl.textContent = formatTime(session.elapsed);
    }
  }, 1000);

  const closeSession = () => {
    clearInterval(chronoInterval);
    clearInterval(restInterval);
    session = null;
    document.body.classList.remove('overlay-open');
    overlay.remove();
    rerenderPage();
  };

  overlay.querySelector('#s-playpause').addEventListener('click', (e) => {
    session.running = !session.running;
    e.currentTarget.innerHTML = session.running ? icons.pause : icons.play;
  });
  overlay.querySelector('#s-quit').addEventListener('click', () => {
    confirmModal('Quitter la séance', 'La séance en cours sera perdue. Continuer ?', closeSession, true);
  });
  overlay.querySelector('#s-date').addEventListener('change', (e) => { session.date = e.target.value; });
  overlay.querySelector('#s-notes').addEventListener('input', (e) => { session.notes = e.target.value; });

  const exosHost = overlay.querySelector('#s-exos');

  const renderExos = () => {
    exosHost.innerHTML = '';
    session.exercises.forEach((wx, idx) => {
      const def = exerciseLookup(wx.exerciseId);
      if (!def) return;
      const perf = lastPerf(wx.exerciseId);
      const showC = store.userData.settings.showCExo;
      const totalW = wx.sets.reduce((a, s) => a + s.weight, 0);
      const avgW = wx.sets.length ? totalW / wx.sets.length : 0;
      const avgR = wx.sets.length ? wx.sets.reduce((a, s) => a + s.reps, 0) / wx.sets.length : 0;
      const cExo = wx.sets.length ? calculateCExo(avgW, avgR, wx.sets.length) : 0;
      const pVol = def.primaryMuscles.reduce((a, m) => a + m.p, 0);
      const sVol = def.secondaryMuscles.reduce((a, m) => a + m.p, 0);
      const cMuscle = calculateCMuscle(pVol, sVol);

      const card = el(`<div class="card">
        <div class="card-row">
          <div>
            <h3>${def.name}</h3>
            <div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:5px">
              ${def.primaryMuscles.map((m) => `<span class="badge">${muscleLabel(m.m)} ${m.p}%</span>`).join('')}
              ${def.secondaryMuscles.map((m) => `<span class="badge violet">${muscleLabel(m.m)} ${m.p}%</span>`).join('')}
            </div>
            ${showC && wx.sets.length ? `<div style="margin-top:6px"><span class="badge green">C_exo: ${cExo.toFixed(1)}</span> <span class="badge green">C_muscle: ${cMuscle.toFixed(2)}</span></div>` : ''}
          </div>
          <button class="icon-btn danger" data-del="${idx}" aria-label="Supprimer exercice">${icons.trash}</button>
        </div>
        ${perf ? `<div class="exo-lastperf">Dernière perf : ${perf}</div>` : ''}
        <div class="sets-list">
          ${wx.sets.map((s, i) => `<div class="set-line"><span class="set-n">#${i + 1}</span><span>${s.weight}kg × ${s.reps} reps</span></div>`).join('')}
        </div>
        <div class="rest-host" data-rest="${idx}"></div>
        <div class="set-inputs">
          <label class="field"><span>Poids (kg)</span><input type="number" inputmode="decimal" step="0.5" min="0" class="in-weight" placeholder="0"></label>
          <label class="field"><span>Reps</span><input type="number" inputmode="numeric" min="1" class="in-reps" placeholder="0"></label>
          <button class="btn btn-primary btn-sm" data-addset="${idx}" style="min-height:44px">${icons.plus} Série</button>
        </div>
      </div>`);
      exosHost.appendChild(card);
    });
  };
  renderExos();

  exosHost.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-addset]');
    if (addBtn) {
      const idx = +addBtn.dataset.addset;
      const card = addBtn.closest('.card');
      const w = parseFloat(card.querySelector('.in-weight').value);
      const r = parseInt(card.querySelector('.in-reps').value, 10);
      if (isNaN(w) || !r) { toast('Poids et reps requis', 'error'); return; }
      session.exercises[idx].sets.push({ weight: w, reps: r });
      haptic();
      renderExos();
      const host = exosHost.querySelector(`[data-rest="${idx}"]`);
      if (host) startRestTimer(host, store.userData.settings.restTimerDefault);
      return;
    }
    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      const idx = +delBtn.dataset.del;
      confirmModal('Supprimer exercice', 'Retirer cet exercice de la séance ?', () => {
        session.exercises.splice(idx, 1);
        renderExos();
      }, true);
    }
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
  const totalVolume = exercises.reduce((a, x) => a + x.sets.reduce((b, st) => b + st.weight * st.reps, 0), 0);
  const w = { date: session.date, exercises };
  const byMuscle = workoutMuscleVolume(w, exerciseLookup, s.secondaryRatio);
  const breakdown = Object.entries(byMuscle).sort((a, b) => b[1] - a[1]);

  const content = el(`<div>
    <div class="grid-2" style="margin-bottom:12px">
      <div class="card" style="margin:0;text-align:center"><div class="muted">Durée</div><div class="mono" style="font-size:1.2rem;color:var(--accent)">${formatTime(session.elapsed)}</div></div>
      <div class="card" style="margin:0;text-align:center"><div class="muted">Exercices</div><div class="mono" style="font-size:1.2rem;color:var(--accent)">${exercises.length}</div></div>
    </div>
    <div class="card" style="text-align:center"><div class="muted">Volume total</div><div class="mono" style="font-size:1.5rem;color:var(--accent)">${Math.round(totalVolume).toLocaleString('fr-FR')} kg</div></div>
    <h3 style="margin:4px 0 8px">Répartition par muscle</h3>
    <table class="volume-table">
      <thead><tr><th>Muscle</th><th>Volume (kg)</th></tr></thead>
      <tbody>${breakdown.map(([m, v]) => `<tr><td>${muscleLabel(m)}</td><td class="num">${Math.round(v).toLocaleString('fr-FR')}</td></tr>`).join('')}</tbody>
    </table>
  </div>`);

  openModal({
    title: 'Résumé de séance',
    content,
    wide: true,
    actions: [
      { label: 'Retour' },
      {
        label: 'Valider la séance', variant: 'btn-primary',
        onClick: () => {
          store.addWorkout({
            id: crypto.randomUUID(),
            date: session.date,
            notes: session.notes,
            exercises,
            totalVolume: Math.round(totalVolume),
            totalTime: session.elapsed,
          });
          toast('Séance enregistrée', 'success');
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
  const r = routine || { id: crypto.randomUUID(), name: '', exercises: [] };
  const form = el(`<div>
    <label class="field"><span>Nom de la routine</span><input id="r-name" type="text" value="${r.name}" placeholder="Push A"></label>
    <div id="r-exos"></div>
    <button class="btn btn-secondary btn-block" id="r-add">${icons.plus} Ajouter exercice</button>
  </div>`);

  const listEl = form.querySelector('#r-exos');
  const renderList = () => {
    listEl.innerHTML = r.exercises.length ? '' : '<div class="empty-state">Aucun exercice</div>';
    r.exercises.forEach((id, i) => {
      const def = exerciseLookup(id);
      const row = el(`<div class="card-row" style="padding:7px 0;border-bottom:1px solid rgba(0,217,255,0.08)">
        <span>${def ? def.name : id}</span>
        <button class="icon-btn danger" aria-label="Retirer">${icons.trash}</button>
      </div>`);
      row.querySelector('button').addEventListener('click', () => { r.exercises.splice(i, 1); renderList(); });
      listEl.appendChild(row);
    });
  };
  renderList();
  form.querySelector('#r-add').addEventListener('click', () => {
    openExercisePicker((exo) => { r.exercises.push(exo.id); renderList(); });
  });

  openModal({
    title: routine ? 'Modifier la routine' : 'Nouvelle routine',
    content: form,
    actions: [
      { label: 'Annuler' },
      ...(routine ? [{
        label: 'Supprimer', variant: 'btn-danger',
        onClick: () => { store.deleteRoutine(r.id); rerender(); },
      }] : []),
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
// VOLUME TRACKING DASHBOARD
// ============================================================
function renderVolumeDashboard(host) {
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

  const alerts = rows.filter((r) => r.goal > 0 && r.pct < 50 && r.pct >= 0)
    .filter((r) => r.done < r.goal * 0.5);

  const card = el(`<div class="card">
    <h3>Volume hebdo (7 derniers jours)</h3>
    ${alerts.slice(0, 3).map((a) => `<div class="alert-banner">${muscleLabel(a.m.id)} en retard cette semaine (${a.pct}% de l'objectif)</div>`).join('')}
    <table class="volume-table">
      <thead><tr><th>Muscle</th><th>Sets</th><th>Objectif</th><th>Progrès</th></tr></thead>
      <tbody>
        ${rows.map((r) => `<tr>
          <td>${r.m.label}</td>
          <td class="num">${r.done}</td>
          <td class="num">${r.goal}</td>
          <td class="num ${r.pct >= 100 ? 'pct-ok' : r.pct >= 50 ? '' : 'pct-warn'}">${r.goal ? r.pct + '%' : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="chart-wrap" style="margin-top:14px;height:190px"><canvas id="vol-chart"></canvas></div>
    <h3 style="margin-top:14px">Top 5 exercices (volume)</h3>
    <div class="chart-wrap" style="height:170px"><canvas id="trend-chart"></canvas></div>
  </div>`);
  host.appendChild(card);

  const vols = workoutsWeekVolume(start, end, s.secondaryRatio);
  if (volumeChart) volumeChart.destroy();
  volumeChart = new Chart(card.querySelector('#vol-chart'), {
    type: 'bar',
    data: {
      labels: MUSCLES.map((m) => m.label),
      datasets: [{ label: 'Volume (kg)', data: MUSCLES.map((m) => Math.round(vols[m.id] || 0)), backgroundColor: 'rgba(0,217,255,0.55)', borderRadius: 5 }],
    },
    options: chartOpts(),
  });

  const top = topExercisesByVolume(store.userData.workouts, exerciseLookup, start, end, 5);
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(card.querySelector('#trend-chart'), {
    type: 'bar',
    data: {
      labels: top.map((t) => t.name),
      datasets: [{ label: 'Volume (kg)', data: top.map((t) => Math.round(t.vol)), backgroundColor: 'rgba(124,58,237,0.6)', borderRadius: 5 }],
    },
    options: { ...chartOpts(), indexAxis: 'y' },
  });
}

function workoutsWeekVolume(start, end, ratio) {
  const acc = {};
  for (const w of store.userData.workouts) {
    if (w.date < start || w.date > end) continue;
    const bm = workoutMuscleVolume(w, exerciseLookup, ratio);
    for (const [m, v] of Object.entries(bm)) acc[m] = (acc[m] || 0) + v;
  }
  return acc;
}

function chartOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#9CA3AF', font: { size: 8 } }, grid: { color: 'rgba(0,217,255,0.06)' } },
      y: { ticks: { color: '#9CA3AF', font: { size: 9 } }, grid: { color: 'rgba(0,217,255,0.06)' } },
    },
  };
}

// ============================================================
// RENDER PAGE
// ============================================================
export function render(container) {
  const rerender = () => render(container);
  const routines = store.userData.routines;
  const recent = [...store.userData.workouts].reverse().slice(0, 5);

  container.innerHTML = '';
  const root = el(`<div>
    <div class="page-title"><h1>Entraînement</h1></div>
    <button class="btn btn-primary btn-block" id="btn-new-session" style="margin-bottom:${'var(--space)'}">${icons.play} Nouvelle séance</button>
    <div class="card">
      <div class="card-row" style="margin-bottom:8px">
        <h3>Routines</h3>
        <button class="btn btn-secondary btn-sm" id="btn-new-routine">${icons.plus} Créer</button>
      </div>
      <div id="routine-list">${routines.length ? '' : '<div class="empty-state">Aucune routine sauvegardée</div>'}</div>
    </div>
    <div id="volume-host"></div>
    <div class="card">
      <h3>Séances récentes</h3>
      <div id="recent-list">${recent.length ? '' : '<div class="empty-state">Aucune séance enregistrée</div>'}</div>
    </div>
  </div>`);
  container.appendChild(root);

  const rlist = root.querySelector('#routine-list');
  for (const r of routines) {
    const names = r.exercises.map((id) => (exerciseLookup(id) || { name: id }).name).join(' · ');
    const card = el(`<div class="card routine-card" style="background:var(--surface-2)">
      <div class="card-row"><h3>${r.name}</h3>
        <button class="icon-btn" aria-label="Modifier">${icons.edit}</button></div>
      <div class="routine-exos">${names || 'Vide'}</div>
      <button class="btn btn-primary btn-sm btn-block">Lancer</button>
    </div>`);
    card.querySelector('.icon-btn').addEventListener('click', () => openRoutineEditor(r, rerender));
    card.querySelector('.btn-primary').addEventListener('click', () => openSession(rerender, r));
    rlist.appendChild(card);
  }

  const recList = root.querySelector('#recent-list');
  for (const w of recent) {
    recList.appendChild(el(`<div class="steps-list-item">
      <span>${w.date} · ${w.exercises.length} exos</span>
      <span class="mono" style="color:var(--accent)">${w.totalVolume.toLocaleString('fr-FR')} kg · ${formatTime(w.totalTime)}</span>
    </div>`));
  }

  root.querySelector('#btn-new-session').addEventListener('click', () => openSession(rerender));
  root.querySelector('#btn-new-routine').addEventListener('click', () => openRoutineEditor(null, rerender));

  renderVolumeDashboard(root.querySelector('#volume-host'));
}
