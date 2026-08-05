// OmniFit — PAGE 0 : Accueil (stats d'abord, poids ensuite, graphique en modal)
import { store, todayISO } from '../utils/storage.js';
import { calculateSMA } from '../utils/math.js';
import { el, icons, openModal, toast, ringSVG, haptic, makeChart, fmtDateFull, attachSwipeToDelete } from '../utils/ui.js';
import { lineChartOptions, lineDataset } from '../utils/charts.js';
import { goToPage, PAGE_NUTRITION, PAGE_ACTIVITY } from '../utils/nav.js';
import { macroGoals, renderCoachCard } from './nutrition.js';
import { computeGlobalRank } from '../utils/globalRank.js';
import { rankBadge, rankFromLP } from '../utils/ranks.js';

let weightChart = null;
let smaVisible = true;
let caloriesVisible = false;

// Réglage de l'eau : consommation du jour et objectif, au même endroit que
// l'affichage. Évite d'aller chercher le curseur dans les réglages.
function openWaterModal(rerender) {
  const today = todayISO();
  const s = store.userData.settings;
  const cur = store.userData.water.byDate[today] || 0;
  const form = el(`<div>
    <div class="wtr-now">
      <span class="num wtr-val" id="wtr-val">${cur.toFixed(2).replace(/0$/, '')}</span>
      <span class="wtr-unit">L bus aujourd'hui</span>
    </div>
    <div class="wtr-quick" id="wtr-quick">
      ${[0.25, 0.5, 0.75, 1].map((v) => `<button class="btn btn-secondary btn-sm" data-add="${v}">+${v} L</button>`).join('')}
    </div>
    <button class="btn btn-ghost btn-sm btn-block" id="wtr-undo" style="margin-top:8px">${icons.swap} Retirer 0.25 L</button>
    <div class="card-row" style="margin-top:18px">
      <span class="row-label">Objectif quotidien</span>
      <span class="num" id="wtr-goal-val" style="color:var(--accent)">${s.waterGoal} L</span>
    </div>
    <input id="wtr-goal" type="range" min="1" max="5" step="0.25" value="${s.waterGoal}">
  </div>`);

  const m = openModal({ title: 'Eau', content: form, actions: [{ label: 'Fermer' }], onClose: () => rerender && rerender() });

  const refresh = () => {
    const v = store.userData.water.byDate[today] || 0;
    form.querySelector('#wtr-val').textContent = v.toFixed(2).replace(/0$/, '');
  };
  form.querySelector('#wtr-quick').addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    store.addWater(today, parseFloat(b.dataset.add));
    haptic();
    refresh();
  });
  form.querySelector('#wtr-undo').addEventListener('click', () => {
    const v = store.userData.water.byDate[today] || 0;
    store.addWater(today, -Math.min(0.25, v)); // jamais de total négatif
    haptic();
    refresh();
  });
  const goal = form.querySelector('#wtr-goal');
  goal.addEventListener('input', () => { form.querySelector('#wtr-goal-val').textContent = `${goal.value} L`; });
  goal.addEventListener('change', () => { store.saveUserData({ settings: { waterGoal: parseFloat(goal.value) } }); });
  return m;
}

// Choix de la phase en cours. Il n'y a volontairement PAS de poids cible :
// on s'arrête quand on est satisfait de son physique, pas à un chiffre.
// C'est cette phase qui pilote le coach (sens attendu de la variation de poids).
export function openGoalModal(rerender) {
  const { goal } = store.userData;
  const CHOIX = [
    { v: 'Perte de poids', t: 'Sèche', d: 'Perdre du gras, poids en baisse régulière' },
    { v: 'Recomposition', t: 'Maintenance', d: 'Poids stable, recomposition corporelle' },
    { v: 'Prise de muscle', t: 'Prise de masse', d: 'Construire du muscle, poids en hausse' },
  ];
  const form = el(`<div class="goal-choices">
    ${CHOIX.map((c) => `<button class="goal-choice${c.v === goal.type ? ' active' : ''}" data-v="${c.v}">
      <span class="goal-choice-t">${c.t}</span>
      <span class="goal-choice-d">${c.d}</span>
    </button>`).join('')}
  </div>`);
  const m = openModal({ title: 'Mon objectif', content: form, actions: [] });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('.goal-choice');
    if (!b) return;
    // saveUserData fusionne en profondeur : on retire explicitement les restes
    // de l'ancien objectif chiffré, qui n'a plus cours.
    store.saveUserData({ goal: { type: b.dataset.v } });
    delete store.userData.goal.targetWeight;
    delete store.userData.goal.targetDate;
    store.persist();
    haptic();
    m.close();
    if (rerender) rerender();
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
  const drawRecent = () => {
    const list = [...store.userData.weights].slice(-8).reverse();
    rec.innerHTML = list.length ? '' : '<div class="empty-state">Aucune pesée</div>';
    for (const w of list) {
      // Glisser vers la gauche révèle la poubelle, comme pour un repas.
      const row = el(`<div class="swipe-row" data-date="${w.date}">
        <button class="swipe-del" data-del aria-label="Supprimer la pesée">${icons.trash}</button>
        <div class="steps-list-item swipe-content">
          <span>${fmtDateFull(w.date)}</span>
          <span class="num" style="color:var(--accent)">${w.value} kg</span>
        </div>
      </div>`);
      row.querySelector('.swipe-content').addEventListener('click', () => {
        if (row.classList.contains('swiped')) return; // poubelle ouverte : on ne modifie pas
        openLogWeightModal(() => { drawRecent(); draw(); if (rerender) rerender(); }, { date: w.date, value: w.value });
      });
      row.querySelector('[data-del]').addEventListener('click', () => {
        store.removeWeightLog(w.date);
        haptic();
        toast('Pesée supprimée', 'success');
        drawRecent();
        draw();
        if (rerender) rerender();
      });
      rec.appendChild(row);
    }
  };
  drawRecent();
  attachSwipeToDelete(rec, { rowSelector: '.swipe-row', contentSelector: '.swipe-content' });
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
  const label = gr.rank.division ? `${gr.rank.name} ${gr.rank.division}` : gr.rank.name;
  const pct = gr.rank.lpNeeded ? Math.round((gr.rank.lp / gr.rank.lpNeeded) * 100) : 100;
  // Le badge en grand : c'est lui qu'on vient chercher, il doit dominer l'écran.
  const content = el(`<div class="grd">
    <div class="grd-hero">
      ${rankBadge(gr.rank.id, 190)}
      <div class="grd-name" style="color:${gr.rank.color}">${label}</div>
      <div class="grd-lp">${gr.rank.lpNeeded ? `${gr.rank.lp} / ${gr.rank.lpNeeded} LP` : `${gr.rank.lp} LP`}</div>
      ${gr.rank.lpNeeded ? `<div class="grd-bar"><i style="width:${pct}%;background:${gr.rank.color}"></i></div>` : '<div class="grd-ultime">Rang ultime atteint</div>'}
    </div>
    <div class="grd-stats">
      <div class="grd-row"><span>LP totaux</span><b>${gr.lp}</b></div>
      <div class="grd-row"><span>Série en cours</span><b>${gr.streak} j</b></div>
      ${gr.lastSeasonPeak > 0 ? `<div class="grd-row"><span>Pic saison ${gr.season - 1}</span><b>${rankFromLP(gr.lastSeasonPeak).name}</b></div>` : ''}
    </div>
  </div>`);
  openModal({ title: 'Rang global', content, wide: true, actions: [{ label: 'Fermer' }] });
}

// Couleurs macros, alignées sur l'onglet Nutrition
const C_PROT = '#FB923C';
const C_CARB = '#38BDF8';
const C_FAT = '#8B5CF6';

// Répartition des macros en anneau : chaque part correspond à la CONTRIBUTION
// CALORIQUE du macronutriment (prot ×4, gluc ×4, lip ×9), pas à sa masse — un
// gramme de lipide pèse deux fois plus dans l'assiette énergétique.
// Dessiné en arcs SVG dans le style de l'app (anneau fin, couleurs macros).
function macroDonut(prot, carbs, fat, size = 92) {
  const kP = (prot || 0) * 4;
  const kC = (carbs || 0) * 4;
  const kF = (fat || 0) * 9;
  const total = kP + kC + kF;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;

  const parts = [
    { k: kP, color: C_PROT, label: 'P' },
    { k: kC, color: C_CARB, label: 'G' },
    { k: kF, color: C_FAT, label: 'L' },
  ];

  // Légende toujours présente (0 % si rien n'est consommé) : la carte garde
  // ainsi la même taille tout au long de la journée.
  const pct = (k) => (total ? Math.round((k / total) * 100) : 0);
  const legend = `<div class="hk-donut-legend">
      <span style="color:${C_PROT}">P ${pct(kP)}%</span>
      <span style="color:${C_CARB}">G ${pct(kC)}%</span>
      <span style="color:${C_FAT}">L ${pct(kF)}%</span>
    </div>`;

  // Rien de consommé : anneau creux, pas de camembert trompeur.
  if (!total) {
    return `<div class="hk-donut">
      <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Répartition des macros">
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="rgba(var(--accent-rgb),0.14)" stroke-width="${stroke}"/>
      </svg>${legend}</div>`;
  }

  let offset = 0;
  const arcs = parts.filter((p) => p.k > 0).map((p) => {
    const len = (p.k / total) * c;
    const seg = `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${p.color}"
      stroke-width="${stroke}" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}"
      stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cx})"/>`;
    offset += len;
    return seg;
  }).join('');

  return `<div class="hk-donut">
    <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Répartition calorique des macros">
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="rgba(var(--accent-rgb),0.10)" stroke-width="${stroke}"/>
      ${arcs}
    </svg>${legend}</div>`;
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
        ${macroDonut(totals.prot, totals.carbs, totals.fat)}
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
    e.stopPropagation(); // le +0.25 reste un raccourci, il n'ouvre pas la fenêtre
    store.addWater(today, 0.25);
    haptic();
    rerender();
  });
  // Toucher la carte Eau ouvre le détail et le réglage de l'objectif.
  container.querySelector('#home-water').addEventListener('click', () => openWaterModal(rerender));
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
    const card = coachEl || el(`<div class="card stat-card coach-card coach-empty">
      <div class="coach-head"><span class="coach-title">${icons.flame} Coach</span></div>
      <div class="coach-msg-empty">Pèse-toi pendant 5 jours pour activer les conseils d'ajustement.</div>
    </div>`);
    // Toucher le coach ouvre le choix de phase (sèche / maintenance / prise) :
    // c'est ce réglage qui détermine ses conseils.
    card.addEventListener('click', (e) => {
      if (e.target.closest('.coach-btn')) return; // les boutons d'ajustement gardent leur action
      openGoalModal(rerender);
    });
    card.style.cursor = 'pointer';
    coachHost.replaceWith(card);
  }

}
