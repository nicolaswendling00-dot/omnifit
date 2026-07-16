// OmniFit — PAGE 1 : Nutrition
import { store, todayISO } from '../utils/storage.js';
import { calcKcal } from '../utils/math.js';
import { el, icons, openSheet, toast, ringSVG, confirmModal, fmtDateShort, fmtDateLong, haptic } from '../utils/ui.js';

let selectedDate = todayISO();

function macroGoals() {
  const s = store.userData.settings;
  const protG = s.proteinGoal;
  const carbsG = Math.round((s.calorieGoal * (s.carbsPct / 100)) / 4);
  const fatG = Math.round((s.calorieGoal * (s.fatPct / 100)) / 9);
  return { protG, carbsG, fatG };
}

function openAddMealSheet(rerender) {
  const form = el(`<div>
    <label class="field"><span>Nom du repas</span>
      <input id="m-name" type="text" placeholder="Poulet riz brocoli" autocomplete="off"></label>
    <div class="field-row">
      <label class="field"><span>Protéines (g)</span><input id="m-prot" type="number" inputmode="decimal" min="0" placeholder="0"></label>
      <label class="field"><span>Glucides (g)</span><input id="m-carbs" type="number" inputmode="decimal" min="0" placeholder="0"></label>
      <label class="field"><span>Lipides (g)</span><input id="m-fat" type="number" inputmode="decimal" min="0" placeholder="0"></label>
    </div>
    <div class="field-row">
      <label class="field"><span>Fibres (g) — opt.</span><input id="m-fiber" type="number" inputmode="decimal" min="0" placeholder="0"></label>
      <label class="field"><span>Sucres (g) — opt.</span><input id="m-sugar" type="number" inputmode="decimal" min="0" placeholder="0"></label>
    </div>
    <div class="card-row" style="margin-bottom:14px">
      <span class="muted">Calories (auto)</span>
      <span class="mono" id="m-kcal" style="color:var(--accent);font-size:1.15rem">0 kcal</span>
    </div>
    <button class="btn btn-primary btn-block" id="m-add">${icons.plus} Ajouter le repas</button>
  </div>`);

  const sheet = openSheet({ title: `Ajouter un repas — ${fmtDateShort(selectedDate)}`, content: form });

  const upd = () => {
    const p = parseFloat(form.querySelector('#m-prot').value) || 0;
    const c = parseFloat(form.querySelector('#m-carbs').value) || 0;
    const f = parseFloat(form.querySelector('#m-fat').value) || 0;
    form.querySelector('#m-kcal').textContent = `${calcKcal(p, c, f)} kcal`;
  };
  ['#m-prot', '#m-carbs', '#m-fat'].forEach((sel) => form.querySelector(sel).addEventListener('input', upd));

  form.querySelector('#m-add').addEventListener('click', () => {
    const name = form.querySelector('#m-name').value.trim();
    const prot = parseFloat(form.querySelector('#m-prot').value) || 0;
    const carbs = parseFloat(form.querySelector('#m-carbs').value) || 0;
    const fat = parseFloat(form.querySelector('#m-fat').value) || 0;
    const fiber = parseFloat(form.querySelector('#m-fiber').value) || 0;
    const sugar = parseFloat(form.querySelector('#m-sugar').value) || 0;
    if (!name) { toast('Donne un nom au repas', 'error'); return; }
    if (prot + carbs + fat === 0) { toast('Renseigne au moins un macro', 'error'); return; }
    store.addNutritionLog(selectedDate, { name, prot, carbs, fat, fiber, sugar, kcal: calcKcal(prot, carbs, fat) });
    haptic();
    sheet.close();
    toast('Repas ajouté', 'success');
    rerender();
  });
}

export function render(container) {
  const rerender = () => render(container);
  const s = store.userData.settings;
  const totals = store.dayTotals(selectedDate);
  const remaining = s.calorieGoal - totals.kcal;
  const { protG, carbsG, fatG } = macroGoals();
  const day = store.userData.nutrition.byDate[selectedDate];
  const meals = day ? day.meals : [];

  const ribbon = [...Array(15)].map((_, i) => {
    const d = todayISO(i - 14);
    const isToday = d === todayISO();
    return `<button class="date-chip ${d === selectedDate ? 'active' : ''} ${isToday ? 'today' : ''}" data-date="${d}">
      ${fmtDateShort(d).split(' ')[0]}<span class="d-num">${d.slice(8)}</span>
    </button>`;
  }).join('');

  container.innerHTML = '';
  container.appendChild(el(`
    <div>
      <div class="nutrition-header">
        <div class="kcal-remaining">
          <div class="big">${Math.round(remaining)}</div>
          <div class="sub">kcal restantes · ${Math.round(totals.kcal)} / ${s.calorieGoal} consommées</div>
        </div>
        <div class="macro-rings">
          <div class="ring-item" title="${Math.round(totals.prot)}g / ${protG}g">
            ${ringSVG({ size: 70, stroke: 7, progress: totals.prot / protG, color: '#00D9FF', label: `${Math.round((totals.prot / protG) * 100)}%` })}
            <div class="ring-caption">Prot · ${Math.round(totals.prot)}/${protG}g</div>
          </div>
          <div class="ring-item" title="${Math.round(totals.carbs)}g / ${carbsG}g">
            ${ringSVG({ size: 70, stroke: 7, progress: totals.carbs / carbsG, color: '#7C3AED', label: `${Math.round((totals.carbs / carbsG) * 100)}%` })}
            <div class="ring-caption">Glu · ${Math.round(totals.carbs)}/${carbsG}g</div>
          </div>
          <div class="ring-item" title="${Math.round(totals.fat)}g / ${fatG}g">
            ${ringSVG({ size: 70, stroke: 7, progress: totals.fat / fatG, color: '#10B981', label: `${Math.round((totals.fat / fatG) * 100)}%` })}
            <div class="ring-caption">Lip · ${Math.round(totals.fat)}/${fatG}g</div>
          </div>
        </div>
      </div>

      <div class="date-ribbon" id="date-ribbon">${ribbon}</div>

      <div class="card">
        <div class="card-row" style="margin-bottom:6px">
          <h3>Repas — ${fmtDateLong(selectedDate)}</h3>
          <span class="mono" style="color:var(--accent)">${Math.round(totals.kcal)} kcal</span>
        </div>
        <div id="meal-list">
          ${meals.length ? '' : '<div class="empty-state">Aucun repas ce jour.<br>Appuie sur + pour en ajouter un.</div>'}
        </div>
      </div>

      <button class="fab" id="fab-add-meal" aria-label="Ajouter un repas">${icons.plus}</button>
    </div>`));

  const list = container.querySelector('#meal-list');
  for (const m of meals) {
    const item = el(`<div class="meal-item">
      <div>
        <div class="meal-name">${m.name}</div>
        <div class="meal-macros">P ${m.prot}g · G ${m.carbs}g · L ${m.fat}g${m.fiber ? ` · Fib ${m.fiber}g` : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px">
        <span class="meal-kcal">${m.kcal} kcal</span>
        <button class="icon-btn danger" aria-label="Supprimer ${m.name}">${icons.trash}</button>
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

  const ribbonEl = container.querySelector('#date-ribbon');
  const active = ribbonEl.querySelector('.date-chip.active');
  if (active && active.scrollIntoView) active.scrollIntoView({ inline: 'center', block: 'nearest' });

  container.querySelector('#fab-add-meal').addEventListener('click', () => openAddMealSheet(rerender));
}
