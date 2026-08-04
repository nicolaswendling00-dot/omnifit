// OmniFit — PAGE 0 : Accueil (stats d'abord, poids ensuite, graphique en modal)
import { store, todayISO } from '../utils/storage.js';
import { calculateSMA } from '../utils/math.js';
import { el, icons, openModal, toast, ringSVG, haptic, makeChart } from '../utils/ui.js';
import { macroGoals } from './nutrition.js';
import { computeGlobalRank } from '../utils/globalRank.js';
import { rankBadge, rankFromLP } from '../utils/ranks.js';

let weightChart = null;
let smaVisible = true;
let caloriesVisible = false;

function goalProgress() {
  const { goal, profile, weights } = store.userData;
  const start = weights.length ? weights[0].value : profile.weight;
  const current = weights.length ? weights[weights.length - 1].value : profile.weight;
  const target = goal.targetWeight;
  if (start === target) return 1;
  return Math.min(1, Math.max(0, (current - start) / (target - start)));
}

function openGoalModal(rerender) {
  const { goal } = store.userData;
  const form = el(`<div class="field-stack">
    <label class="field"><span>Objectif</span>
      <select id="g-type">${['Perte de poids', 'Prise de muscle', 'Recomposition'].map((t) => `<option ${t === goal.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="field"><span>Poids cible (kg)</span><input id="g-weight" type="number" step="0.1" inputmode="decimal" value="${goal.targetWeight}"></label>
  </div>`);
  openModal({
    title: 'Objectif',
    content: form,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Enregistrer', variant: 'btn-primary',
        onClick: (body) => {
          store.saveUserData({ goal: {
            type: body.querySelector('#g-type').value,
            targetWeight: parseFloat(body.querySelector('#g-weight').value) || goal.targetWeight,
          } });
          rerender();
        },
      },
    ],
  });
}

function openLogWeightModal(rerender, prefill = null) {
  const form = el(`<div class="field-stack">
    <label class="field"><span>Poids (kg)</span><input id="w-value" type="number" step="0.1" inputmode="decimal" placeholder="75.2" value="${prefill ? prefill.value : ''}" autofocus></label>
    <label class="field"><span>Date</span><input id="w-date" type="date" value="${prefill ? prefill.date : todayISO()}"></label>
  </div>`);
  openModal({
    title: prefill ? 'Modifier le poids' : 'Log poids',
    content: form,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Enregistrer', variant: 'btn-primary',
        onClick: (body) => {
          const v = parseFloat(body.querySelector('#w-value').value);
          const d = body.querySelector('#w-date').value;
          if (!v || !d) { toast('Valeur invalide', 'error'); return 'keep'; }
          store.addWeightLog(d, v);
          haptic();
          rerender();
        },
      },
    ],
  });
}

function openChartModal(rerender) {
  const recent = [...store.userData.weights].slice(-8).reverse();
  const content = el(`<div>
    <div class="chart-wrap" style="height:260px"><canvas id="weight-chart"></canvas></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-ghost btn-sm" id="btn-toggle-sma" style="flex:1">Tendance : ${smaVisible ? 'ON' : 'OFF'}</button>
      <button class="btn btn-ghost btn-sm" id="btn-toggle-cal" style="flex:1">Calories : ${caloriesVisible ? 'ON' : 'OFF'}</button>
    </div>
    <h3 style="margin:14px 0 4px">Entrées récentes</h3>
    <div id="w-recent">${recent.length ? '' : '<div class="empty-state">Aucune pesée</div>'}</div>
  </div>`);
  // À la fermeture, on détruit le graphique : sans ça il garde une référence sur
  // un canvas retiré du DOM (et ses écouteurs de redimensionnement).
  openModal({
    title: 'Poids — 14 jours',
    content,
    wide: true,
    actions: [],
    onClose: () => {
      if (weightChart) { try { weightChart.destroy(); } catch (_) { /* déjà détruit */ } weightChart = null; }
    },
  });
  const draw = () => renderWeightChart(content.querySelector('#weight-chart'));
  content.querySelector('#btn-toggle-sma').addEventListener('click', (e) => {
    smaVisible = !smaVisible;
    e.target.textContent = `Tendance : ${smaVisible ? 'ON' : 'OFF'}`;
    draw();
  });
  content.querySelector('#btn-toggle-cal').addEventListener('click', (e) => {
    caloriesVisible = !caloriesVisible;
    e.target.textContent = `Calories : ${caloriesVisible ? 'ON' : 'OFF'}`;
    draw();
  });
  const rec = content.querySelector('#w-recent');
  for (const w of recent) {
    const row = el(`<div class="steps-list-item" style="cursor:pointer">
      <span>${w.date}</span>
      <span class="num" style="color:var(--accent)">${w.value} kg</span>
    </div>`);
    row.addEventListener('click', () => openLogWeightModal(rerender || (() => draw()), { date: w.date, value: w.value }));
    rec.appendChild(row);
  }
  draw();
}

function renderWeightChart(canvas) {
  const days = [...Array(14)].map((_, i) => todayISO(i - 13));
  const map = Object.fromEntries(store.userData.weights.map((w) => [w.date, w.value]));
  const values = days.map((d) => map[d] ?? null);
  const known = store.userData.weights.map((w) => w.value);
  const sma = calculateSMA(known, 5);
  const smaMap = {};
  store.userData.weights.forEach((w, i) => { smaMap[w.date] = sma[i]; });
  const smaValues = days.map((d) => (smaMap[d] != null ? Math.round(smaMap[d] * 10) / 10 : null));
  const calValues = days.map((d) => {
    const t = store.dayTotals(d);
    return t.kcal ? Math.round(t.kcal) : null;
  });
  // Jours dont l'objectif a été lissé : on les marque d'un cercle CREUX (au lieu
  // d'un point plein) sur la courbe calories, sans changer la valeur affichée.
  const smoothedFlags = days.map((d) => {
    const day = store.userData.nutrition.byDate[d];
    return !!(day && day.smoothed);
  });
  const calPointBg = days.map((_, i) => (smoothedFlags[i] ? 'transparent' : '#FB923C'));
  const calPointBorder = days.map(() => '#FB923C');
  const calPointRadius = days.map((_, i) => (smoothedFlags[i] ? 5 : 3));
  const calPointBorderWidth = days.map((_, i) => (smoothedFlags[i] ? 2 : 1));

  const datasets = [
    { label: 'Poids (kg)', data: values, borderColor: '#00D9FF', backgroundColor: 'rgba(0,217,255,0.12)', borderWidth: 3, pointRadius: 4, pointBackgroundColor: '#00D9FF', tension: 0.3, spanGaps: true, yAxisID: 'y' },
    { label: 'SMA-5', data: smaValues, borderColor: '#7C3AED', borderWidth: 2, borderDash: [6, 4], pointRadius: 0, tension: 0.35, spanGaps: true, hidden: !smaVisible, yAxisID: 'y' },
  ];
  if (caloriesVisible) {
    datasets.push({ label: 'Calories', data: calValues, borderColor: '#FB923C', backgroundColor: 'rgba(251,146,60,0.12)', borderWidth: 2, pointRadius: calPointRadius, pointBackgroundColor: calPointBg, pointBorderColor: calPointBorder, pointBorderWidth: calPointBorderWidth, tension: 0.3, spanGaps: true, yAxisID: 'y1' });
  }

  const scales = {
    x: { ticks: { color: '#9CA3AF', font: { size: 9, family: 'Inter' } }, grid: { color: 'rgba(0,217,255,0.06)' } },
    y: { position: 'left', ticks: { color: '#9CA3AF', font: { size: 10, family: 'Inter' } }, grid: { color: 'rgba(0,217,255,0.06)' } },
  };
  if (caloriesVisible) {
    scales.y1 = { position: 'right', ticks: { color: '#FB923C', font: { size: 10, family: 'Inter' } }, grid: { drawOnChartArea: false } };
  }

  weightChart = makeChart(canvas, {
    type: 'line',
    data: { labels: days.map((d) => d.slice(8) + '/' + d.slice(5, 7)), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9CA3AF', boxWidth: 12, font: { size: 10, family: 'Inter' } } } },
      scales,
    },
  }, weightChart);
}

function openGlobalRankModal(gr) {
  const content = el(`<div>
    <div class="grd-row"><span>Rang</span><b style="color:${gr.rank.color}">${gr.rank.division ? `${gr.rank.name} ${gr.rank.division}` : gr.rank.name}</b></div>
    <div class="grd-row"><span>LP</span><b>${gr.lp}</b></div>
    <div class="grd-row"><span>Série en cours</span><b>${gr.streak} j</b></div>
    ${gr.lastSeasonPeak > 0 ? `<div class="grd-row"><span>Pic saison ${gr.season - 1}</span><b>${rankFromLP(gr.lastSeasonPeak).name}</b></div>` : ''}
  </div>`);
  openModal({ title: 'Rang global', content, actions: [{ label: 'Fermer' }] });
}

// Couleurs macros, alignées sur l'onglet Nutrition
const C_PROT = '#FB923C';
const C_CARB = '#38BDF8';
const C_FAT = '#8B5CF6';

// Petite barre de macro : libellé, jauge colorée, valeur / objectif.
function macroBar(label, done, goal, color) {
  const pct = goal ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  return `<div class="hk-macro">
    <div class="hk-macro-top"><span>${label}</span><span class="num">${Math.round(done)}<i>/${goal}g</i></span></div>
    <div class="hk-macro-bar"><i style="width:${pct}%;background:${color}"></i></div>
  </div>`;
}

// Courbe de poids tracée en fond de la carte : dernières pesées, normalisées
// sur la hauteur disponible. Purement décorative (aria-hidden).
function weightSparkline(weights) {
  const pts = (weights || []).slice(-14).map((w) => w.value);
  if (pts.length < 2) return '';
  const min = Math.min(...pts); const max = Math.max(...pts);
  const span = max - min || 1;
  const W = 100; const H = 40;
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = H - ((v - min) / span) * (H * 0.8) - H * 0.1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = coords.join(' ');
  const area = `0,${H} ${line} ${W},${H}`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="hw-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${area}" fill="url(#hw-grad)"/>
    <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="1.6"
      stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity="0.75"/>
  </svg>`;
}

// Part de la journée écoulée (0–1), pour situer l'avancement des pas par
// rapport à l'heure qu'il est.
function dayProgress() {
  const d = new Date();
  return (d.getHours() * 60 + d.getMinutes()) / 1440;
}

// Piste de progression des pas tracée en fond : une ligne qui se remplit
// jusqu'au drapeau d'arrivée, plus un repère à l'avancement de la journée
// (on voit d'un coup d'œil si on est en avance ou en retard).
function stepsTrack(ratio, timeRatio) {
  const p = Math.max(0, Math.min(1, ratio || 0));
  const t = Math.max(0, Math.min(1, timeRatio || 0));
  const W = 100; const H = 40; const y = 26;
  const x1 = 6; const x2 = 88;              // la ligne s'arrête avant le drapeau
  const fill = x1 + (x2 - x1) * p;
  const mark = x1 + (x2 - x1) * t;
  const done = p >= 1;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="var(--text-2)" stroke-opacity="0.25"
      stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <line class="ha-fill" x1="${x1}" y1="${y}" x2="${fill.toFixed(1)}" y2="${y}"
      stroke="url(#ha-grad)" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <defs><linearGradient id="ha-grad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="var(--accent)"/><stop offset="100%" stop-color="var(--accent-2)"/>
    </linearGradient></defs>
    <circle cx="${fill.toFixed(1)}" cy="${y}" r="2.6" fill="var(--accent)"/>
    <line x1="${mark.toFixed(1)}" y1="${y - 5}" x2="${mark.toFixed(1)}" y2="${y + 5}"
      stroke="var(--text-2)" stroke-opacity="0.5" stroke-width="1" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>
    <g transform="translate(${x2 + 2} ${y - 12})">
      <line x1="0" y1="0" x2="0" y2="12" stroke="var(--text-2)" stroke-opacity="0.6" stroke-width="1" vector-effect="non-scaling-stroke"/>
      <path d="M0 0 L7 2.5 L0 5 Z" fill="${done ? 'var(--success)' : 'var(--text-2)'}" fill-opacity="${done ? '1' : '0.6'}"/>
    </g>
  </svg>`;
}

// Variation de poids sur 7 jours (pesée la plus récente vs la plus proche de J-7)
function weightDelta7(weights) {
  if (!weights || weights.length < 2) return 0;
  const last = weights[weights.length - 1];
  const target = todayISO(-7);
  let ref = weights[0];
  for (const w of weights) { if (w.date <= target) ref = w; }
  return Math.round((last.value - ref.value) * 10) / 10;
}

export function render(container) {
  const rerender = () => render(container);
  const { profile, goal, settings } = store.userData;
  const today = todayISO();
  const totals = store.dayTotals(today);
  const mg = macroGoals();
  const steps = store.userData.steps.byDate[today] || 0;
  const stepsGoal = settings.stepsGoal || 10000;
  const water = store.userData.water.byDate[today] || 0;
  const prog = goalProgress();
  const kcalLeft = Math.round(mg.kcalGoal - totals.kcal);
  const wDelta = weightDelta7(store.userData.weights);
  const currentW = store.userData.weights.length
    ? store.userData.weights[store.userData.weights.length - 1].value
    : profile.weight;

  container.innerHTML = '';
  const gr = computeGlobalRank(store.userData, today, { liveMacroGoal: mg });
  const grRankLabel = gr.rank.division ? `${gr.rank.name} ${gr.rank.division}` : gr.rank.name;
  const grProgress = gr.rank.lpNeeded ? gr.rank.lp / gr.rank.lpNeeded : 1;

  container.appendChild(el(`
    <div class="home-fit">
      <div class="page-title"><h1>OmniFit</h1></div>

      <div class="card card-glow gr-card" id="gr-card">
        <div class="gr-top">
          <div class="gr-badge">${rankBadge(gr.rank.id, 52)}</div>
          <div class="gr-info">
            <div class="gr-rank-name" style="color:${gr.rank.color}">${grRankLabel}</div>
            <div class="gr-lp">${gr.rank.lpNeeded ? `${gr.rank.lp} / ${gr.rank.lpNeeded} LP` : `${gr.rank.lp} LP`}</div>
          </div>
          <div class="gr-streak" title="Jours consécutifs">${gr.streak > 0 ? `${icons.flame}<span>${gr.streak}</span>` : ''}</div>
        </div>
        <div class="gr-progress"><i style="width:${Math.round(grProgress * 100)}%;background:${gr.rank.color}"></i></div>
      </div>

      <div class="card stat-card home-kcal" id="home-kcal">
        <div class="stat-head">${icons.flame} Calories</div>
        <div class="hk-main">
          <div class="hk-numbers">
            <span class="num hk-big">${Math.round(totals.kcal)}</span>
            <span class="hk-goal">/ ${mg.kcalGoal} kcal</span>
          </div>
          ${ringSVG({ size: 58, stroke: 6, progress: totals.kcal / mg.kcalGoal, color: 'var(--accent)', label: `${Math.round((totals.kcal / mg.kcalGoal) * 100)}%` })}
        </div>
        <div class="hk-remaining">${kcalLeft >= 0 ? `${kcalLeft} kcal restantes` : `${Math.abs(kcalLeft)} kcal au-dessus`}</div>
        <div class="hk-macros">
          ${macroBar('Prot', totals.prot, mg.protG, C_PROT)}
          ${macroBar('Gluc', totals.carbs, mg.carbsG, C_CARB)}
          ${macroBar('Lip', totals.fat, mg.fatG, C_FAT)}
        </div>
      </div>

      <div class="home-duo">
        <div class="card stat-card home-weight" id="home-weight">
          <div class="hw-bg">${weightSparkline(store.userData.weights)}</div>
          <div class="hw-content">
            <div class="stat-head">${icons.user} Poids</div>
            <div class="hw-values">
              <div>
                <div class="num w-now">${currentW}<small>kg</small></div>
                <div class="hw-label">Actuel</div>
              </div>
              <div class="hw-delta">
                <div class="num ${wDelta > 0 ? 'up' : wDelta < 0 ? 'down' : ''}">${wDelta > 0 ? '+' : ''}${wDelta.toFixed(1)}</div>
                <div class="hw-label">7 jours</div>
              </div>
            </div>
            <div class="hw-target">Cible <b>${goal.targetWeight} kg</b> · ${Math.round(prog * 100)}%</div>
          </div>
        </div>

        <div class="card stat-card home-activity" id="home-activity">
          <div class="ha-bg">${stepsTrack(steps / stepsGoal, dayProgress())}</div>
          <div class="ha-content">
            <div class="stat-head">${icons.activity} Activité</div>
            <div class="ha-values">
              <div>
                <div class="num ha-big">${steps.toLocaleString('fr-FR')}</div>
                <div class="hw-label">Pas</div>
              </div>
              <div>
                <div class="num ha-goal">${stepsGoal.toLocaleString('fr-FR')}</div>
                <div class="hw-label">Objectif</div>
              </div>
            </div>
            <div class="ha-status">${steps >= stepsGoal ? 'Objectif atteint 🎯' : `${(stepsGoal - steps).toLocaleString('fr-FR')} pas restants`}</div>
          </div>
        </div>
      </div>

      <div class="card stat-card home-water" id="home-water">
        <div class="hwa-left">
          ${icons.water}
          <span class="num hwa-val">${water.toFixed(2).replace(/0$/, '')}<small>L</small></span>
          <span class="hwa-goal">/ ${settings.waterGoal} L</span>
        </div>
        <div class="hwa-bar"><i style="width:${Math.min(100, Math.round((water / settings.waterGoal) * 100))}%"></i></div>
        <button class="btn btn-secondary btn-sm" id="btn-add-water">+0.25</button>
      </div>

      <div class="home-actions">
        <button class="btn btn-primary btn-sm" id="btn-log-weight">${icons.plus} Poids</button>
        <button class="btn btn-secondary btn-sm" id="btn-chart">${icons.activity} Graphique</button>
        <button class="btn btn-secondary btn-sm" id="btn-edit-goal">${icons.edit} Objectif</button>
      </div>
    </div>`));

  container.querySelector('#gr-card').addEventListener('click', () => openGlobalRankModal(gr));
  container.querySelector('#btn-edit-goal').addEventListener('click', () => openGoalModal(rerender));
  container.querySelector('#btn-log-weight').addEventListener('click', () => openLogWeightModal(rerender));
  container.querySelector('#btn-chart').addEventListener('click', () => openChartModal(rerender));
  container.querySelector('#btn-add-water').addEventListener('click', (e) => {
    e.stopPropagation();
    store.addWater(today, 0.25);
    haptic();
    rerender();
  });
  // La carte poids ouvre le graphique (raccourci vers le même écran que le bouton)
  container.querySelector('#home-weight').addEventListener('click', () => openChartModal(rerender));

  // La ligne de progression des pas se remplit à l'affichage plutôt que
  // d'apparaître déjà pleine : le remplissage se « joue » sous les yeux.
  const fill = container.querySelector('.ha-fill');
  if (fill && typeof fill.animate === 'function') {
    const x1 = fill.getAttribute('x1');
    const x2 = fill.getAttribute('x2');
    try {
      fill.animate([{ x2: x1 }, { x2 }], { duration: 900, easing: 'cubic-bezier(0.4,0,0.2,1)', fill: 'backwards' });
    } catch (_) { /* l'animation ne doit jamais empêcher l'affichage */ }
  }
}
