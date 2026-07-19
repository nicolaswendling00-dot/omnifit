// OmniFit — PAGE 0 : Accueil (stats d'abord, poids ensuite, graphique en modal)
import { store, todayISO } from '../utils/storage.js';
import { calculateSMA } from '../utils/math.js';
import { el, icons, openModal, toast, ringSVG, haptic } from '../utils/ui.js';
import { macroGoals } from './nutrition.js';

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
  openModal({ title: 'Poids — 14 jours', content, wide: true, actions: [] });
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

  const datasets = [
    { label: 'Poids (kg)', data: values, borderColor: '#00D9FF', backgroundColor: 'rgba(0,217,255,0.12)', borderWidth: 3, pointRadius: 4, pointBackgroundColor: '#00D9FF', tension: 0.3, spanGaps: true, yAxisID: 'y' },
    { label: 'SMA-5', data: smaValues, borderColor: '#7C3AED', borderWidth: 2, borderDash: [6, 4], pointRadius: 0, tension: 0.35, spanGaps: true, hidden: !smaVisible, yAxisID: 'y' },
  ];
  if (caloriesVisible) {
    datasets.push({ label: 'Calories', data: calValues, borderColor: '#FB923C', backgroundColor: 'rgba(251,146,60,0.12)', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#FB923C', tension: 0.3, spanGaps: true, yAxisID: 'y1' });
  }

  const scales = {
    x: { ticks: { color: '#9CA3AF', font: { size: 9, family: 'Inter' } }, grid: { color: 'rgba(0,217,255,0.06)' } },
    y: { position: 'left', ticks: { color: '#9CA3AF', font: { size: 10, family: 'Inter' } }, grid: { color: 'rgba(0,217,255,0.06)' } },
  };
  if (caloriesVisible) {
    scales.y1 = { position: 'right', ticks: { color: '#FB923C', font: { size: 10, family: 'Inter' } }, grid: { drawOnChartArea: false } };
  }

  if (weightChart) weightChart.destroy();
  weightChart = new Chart(canvas, {
    type: 'line',
    data: { labels: days.map((d) => d.slice(8) + '/' + d.slice(5, 7)), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9CA3AF', boxWidth: 12, font: { size: 10, family: 'Inter' } } } },
      scales,
    },
  });
}

export function render(container) {
  const rerender = () => render(container);
  const { profile, goal, settings } = store.userData;
  const today = todayISO();
  const totals = store.dayTotals(today);
  const mg = macroGoals();
  const steps = store.userData.steps.byDate[today] || 0;
  const water = store.userData.water.byDate[today] || 0;
  const prog = goalProgress();
  const currentW = store.userData.weights.length
    ? store.userData.weights[store.userData.weights.length - 1].value
    : profile.weight;

  container.innerHTML = '';
  container.appendChild(el(`
    <div>
      <div class="page-title"><h1>OmniFit</h1></div>

      <div class="grid-2" style="margin-bottom:var(--space)">
        <div class="card stat-card">
          <div class="stat-head">${icons.flame} CALORIES</div>
          <div class="stat-body">
            ${ringSVG({ size: 54, stroke: 6, progress: totals.kcal / mg.kcalGoal, color: 'var(--accent)', label: `${Math.round((totals.kcal / mg.kcalGoal) * 100)}%` })}
            <div class="num stat-big">${Math.round(totals.kcal)} <small>/ ${mg.kcalGoal}</small></div>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-head">${icons.activity} PAS</div>
          <div class="stat-body">
            ${ringSVG({ size: 54, stroke: 6, progress: steps / (settings.stepsGoal || 10000), gradient: true, label: `${Math.round((steps / (settings.stepsGoal || 10000)) * 100)}%` })}
            <div class="num stat-big">${steps.toLocaleString('fr-FR')} <small>/ ${(settings.stepsGoal || 10000).toLocaleString('fr-FR')}</small></div>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-head">${icons.protein} PROTÉINES</div>
          <div class="stat-body">
            ${ringSVG({ size: 54, stroke: 6, progress: totals.prot / mg.protG, color: '#FB923C', label: `${Math.round((totals.prot / mg.protG) * 100)}%` })}
            <div class="num stat-big">${Math.round(totals.prot)}<small>g / ${mg.protG}g</small></div>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-head">${icons.water} EAU</div>
          <div class="stat-body">
            ${ringSVG({ size: 54, stroke: 6, progress: water / settings.waterGoal, color: '#38BDF8', label: `${Math.round((water / settings.waterGoal) * 100)}%` })}
            <div>
              <div class="num stat-big">${water.toFixed(1)}<small>L / ${settings.waterGoal}L</small></div>
              <button class="btn btn-secondary btn-sm" id="btn-add-water" style="min-height:34px;padding:4px 10px;margin-top:4px">+0.25</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card card-glow">
        <div class="weight-hero">
          <div>
            <div class="num w-now">${currentW} <small style="font-size:0.9rem;color:var(--text-2)">kg</small></div>
            <div class="w-sub">${goal.type} · cible <b class="num" style="color:var(--accent)">${goal.targetWeight} kg</b></div>
          </div>
          ${ringSVG({ size: 74, stroke: 7, progress: prog, label: `${Math.round(prog * 100)}%` })}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-primary btn-sm" id="btn-log-weight" style="flex:1">${icons.plus} Log poids</button>
          <button class="btn btn-secondary btn-sm" id="btn-chart" style="flex:1">${icons.activity} Graphique</button>
          <button class="icon-btn" id="btn-edit-goal" aria-label="Modifier l'objectif">${icons.edit}</button>
        </div>
      </div>
    </div>`));

  container.querySelector('#btn-edit-goal').addEventListener('click', () => openGoalModal(rerender));
  container.querySelector('#btn-log-weight').addEventListener('click', () => openLogWeightModal(rerender));
  container.querySelector('#btn-chart').addEventListener('click', () => openChartModal(rerender));
  container.querySelector('#btn-add-water').addEventListener('click', () => {
    store.addWater(today, 0.25);
    haptic();
    rerender();
  });
}
