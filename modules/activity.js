// OmniFit — PAGE 3 : Activité (pas)
import { store, todayISO, parseStepsPayload } from '../utils/storage.js';
import { calculateTrend } from '../utils/math.js';
import { el, icons, openModal, openSheet, toast, ringSVG, fmtDateShort, haptic } from '../utils/ui.js';

let stepsChart = null;
let viewDays = 7;
const stepGoal = () => store.userData.settings.stepsGoal || 10000;

// Objectif de pas figé par jour : augmenter l'objectif aujourd'hui ne dévalide pas
// les jours passés qui avaient déjà atteint l'ancien objectif (même principe que
// macroGoalsFor pour la nutrition).
function stepGoalFor(date) {
  const live = stepGoal();
  const gbd = store.userData.steps.goalByDate;
  if (date === todayISO()) { gbd[date] = live; store.persist(); return live; }
  if (gbd[date] != null) return gbd[date];
  gbd[date] = live;
  store.persist();
  return live;
}

function openStepGoalModal(rerender) {
  const form = el(`<div class="field-stack">
    <label class="field"><span>Objectif de pas / jour</span><input id="sg-value" type="number" inputmode="numeric" step="500" min="0" value="${stepGoal()}" autofocus></label>
  </div>`);
  openModal({
    title: 'Objectif de pas',
    content: form,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Enregistrer', variant: 'btn-primary',
        onClick: (body) => {
          const v = parseInt(body.querySelector('#sg-value').value, 10);
          if (!v || v <= 0) { toast('Valeur invalide', 'error'); return 'keep'; }
          store.saveUserData({ settings: { stepsGoal: v } });
          haptic();
          rerender();
        },
      },
    ],
  });
}

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
        backgroundColor: data.map((v, i) => (v >= stepGoalFor(days[i]) ? 'rgba(16,185,129,0.65)' : 'rgba(0,217,255,0.55)')),
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
  const activeDays = monthDays.filter((d) => (byDate[d] || 0) >= stepGoalFor(d)).length;
  const sumCur = vals.reduce((a, b) => a + b, 0);
  const sumPrev = prevVals.reduce((a, b) => a + b, 0);
  const trend = calculateTrend(sumCur, sumPrev);
  return { weekAvg, record, activeDays, trend };
}

// Applique une liste d'entrées de pas et notifie.
function applyStepsEntries(entries, rerender) {
  for (const { date, count } of entries) store.addStepsLog(date, count);
  haptic();
  const todayEntry = entries.find((e) => e.date === todayISO());
  toast(
    entries.length === 1
      ? `${entries[0].count.toLocaleString('fr-FR')} pas importés`
      : `${entries.length} jours importés${todayEntry ? ` · ${todayEntry.count.toLocaleString('fr-FR')} aujourd'hui` : ''}`,
    'success',
  );
  rerender();
}

// Import des pas. On tente d'abord la lecture automatique du presse-papier ; si
// iOS la bloque (fréquent en PWA), on ouvre un champ où l'utilisateur colle
// directement — méthode fiable, plutôt que d'afficher un guide.
async function importStepsFromClipboard(rerender) {
  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch (_) {
    text = '';
  }
  const entries = parseStepsPayload(text);
  if (entries.length) {
    applyStepsEntries(entries, rerender);
    return;
  }
  // Lecture auto vide ou refusée → champ de collage manuel (fiable sur iOS).
  openStepsPasteSheet(rerender);
}

// Champ de collage : l'utilisateur colle le texte du raccourci (appui long →
// Coller) puis valide. On tente de pré-remplir automatiquement si possible.
function openStepsPasteSheet(rerender) {
  const form = el(`<div>
    <p class="muted" style="font-size:0.82rem;line-height:1.5;margin-bottom:10px">
      Colle ici le texte copié par ton raccourci (appui long dans le champ → <b>Coller</b>), puis touche <b>Importer</b>.
    </p>
    <textarea id="sp-input" rows="5" placeholder="2026-07-22:8200&#10;2026-07-23:9100&#10;…" class="field-input-solo" style="width:100%;font-family:monospace;font-size:0.9rem;line-height:1.5;resize:vertical"></textarea>
    <button class="btn btn-primary btn-block" id="sp-import" style="margin-top:12px">${icons.download} Importer</button>
    <button class="btn btn-ghost btn-block btn-sm" id="sp-help" style="margin-top:8px">Comment configurer le raccourci ?</button>
  </div>`);
  const sheet = openSheet({ title: 'Importer les pas', content: form });
  const input = form.querySelector('#sp-input');

  // Pré-remplissage best-effort (si le presse-papier est finalement lisible).
  navigator.clipboard.readText().then((t) => {
    if (t && !input.value) { input.value = t; }
  }).catch(() => { /* ignoré : l'utilisateur collera à la main */ });

  setTimeout(() => { try { input.focus(); } catch (_) { /* noop */ } }, 60);

  form.querySelector('#sp-import').addEventListener('click', () => {
    const entries = parseStepsPayload(input.value);
    if (!entries.length) { toast('Rien à importer — colle le texte du raccourci', 'error'); return; }
    sheet.close();
    applyStepsEntries(entries, rerender);
  });
  form.querySelector('#sp-help').addEventListener('click', () => { sheet.close(); openStepsGuide(rerender); });
}

// Guide de configuration du raccourci iOS (affiché si le presse-papier est vide
// ou inaccessible).
function openStepsGuide(rerender) {
  const content = el(`<div class="steps-guide">
    <p class="muted" style="font-size:0.82rem;line-height:1.5;margin-bottom:12px">
      iOS interdit à une app web de lire Santé directement. Un petit <b>raccourci</b> copie tes pas ;
      ce bouton les récupère ensuite depuis le presse-papier.
    </p>
    <div class="guide-step"><span class="guide-n">1</span><div>Ouvre l'app <b>Raccourcis</b> → <b>＋</b> pour en créer un.</div></div>
    <div class="guide-step"><span class="guide-n">2</span><div>Ajoute l'action <b>« Rechercher des échantillons de Santé »</b> : type <b>Pas</b>, période <b>Aujourd'hui</b>, option <b>Calculer la somme</b>.</div></div>
    <div class="guide-step"><span class="guide-n">3</span><div>Ajoute <b>« Copier dans le presse-papiers »</b> (la somme de l'étape 2).</div></div>
    <div class="guide-step"><span class="guide-n">4</span><div>Nomme-le p.ex. « Pas → OmniFit ». Lance-le, reviens ici, touche <b>Importer</b>.</div></div>
    <div class="guide-auto">
      <b>Rendre ça (presque) automatique</b>
      <div class="guide-step"><span class="guide-n">A</span><div>Onglet <b>Automatisation</b> → <b>＋</b> → <b>App</b> → choisis <b>OmniFit</b> → <b>Est ouverte</b>.</div></div>
      <div class="guide-step"><span class="guide-n">B</span><div>Action <b>« Exécuter le raccourci »</b> → ton raccourci. Décoche <b>« Demander avant d'exécuter »</b>.</div></div>
      <div class="guide-step"><span class="guide-n">C</span><div>Désormais, à chaque ouverture de l'app, tes pas sont copiés : il ne reste qu'à toucher <b>Importer</b>.</div></div>
    </div>
    <div class="guide-multi muted" style="font-size:0.76rem;line-height:1.5;margin-top:10px">
      <b>Astuce 7 jours :</b> pour combler les trous, fais une boucle « Répéter 7 fois » qui ajoute une ligne
      <code>AAAA-MM-JJ:pas</code> par jour, puis copie le tout. L'import lit toutes les lignes d'un coup.
    </div>
    <button class="btn btn-secondary btn-block" id="guide-manual" style="margin-top:14px">${icons.edit} Saisir manuellement</button>
  </div>`);
  const m = openModal({ title: 'Importer les pas', content, actions: [{ label: 'Fermer' }] });
  content.querySelector('#guide-manual').addEventListener('click', () => {
    if (m && m.close) m.close();
    openLogStepsModal(rerender);
  });
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
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" id="btn-import-steps" title="Importer les pas depuis Santé">${icons.download}</button>
          <button class="btn btn-ghost btn-sm" id="btn-step-goal">${icons.edit} Objectif</button>
          <button class="btn btn-primary btn-sm" id="btn-log-steps">${icons.plus} Log</button>
        </div>
      </div>

      <div class="card card-glow steps-hero">
        ${ringSVG({ size: 168, stroke: 13, progress: steps / stepGoal(), gradient: true, label: steps.toLocaleString('fr-FR'), sub: `/ ${stepGoal().toLocaleString('fr-FR')} pas` })}
        <div class="steps-remaining">${steps >= stepGoal() ? 'Objectif atteint 🎯' : `${(stepGoal() - steps).toLocaleString('fr-FR')} pas restants`}</div>
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
  container.querySelector('#btn-step-goal').addEventListener('click', () => openStepGoalModal(rerender));
  container.querySelector('#btn-import-steps').addEventListener('click', () => importStepsFromClipboard(rerender));
  container.querySelector('#view-toggle').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    viewDays = +b.dataset.d;
    rerender();
  });

  renderChart(container.querySelector('#steps-chart'));
}
