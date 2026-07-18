// OmniFit — PAGE 3 : Activité (pas)
import { store, todayISO } from '../utils/storage.js';
import { calculateTrend } from '../utils/math.js';
import { el, icons, openModal, toast, ringSVG, fmtDateShort, haptic } from '../utils/ui.js';

let stepsChart = null;
let viewDays = 7;
const stepGoal = () => store.userData.settings.stepsGoal || 10000;

function openLogStepsModal(rerender, prefill = null) {
  const form = el(`<div class="field-stack">
    <label class="field"><span>Nombre de pas</span><input id="st-count" type="number" inputmode="numeric" min="0" placeholder="8500" value="${prefill ? prefill.count : ''}" autofocus></label>
    <label class="field"><span>Date</span><input id="st-date" type="date" value="${prefill ? prefill.date : todayISO()}"></label>
  </div>`);
  openModal({
    title: prefill ? 'Modifier les pas' : 'Log pas',
    content: form,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Enregistrer', variant: 'btn-primary',
        onClick: (body) => {
          const d = body.querySelector('#st-date').value;
          const c = parseInt(body.querySelector('#st-count').value, 10);
          if (!d || isNaN(c)) { toast('Valeur invalide', 'error'); return 'keep'; }
          store.addStepsLog(d, c);
          haptic();
          toast('Pas enregistrés', 'success');
          rerender();
        },
      },
    ],
  });
}

function renderChart(canvas) {
  const days = [...Array(viewDays)].map((_, i) => todayISO(i - viewDays + 1));
  const data = days.map((d) => store.userData.steps.byDate[d] || 0);
  const labels = viewDays <= 30
    ? days.map((d) => d.slice(8) + '/' + d.slice(5, 7))
    : days.map((d, i) => (i % 14 === 0 ? d.slice(8) + '/' + d.slice(5, 7) : ''));

  if (stepsChart) stepsChart.destroy();
  stepsChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Pas',
        data,
        backgroundColor: data.map((v) => (v >= stepGoal() ? 'rgba(16,185,129,0.65)' : 'rgba(0,217,255,0.55)')),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9CA3AF', font: { size: 8 }, maxRotation: 0 }, grid: { display: false } },
        y: { min: 0, suggestedMax: 15000, ticks: { color: '#9CA3AF', font: { size: 9 } }, grid: { color: 'rgba(0,217,255,0.06)' } },
      },
    },
  });
}

function monthStats() {
  const byDate = store.userData.steps.byDate;
  const monthDays = [...Array(30)].map((_, i) => todayISO(i - 29));
  const prevMonthDays = [...Array(30)].map((_, i) => todayISO(i - 59));
  const vals = monthDays.map((d) => byDate[d] || 0);
  const prevVals = prevMonthDays.map((d) => byDate[d] || 0);
  const last7 = [...Array(7)].map((_, i) => byDate[todayISO(i - 6)] || 0);

  const weekAvg = Math.round(last7.reduce((a, b) => a + b, 0) / 7);
  let record = { date: '—', v: 0 };
  monthDays.forEach((d) => { const v = byDate[d] || 0; if (v > record.v) record = { date: d, v }; });
  const activeDays = vals.filter((v) => v >= stepGoal()).length;
  const sumCur = vals.reduce((a, b) => a + b, 0);
  const sumPrev = prevVals.reduce((a, b) => a + b, 0);
  const trend = calculateTrend(sumCur, sumPrev);
  return { weekAvg, record, activeDays, trend };
}

export function render(container) {
  const rerender = () => render(container);
  const today = todayISO();
  const steps = store.userData.steps.byDate[today] || 0;
  const { weekAvg, record, activeDays, trend } = monthStats();

  const last14 = [...Array(14)].map((_, i) => todayISO(-i));

  container.innerHTML = '';
  container.appendChild(el(`
    <div>
      <div class="page-title">
        <h1>Activité</h1>
        <button class="btn btn-primary btn-sm" id="btn-log-steps">${icons.plus} Log</button>
      </div>

      <div class="card card-glow steps-hero">
        <div class="kcal-total">
          <span class="num kcal-consumed">${steps.toLocaleString('fr-FR')}</span>
          <span class="kcal-sep">/ ${stepGoal().toLocaleString('fr-FR')} pas</span>
        </div>
        <div class="kcal-sub">
          <span>${steps >= stepGoal() ? 'Objectif atteint' : `${(stepGoal() - steps).toLocaleString('fr-FR')} pas restants`}</span>
        </div>
        <div class="progress-bar ${steps >= stepGoal() ? 'green' : ''}" style="margin-top:8px"><div style="width:${Math.min(100, (steps / stepGoal()) * 100)}%"></div></div>
      </div>

      <div class="card">
        <div class="card-row" style="margin-bottom:8px">
          <h3>Historique</h3>
          <div class="segment" style="max-width:220px" id="view-toggle">
            <button data-d="7" class="${viewDays === 7 ? 'active' : ''}">7 j</button>
            <button data-d="30" class="${viewDays === 30 ? 'active' : ''}">30 j</button>
            <button data-d="180" class="${viewDays === 180 ? 'active' : ''}">6 mois</button>
          </div>
        </div>
        <div class="chart-wrap" style="height:190px"><canvas id="steps-chart"></canvas></div>
      </div>

      <div class="grid-2">
        <div class="card" style="margin:0"><div class="muted">Moyenne hebdo</div><div class="num" style="font-size:1.3rem;color:var(--accent)">${weekAvg.toLocaleString('fr-FR')}</div></div>
        <div class="card" style="margin:0"><div class="muted">Record 30 j</div><div class="num" style="font-size:1.3rem;color:var(--accent)">${record.v.toLocaleString('fr-FR')}</div></div>
        <div class="card" style="margin:0"><div class="muted">Jours actifs</div><div class="num" style="font-size:1.3rem;color:var(--success)">${activeDays}</div></div>
        <div class="card" style="margin:0"><div class="muted">Tendance</div><div class="num" style="font-size:1.3rem;color:${trend >= 0 ? 'var(--success)' : 'var(--danger)'}">${trend >= 0 ? '+' : ''}${trend}%</div></div>
      </div>

      <div class="card" style="margin-top:var(--space)">
        <h3>14 derniers jours</h3>
        <div id="steps-list"></div>
      </div>
    </div>`));

  const list = container.querySelector('#steps-list');
  let hasAny = false;
  last14.forEach((d, i) => {
    const v = store.userData.steps.byDate[d];
    if (v == null) return;
    hasAny = true;
    const prev = store.userData.steps.byDate[todayISO(-i - 1)];
    const delta = prev != null ? v - prev : null;
    const item = el(`<div class="steps-list-item" style="cursor:pointer">
      <span>${fmtDateShort(d)}</span>
      <span>
        <span class="num">${v.toLocaleString('fr-FR')}</span>
        ${delta != null ? `<span class="${delta >= 0 ? 'delta-up' : 'delta-down'}"> ${delta >= 0 ? '+' : ''}${delta.toLocaleString('fr-FR')}</span>` : ''}
      </span>
    </div>`);
    item.addEventListener('click', () => openLogStepsModal(rerender, { date: d, count: v }));
    list.appendChild(item);
  });
  if (!hasAny) list.innerHTML = '<div class="empty-state">Aucun log de pas.</div>';

  container.querySelector('#btn-log-steps').addEventListener('click', () => openLogStepsModal(rerender));
  container.querySelector('#view-toggle').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    viewDays = +b.dataset.d;
    rerender();
  });

  renderChart(container.querySelector('#steps-chart'));
}
