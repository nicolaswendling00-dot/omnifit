// OmniFit — PAGE 1 : Nutrition (macros en grammes par défaut, FAB global)
import { store, todayISO } from '../utils/storage.js';
import { calcKcal } from '../utils/math.js';
import { el, icons, openSheet, toast, ringSVG, confirmModal, fmtDateShort, haptic } from '../utils/ui.js';

let selectedDate = todayISO();
let currentRerender = null;

// Objectifs macros effectifs selon le mode (grammes par défaut / pourcentages)
export function macroGoals() {
  const s = store.userData.settings;
  if (s.macroMode === 'pct') {
    const kcal = s.calorieGoal;
    const protG = Math.round((kcal * (s.protPct / 100)) / 4);
    const carbsG = Math.round((kcal * (s.carbsPct / 100)) / 4);
    const fatG = Math.round((kcal * (s.fatPct / 100)) / 9);
    return { protG, carbsG, fatG, kcalGoal: kcal };
  }
  const protG = s.proteinGoal;
  const carbsG = s.carbsGoalG;
  const fatG = s.fatGoalG;
  return { protG, carbsG, fatG, kcalGoal: calcKcal(protG, carbsG, fatG) };
}

function openMacroGoalsSheet(rerender) {
  const s = store.userData.settings;
  let mode = s.macroMode || 'grams';

  const form = el(`<div>
    <div class="segment" style="margin-bottom:14px" id="mg-mode">
      <button data-v="grams" class="${mode === 'grams' ? 'active' : ''}">Grammes</button>
      <button data-v="pct" class="${mode === 'pct' ? 'active' : ''}">Pourcentages</button>
    </div>
    <div id="mg-body"></div>
    <button class="btn btn-primary btn-block" id="mg-save" style="margin-top:6px">Enregistrer</button>
  </div>`);
  const sheet = openSheet({ title: 'Objectifs macros', content: form });
  const body = form.querySelector('#mg-body');

  const renderBody = () => {
    if (mode === 'grams') {
      body.innerHTML = `
        <div class="field-row">
          <label class="field"><span>Protéines (g)</span><input id="mg-p" type="number" inputmode="numeric" value="${s.proteinGoal}"></label>
          <label class="field"><span>Glucides (g)</span><input id="mg-c" type="number" inputmode="numeric" value="${s.carbsGoalG}"></label>
          <label class="field"><span>Lipides (g)</span><input id="mg-f" type="number" inputmode="numeric" value="${s.fatGoalG}"></label>
        </div>
        <div class="card-row"><span class="muted">Calories cibles (auto)</span><span class="num" id="mg-kcal" style="color:var(--accent);font-size:1.1rem"></span></div>`;
      const upd = () => {
        const p = +body.querySelector('#mg-p').value || 0;
        const c = +body.querySelector('#mg-c').value || 0;
        const f = +body.querySelector('#mg-f').value || 0;
        body.querySelector('#mg-kcal').textContent = `${calcKcal(p, c, f)} kcal`;
      };
      body.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd));
      upd();
    } else {
      body.innerHTML = `
        <div class="muted" style="margin-bottom:10px">Répartition de ${s.calorieGoal} kcal (réglable dans Réglages)</div>
        ${[['Protéines', 'p', s.protPct], ['Glucides', 'c', s.carbsPct], ['Lipides', 'f', s.fatPct]].map(([lbl, k, v]) => `
          <div style="margin-bottom:10px">
            <div class="card-row"><span style="font-size:0.85rem">${lbl}</span><span class="num" id="mgp-${k}-val" style="color:var(--accent)">${v}%</span></div>
            <input id="mgp-${k}" type="range" min="5" max="70" value="${v}">
          </div>`).join('')}
        <div class="card-row"><span class="muted">Total</span><span class="num" id="mgp-total"></span></div>`;
      const upd = () => {
        const p = +body.querySelector('#mgp-p').value;
        const c = +body.querySelector('#mgp-c').value;
        const f = +body.querySelector('#mgp-f').value;
        body.querySelector('#mgp-p-val').textContent = p + '%';
        body.querySelector('#mgp-c-val').textContent = c + '%';
        body.querySelector('#mgp-f-val').textContent = f + '%';
        const tot = body.querySelector('#mgp-total');
        tot.textContent = (p + c + f) + '%';
        tot.style.color = (p + c + f) === 100 ? 'var(--success)' : 'var(--warning)';
      };
      body.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd));
      upd();
    }
  };
  renderBody();

  form.querySelector('#mg-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    mode = b.dataset.v;
    form.querySelectorAll('#mg-mode button').forEach((x) => x.classList.toggle('active', x === b));
    renderBody();
  });

  form.querySelector('#mg-save').addEventListener('click', () => {
    if (mode === 'grams') {
      store.saveUserData({ settings: {
        macroMode: 'grams',
        proteinGoal: +body.querySelector('#mg-p').value || s.proteinGoal,
        carbsGoalG: +body.querySelector('#mg-c').value || s.carbsGoalG,
        fatGoalG: +body.querySelector('#mg-f').value || s.fatGoalG,
      } });
    } else {
      store.saveUserData({ settings: {
        macroMode: 'pct',
        protPct: +body.querySelector('#mgp-p').value,
        carbsPct: +body.querySelector('#mgp-c').value,
        fatPct: +body.querySelector('#mgp-f').value,
      } });
    }
    sheet.close();
    toast('Objectifs enregistrés', 'success');
    rerender();
  });
}

function openAddMealSheet(rerender) {
  const form = el(`<div>
    <label class="field"><span>Nom</span><input id="m-name" type="text" placeholder="Poulet riz brocoli" autocomplete="off"></label>
    <div class="field-row">
      <label class="field"><span>Prot (g)</span><input id="m-prot" type="number" inputmode="decimal" min="0" placeholder="0"></label>
      <label class="field"><span>Gluc (g)</span><input id="m-carbs" type="number" inputmode="decimal" min="0" placeholder="0"></label>
      <label class="field"><span>Lip (g)</span><input id="m-fat" type="number" inputmode="decimal" min="0" placeholder="0"></label>
    </div>
    <div class="card-row" style="margin-bottom:14px">
      <span class="muted">Calories (auto)</span>
      <span class="num" id="m-kcal" style="color:var(--accent);font-size:1.15rem">0 kcal</span>
    </div>
    <button class="btn btn-primary btn-block" id="m-add">${icons.plus} Ajouter</button>
  </div>`);

  const sheet = openSheet({ title: `Repas — ${fmtDateShort(selectedDate)}`, content: form });

  const upd = () => {
    const p = parseFloat(form.querySelector('#m-prot').value) || 0;
    const c = parseFloat(form.querySelector('#m-carbs').value) || 0;
    const f = parseFloat(form.querySelector('#m-fat').value) || 0;
    form.querySelector('#m-kcal').textContent = `${calcKcal(p, c, f)} kcal`;
  };
  ['#m-prot', '#m-carbs', '#m-fat'].forEach((s) => form.querySelector(s).addEventListener('input', upd));

  form.querySelector('#m-add').addEventListener('click', () => {
    const name = form.querySelector('#m-name').value.trim();
    const prot = parseFloat(form.querySelector('#m-prot').value) || 0;
    const carbs = parseFloat(form.querySelector('#m-carbs').value) || 0;
    const fat = parseFloat(form.querySelector('#m-fat').value) || 0;
    if (!name) { toast('Nom requis', 'error'); return; }
    if (prot + carbs + fat === 0) { toast('Au moins un macro', 'error'); return; }
    store.addNutritionLog(selectedDate, { name, prot, carbs, fat, kcal: calcKcal(prot, carbs, fat) });
    haptic();
    sheet.close();
    rerender();
  });
}

// FAB global dans body (hors du conteneur transformé, sinon invisible sur iOS)
function ensureFab() {
  let fab = document.getElementById('fab-nutrition');
  if (!fab) {
    fab = el(`<button class="fab" id="fab-nutrition" aria-label="Ajouter un repas">${icons.plus}</button>`);
    document.body.appendChild(fab);
  }
  fab.onclick = () => openAddMealSheet(currentRerender);
}

export function render(container) {
  const rerender = () => render(container);
  currentRerender = rerender;
  const totals = store.dayTotals(selectedDate);
  const mg = macroGoals();
  const remaining = mg.kcalGoal - totals.kcal;
  const day = store.userData.nutrition.byDate[selectedDate];
  const meals = day ? day.meals : [];

  const ribbon = [...Array(15)].map((_, i) => {
    const d = todayISO(i - 14);
    return `<button class="date-chip ${d === selectedDate ? 'active' : ''} ${d === todayISO() ? 'today' : ''}" data-date="${d}">
      ${fmtDateShort(d).split(' ')[0]}<span class="d-num">${d.slice(8)}</span>
    </button>`;
  }).join('');

  container.innerHTML = '';
  container.appendChild(el(`
    <div>
      <div class="nutrition-header">
        <div class="kcal-remaining">
          <div class="num big">${Math.round(remaining)}</div>
          <div class="sub">kcal restantes</div>
        </div>
        <div class="macro-rings">
          <div class="ring-item">
            ${ringSVG({ size: 66, stroke: 7, progress: totals.prot / mg.protG, color: '#00D9FF', label: `${Math.round(totals.prot)}` })}
            <div class="ring-caption">Prot / ${mg.protG}g</div>
          </div>
          <div class="ring-item">
            ${ringSVG({ size: 66, stroke: 7, progress: totals.carbs / mg.carbsG, color: '#7C3AED', label: `${Math.round(totals.carbs)}` })}
            <div class="ring-caption">Gluc / ${mg.carbsG}g</div>
          </div>
          <div class="ring-item">
            ${ringSVG({ size: 66, stroke: 7, progress: totals.fat / mg.fatG, color: '#10B981', label: `${Math.round(totals.fat)}` })}
            <div class="ring-caption">Lip / ${mg.fatG}g</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm btn-block" id="btn-macro-goals" style="margin-top:4px">${icons.edit} Objectifs macros</button>
      </div>

      <div class="date-ribbon no-swipe" id="date-ribbon">${ribbon}</div>

      <div class="card">
        <div class="card-row" style="margin-bottom:4px">
          <h3 style="margin:0">Repas</h3>
          <button class="btn btn-secondary btn-sm" id="btn-add-meal-2">${icons.plus} Ajouter</button>
        </div>
        <div id="meal-list">
          ${meals.length ? '' : '<div class="empty-state">Aucun repas.<br>Appuie sur + pour en ajouter.</div>'}
        </div>
      </div>
    </div>`));

  const list = container.querySelector('#meal-list');
  for (const m of meals) {
    const item = el(`<div class="meal-item">
      <div>
        <div class="meal-name">${m.name}</div>
        <div class="meal-macros">P ${m.prot} · G ${m.carbs} · L ${m.fat}</div>
      </div>
      <div style="display:flex;align-items:center;gap:2px">
        <span class="meal-kcal">${m.kcal}</span>
        <button class="icon-btn danger" aria-label="Supprimer">${icons.trash}</button>
      </div>
    </div>`);
    item.querySelector('.icon-btn').addEventListener('click', () => {
      confirmModal('Supprimer', `Supprimer « ${m.name} » ?`, () => {
        store.removeMeal(selectedDate, m.id);
        rerender();
      }, true);
    });
    list.appendChild(item);
  }

  container.querySelector('#date-ribbon').addEventListener('click', (e) => {
    const chip = e.target.closest('.date-chip');
    if (!chip) return;
    selectedDate = chip.dataset.date;
    rerender();
  });
  const active = container.querySelector('.date-chip.active');
  if (active && active.scrollIntoView) active.scrollIntoView({ inline: 'center', block: 'nearest' });

  container.querySelector('#btn-macro-goals').addEventListener('click', () => openMacroGoalsSheet(rerender));
  container.querySelector('#btn-add-meal-2').addEventListener('click', () => openAddMealSheet(rerender));
  ensureFab();
}
