// OmniFit — PAGE 0 : Accueil (stats d'abord, poids ensuite, graphique en modal)
import { store, todayISO } from '../utils/storage.js';
import { calculateSMA } from '../utils/math.js';
import { el, icons, openModal, openSheet, toast, ringSVG, haptic, makeChart, fmtDateFull, attachSwipeToDelete, dateBar } from '../utils/ui.js';
import { openRankCard } from '../utils/rankCard.js';
import { lineChartOptions, lineDataset } from '../utils/charts.js';
import { goToPage, PAGE_NUTRITION, PAGE_ACTIVITY, PAGE_WORKOUT, getViewDate, isViewingToday } from '../utils/nav.js';
import { weeklySetsByMuscle } from '../utils/math.js';
import { exerciseLookup } from './workout.js';
import { macroGoals, macroGoalsFor, renderCoachCard } from './nutrition.js';
import { computeGlobalRank } from '../utils/globalRank.js';
import { rankBadge, rankFromLP, lpLabel } from '../utils/ranks.js';

let weightChart = null;
let smaVisible = true;
let caloriesVisible = false;


function openLogWeightModal(rerender, prefill = null) {
  const form = el(`<div class="field-stack">
    <label class="field"><span>Poids (kg)</span><input id="w-value" type="number" step="0.1" inputmode="decimal" placeholder="75.2" value="${prefill ? prefill.value : ''}" autofocus></label>
    <label class="field"><span>Date</span><input id="w-date" type="date" value="${prefill ? prefill.date : getViewDate()}"></label>
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
  // Plage : soit les N derniers jours, soit tout depuis la première pesée.
  // Sans pesée, on affiche quand même la plage choisie, axes et titres compris.
  const first = all.length ? all[0].date : todayISO(-(weightRange || 30) + 1);
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
    datasets.push(lineDataset('Calories', calValues, '#8D95A3', { fill: false, borderWidth: 2, yAxisID: 'y1' }));
  }

  // Étiquettes : jour/mois sur les courtes plages, mois seul au-delà.
  const labels = days.map((d) => (nDays > 120 ? d.slice(5, 7) + '/' + d.slice(2, 4) : d.slice(8) + '/' + d.slice(5, 7)));

  const options = lineChartOptions({ legend: datasets.length > 1, ySuffix: ' kg', yTicks: 4, xTicks: 5 });
  const axisTitle = (text) => ({ display: true, text, color: '#8A9099', font: { size: 11, family: 'Archivo', weight: '600' } });
  options.scales.x.title = axisTitle('Date');
  options.scales.y.title = axisTitle('Poids (kg)');
  if (!all.length) {
    // Échelle autour du poids du profil : la grille reste lisible à vide.
    const bw = Math.round(store.userData.profile.weight || 75);
    options.scales.y.suggestedMin = bw - 3;
    options.scales.y.suggestedMax = bw + 3;
  }
  if (caloriesVisible) {
    options.scales.y1 = {
      position: 'left',
      grid: { display: false, drawBorder: false },
      border: { display: false },
      ticks: { color: '#8D95A3', font: { size: 10, family: 'Archivo' }, maxTicksLimit: 4, padding: 6 },
    };
  }

  weightChart = makeChart(canvas, { type: 'line', data: { labels, datasets }, options }, weightChart);
}

// Rang global : la carte commune (utils/rankCard.js), avec au verso le détail.
function openGlobalRankModal(gr) {
  const label = gr.rank.division ? `${gr.rank.name} ${gr.rank.division}` : gr.rank.name;
  const pct = gr.rank.lpNeeded ? Math.round((gr.rank.lp / gr.rank.lpNeeded) * 100) : 100;
  openRankCard({
    rank: gr.rank,
    label,
    ariaLabel: `Rang global ${label}`,
    back: `<div class="rk-face rk-back" style="--rk:${gr.rank.color}">
      <div class="rk-back-title">Rang global</div>
      <div class="rk-back-name">${label}</div>
      ${gr.rank.lpNeeded ? `<div class="grd-bar"><i style="width:${pct}%;background:${gr.rank.color}"></i></div>
        <div class="rk-next">${gr.rank.lpNeeded - gr.rank.lp} LP avant le rang suivant</div>` : '<div class="grd-ultime">Rang ultime atteint</div>'}
      <div class="grd-stats">
        <div class="grd-row"><span>LP totaux</span><b>${gr.lp}</b></div>
        <div class="grd-row"><span>Série en cours</span><b>${gr.streak} j</b></div>
        ${gr.lastSeasonPeak > 0 ? `<div class="grd-row"><span>Pic saison ${gr.season - 1}</span><b>${rankFromLP(gr.lastSeasonPeak).name}</b></div>` : ''}
      </div>
    </div>`,
  });
}

// Couleurs macros, alignées sur l'onglet Nutrition
const C_PROT = 'var(--mac-p)';
const C_CARB = 'var(--mac-g)';
const C_FAT = 'var(--mac-l)';


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
    <path d="${area}" fill="var(--accent)" fill-opacity="0.1"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

// Piste de progression des pas : une ligne qui se remplit jusqu'au drapeau
// d'arrivée. Construite en HTML/CSS et non en SVG étiré : un SVG en
// `preserveAspectRatio: none` déformerait le drapeau dans une bande large et
// basse.
function stepsTrack(ratio) {
  const p = Math.max(0, Math.min(1, ratio || 0));
  const done = p >= 1;
  return `<div class="ha-line">
    <i class="ha-fill" style="width:${(p * 100).toFixed(1)}%"></i>
    <i class="ha-dot" style="left:${(p * 100).toFixed(1)}%"></i>
    <span class="ha-flag${done ? ' done' : ''}" aria-hidden="true">
      <svg viewBox="0 0 10 14"><path d="M1 0v14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M1.8 1.2 L9 3.6 L1.8 6 Z" fill="currentColor"/></svg>
    </span>
  </div>`;
}

// Série : jours consécutifs avec au moins un repas ou une séance saisis.
// Aujourd'hui compte s'il est renseigné ; sinon la série court jusqu'à hier.
function entryStreak() {
  const meals = store.userData.nutrition.byDate;
  const sessions = new Set(store.userData.workouts.map((w) => w.date));
  const has = (d) => sessions.has(d) || !!(meals[d] && meals[d].meals && meals[d].meals.length);
  let n = 0;
  for (let i = has(todayISO()) ? 0 : -1; has(todayISO(i)); i--) n++;
  return n;
}
// Flamme : bleu de l'appli au départ, violet à mi-chemin, rose à un an.
function flameColor(days) {
  const stops = [[0, 217, 255], [167, 139, 250], [244, 114, 182]];
  const t = Math.min(1, days / 365) * 2;
  const a = stops[Math.min(1, Math.floor(t))]; const b = stops[Math.min(1, Math.floor(t)) + 1];
  const k = t - Math.min(1, Math.floor(t));
  return `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * k)).join(',')})`;
}

export function render(container) {
  const rerender = () => render(container);
  const { profile, goal, settings } = store.userData;
  const today = getViewDate(); // jour consulté, commun à tous les onglets
  const totals = store.dayTotals(today);
  const mg = macroGoalsFor(today);
  const steps = store.userData.steps.byDate[today] || 0;
  const stepsGoal = settings.stepsGoal || 10000;
  // Volume de la semaine : séries faites sur 7 jours, sur la somme des objectifs par muscle
  const wkStart = new Date(today + 'T12:00:00'); wkStart.setDate(wkStart.getDate() - 6);
  const wkSets = weeklySetsByMuscle(store.userData.workouts, exerciseLookup, wkStart.toISOString().slice(0, 10), today, settings.secondaryRatio);
  const volDone = Math.round(Object.values(wkSets).reduce((a, b) => a + b, 0));
  const volGoal = Object.values(settings.volumeGoals || {}).reduce((a, b) => a + b, 0) || 1;
  const left = mg.kcalGoal - totals.kcal;
  const macro = (k, v, g, c) => `<div class="hk-macro"><span>${k} <b class="num">${Math.round(v)}</b>/${g} g</span><i><u style="width:${Math.min(100, Math.round((v / (g || 1)) * 100))}%;background:var(${c})"></u></i></div>`;
  // Poids du jour consulté : la dernière pesée faite ce jour là ou avant.
  const wUpTo = store.userData.weights.filter((w) => w.date <= today);
  const currentW = wUpTo.length ? wUpTo[wUpTo.length - 1].value : profile.weight;

  container.innerHTML = '';
  const streak = entryStreak();
  const gr = computeGlobalRank(store.userData, todayISO(), { liveMacroGoal: macroGoals() });
  const grRankLabel = gr.rank.division ? `${gr.rank.name} ${gr.rank.division}` : gr.rank.name;
  const grProgress = gr.rank.lpNeeded ? gr.rank.lp / gr.rank.lpNeeded : 1;

  container.appendChild(el(`
    <div class="home-fit">

      <div class="card stat-card home-kcal" id="home-kcal">
        <div class="hk-row">
          <div class="hk-side"><span class="num hk-big">${Math.round(totals.kcal)}</span><span class="hk-lbl">kcal mangées</span></div>
          <div class="hk-ring">${ringSVG({ size: 104, stroke: 12, progress: totals.kcal / mg.kcalGoal })}</div>
          <div class="hk-side hk-right"><span class="num hk-big">${Math.abs(Math.round(left))}</span><span class="hk-lbl">${left >= 0 ? 'kcal restantes' : 'kcal en trop'}</span></div>
        </div>
        <div class="hk-macros">
          ${macro('P', totals.prot, mg.protG, '--mac-p')}${macro('G', totals.carbs, mg.carbsG, '--mac-g')}${macro('L', totals.fat, mg.fatG, '--mac-l')}
        </div>
      </div>

      <div class="home-pair">
        <div class="card stat-card home-activity" id="home-activity">
          <div class="tile-top"><span class="stat-head">${icons.steps} Pas</span>${ringSVG({ size: 56, stroke: 8, progress: steps / stepsGoal })}</div>
          <div class="tile-val"><span class="num">${steps.toLocaleString('fr-FR')}</span><small>/ ${stepsGoal.toLocaleString('fr-FR')}</small></div>
        </div>
        <div class="card stat-card home-volume" id="home-volume">
          <div class="tile-top"><span class="stat-head">Volume</span>${ringSVG({ size: 56, stroke: 8, progress: volDone / volGoal })}</div>
          <div class="tile-val"><span class="num">${volDone}</span><small>/ ${volGoal} séries sur 7 j</small></div>
        </div>
      </div>

      <div class="card stat-card home-weight" id="home-weight">
        <div class="hw-content">
          <div class="stat-head">Poids</div>
          <div class="num w-now">${currentW}<small>kg</small></div>
        </div>
        <div class="hw-curve">${weightSparkline(store.userData.weights)}</div>
      </div>

      <div class="home-pair">
        <div class="card stat-card gr-card" id="gr-card">
          <div class="tile-top"><span class="stat-head">Rang</span><span class="gr-badge">${rankBadge(gr.rank.id, 56)}</span></div>
          <div class="tile-val">
            <span class="gr-rank-name" style="color:${gr.rank.color}">${grRankLabel}</span>
            <small class="gr-lp">${lpLabel(gr.rank)}</small>
            <div class="gr-progress"><i style="width:${Math.round(grProgress * 100)}%;background:${gr.rank.color}"></i></div>
          </div>
        </div>
        <div class="card stat-card home-streak" id="home-streak" style="--flame:${flameColor(streak)}">
          <div class="tile-top"><span class="stat-head">Série</span><span class="streak-flame">${icons.flame}</span></div>
          <div class="tile-val"><span class="num">${streak}</span><small>jour${streak > 1 ? 's' : ''} de suite</small></div>
        </div>
      </div>
    </div>`));

  const nByDate = store.userData.nutrition.byDate;
  container.querySelector('.home-fit').prepend(dateBar({
    title: 'Accueil',
    mark: (d) => (nByDate[d] && nByDate[d].meals && nByDate[d].meals.length ? 'on' : ''),
    onChange: rerender,
  }));
  container.querySelector('#gr-card').addEventListener('click', () => openGlobalRankModal(gr));
  // La carte Poids ouvre la fenêtre qui contient le graphique ET les actions.
  container.querySelector('#home-weight').addEventListener('click', () => openChartModal(rerender));
  // Calories et Activité renvoient vers l'onglet correspondant : l'accueil est
  // un résumé, le détail vit dans sa page.
  container.querySelector('#home-kcal').addEventListener('click', () => goToPage(PAGE_NUTRITION));
  container.querySelector('#home-activity').addEventListener('click', () => goToPage(PAGE_ACTIVITY));
  container.querySelector('#home-volume').addEventListener('click', () => goToPage(PAGE_WORKOUT));

  // Jours de pesée déjà couverts sur les 5 qui déclenchent le coach.
function coachDays() {
  const ws = [...store.userData.weights].sort((a, b) => a.date.localeCompare(b.date)).filter((w) => w.date > todayISO(-14));
  if (!ws.length) return 0;
  const span = (new Date(ws[ws.length - 1].date) - new Date(ws[0].date)) / 86400000;
  return Math.min(5, Math.round(span) + 1);
}

// Coach métabolique : il vit sur l'accueil (et non plus dans Nutrition).
  {
    // Sur l'accueil, le coach tient sur une ligne (rythme + point s'il a un
    // conseil à appliquer) ; le toucher ouvre le conseil complet.
    const full = renderCoachCard(rerender);
    const tone = full ? ['good', 'warn'].find((t) => full.classList.contains(`coach-${t}`)) || 'neutral' : 'neutral';
    const row = el(`<button type="button" class="coach-card coach-mini coach-${tone}" aria-label="Coach${full && full.querySelector('.coach-btn') ? ', un conseil à appliquer' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>
      ${full && full.querySelector('.coach-btn') ? '<i class="coach-dot"></i>' : ''}
    </button>`);
    row.addEventListener('click', () => {
      // Pas assez de pesées : seul le choix de phase a du sens
      if (!full) { openGoalModal(rerender); return; }
      let sheet = null;
      const after = () => { if (sheet) sheet.close(); rerender(); };
      const body = el('<div class="coach-sheet"></div>');
      body.appendChild(renderCoachCard(after));
      const phase = el(`<button class="btn btn-secondary btn-block">${icons.edit} Changer de phase</button>`);
      phase.addEventListener('click', () => { sheet.close(); openGoalModal(rerender); });
      body.appendChild(phase);
      sheet = openSheet({ title: 'Coach', content: body });
    });
    const bar = container.querySelector('.date-bar');
    bar.insertBefore(row, bar.querySelector('.week-strip'));
  }

}
