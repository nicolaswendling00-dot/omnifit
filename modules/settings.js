// OmniFit — PAGE 4 : Réglages (macros déplacées dans Nutrition)
import { store } from '../utils/storage.js';
import { harrisBenedict } from '../utils/math.js';
import { EQUIPMENT_TYPES, EXERCISES } from '../data/exercises.js';
import { el, icons, openModal, toast, confirmModal } from '../utils/ui.js';
import { RANK_ORDER, RANK_META, DIV_LP, ONYX_LP, rankBadge, rankFromLP, estimateRankFromLift, getStandards } from '../utils/ranks.js';

const VERSION = '3.14';

function toggleRow(label, key, sub = '') {
  const s = store.userData.settings;
  const row = el(`<div class="settings-row">
    <div><div class="row-label">${label}</div>${sub ? `<div class="row-sub">${sub}</div>` : ''}</div>
    <label class="switch"><input type="checkbox" ${s[key] ? 'checked' : ''}><span class="slider"></span></label>
  </div>`);
  row.querySelector('input').addEventListener('change', (e) => {
    store.saveUserData({ settings: { [key]: e.target.checked } });
  });
  return row;
}

function applyCalorieAuto() {
  const u = store.userData;
  if (u.settings.calorieAuto) {
    store.saveUserData({ settings: { calorieGoal: harrisBenedict(u.profile, u.goal.type) } });
  }
}

function openProfileModal(rerender) {
  const p = store.userData.profile;
  const form = el(`<div class="field-stack">
    <label class="field"><span>Nom</span><input id="p-name" type="text" value="${p.name}"></label>
    <label class="field"><span>Âge</span><input id="p-age" type="number" inputmode="numeric" min="10" max="100" value="${p.age}"></label>
    <label class="field"><span>Sexe</span>
      <select id="p-sex">${['M', 'F', 'Autre'].map((x) => `<option ${x === p.sex ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <label class="field"><span>Poids initial (kg)</span><input id="p-weight" type="number" inputmode="decimal" step="0.1" value="${p.weight}"></label>
    <label class="field"><span>Taille (cm)</span><input id="p-height" type="number" inputmode="numeric" value="${p.height}"></label>
  </div>`);
  openModal({
    title: 'Profil',
    content: form,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Enregistrer', variant: 'btn-primary',
        onClick: (body) => {
          store.saveUserData({ profile: {
            name: body.querySelector('#p-name').value.trim(),
            age: parseInt(body.querySelector('#p-age').value, 10) || p.age,
            sex: body.querySelector('#p-sex').value,
            weight: parseFloat(body.querySelector('#p-weight').value) || p.weight,
            height: parseInt(body.querySelector('#p-height').value, 10) || p.height,
          } });
          applyCalorieAuto();
          rerender();
        },
      },
    ],
  });
}

export function render(container) {
  const rerender = () => render(container);
  const u = store.userData;
  const s = u.settings;
  const sizeKB = (store.getStorageSize() / 1024).toFixed(1);

  container.innerHTML = '';
  const root = el(`<div>
    <div class="page-title"><h1>Réglages</h1></div>

    <!-- 1. PROFIL -->
    <div class="card settings-section">
      <div class="card-row">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="avatar">${icons.user}</div>
          <div>
            <h3 style="margin:0">${u.profile.name || 'Profil'}</h3>
            <div class="muted">${u.profile.age} ans · ${u.profile.weight} kg · ${u.profile.height} cm</div>
          </div>
        </div>
        <button class="icon-btn" id="btn-edit-profile" aria-label="Modifier">${icons.edit}</button>
      </div>
    </div>

    <!-- 3. ENTRAÎNEMENT -->
    <div class="card settings-section">
      <h3>Entraînement</h3>
      <div class="settings-row" style="flex-direction:column;align-items:stretch">
        <div class="card-row"><span class="row-label">Repos par défaut</span><span class="num" id="rest-val" style="color:var(--accent)">${s.restTimerDefault}s</span></div>
        <input id="set-rest" type="range" min="60" max="300" step="15" value="${s.restTimerDefault}">
      </div>
      <div id="row-vol-tracking"></div>
      <div id="row-db-full"></div>
      <div class="settings-row" style="flex-direction:column;align-items:stretch">
        <div class="row-label" style="margin-bottom:6px">Filtre équipement <span class="muted">(aucun = tout)</span></div>
        <div id="equip-filter" style="display:flex;flex-wrap:wrap;gap:6px"></div>
      </div>
      <button class="btn btn-secondary btn-block" id="btn-rank-ladder" style="margin-top:10px">${icons.book} Classement des rangs & calculateur</button>
    </div>

    <!-- 4. NUTRITION -->
    <div class="card settings-section">
      <h3>Nutrition</h3>
      <div class="settings-row" style="flex-direction:column;align-items:stretch">
        <div class="card-row"><span class="row-label">Objectif eau</span><span class="num" id="water-val" style="color:var(--accent)">${s.waterGoal}L</span></div>
        <input id="set-water" type="range" min="2" max="5" step="0.25" value="${s.waterGoal}">
      </div>
    </div>

    <!-- 5. INTERFACE -->
    <div class="card settings-section">
      <h3>Interface</h3>
      <div class="settings-row">
        <span class="row-label">Thème</span>
        <div class="segment" style="max-width:200px" id="seg-theme">
          <button data-v="dark" class="${s.theme === 'dark' ? 'active' : ''}">Sombre</button>
          <button data-v="amoled" class="${s.theme === 'amoled' ? 'active' : ''}">AMOLED</button>
        </div>
      </div>
      <div class="settings-row">
        <span class="row-label">Densité</span>
        <div class="segment" style="max-width:230px" id="seg-density">
          <button data-v="compact" class="${s.density === 'compact' ? 'active' : ''}">Compact</button>
          <button data-v="normal" class="${s.density === 'normal' ? 'active' : ''}">Normal</button>
          <button data-v="spacious" class="${s.density === 'spacious' ? 'active' : ''}">Spacieux</button>
        </div>
      </div>
      <div id="rows-interface"></div>
    </div>

    <!-- 6. DONNÉES -->
    <div class="card settings-section">
      <h3>Données</h3>
      <div class="settings-row"><span class="row-label">Taille</span><span class="num" style="color:var(--accent)">${sizeKB} Ko</span></div>
      <div class="settings-row">
        <span class="row-label">Export JSON</span>
        <button class="btn btn-secondary btn-sm" id="btn-export">${icons.download}</button>
      </div>
      <div class="settings-row">
        <span class="row-label">Import JSON</span>
        <button class="btn btn-secondary btn-sm" id="btn-import">${icons.upload}</button>
        <input type="file" id="import-file" accept="application/json" style="display:none">
      </div>
      <div class="settings-row">
        <div><div class="row-label">Effacer l'historique</div><div class="row-sub">Garde les réglages</div></div>
        <button class="btn btn-secondary btn-sm" id="btn-clear-history">Effacer</button>
      </div>
      <div class="settings-row">
        <div><div class="row-label" style="color:var(--danger)">Reset complet</div></div>
        <button class="btn btn-danger btn-sm" id="btn-reset">Reset</button>
      </div>
    </div>

    <!-- 7. À PROPOS -->
    <div class="card settings-section">
      <div class="settings-row"><span class="row-label">OmniFit</span><span class="num">v${VERSION}</span></div>
      <div class="settings-row"><span class="row-label">Données</span><span class="muted">100% locales</span></div>
    </div>
  </div>`);
  container.appendChild(root);

  root.querySelector('#row-vol-tracking').replaceWith(toggleRow('Volume tracking', 'volumeTrackingEnabled'));
  root.querySelector('#row-db-full').replaceWith(toggleRow('Base complète', 'exerciseDbFull', 'Décoché : débutant uniquement'));
  const rowsInt = root.querySelector('#rows-interface');
  rowsInt.appendChild(toggleRow('Haptique', 'hapticEnabled'));
  rowsInt.appendChild(toggleRow('Notifications', 'notificationsEnabled'));

  const eqHost = root.querySelector('#equip-filter');
  for (const eq of EQUIPMENT_TYPES) {
    const active = s.equipmentFilter.includes(eq);
    const chip = el(`<button class="badge ${active ? '' : 'violet'}" style="cursor:pointer;min-height:32px;${active ? 'background:rgba(0,217,255,0.2)' : 'opacity:0.6'}">${eq}</button>`);
    chip.addEventListener('click', () => {
      const cur = new Set(store.userData.settings.equipmentFilter);
      if (cur.has(eq)) cur.delete(eq); else cur.add(eq);
      store.userData.settings.equipmentFilter = [...cur];
      store.persist();
      rerender();
    });
    eqHost.appendChild(chip);
  }

  root.querySelector('#btn-edit-profile').addEventListener('click', () => openProfileModal(rerender));
  root.querySelector('#btn-rank-ladder').addEventListener('click', () => openRankLadderModal());

  const bindRange = (id, valId, key, fmt = (v) => v, parse = parseFloat) => {
    const inp = root.querySelector(id);
    inp.addEventListener('input', () => { root.querySelector(valId).textContent = fmt(inp.value); });
    inp.addEventListener('change', () => { store.saveUserData({ settings: { [key]: parse(inp.value) } }); });
  };
  bindRange('#set-rest', '#rest-val', 'restTimerDefault', (v) => `${v}s`, (v) => parseInt(v, 10));
  bindRange('#set-water', '#water-val', 'waterGoal', (v) => `${v}L`);

  root.querySelector('#seg-theme').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    store.saveUserData({ settings: { theme: b.dataset.v } });
    applyTheme();
    rerender();
  });
  root.querySelector('#seg-density').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    store.saveUserData({ settings: { density: b.dataset.v } });
    applyTheme();
    rerender();
  });

  root.querySelector('#btn-export').addEventListener('click', () => openExportModal());

  const fileInput = root.querySelector('#import-file');
  root.querySelector('#btn-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        openModal({
          title: 'Importer',
          content: '<p class="confirm-text">Fusionner avec les données existantes, ou tout écraser ?</p>',
          actions: [
            { label: 'Fusionner', variant: 'btn-secondary', onClick: () => { store.importJSON(data, 'merge'); rerender(); } },
            { label: 'Écraser', variant: 'btn-danger', onClick: () => { store.importJSON(data, 'overwrite'); applyTheme(); rerender(); } },
          ],
        });
      } catch (e) {
        toast('JSON invalide', 'error');
      }
      fileInput.value = '';
    };
    reader.readAsText(f);
  });

  root.querySelector('#btn-clear-history').addEventListener('click', () => {
    confirmModal('Effacer l\'historique', 'Poids, nutrition, pas et séances seront supprimés.', () => {
      store.clearHistory();
      rerender();
    }, true);
  });
  root.querySelector('#btn-reset').addEventListener('click', () => {
    confirmModal('Reset complet', 'Toutes les données seront perdues.', () => {
      confirmModal('Dernière confirmation', 'Vraiment tout supprimer ?', () => {
        store.resetAll();
        applyTheme();
        rerender();
      }, true);
    }, true);
  });
}

export function applyTheme() {
  const s = store.userData.settings;
  document.body.classList.toggle('theme-amoled', s.theme === 'amoled');
  document.body.classList.remove('density-compact', 'density-spacious');
  if (s.density === 'compact') document.body.classList.add('density-compact');
  if (s.density === 'spacious') document.body.classList.add('density-spacious');
}

function openExportModal() {
  const cats = [
    { key: 'weights', label: 'Poids' },
    { key: 'steps', label: 'Pas' },
    { key: 'nutrition', label: 'Nutrition' },
    { key: 'workouts', label: 'Entraînements' },
  ];
  const content = el(`<div>
    <div class="muted" style="font-size:0.78rem;margin-bottom:10px">Choisis les données à inclure dans l'export. Réglages, profil, routines et recettes sont toujours inclus.</div>
    <div class="field-stack">
      ${cats.map((c) => `<label class="settings-row" style="cursor:pointer">
        <span class="row-label">${c.label}</span>
        <input type="checkbox" class="exp-check" data-cat="${c.key}" checked style="width:20px;height:20px">
      </label>`).join('')}
    </div>
  </div>`);
  openModal({
    title: 'Export JSON',
    content,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Exporter', variant: 'btn-primary',
        onClick: (body) => {
          const opts = {};
          body.querySelectorAll('.exp-check').forEach((cb) => { opts[cb.dataset.cat] = cb.checked; });
          if (!Object.values(opts).some(Boolean)) { toast('Coche au moins une catégorie', 'error'); return 'keep'; }
          store.exportJSONSelective(opts);
          toast('Export téléchargé', 'success');
        },
      },
    ],
  });
}

function openRankLadderModal() {
  const nameOverrides = store.userData.settings.exerciseNames || {};
  const allExos = [...EXERCISES, ...(store.userData.settings.customExercises || [])]
    .map((e) => ({ id: e.id, name: nameOverrides[e.id] || e.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const ladderRows = RANK_ORDER.map((id, i) => {
    const meta = RANK_META[id];
    const lo = i * DIV_LP * 3;
    const range = id === 'onyx' ? `${ONYX_LP}+ LP` : `${lo} – ${lo + DIV_LP * 3 - 1} LP`;
    return `<div class="ladder-row">
      ${rankBadge(id, 52)}
      <div><div class="ladder-name" style="color:${meta.color}">${meta.name}</div><div class="muted" style="font-size:0.72rem">${range}${id !== 'onyx' ? ' · 3 divisions (III → I)' : ' · rang unique'}</div></div>
    </div>`;
  }).join('');

  const content = el(`<div>
    <h3 style="margin:0 0 8px">Échelle des rangs</h3>
    <div class="ladder-list">${ladderRows}</div>

    <h3 style="margin:18px 0 8px">Calculateur de rang</h3>
    <div class="muted" style="font-size:0.75rem;margin-bottom:10px">
      Estime le rang qu'un exercice te donnerait avec le poids de corps actuel de ton profil.
      Basé uniquement sur le poids de corps (l'âge n'entre pas dans le calcul).
    </div>
    <div class="field-stack">
      <label class="field"><span>Exercice</span>
        <select id="calc-exo">${allExos.map((e) => `<option value="${e.id}">${e.name}</option>`).join('')}</select>
      </label>
      <div class="grid-2">
        <label class="field"><span>Poids (kg)</span><input id="calc-weight" type="number" step="0.5" min="0" placeholder="80"></label>
        <label class="field"><span>Répétitions</span><input id="calc-reps" type="number" step="1" min="1" placeholder="8"></label>
      </div>
    </div>
    <button class="btn btn-primary btn-block" id="calc-run" style="margin-top:6px">Calculer</button>
    <div id="calc-result" style="margin-top:12px"></div>
  </div>`);

  openModal({ title: 'Rangs & calculateur', content, wide: true, actions: [{ label: 'Fermer', variant: 'btn-primary' }] });

  content.querySelector('#calc-run').addEventListener('click', () => {
    const exoId = content.querySelector('#calc-exo').value;
    const weight = parseFloat(content.querySelector('#calc-weight').value);
    const reps = parseInt(content.querySelector('#calc-reps').value, 10);
    const resultHost = content.querySelector('#calc-result');
    if (!weight || !reps) { resultHost.innerHTML = '<div class="empty-state">Renseigne un poids et des répétitions</div>'; return; }
    const bw = store.userData.profile.weight;
    const r = estimateRankFromLift(exoId, weight, reps, bw, getStandards());
    const tierLabel = { beginner: 'Débutant', novice: 'Novice', intermediate: 'Intermédiaire', advanced: 'Avancé', elite: 'Élite' };
    resultHost.innerHTML = `
      <div class="calc-result-card">
        <div class="calc-result-row"><span>1RM estimé</span><span class="num" style="color:var(--accent)">${r.orm} kg</span></div>
        <div class="calc-result-row"><span>Niveau StrengthLevel</span><span>${r.hasStandard ? (r.levelTier ? tierLabel[r.levelTier] : 'En dessous de Débutant') : 'Non disponible pour cet exo'}</span></div>
        <div class="calc-result-row">
          <span>Rang obtenu</span>
          <span style="display:flex;align-items:center;gap:8px;color:${r.rank.color};font-weight:700">${r.rank.division ? `${r.rank.name} ${r.rank.division}` : r.rank.name}</span>
        </div>
      </div>`;
  });
}
