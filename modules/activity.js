// OmniFit — PAGE 3 : Activité (pas)
import { store, todayISO, parseStepsPayload } from '../utils/storage.js';
import { el, icons, openModal, openSheet, toast, ringSVG, fmtDateShort, haptic } from '../utils/ui.js';

let viewDays = 7;
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
    <label class="field"><span>Date</span><input id="st-date" type="date" value="${prefill ? prefill.date : todayISO()}"></label>
  </div>`);
  openModal({
    title: prefill ? `Pas · ${fmtDateShort(prefill.date)}` : 'Ajouter des pas',
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
function barsHTML(days) {
  const byDate = store.userData.steps.byDate;
  const vals = days.map((d) => byDate[d] || 0);
  const goal = stepGoal();
  const max = Math.max(goal * 1.2, ...vals) || 1;
  const week = days.length <= 7;
  return `<div class="sb-plot${week ? ' sb-week' : ''}" style="--goal:${(goal / max).toFixed(3)}">
    <div class="sb-goal"></div>
    ${days.map((d, i) => {
    const v = vals[i];
    const hit = v >= stepGoalFor(d);
    const dt = new Date(d + 'T12:00:00');
    const lbl = week ? DAY_LETTERS[dt.getDay()] : ((days.length - 1 - i) % 7 === 0 ? String(dt.getDate()) : '');
    return `<button type="button" class="sb-col${d === todayISO() ? ' today' : ''}" data-date="${d}" aria-label="${fmtDateShort(d)} : ${v.toLocaleString('fr-FR')} pas">
        ${week ? `<span class="sb-val">${v ? kSteps(v) : ''}</span>` : ''}
        <span class="sb-track"><span class="sb-bar${hit ? ' hit' : ''}" style="height:${v ? Math.max(3, (v / max) * 100).toFixed(1) : 0}%"></span></span>
        <span class="sb-day">${lbl}</span>
      </button>`;
  }).join('')}
  </div>`;
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
      Touche <b>Coller le presse-papier</b>, ou fais un appui long dans le champ → <b>Coller</b>, puis <b>Importer</b>.
    </p>
    <button class="btn btn-secondary btn-block" id="sp-paste" style="margin-bottom:8px">${icons.copy} Coller le presse-papier</button>
    <textarea id="sp-input" rows="5" placeholder="2026-07-22:8200&#10;2026-07-23:9100&#10;…" class="field-input-solo no-sheet-drag" style="width:100%;font-family:monospace;font-size:0.9rem;line-height:1.5;resize:vertical"></textarea>
    <button class="btn btn-primary btn-block" id="sp-import" style="margin-top:12px">${icons.download} Importer</button>
    <button class="btn btn-ghost btn-block btn-sm" id="sp-help" style="margin-top:8px">Comment configurer le raccourci ?</button>
  </div>`);
  const sheet = openSheet({ title: 'Importer les pas', content: form });
  const input = form.querySelector('#sp-input');

  // Bouton « Coller » : un tap est un geste utilisateur direct, ce qu'iOS exige
  // pour lire le presse-papier. On importe DIRECTEMENT le contenu lu, sans
  // dépendre du champ texte (qui peut être capricieux en PWA).
  form.querySelector('#sp-paste').addEventListener('click', async () => {
    let t = '';
    try {
      t = await navigator.clipboard.readText();
    } catch (_) {
      toast('Lecture refusée — colle à la main dans le champ', 'error');
      return;
    }
    const entries = parseStepsPayload(t);
    if (!entries.length) { toast('Presse-papier vide ou non reconnu', 'error'); input.value = t || ''; return; }
    sheet.close();
    applyStepsEntries(entries, rerender);
  });

  // Pré-remplissage best-effort (si le presse-papier est finalement lisible).
  navigator.clipboard.readText().then((t) => {
    if (t && !input.value) { input.value = t; }
  }).catch(() => { /* ignoré : l'utilisateur collera à la main */ });

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
  const byDate = store.userData.steps.byDate;
  const steps = byDate[today] || 0;
  const goal = stepGoal();
  const days = [...Array(viewDays)].map((_, i) => todayISO(i - viewDays + 1));
  const logged = days.filter((d) => byDate[d] != null);
  const avg = logged.length ? Math.round(logged.reduce((acc, d) => acc + byDate[d], 0) / logged.length) : 0;
  const hits = days.filter((d) => (byDate[d] || 0) >= stepGoalFor(d)).length;
  const best = Math.max(0, ...days.map((d) => byDate[d] || 0));
  const streak = goalStreak();
  const left = Math.max(0, goal - steps);

  container.innerHTML = '';
  container.appendChild(el(`
    <div class="steps-page">
      <div class="page-title page-title-actions">
        <h1>Activité</h1>
        <div class="title-actions">
          <button class="btn btn-ghost btn-sm" id="btn-import-steps" title="Importer les pas depuis Santé" aria-label="Importer les pas depuis Santé">${icons.download}</button>
          <button class="btn btn-primary btn-sm" id="btn-log-steps" aria-label="Ajouter des pas">${icons.plus}</button>
        </div>
      </div>

      <div class="card card-glow steps-hero">
        <button type="button" class="steps-ring" id="btn-step-goal" aria-label="Modifier l'objectif de pas">
          ${ringSVG({ size: 148, stroke: 12, progress: steps / goal, gradient: true, label: steps.toLocaleString('fr-FR'), sub: `/ ${goal.toLocaleString('fr-FR')}` })}
        </button>
        <div class="steps-kpis">
          <div class="steps-kpi"><span class="eyebrow">${left ? 'Restants' : 'Objectif'}</span><b class="num${left ? '' : ' ok'}">${left ? left.toLocaleString('fr-FR') : 'Atteint'}</b></div>
          <div class="steps-kpi"><span class="eyebrow">Série</span><b class="num">${streak}<small> j</small></b></div>
          <div class="steps-kpi"><span class="eyebrow">Moyenne ${viewDays} j</span><b class="num">${avg.toLocaleString('fr-FR')}</b></div>
        </div>
      </div>

      <div class="card steps-bars">
        <div class="card-row">
          <h3>${viewDays === 7 ? '7 derniers jours' : '30 derniers jours'}</h3>
          <div class="segment" id="view-toggle">
            <button data-d="7" class="${viewDays === 7 ? 'active' : ''}">7 j</button>
            <button data-d="30" class="${viewDays === 30 ? 'active' : ''}">30 j</button>
          </div>
        </div>
        ${barsHTML(days)}
        <div class="sb-foot">
          <span><b class="num">${hits}</b> / ${viewDays} jours à l'objectif</span>
          <span>Record <b class="num">${best.toLocaleString('fr-FR')}</b></span>
        </div>
      </div>
    </div>`));

  container.querySelector('#btn-log-steps').addEventListener('click', () => openLogStepsModal(rerender));
  container.querySelector('#btn-step-goal').addEventListener('click', () => openStepGoalModal(rerender));
  container.querySelector('#btn-import-steps').addEventListener('click', () => importStepsFromClipboard(rerender));
  container.querySelector('#view-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    viewDays = +btn.dataset.d;
    rerender();
  });
  container.querySelector('.sb-plot').addEventListener('click', (e) => {
    const col = e.target.closest('.sb-col');
    if (!col) return;
    const d = col.dataset.date;
    openLogStepsModal(rerender, { date: d, count: byDate[d] != null ? byDate[d] : null });
  });
}
