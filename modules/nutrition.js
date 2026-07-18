// OmniFit — PAGE 1 : Nutrition (macros couleur, fibres, modes grammes/auto/%, repas typés, recettes)
import { store, todayISO } from '../utils/storage.js';
import { calcKcal, fiberGoalFromKcal } from '../utils/math.js';
import { el, icons, openSheet, openModal, toast, ringSVG, confirmModal, fmtDateShort, haptic } from '../utils/ui.js';

let selectedDate = todayISO();
let currentRerender = null;

// Couleurs macros : Prot orange · Glucides bleu clair · Lipides violet
const C_PROT = '#FB923C';
const C_CARB = '#38BDF8';
const C_FAT = '#8B5CF6';

const MEAL_TYPES = ['Petit-Déjeuner', 'Déjeuner', 'Dîner', 'Snack'];
function defaultMealType() {
  const h = new Date().getHours();
  if (h < 11) return 'Petit-Déjeuner';
  if (h < 15) return 'Déjeuner';
  if (h < 21) return 'Dîner';
  return 'Snack';
}

function currentWeight() {
  const w = store.userData.weights;
  return w.length ? w[w.length - 1].value : store.userData.profile.weight;
}

// Objectifs macros effectifs selon le mode (grammes par défaut / auto / pourcentages)
export function macroGoals() {
  const s = store.userData.settings;
  if (s.macroMode === 'pct') {
    const kcal = s.calorieGoal;
    return {
      protG: Math.round((kcal * (s.protPct / 100)) / 4),
      carbsG: Math.round((kcal * (s.carbsPct / 100)) / 4),
      fatG: Math.round((kcal * (s.fatPct / 100)) / 9),
      kcalGoal: kcal,
    };
  }
  if (s.macroMode === 'auto') {
    const w = currentWeight();
    const protG = Math.round((s.protMult ?? 2.2) * w);
    const fatG = Math.round((s.fatMult ?? 1.0) * w);
    const kcalGoal = s.calorieGoal;
    const carbsG = Math.max(0, Math.round((kcalGoal - (protG * 4 + fatG * 9)) / 4));
    return { protG, carbsG, fatG, kcalGoal };
  }
  const protG = s.proteinGoal;
  const carbsG = s.carbsGoalG;
  const fatG = s.fatGoalG;
  return { protG, carbsG, fatG, kcalGoal: calcKcal(protG, carbsG, fatG) };
}

// Objectif figé par jour : les jours passés gardent l'objectif qu'ils avaient
// (changer l'objectif aujourd'hui ne modifie plus l'historique).
export function macroGoalsFor(date) {
  const day = store.userData.nutrition.byDate[date];
  const live = macroGoals();
  if (date === todayISO()) {
    if (day) { day.goal = live; store.persist(); }
    return live;
  }
  if (day) {
    if (!day.goal) { day.goal = live; store.persist(); }
    return day.goal;
  }
  return live;
}

// ============================================================
// OBJECTIFS MACROS — sheet (Grammes / Auto / Pourcentages)
// ============================================================
function openMacroGoalsSheet(rerender) {
  const s = store.userData.settings;
  let mode = s.macroMode || 'grams';

  const form = el(`<div>
    <div class="segment" style="margin-bottom:14px" id="mg-mode">
      <button data-v="grams" class="${mode === 'grams' ? 'active' : ''}">Grammes</button>
      <button data-v="auto" class="${mode === 'auto' ? 'active' : ''}">Auto</button>
      <button data-v="pct" class="${mode === 'pct' ? 'active' : ''}">%</button>
    </div>
    <div id="mg-body"></div>
    <div style="margin:8px 0 4px">
      <div class="card-row"><span style="font-size:0.9rem;color:#38BDF8">Fibres / 1000 kcal</span>
        <span class="num" id="mg-fiber-val" style="color:#38BDF8">${s.fiberPer1000 ?? 10} g</span></div>
      <input id="mg-fiber-per" type="range" min="5" max="25" step="1" value="${s.fiberPer1000 ?? 10}" style="accent-color:#38BDF8">
    </div>
    <div class="macro-kcal-sticky">
      <span class="muted">Calories cibles</span>
      <span class="num" id="mg-kcal" style="color:var(--accent);font-size:1.2rem">—</span>
    </div>
    <button class="btn btn-primary btn-block" id="mg-save" style="margin-top:10px">Enregistrer</button>
  </div>`);
  const sheet = openSheet({ title: 'Objectifs macros', content: form });
  const body = form.querySelector('#mg-body');
  const kcalEl = form.querySelector('#mg-kcal');
  const fiberSlider = form.querySelector('#mg-fiber-per');
  fiberSlider.addEventListener('input', () => { form.querySelector('#mg-fiber-val').textContent = `${fiberSlider.value} g`; });
  const w = currentWeight();

  const renderBody = () => {
    if (mode === 'grams') {
      const rows = [
        ['p', 'Protéines', s.proteinGoal, C_PROT],
        ['c', 'Glucides', s.carbsGoalG, C_CARB],
        ['f', 'Lipides', s.fatGoalG, C_FAT],
      ];
      body.innerHTML = rows.map(([k, lbl, v, col]) => `
        <div style="margin-bottom:14px">
          <div class="card-row"><span style="font-size:0.9rem">${lbl}</span>
            <span class="num" id="mg-${k}-val" style="color:${col}">${v} g</span></div>
          <input id="mg-${k}" type="range" min="0" max="2000" step="5" value="${v}" style="accent-color:${col}">
        </div>`).join('');
      const upd = () => {
        const p = +body.querySelector('#mg-p').value;
        const c = +body.querySelector('#mg-c').value;
        const f = +body.querySelector('#mg-f').value;
        body.querySelector('#mg-p-val').textContent = p + ' g';
        body.querySelector('#mg-c-val').textContent = c + ' g';
        body.querySelector('#mg-f-val').textContent = f + ' g';
        kcalEl.textContent = `${calcKcal(p, c, f)} kcal`;
      };
      body.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd));
      upd();
    } else if (mode === 'auto') {
      body.innerHTML = `
        <div class="muted" style="margin-bottom:12px">Poids de corps actuel : <b>${w} kg</b> · la répartition s'ajuste avec le poids.</div>
        <label class="field" style="margin-bottom:12px"><span>Objectif calories</span>
          <input id="mg-cal" type="number" inputmode="numeric" step="10" value="${s.calorieGoal}"></label>
        <div style="margin-bottom:12px">
          <div class="card-row"><span style="font-size:0.9rem">Prot · ×poids</span>
            <span class="num" id="mg-pm-val" style="color:${C_PROT}">${(s.protMult ?? 2.2).toFixed(1)}</span></div>
          <input id="mg-pm" type="range" min="1.4" max="3.0" step="0.1" value="${s.protMult ?? 2.2}" style="accent-color:${C_PROT}">
        </div>
        <div style="margin-bottom:12px">
          <div class="card-row"><span style="font-size:0.9rem">Lip · ×poids</span>
            <span class="num" id="mg-fm-val" style="color:${C_FAT}">${(s.fatMult ?? 1.0).toFixed(1)}</span></div>
          <input id="mg-fm" type="range" min="0.5" max="1.5" step="0.1" value="${s.fatMult ?? 1.0}" style="accent-color:${C_FAT}">
        </div>
        <div class="card" style="background:var(--surface-2);margin:0;padding:10px">
          <div class="card-row"><span class="muted" style="color:${C_PROT}">Protéines</span><span class="num" id="mg-auto-p">—</span></div>
          <div class="card-row"><span class="muted" style="color:${C_CARB}">Glucides (reste)</span><span class="num" id="mg-auto-c">—</span></div>
          <div class="card-row"><span class="muted" style="color:${C_FAT}">Lipides</span><span class="num" id="mg-auto-f">—</span></div>
        </div>`;
      const upd = () => {
        const cal = +body.querySelector('#mg-cal').value || 0;
        const pm = +body.querySelector('#mg-pm').value;
        const fm = +body.querySelector('#mg-fm').value;
        body.querySelector('#mg-pm-val').textContent = pm.toFixed(1);
        body.querySelector('#mg-fm-val').textContent = fm.toFixed(1);
        const protG = Math.round(pm * w);
        const fatG = Math.round(fm * w);
        const carbsG = Math.max(0, Math.round((cal - (protG * 4 + fatG * 9)) / 4));
        body.querySelector('#mg-auto-p').textContent = `${protG} g`;
        body.querySelector('#mg-auto-c').textContent = `${carbsG} g`;
        body.querySelector('#mg-auto-f').textContent = `${fatG} g`;
        kcalEl.textContent = `${cal} kcal`;
      };
      body.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd));
      upd();
    } else {
      body.innerHTML = `
        <div class="muted" style="margin-bottom:10px">Répartition de l'objectif ${s.calorieGoal} kcal</div>
        ${[['Protéines', 'p', s.protPct, C_PROT], ['Glucides', 'c', s.carbsPct, C_CARB], ['Lipides', 'f', s.fatPct, C_FAT]].map(([lbl, k, v, col]) => `
          <div style="margin-bottom:10px">
            <div class="card-row"><span style="font-size:0.85rem">${lbl}</span><span class="num" id="mgp-${k}-val" style="color:${col}">${v}%</span></div>
            <input id="mgp-${k}" type="range" min="5" max="70" value="${v}" style="accent-color:${col}">
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
        kcalEl.textContent = `${s.calorieGoal} kcal`;
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
        proteinGoal: +body.querySelector('#mg-p').value,
        carbsGoalG: +body.querySelector('#mg-c').value,
        fatGoalG: +body.querySelector('#mg-f').value,
      } });
    } else if (mode === 'auto') {
      store.saveUserData({ settings: {
        macroMode: 'auto',
        calorieAuto: false,
        calorieGoal: +body.querySelector('#mg-cal').value || s.calorieGoal,
        protMult: +body.querySelector('#mg-pm').value,
        fatMult: +body.querySelector('#mg-fm').value,
      } });
    } else {
      store.saveUserData({ settings: {
        macroMode: 'pct',
        protPct: +body.querySelector('#mgp-p').value,
        carbsPct: +body.querySelector('#mgp-c').value,
        fatPct: +body.querySelector('#mgp-f').value,
      } });
    }
    store.saveUserData({ settings: { fiberPer1000: +fiberSlider.value } });
    sheet.close();
    toast('Objectifs enregistrés', 'success');
    rerender();
  });
}

// ============================================================
// AJOUT DE REPAS — sheet (catégorie, fibres, recettes)
// ============================================================
function openAddMealSheet(rerender, prefill = null) {
  const pf = prefill || {};
  let cat = pf.meal || defaultMealType();
  const recipes = store.userData.recipes || [];

  const form = el(`<div>
    <div class="segment segment-wrap" id="m-cat" style="margin-bottom:12px">
      ${MEAL_TYPES.map((t) => `<button data-v="${t}" class="${t === cat ? 'active' : ''}">${t}</button>`).join('')}
    </div>
    <label class="field"><span>Nom</span><input id="m-name" type="text" placeholder="Poulet riz brocoli" autocomplete="off" value="${pf.name || ''}"></label>
    <div class="field-row">
      <label class="field"><span>Prot (g)</span><input id="m-prot" type="number" inputmode="decimal" min="0" placeholder="0" value="${pf.prot ?? ''}"></label>
      <label class="field"><span>Gluc (g)</span><input id="m-carbs" type="number" inputmode="decimal" min="0" placeholder="0" value="${pf.carbs ?? ''}"></label>
      <label class="field"><span>Lip (g)</span><input id="m-fat" type="number" inputmode="decimal" min="0" placeholder="0" value="${pf.fat ?? ''}"></label>
    </div>
    <label class="field" style="margin-bottom:12px"><span>Fibres (g) · optionnel</span><input id="m-fiber" type="number" inputmode="decimal" min="0" placeholder="0" value="${pf.fiber ?? ''}"></label>
    <div class="card-row" style="margin-bottom:12px">
      <span class="muted">Calories (auto)</span>
      <span class="num" id="m-kcal" style="color:var(--accent);font-size:1.15rem">0 kcal</span>
    </div>
    ${recipes.length ? `<div class="muted" style="margin-bottom:6px">Recettes rapides</div>
      <div class="recipe-chips" id="m-recipes">${recipes.map((r) => `<button class="recipe-chip" data-id="${r.id}">${r.name}</button>`).join('')}</div>` : ''}
    <label class="check-row" style="margin:4px 0 12px"><input type="checkbox" id="m-save-recipe"> <span>Enregistrer comme recette</span></label>
    <button class="btn btn-primary btn-block" id="m-add">${pf.editId ? icons.check + ' Enregistrer' : icons.plus + ' Ajouter'}</button>
  </div>`);

  const sheet = openSheet({ title: pf.editId ? 'Modifier le repas' : `Repas — ${fmtDateShort(selectedDate)}`, content: form });

  const upd = () => {
    const p = parseFloat(form.querySelector('#m-prot').value) || 0;
    const c = parseFloat(form.querySelector('#m-carbs').value) || 0;
    const f = parseFloat(form.querySelector('#m-fat').value) || 0;
    form.querySelector('#m-kcal').textContent = `${calcKcal(p, c, f)} kcal`;
  };
  ['#m-prot', '#m-carbs', '#m-fat'].forEach((sel) => form.querySelector(sel).addEventListener('input', upd));
  upd();

  form.querySelector('#m-cat').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    cat = b.dataset.v;
    form.querySelectorAll('#m-cat button').forEach((x) => x.classList.toggle('active', x === b));
  });

  const recipesHost = form.querySelector('#m-recipes');
  if (recipesHost) {
    recipesHost.addEventListener('click', (e) => {
      const b = e.target.closest('.recipe-chip'); if (!b) return;
      const r = (store.userData.recipes || []).find((x) => x.id === b.dataset.id);
      if (!r) return;
      form.querySelector('#m-name').value = r.name;
      form.querySelector('#m-prot').value = r.prot;
      form.querySelector('#m-carbs').value = r.carbs;
      form.querySelector('#m-fat').value = r.fat;
      form.querySelector('#m-fiber').value = r.fiber || '';
      upd();
      haptic();
    });
  }

  form.querySelector('#m-add').addEventListener('click', () => {
    const name = form.querySelector('#m-name').value.trim();
    const prot = parseFloat(form.querySelector('#m-prot').value) || 0;
    const carbs = parseFloat(form.querySelector('#m-carbs').value) || 0;
    const fat = parseFloat(form.querySelector('#m-fat').value) || 0;
    const fiber = parseFloat(form.querySelector('#m-fiber').value) || 0;
    if (!name) { toast('Nom requis', 'error'); return; }
    if (prot + carbs + fat === 0) { toast('Au moins un macro', 'error'); return; }
    const payload = { name, meal: cat, prot, carbs, fat, fiber, kcal: calcKcal(prot, carbs, fat) };
    if (pf.editId) {
      store.updateMeal(selectedDate, pf.editId, payload);
      toast('Repas modifié', 'success');
    } else {
      store.addNutritionLog(selectedDate, payload);
    }
    if (form.querySelector('#m-save-recipe').checked) {
      store.saveRecipe({ id: crypto.randomUUID(), name, prot, carbs, fat, fiber });
      toast('Recette enregistrée', 'success');
    }
    haptic();
    sheet.close();
    rerender();
  });
}

// ============================================================
// RECETTES — sheet de gestion
// ============================================================
function openRecipesSheet(rerender) {
  const build = () => {
    const recipes = store.userData.recipes || [];
    const form = el(`<div>
      <button class="btn btn-primary btn-block" id="r-new" style="margin-bottom:14px">${icons.plus} Créer une recette</button>
      <div id="r-list">${recipes.length ? '' : '<div class="empty-state">Aucune recette.<br>Créez-en une pour un ajout rapide.</div>'}</div>
    </div>`);
    const sheet = openSheet({ title: 'Mes recettes', content: form });
    const list = form.querySelector('#r-list');
    for (const r of recipes) {
      const item = el(`<div class="recipe-item">
        <div class="recipe-info">
          <div class="recipe-name">${r.name}</div>
          <div class="meal-macros">P ${r.prot} · G ${r.carbs} · L ${r.fat}${r.fiber ? ` · <span class="fiber-tag">${r.fiber}g fibres</span>` : ''} · ${calcKcal(r.prot, r.carbs, r.fat)} kcal</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-secondary btn-sm" data-add>${icons.plus}</button>
          <button class="icon-btn danger" data-del aria-label="Supprimer">${icons.trash}</button>
        </div>
      </div>`);
      item.querySelector('[data-add]').addEventListener('click', () => {
        sheet.close();
        openAddMealSheet(rerender, { name: r.name, prot: r.prot, carbs: r.carbs, fat: r.fat, fiber: r.fiber });
      });
      item.querySelector('[data-del]').addEventListener('click', () => {
        confirmModal('Supprimer', `Supprimer la recette « ${r.name} » ?`, () => {
          store.deleteRecipe(r.id);
          sheet.close();
          build();
        }, true);
      });
      list.appendChild(item);
    }
    form.querySelector('#r-new').addEventListener('click', () => {
      sheet.close();
      openRecipeEditor(() => build());
    });
  };
  build();
}

function openRecipeEditor(onSaved) {
  const form = el(`<div>
    <label class="field"><span>Nom de la recette</span><input id="re-name" type="text" placeholder="Bowl protéiné" autocomplete="off"></label>
    <div class="field-row">
      <label class="field"><span>Prot (g)</span><input id="re-prot" type="number" inputmode="decimal" min="0" placeholder="0"></label>
      <label class="field"><span>Gluc (g)</span><input id="re-carbs" type="number" inputmode="decimal" min="0" placeholder="0"></label>
      <label class="field"><span>Lip (g)</span><input id="re-fat" type="number" inputmode="decimal" min="0" placeholder="0"></label>
    </div>
    <label class="field"><span>Fibres (g) · optionnel</span><input id="re-fiber" type="number" inputmode="decimal" min="0" placeholder="0"></label>
    <div class="card-row" style="margin:10px 0"><span class="muted">Calories</span><span class="num" id="re-kcal" style="color:var(--accent)">0 kcal</span></div>
  </div>`);
  const upd = () => {
    const p = parseFloat(form.querySelector('#re-prot').value) || 0;
    const c = parseFloat(form.querySelector('#re-carbs').value) || 0;
    const f = parseFloat(form.querySelector('#re-fat').value) || 0;
    form.querySelector('#re-kcal').textContent = `${calcKcal(p, c, f)} kcal`;
  };
  ['#re-prot', '#re-carbs', '#re-fat'].forEach((sel) => form.querySelector(sel).addEventListener('input', upd));
  openModal({
    title: 'Nouvelle recette',
    content: form,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Enregistrer', variant: 'btn-primary',
        onClick: (b) => {
          const name = b.querySelector('#re-name').value.trim();
          const prot = parseFloat(b.querySelector('#re-prot').value) || 0;
          const carbs = parseFloat(b.querySelector('#re-carbs').value) || 0;
          const fat = parseFloat(b.querySelector('#re-fat').value) || 0;
          const fiber = parseFloat(b.querySelector('#re-fiber').value) || 0;
          if (!name) { toast('Nom requis', 'error'); return 'keep'; }
          if (prot + carbs + fat === 0) { toast('Au moins un macro', 'error'); return 'keep'; }
          store.saveRecipe({ id: crypto.randomUUID(), name, prot, carbs, fat, fiber });
          toast('Recette enregistrée', 'success');
          if (onSaved) onSaved();
        },
      },
    ],
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
  const mg = macroGoalsFor(selectedDate);
  const consumed = Math.round(totals.kcal);
  const remaining = mg.kcalGoal - totals.kcal;
  const fiberGoal = fiberGoalFromKcal(mg.kcalGoal, store.userData.settings.fiberPer1000 ?? 10);
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
        <div class="kcal-total">
          <span class="num kcal-consumed">${consumed}</span>
          <span class="kcal-sep">/ ${mg.kcalGoal} kcal</span>
        </div>
        <div class="kcal-sub">
          <span>${remaining >= 0 ? `${Math.round(remaining)} kcal restantes` : `${Math.abs(Math.round(remaining))} kcal au-dessus`}</span>
          <span class="fiber-line">Fibres ${Math.round(totals.fiber)} / ${fiberGoal} g</span>
        </div>
        <div class="macro-rings">
          <div class="ring-item">
            ${ringSVG({ size: 66, stroke: 7, progress: totals.prot / mg.protG, color: C_PROT, label: `${Math.round(totals.prot)}` })}
            <div class="ring-caption">Prot / ${mg.protG}g</div>
          </div>
          <div class="ring-item">
            ${ringSVG({ size: 66, stroke: 7, progress: totals.carbs / mg.carbsG, color: C_CARB, label: `${Math.round(totals.carbs)}` })}
            <div class="ring-caption">Gluc / ${mg.carbsG}g</div>
          </div>
          <div class="ring-item">
            ${ringSVG({ size: 66, stroke: 7, progress: totals.fat / mg.fatG, color: C_FAT, label: `${Math.round(totals.fat)}` })}
            <div class="ring-caption">Lip / ${mg.fatG}g</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm btn-block" id="btn-macro-goals" style="margin-top:4px">${icons.edit} Objectifs macros</button>
      </div>

      <div class="date-ribbon no-swipe" id="date-ribbon">${ribbon}</div>

      <div class="card">
        <div class="card-row" style="margin-bottom:4px">
          <h3 style="margin:0">Repas</h3>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" id="btn-recipes" aria-label="Recettes">${icons.book}</button>
          </div>
        </div>
        <div id="meal-list">
          ${meals.length ? '' : '<div class="empty-state">Aucun repas.<br>Appuie sur + pour en ajouter.</div>'}
        </div>
      </div>
    </div>`));

  const list = container.querySelector('#meal-list');
  // Regroupement par type de repas
  const byCat = {};
  for (const m of meals) {
    const c = MEAL_TYPES.includes(m.meal) ? m.meal : 'Snack';
    (byCat[c] = byCat[c] || []).push(m);
  }
  for (const cat of MEAL_TYPES) {
    const group = byCat[cat];
    if (!group || !group.length) continue;
    const catKcal = group.reduce((a, m) => a + m.kcal, 0);
    list.appendChild(el(`<div class="meal-cat-head"><span>${cat}</span><span class="num">${Math.round(catKcal)} kcal</span></div>`));
    for (const m of group) {
      const item = el(`<div class="meal-item">
        <div>
          <div class="meal-name">${m.name}</div>
          <div class="meal-macros">P ${m.prot} · G ${m.carbs} · L ${m.fat}${m.fiber ? ` · <span class="fiber-tag">${m.fiber}g fibres</span>` : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:2px">
          <span class="meal-kcal">${m.kcal}</span>
          <button class="icon-btn" data-edit aria-label="Modifier">${icons.edit}</button>
          <button class="icon-btn danger" data-del aria-label="Supprimer">${icons.trash}</button>
        </div>
      </div>`);
      item.querySelector('[data-edit]').addEventListener('click', () => {
        openAddMealSheet(rerender, { editId: m.id, name: m.name, meal: m.meal, prot: m.prot, carbs: m.carbs, fat: m.fat, fiber: m.fiber });
      });
      item.querySelector('[data-del]').addEventListener('click', () => {
        confirmModal('Supprimer', `Supprimer « ${m.name} » ?`, () => {
          store.removeMeal(selectedDate, m.id);
          rerender();
        }, true);
      });
      list.appendChild(item);
    }
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
  container.querySelector('#btn-recipes').addEventListener('click', () => openRecipesSheet(rerender));
  ensureFab();
}
