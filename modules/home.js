// OmniFit — PAGE 0 : Accueil
import { store, todayISO } from '../utils/storage.js';
import { calculateSMA } from '../utils/math.js';
import { el, icons, openModal, toast, ringSVG, haptic } from '../utils/ui.js';

let weightChart = null;
let smaVisible = true;

function goalProgress() {
  const { goal, profile, weights } = store.userData;
  const start = weights.length ? weights[0].value : profile.weight;
  const current = weights.length ? weights[weights.length - 1].value : profile.weight;
  const target = goal.targetWeight;
  if (start === target) return 1;
  const p = (current - start) / (target - start);
  return Math.min(1, Math.max(0, p));
}

function openGoalModal(rerender) {
  const { goal } = store.userData;
  const form = el(`<div>
    <label class="field"><span>Type d'objectif</span>
      <select id="g-type">
        ${['Perte de poids', 'Prise de muscle', 'Recomposition'].map((t) => `<option ${t === goal.type ? 'selected' : ''}>${t}</option>`).join('')}
      </select></label>
    <div class="field-row">
      <label class="field"><span>Poids cible (${store.userData.settings.unitSystem})</span>
        <input id="g-weight" type="number" step="0.1" value="${goal.targetWeight}"></label>
      <label class="field"><span>Date cible</span>
        <input id="g-date" type="date" value="${goal.targetDate}"></label>
    </div>
  </div>`);
  openModal({
    title: 'Modifier l\'objectif',
    content: form,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Enregistrer', variant: 'btn-primary',
        onClick: (body) => {
          store.saveUserData({
            goal: {
              type: body.querySelector('#g-type').value,
              targetWeight: parseFloat(body.querySelector('#g-weight').value) || goal.targetWeight,
              targetDate: body.querySelector('#g-date').value || goal.targetDate,
            },
          });
          toast('Objectif mis à jour', 'success');
          rerender();
        },
      },
    ],
  });
}

function openLogWeightModal(rerender) {
  const form = el(`<div>
    <div class="field-row">
      <label class="field"><span>Date</span><input id="w-date" type="date" value="${todayISO()}"></label>
      <label class="field"><span>Poids (${store.userData.settings.unitSystem})</span>
        <input id="w-value" type="number" step="0.1" inputmode="decimal" placeholder="75.2"></label>
    </div>
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
          toast('Poids enregistré', 'success');
          rerender();
        },
      },
    ],
  });
}

function renderWeightChart(canvas) {
  const unit = store.userData.settings.unitSystem;
  const days = [...Array(14)].map((_, i) => todayISO(i - 13));
  const map = Object.fromEntries(store.userData.weights.map((w) => [w.date, w.value]));
  const values = days.map((d) => map[d] ?? null);

  // SMA-5 sur la série des poids connus, réinjectée aux bonnes dates
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
        {
          label: `Poids (${unit})`,
          data: values,
          borderColor: '#00D9FF',
          backgroundColor: 'rgba(0,217,255,0.12)',
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: '#00D9FF',
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: 'Tendance SMA-5',
          data: smaValues,
          borderColor: '#7C3AED',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          tension: 0.35,
          spanGaps: true,
          hidden: !smaVisible,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9CA3AF', boxWidth: 12, font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: '#9CA3AF', font: { size: 9 } }, grid: { color: 'rgba(0,217,255,0.06)' } },
        y: { ticks: { color: '#9CA3AF', font: { size: 10 } }, grid: { color: 'rgba(0,217,255,0.06)' } },
      },
    },
  });
}

export function render(container) {
  const rerender = () => render(container);
  const { profile, goal, settings } = store.userData;
  const today = todayISO();
  const totals = store.dayTotals(today);
  const steps = store.userData.steps.byDate[today] || 0;
  const water = store.userData.water.byDate[today] || 0;
  const prog = goalProgress();
  const currentW = store.userData.weights.length
    ? store.userData.weights[store.userData.weights.length - 1].value
    : profile.weight;

  container.innerHTML = '';
  container.appendChild(el(`
    <div>
      <div class="page-title">
        <h1>OmniFit${profile.name ? ' — ' + profile.name : ''}</h1>
      </div>

      <div class="card card-glow" id="goal-card">
        <div class="card-row" style="margin-bottom:10px">
          <h3>Objectif</h3>
          <button class="btn btn-secondary btn-sm" id="btn-edit-goal">${icons.edit} Modifier</button>
        </div>
        <div class="goal-progress">
          ${ringSVG({ size: 84, stroke: 8, progress: prog, label: `${Math.round(prog * 100)}%` })}
          <div class="goal-meta">
            <div class="goal-type">${goal.type}</div>
            <div class="goal-detail">Actuel : <b class="mono">${currentW} ${settings.unitSystem}</b> → Cible : <b class="mono">${goal.targetWeight} ${settings.unitSystem}</b></div>
            <div class="goal-detail">Échéance : ${goal.targetDate}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-row" style="margin-bottom:8px">
          <h3>Poids — 14 jours</h3>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" id="btn-toggle-sma">SMA-5 ${smaVisible ? '✓' : ''}</button>
            <button class="btn btn-primary btn-sm" id="btn-log-weight">${icons.plus} Log poids</button>
          </div>
        </div>
        <div class="chart-wrap"><canvas id="weight-chart"></canvas></div>
      </div>

      <div class="grid-2">
        <div class="card stat-card" style="margin-bottom:0">
          <div class="stat-head">${icons.flame} CALORIES</div>
          <div class="stat-value">${Math.round(totals.kcal)} <small>/ ${settings.calorieGoal} kcal</small></div>
          <div class="progress-bar"><div style="width:${Math.min(100, (totals.kcal / settings.calorieGoal) * 100)}%"></div></div>
        </div>
        <div class="card stat-card" style="margin-bottom:0">
          <div class="stat-head">${icons.protein} PROTÉINES</div>
          <div class="card-row">
            <div class="stat-value">${Math.round(totals.prot)}g <small>/ ${settings.proteinGoal}g</small></div>
            ${ringSVG({ size: 44, stroke: 5, progress: totals.prot / settings.proteinGoal, label: '' })}
          </div>
        </div>
        <div class="card stat-card" style="margin-bottom:0">
          <div class="stat-head">${icons.activity} PAS</div>
          <div class="stat-value">${steps.toLocaleString('fr-FR')} <small>/ 10 000</small></div>
          <div class="progress-bar green"><div style="width:${Math.min(100, (steps / 10000) * 100)}%"></div></div>
        </div>
        <div class="card stat-card" style="margin-bottom:0">
          <div class="stat-head">${icons.water} EAU</div>
          <div class="card-row">
            <div class="stat-value">${water.toFixed(1)}L <small>/ ${settings.waterGoal}L</small></div>
            <button class="btn btn-secondary btn-sm" id="btn-add-water">+0.25L</button>
          </div>
          <div class="progress-bar" style="margin-top:6px"><div style="width:${Math.min(100, (water / settings.waterGoal) * 100)}%"></div></div>
        </div>
      </div>
    </div>`));

  container.querySelector('#btn-edit-goal').addEventListener('click', () => openGoalModal(rerender));
  container.querySelector('#btn-log-weight').addEventListener('click', () => openLogWeightModal(rerender));
  container.querySelector('#btn-toggle-sma').addEventListener('click', () => { smaVisible = !smaVisible; rerender(); });
  container.querySelector('#btn-add-water').addEventListener('click', () => {
    store.addWater(today, 0.25);
    haptic();
    rerender();
  });

  renderWeightChart(container.querySelector('#weight-chart'));
}
