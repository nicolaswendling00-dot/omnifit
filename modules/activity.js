// OmniFit — PAGE 3 : Activité (pas)
import { store, todayISO, parseStepsPayload } from '../utils/storage.js';
import { el, icons, openModal, openSheet, toast, ringSVG, fmtDateShort, haptic, pageFab, dateBar, periodRange, monthBuckets, PERIODS, periodHead, attachPeriodSwipe, slideIn } from '../utils/ui.js';
import { PAGE_ACTIVITY, getViewDate } from '../utils/nav.js';

// Jour décalé de n jours (dates locales AAAA-MM-JJ)
const shiftISO = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

let perKind = 'week'; // 'week' | 'month' | 'year' | 'all'
let perOffset = 0;
let perDir = 0; // sens de la dernière navigation, pour l'animation
const stepGoal = () => store.userData.settings.stepsGoal || 10000;

// Objectif de pas figé par jour : augmenter l'objectif aujourd'hui ne dévalide pas
// les jours passés qui avaient déjà atteint l'ancien objectif (même principe que
// macroGoalsFor pour la nutrition).
// N'écrit dans le stockage que si la valeur change réellement : `persist()`
// sérialise tout le userData, et cette fonction est appelée une fois par jour
// affiché (jusqu'à 180 fois par rendu du graphique).
function stepGoalFor(date) {
  const live = stepGoal();
  const gbd = store.userData.steps.goalByDate;
  if (date === todayISO()) {
    if (gbd[date] !== live) { gbd[date] = live; store.persist(); }
    return live;
  }
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
    <label class="field"><span>Nombre de pas</span><input id="st-count" type="number" inputmode="numeric" min="0" placeholder="8500" value="${prefill && prefill.count != null ? prefill.count : ''}" autofocus></label>
    <label class="field"><span>Date</span><input id="st-date" type="date" value="${prefill ? prefill.date : getViewDate()}"></label>
  </div>`);
  openModal({
    title: prefill ? `Pas du ${fmtDateShort(prefill.date)}` : 'Ajouter des pas',
    content: form,
    actions: [
      prefill && prefill.count != null
        ? {
          label: 'Supprimer', variant: 'btn-danger-soft',
          onClick: () => {
            store.removeStepsLog(prefill.date);
            haptic();
            toast('Relevé supprimé', 'success');
            rerender();
          },
        }
        : { label: 'Annuler' },
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

// Série en cours : jours consécutifs à l'objectif. Aujourd'hui compte s'il
// est déjà atteint ; sinon la série court jusqu'à hier (la journée n'est pas
// finie, on ne la casse pas).
function goalStreak() {
  const byDate = store.userData.steps.byDate;
  let n = 0;
  let i = (byDate[todayISO()] || 0) >= stepGoalFor(todayISO()) ? 0 : -1;
  for (; i > -400; i--) {
    const d = todayISO(i);
    if ((byDate[d] || 0) >= stepGoalFor(d)) n++; else break;
  }
  return n;
}

const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const kSteps = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',')}k` : String(v));

// Histogramme en HTML (pas de Chart.js) : une barre par jour, ligne
// pointillée à l'objectif, barre verte quand l'objectif est atteint.
// Toucher une barre ouvre la saisie de ce jour.
// items : [{ date?, label, v, hit, val }] ; une barre par jour, ou par mois en vue année
function barsHTML(items, goal, showVals) {
  const max = Math.max(goal * 1.2, ...items.map((x) => x.v)) || 1;
  return `<div class="sb-plot${showVals ? ' sb-week' : ''}" style="--goal:${(goal / max).toFixed(3)}">
    <div class="sb-goal"></div>
    ${items.map((x) => `<button type="button" class="sb-col${x.date && x.date === getViewDate() ? ' today' : ''}" ${x.date ? `data-date="${x.date}"` : ''} aria-label="${x.aria}">
        ${showVals ? `<span class="sb-val">${x.v ? kSteps(x.v) : ''}</span>` : ''}
        <span class="sb-track"><span class="sb-bar${x.hit ? ' hit' : ''}" style="height:${x.v ? Math.max(3, (x.v / max) * 100).toFixed(1) : 0}%"></span></span>
        <span class="sb-day">${x.label}</span>
      </button>`).join('')}
  </div>`;
}

export function render(container) {
  const rerender = () => render(container);
  const today = getViewDate(); // jour consulté, commun à tous les onglets
  const byDate = store.userData.steps.byDate;
  const steps = byDate[today] || 0;
  const goal = stepGoalFor(today);
  const R = periodRange(perKind, perOffset, Object.keys(byDate).sort()[0]);
  const days = R.days;
  const logged = days.filter((d) => byDate[d] != null);
  const avg = logged.length ? Math.round(logged.reduce((acc, d) => acc + byDate[d], 0) / logged.length) : 0;
  const hits = days.filter((d) => (byDate[d] || 0) >= stepGoalFor(d)).length;
  const best = Math.max(0, ...days.map((d) => byDate[d] || 0));
  const goalNow = stepGoal();
  let items;
  // Tout : une barre par jour tant que l'historique tient dans un mois
  if (perKind === 'year' || (perKind === 'all' && days.length > 31)) {
    // Une barre par mois : moyenne des jours renseignés du mois
    items = monthBuckets(days).map(({ days: ds, label }) => {
      const md = ds.filter((d) => byDate[d] != null);
      const v = md.length ? Math.round(md.reduce((a, d) => a + byDate[d], 0) / md.length) : 0;
      return { label, v, hit: v >= goalNow, aria: `Moyenne ${v} pas` };
    });
  } else {
    items = days.map((d, i) => {
      const v = byDate[d] || 0;
      const dt = new Date(d + 'T12:00:00');
      const label = days.length <= 7 ? DAY_LETTERS[dt.getDay()] : (dt.getDate() === 1 || dt.getDate() % 7 === 1 ? String(dt.getDate()) : '');
      return { date: d, label, v, hit: v >= stepGoalFor(d), aria: `${fmtDateShort(d)} : ${v.toLocaleString('fr-FR')} pas` };
    });
  }
  const streak = goalStreak();
  const left = Math.max(0, goal - steps);

  container.innerHTML = '';
  container.appendChild(el(`
    <div class="steps-page">

      <div class="card card-glow steps-hero">
        <button class="icon-btn steps-import" id="btn-import-steps" title="Importer les pas depuis Santé" aria-label="Importer les pas depuis Santé">${icons.download}</button>
        <button type="button" class="steps-ring" id="btn-step-goal" aria-label="Modifier l'objectif de pas">
          ${ringSVG({ size: 148, stroke: 12, progress: steps / goal, gradient: true, label: steps.toLocaleString('fr-FR'), sub: `/ ${goal.toLocaleString('fr-FR')}` })}
        </button>
        <div class="steps-kpis">
          <div class="steps-kpi"><span class="eyebrow">${left ? 'Restants' : 'Objectif'}</span><b class="num${left ? '' : ' ok'}">${left ? left.toLocaleString('fr-FR') : 'Atteint'}</b></div>
          <div class="steps-kpi"><span class="eyebrow">Série</span><b class="num">${streak}<small> j</small></b></div>
        </div>
      </div>

      <div class="card steps-bars">
        <div class="segment" id="view-toggle">
          ${PERIODS.map(([k, l]) => `<button data-k="${k}" class="${perKind === k ? 'active' : ''}">${l}</button>`).join('')}
        </div>
        ${periodHead(R, `<span class="per-avg"><b class="num">${avg.toLocaleString('fr-FR')}</b> pas en moyenne</span>`, perOffset)}
        <div class="sb-zone">${barsHTML(items, goalNow, perKind === 'week')}</div>
        <div class="sb-foot">
          <span><b class="num">${hits}</b> jours à l'objectif</span>
          <span>Record <b class="num">${best.toLocaleString('fr-FR')}</b></span>
        </div>
      </div>
    </div>`));

  container.firstElementChild.prepend(dateBar({
    title: 'Activité',
    mark: (d) => (byDate[d] == null ? '' : byDate[d] >= stepGoalFor(d) ? 'ok' : 'on'),
    onChange: rerender,
  }));

  pageFab(PAGE_ACTIVITY, icons.plus, 'Ajouter des pas', () => openLogStepsModal(rerender));
  container.querySelector('#btn-step-goal').addEventListener('click', () => openStepGoalModal(rerender));
  container.querySelector('#btn-import-steps').addEventListener('click', () => importStepsFromClipboard(rerender));
  container.querySelector('#view-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.dataset.k === perKind) return;
    perKind = btn.dataset.k; perOffset = 0; perDir = 0;
    rerender();
  });
  const go = (dir) => {
    if (perKind === 'all' || perOffset + dir < 0) return;
    perOffset += dir; perDir = dir;
    haptic();
    rerender();
  };
  container.querySelector('.per-prev').addEventListener('click', () => go(1));
  container.querySelector('.per-next').addEventListener('click', () => go(-1));
  attachPeriodSwipe(container.querySelector('.sb-zone'), go);
  if (perDir) { slideIn(container.querySelector('.sb-plot'), perDir); perDir = 0; }
  container.querySelector('.sb-plot').addEventListener('click', (e) => {
    const col = e.target.closest('.sb-col');
    if (!col) return;
    const d = col.dataset.date;
    openLogStepsModal(rerender, { date: d, count: byDate[d] != null ? byDate[d] : null });
  });
}
