// OmniFit — PAGE 0 : Accueil (stats d'abord, poids ensuite, graphique en modal)
import { store, todayISO } from '../utils/storage.js';
import { calculateSMA } from '../utils/math.js';
import { el, icons, openModal, toast, ringSVG, haptic } from '../utils/ui.js';
import { macroGoals } from './nutrition.js';

let weightChart = null;
let smaVisible = true;

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

function openLogWeightModal(rerender) {
  const form = el(`<div class="field-stack">
    <label class="field"><span>Poids (kg)</span><input id="w-value" type="number" step="0.1" inputmode="decimal" placeholder="75.2" autofocus></label>
    <label class="field"><span>Date</span><input id="w-date" type="date" value="${todayISO()}"></label>
  </div>`);
  openModal({
    title: 'Log poids',
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

function openChartModal() {
  const content = el(`<div>
    <div class="chart-wrap" style="height:260px"><canvas id="weight-chart"></canvas></div>
    <button class="btn btn-ghost btn-sm btn-block" id="btn-toggle-sma" style="margin-top:8px">Tendance SMA-5 : ${smaVisible ? 'ON' : 'OFF'}</button>
  </div>`);
  openModal({ title: 'Poids — 14 jours', content, wide: true, actions: [{ label: 'Fermer', variant: 'btn-primary' }] });
  const draw = () => renderWeightChart(content.querySelector('#weight-chart'));
  content.querySelector('#btn-toggle-sma').addEventListener('click', (e) => {
    smaVisible = !smaVisible;
    e.target.textContent = `Tendance SMA-5 : ${smaVisible ? 'ON' : 'OFF'}`;
    draw();
  });
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

  if (weightChart) weightChart.destroy();
  weightChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: days.map((d) => d.slice(8) + '/' + d.slice(5, 7)),
      datasets: [
        { label: 'Poids (kg)', data: values, borderColor: '#00D9FF', backgroundColor: 'rgba(0,217,255,0.12)', borderWidth: 3, pointRadius: 4, pointBackgroundColor: '#00D9FF', tension: 0.3, spanGaps: true },
        { label: 'SMA-5', data: smaValues, borderColor: '#7C3AED', borderWidth: 2, borderDash: [6, 4], pointRadius: 0, tension: 0.35, spanGaps: true, hidden: !smaVisible },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9CA3AF', boxWidth: 12, font: { size: 10, family: 'Inter' } } } },
      scales: {
        x: { ticks: { color: '#9CA3AF', font: { size: 9, family: 'Inter' } }, grid: { color: 'rgba(0,217,255,0.06)' } },
        y: { ticks: { color: '#9CA3AF', font: { size: 10, family: 'Inter' } }, grid: { color: 'rgba(0,217,255,0.06)' } },
      },
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
          <div class="num stat-big">${Math.round(totals.kcal)} <small>/ ${mg.kcalGoal}</small></div>
          <div class="progress-bar" style="margin-top:6px"><div style="width:${Math.min(100, (totals.kcal / mg.kcalGoal) * 100)}%"></div></div>
        </div>
        <div class="card stat-card">
          <div class="stat-head">${icons.activity} PAS</div>
          <div class="num stat-big">${steps.toLocaleString('fr-FR')} <small>/ 10 000</small></div>
          <div class="progress-bar green" style="margin-top:6px"><div style="width:${Math.min(100, (steps / 10000) * 100)}%"></div></div>
        </div>
        <div class="card stat-card">
          <div class="stat-head">${icons.protein} PROTÉINES</div>
          <div class="num stat-big">${Math.round(totals.prot)}<small>g / ${mg.protG}g</small></div>
          <div class="progress-bar" style="margin-top:6px"><div style="width:${Math.min(100, (totals.prot / mg.protG) * 100)}%"></div></div>
        </div>
        <div class="card stat-card">
          <div class="stat-head">${icons.water} EAU</div>
          <div class="card-row">
            <div class="num stat-big">${water.toFixed(1)}<small>L / ${settings.waterGoal}L</small></div>
            <button class="btn btn-secondary btn-sm" id="btn-add-water" style="min-height:34px;padding:4px 10px">+0.25</button>
          </div>
          <div class="progress-bar" style="margin-top:6px"><div style="width:${Math.min(100, (water / settings.waterGoal) * 100)}%"></div></div>
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
  container.querySelector('#btn-chart').addEventListener('click', () => openChartModal());
  container.querySelector('#btn-add-water').addEventListener('click', () => {
    store.addWater(today, 0.25);
    haptic();
    rerender();
  });
}
