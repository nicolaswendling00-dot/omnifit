// OmniFit — PAGE 0 : Accueil (stats d'abord, poids ensuite, graphique en modal)
import { store, todayISO } from '../utils/storage.js';
import { calculateSMA } from '../utils/math.js';
import { el, icons, openModal, toast, ringSVG, haptic, makeChart } from '../utils/ui.js';
import { lineChartOptions, lineDataset } from '../utils/charts.js';
import { goToPage, PAGE_NUTRITION, PAGE_ACTIVITY } from '../utils/nav.js';
import { macroGoals, renderCoachCard } from './nutrition.js';
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
  const RANGES = [[30, '1 mois'], [90, '3 mois'], [365, '1 an'], [0, 'Tout']];
  const content = el(`<div>
    <div class="segment" id="w-range" style="margin-bottom:10px">
      ${RANGES.map(([v, lbl]) => `<button data-r="${v}" class="${v === weightRange ? 'active' : ''}">${lbl}</button>`).join('')}
    </div>
    <div class="chart-wrap" style="height:240px"><canvas id="weight-chart"></canvas></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-ghost btn-sm" id="btn-toggle-sma" style="flex:1">Tendance : ${smaVisible ? 'ON' : 'OFF'}</button>
      <button class="btn btn-ghost btn-sm" id="btn-toggle-cal" style="flex:1">Calories : ${caloriesVisible ? 'ON' : 'OFF'}</button>
    </div>
    <div class="w-modal-actions">
      <button class="btn btn-primary btn-sm" id="btn-log-weight">${icons.plus} Ajouter une pesée</button>
      <button class="btn btn-secondary btn-sm" id="btn-edit-goal">${icons.edit} Objectif</button>
    </div>
    <h3 style="margin:14px 0 4px">Entrées récentes</h3>
    <div id="w-recent">${recent.length ? '' : '<div class="empty-state">Aucune pesée</div>'}</div>
  </div>`);
  // À la fermeture, on détruit le graphique : sans ça il garde une référence sur
  // un canvas retiré du DOM (et ses écouteurs de redimensionnement).
  const modal = openModal({
    title: 'Poids',
    content,
    wide: true,
    actions: [],
    onClose: () => {
      if (weightChart) { try { weightChart.destroy(); } catch (_) { /* déjà détruit */ } weightChart = null; }
    },
  });
  const draw = () => renderWeightChart(content.querySelector('#weight-chart'));
  content.querySelector('#w-range').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    weightRange = +b.dataset.r;
    content.querySelectorAll('#w-range button').forEach((x) => x.classList.toggle('active', x === b));
    draw();
    haptic();
  });
  // Les actions poids vivent ici plutôt que sur l'accueil, qui reste un écran
  // de lecture : on ouvre la carte Poids, on voit la courbe, on agit.
  content.querySelector('#btn-log-weight').addEventListener('click', () => {
    modal.close();
    openLogWeightModal(rerender || (() => {}));
  });
  content.querySelector('#btn-edit-goal').addEventListener('click', () => {
    modal.close();
    openGoalModal(rerender || (() => {}));
  });
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

// Plage affichée dans la fenêtre Poids (en jours). `0` = tout l'historique.
let weightRange = 90;

function renderWeightChart(canvas) {
  const all = store.userData.weights;
  if (!all.length) { weightChart = makeChart(canvas, { type: 'line', data: { labels: [], datasets: [] } }, weightChart); return; }

  // Plage : soit les N derniers jours, soit tout depuis la première pesée.
  const first = all[0].date;
  const start = weightRange ? todayISO(-weightRange + 1) : first;
  const from = start < first ? first : start;
  const nDays = Math.max(1, Math.round((new Date(todayISO()) - new Date(from)) / 86400000) + 1);
  const days = [...Array(nDays)].map((_, i) => todayISO(i - nDays + 1));

  const map = Object.fromEntries(all.map((w) => [w.date, w.value]));
  const values = days.map((d) => map[d] ?? null);

  // Tendance lissée : moyenne mobile sur les pesées connues, reprojetée sur les
  // jours. C'est elle qui montre la vraie direction, sans le bruit quotidien.
  const sma = calculateSMA(all.map((w) => w.value), 5);
  const smaMap = {};
  all.forEach((w, i) => { smaMap[w.date] = sma[i]; });
  const smaValues = days.map((d) => (smaMap[d] != null ? Math.round(smaMap[d] * 10) / 10 : null));

  const calValues = days.map((d) => {
    const t = store.dayTotals(d);
    return t.kcal ? Math.round(t.kcal) : null;
  });

  const datasets = [lineDataset('Poids', values, '#00D9FF', { yAxisID: 'y' })];
  if (smaVisible) {
    datasets.push(lineDataset('Tendance', smaValues, '#7C3AED', { fill: false, borderWidth: 2, borderDash: [5, 4], yAxisID: 'y' }));
  }
  if (caloriesVisible) {
    datasets.push(lineDataset('Calories', calValues, '#FB923C', { fill: false, borderWidth: 2, yAxisID: 'y1' }));
  }

  // Étiquettes : jour/mois sur les courtes plages, mois seul au-delà.
  const labels = days.map((d) => (nDays > 120 ? d.slice(5, 7) + '/' + d.slice(2, 4) : d.slice(8) + '/' + d.slice(5, 7)));

  const options = lineChartOptions({ legend: datasets.length > 1, ySuffix: ' kg', yTicks: 4, xTicks: 5 });
  if (caloriesVisible) {
    options.scales.y1 = {
      position: 'left',
      grid: { display: false, drawBorder: false },
      border: { display: false },
      ticks: { color: '#FB923C', font: { size: 10, family: 'Inter' }, maxTicksLimit: 4, padding: 6 },
    };
  }

  weightChart = makeChart(canvas, { type: 'line', data: { labels, datasets }, options }, weightChart);
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

// Ligne de macro : libellé à gauche, consommé/objectif à droite, jauge en
// dessous sur toute la largeur. Empilées, elles se lisent d'un coup d'œil.
function macroBar(label, done, goal, color) {
  const pct = goal ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  return `<div class="hk-macro">
    <div class="hk-macro-top"><span>${label}</span><span class="num">${Math.round(done)}<i>/${goal}g</i></span></div>
    <div class="hk-macro-bar"><i style="width:${pct}%;background:${color}"></i></div>
  </div>`;
}

// Chemin lissé passant par une série de points (spline de Catmull-Rom convertie
// en courbes de Bézier). Donne un tracé fluide, sans les angles d'une polyline.
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

// Courbe de poids tracée en fond de la carte. On lisse D'ABORD les valeurs
// (moyenne mobile) : le poids varie de plusieurs centaines de grammes d'un jour
// à l'autre (eau, glycogène) et le tracé brut ressemblait à des pics. On veut
// la tendance, pas le bruit. Purement décoratif (aria-hidden).
function weightSparkline(weights) {
  const raw = (weights || []).slice(-40).map((w) => w.value);
  if (raw.length < 2) return '';
  const smoothed = calculateSMA(raw, Math.min(5, Math.max(2, Math.round(raw.length / 4))));
  const vals = smoothed.filter((v) => v != null);
  if (vals.length < 2) return '';
  const min = Math.min(...vals); const max = Math.max(...vals);
  const span = max - min || 1;
  const W = 100; const H = 40;
  const pts = vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * W,
    y: H - ((v - min) / span) * (H * 0.7) - H * 0.15,
  }));
  const line = smoothPath(pts);
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="hw-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#hw-grad)"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="1.8"
      stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity="0.8"/>
  </svg>`;
}

// Part de la journée écoulée (0–1), pour situer l'avancement des pas par
// rapport à l'heure qu'il est.
function dayProgress() {
  const d = new Date();
  return (d.getHours() * 60 + d.getMinutes()) / 1440;
}

// Piste de progression des pas : une ligne qui se remplit jusqu'au drapeau
// d'arrivée, avec un repère à l'avancement de la journée (on voit d'un coup
// d'œil si on est en avance ou en retard).
// Construite en HTML/CSS et non en SVG étiré : un SVG en
// `preserveAspectRatio: none` déformerait le drapeau dans une bande large et
// basse.
function stepsTrack(ratio, timeRatio) {
  const p = Math.max(0, Math.min(1, ratio || 0));
  const t = Math.max(0, Math.min(1, timeRatio || 0));
  const done = p >= 1;
  return `<div class="ha-line">
    <i class="ha-fill" style="width:${(p * 100).toFixed(1)}%"></i>
    <i class="ha-now" style="left:${(t * 100).toFixed(1)}%"></i>
    <i class="ha-dot" style="left:${(p * 100).toFixed(1)}%"></i>
    <span class="ha-flag${done ? ' done' : ''}" aria-hidden="true">
      <svg viewBox="0 0 10 14"><path d="M1 0v14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M1.8 1.2 L9 3.6 L1.8 6 Z" fill="currentColor"/></svg>
    </span>
  </div>`;
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

      <div class="home-duo home-top-duo">
      <div class="card stat-card home-kcal" id="home-kcal">
        <div class="stat-head">${icons.flame} Calories</div>
        <div class="hk-numbers">
          <span class="num hk-big">${Math.round(totals.kcal)}</span>
          <span class="hk-goal">/ ${mg.kcalGoal} kcal</span>
        </div>
        <div class="hk-macros">
          ${macroBar('Prot', totals.prot, mg.protG, C_PROT)}
          ${macroBar('Gluc', totals.carbs, mg.carbsG, C_CARB)}
          ${macroBar('Lip', totals.fat, mg.fatG, C_FAT)}
        </div>
      </div>
      <div id="coach-host"></div>
      </div>

      <div class="home-duo">
        <div class="card stat-card home-weight" id="home-weight">
          <div class="hw-bg">${weightSparkline(store.userData.weights)}</div>
          <div class="hw-content">
            <div class="stat-head">${icons.user} Poids</div>
            <div class="num w-now">${currentW}<small>kg</small></div>
          </div>
        </div>

        <div class="card stat-card home-activity" id="home-activity">
          <div class="ha-content">
            <div class="stat-head">${icons.activity} Activité</div>
            <div class="hk-numbers">
              <span class="num ha-big">${steps.toLocaleString('fr-FR')}</span>
              <span class="hk-goal">/ ${stepsGoal.toLocaleString('fr-FR')}</span>
            </div>
            <div class="ha-track">${stepsTrack(steps / stepsGoal, dayProgress())}</div>
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
    </div>`));

  container.querySelector('#gr-card').addEventListener('click', () => openGlobalRankModal(gr));
  container.querySelector('#btn-add-water').addEventListener('click', (e) => {
    e.stopPropagation();
    store.addWater(today, 0.25);
    haptic();
    rerender();
  });
  // La carte Poids ouvre la fenêtre qui contient le graphique ET les actions.
  container.querySelector('#home-weight').addEventListener('click', () => openChartModal(rerender));
  // Calories et Activité renvoient vers l'onglet correspondant : l'accueil est
  // un résumé, le détail vit dans sa page.
  container.querySelector('#home-kcal').addEventListener('click', () => goToPage(PAGE_NUTRITION));
  container.querySelector('#home-activity').addEventListener('click', () => goToPage(PAGE_ACTIVITY));

  // Coach métabolique : il vit sur l'accueil (et non plus dans Nutrition).
  const coachHost = container.querySelector('#coach-host');
  if (coachHost) {
    const coachEl = renderCoachCard(rerender, { compact: true });
    if (coachEl) coachHost.replaceWith(coachEl);
    else coachHost.replaceWith(el(`<div class="card stat-card coach-card coach-empty">
      <div class="coach-head"><span class="coach-title">${icons.flame} Coach</span></div>
      <div class="coach-msg-empty">Pèse-toi régulièrement pendant ~2 semaines pour activer les conseils d'ajustement.</div>
    </div>`));
  }

}
