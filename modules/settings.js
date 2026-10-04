// OmniFit — PAGE 4 : Réglages (macros déplacées dans Nutrition)
import { store, parseStepsPayload } from '../utils/storage.js';
import { harrisBenedict } from '../utils/math.js';
import { EQUIPMENT_TYPES } from '../data/exercises.js';
import { el, esc, icons, openModal, toast, confirmModal } from '../utils/ui.js';
import { RANK_ORDER, RANK_META, DIV_LP, ONYX_LP, rankBadge, liftPercentile, LEVEL_PERCENTILE, getStandards } from '../utils/ranks.js';
import { openExercisePicker, customRefMap, exerciseLookup } from './workout.js';
import { backfillNutritionGoals, freezePastGoals } from './nutrition.js';

const VERSION = '6.5';

// Familles de matériel (filtre de la base d'exercices), en français.
const EQUIP_FAMILY_FR = {
  Band: 'Élastique', Barbell: 'Barre', Bodyweight: 'Poids du corps', Cable: 'Poulie',
  Dumbbells: 'Haltères', Kettlebell: 'Kettlebell', Machine: 'Machine', Other: 'Autre', Plate: 'Disque',
};

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
    // Le profil change → l'objectif auto change. On fige d'abord l'historique
    // pour qu'il garde l'objectif réellement en vigueur jusqu'à maintenant.
    freezePastGoals();
    store.saveUserData({ settings: { calorieGoal: harrisBenedict(u.profile, u.goal.type) } });
  }
}

function openProfileModal(rerender) {
  const p = store.userData.profile;
  const form = el(`<div class="field-stack">
    <label class="field"><span>Nom</span><input id="p-name" type="text" value="${esc(p.name)}"></label>
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
            <h3 style="margin:0">${u.profile.name ? esc(u.profile.name) : 'Profil'}</h3>
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
      <div class="settings-row" style="flex-direction:column;align-items:stretch">
        <div class="card-row"><span class="row-label">Séances / semaine <span class="muted">(rang global)</span></span><span class="num" id="wsg-val" style="color:var(--accent)">${s.weeklySessionGoal ?? 4}</span></div>
        <input id="set-weekly-sessions" type="range" min="1" max="7" step="1" value="${s.weeklySessionGoal ?? 4}">
      </div>
      <div id="row-db-full"></div>
      <div class="settings-row" style="flex-direction:column;align-items:stretch">
        <div class="row-label" style="margin-bottom:6px">Filtre équipement <span class="muted">(aucun = tout)</span></div>
        <div id="equip-filter" class="equip-grid"></div>
      </div>
      <button class="btn btn-secondary btn-block" id="btn-rank-ladder" style="margin-top:10px">${icons.book} Rangs & Top %</button>
    </div>

    <!-- 4. ACTIVITÉ -->
    <div class="card settings-section">
      <h3>Activité</h3>
      <div class="settings-row">
        <div><div class="row-label">Synchro des pas</div><div class="row-sub">Récupérer les pas depuis l'app Santé</div></div>
        <button class="btn btn-secondary btn-sm" id="btn-health-sync">${icons.steps}</button>
      </div>
    </div>


    <!-- 5. INTERFACE -->
    <div class="card settings-section">
      <h3>Interface</h3>
      <div class="settings-row">
        <span class="row-label">Couleur</span>
        <div class="segment" style="max-width:230px" id="seg-palette">
          <button data-v="dark" class="${(s.palette || 'dark') === 'dark' ? 'active' : ''}">Sombre</button>
          <button data-v="light" class="${s.palette === 'light' ? 'active' : ''}">Clair</button>
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

  root.querySelector('#row-db-full').replaceWith(toggleRow('Base complète', 'exerciseDbFull', 'Décoché : débutant uniquement'));
  const wsg = root.querySelector('#set-weekly-sessions');
  wsg.addEventListener('input', (e) => { root.querySelector('#wsg-val').textContent = e.target.value; });
  wsg.addEventListener('change', (e) => { store.saveUserData({ settings: { weeklySessionGoal: parseInt(e.target.value, 10) } }); });
  const rowsInt = root.querySelector('#rows-interface');
  rowsInt.appendChild(toggleRow('Notifications', 'notificationsEnabled'));

  const eqHost = root.querySelector('#equip-filter');
  for (const eq of EQUIPMENT_TYPES) {
    const active = s.equipmentFilter.includes(eq);
    const chip = el(`<button class="equip-chip${active ? ' on' : ''}">${EQUIP_FAMILY_FR[eq] || eq}</button>`);
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
  root.querySelector('#btn-health-sync').addEventListener('click', () => openHealthSyncModal());
  root.querySelector('#btn-rank-ladder').addEventListener('click', () => openRankLadderModal());

  const bindRange = (id, valId, key, fmt = (v) => v, parse = parseFloat) => {
    const inp = root.querySelector(id);
    inp.addEventListener('input', () => { root.querySelector(valId).textContent = fmt(inp.value); });
    inp.addEventListener('change', () => { store.saveUserData({ settings: { [key]: parse(inp.value) } }); });
  };
  // L'objectif d'eau se règle depuis la carte Eau de l'accueil, là où on le lit.
  bindRange('#set-rest', '#rest-val', 'restTimerDefault', (v) => `${v}s`, (v) => parseInt(v, 10));

  root.querySelector('#seg-palette').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    store.saveUserData({ settings: { palette: b.dataset.v } });
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
            { label: 'Fusionner', variant: 'btn-secondary', onClick: () => { store.importJSON(data, 'merge'); backfillNutritionGoals(); rerender(); } },
            { label: 'Écraser', variant: 'btn-danger', onClick: () => { store.importJSON(data, 'overwrite'); backfillNutritionGoals(); applyTheme(); rerender(); } },
          ],
        });
      } catch (e) {
        toast('JSON invalide', 'error');
      }
      fileInput.value = '';
    };
    reader.readAsText(f);
  });

  root.querySelector('#btn-clear-history').addEventListener('click', () => openClearHistoryModal(rerender));
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

// Une seule forme d'interface ; seule la palette (sombre / claire) se choisit.
export function applyTheme() {
  const palette = store.userData.settings.palette || 'dark'; // 'dark' | 'light'
  document.body.classList.toggle('palette-light', palette === 'light');
  // La barre de statut iOS suit la palette (elle est opaque, cf. index.html).
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', palette === 'light' ? '#F4F6FB' : '#000000');
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

function openHealthSyncModal() {
  // URL de base de l'app (sans query ni hash).
  const base = window.location.origin + window.location.pathname;

  const content = el(`<div>
    <div class="muted" style="font-size:0.82rem;line-height:1.5;margin-bottom:14px">
      iOS n'autorise pas une app web à lire l'app Santé directement. On passe par un <b>raccourci iOS</b> qui lit tes pas des <b>7 derniers jours</b> et les transmet à OmniFit. Lancé une fois, il remplit la semaine ; via une automatisation quotidienne, il garde tout à jour.
    </div>

    <div class="hs-method">
      <div class="hs-method-h">Méthode A — App installée (recommandé)</div>
      <div class="muted" style="font-size:0.8rem;line-height:1.5;margin-bottom:10px">Le raccourci <b>copie</b> les 7 jours, tu les colles ici. C'est la méthode fiable pour l'app installée sur l'écran d'accueil.</div>
      <button class="btn btn-primary btn-block" id="hs-paste">${icons.copy} Coller les pas depuis le presse-papier</button>
      <div class="hs-steps" style="margin-top:12px">
        <div class="hs-step"><span class="hs-num">1</span><div>Raccourcis → <b>+</b>. Ajoute une action <b>Texte</b> vide (variable « Lignes »).</div></div>
        <div class="hs-step"><span class="hs-num">2</span><div><b>Répéter 7 fois</b> : calcule <b>Date = aujourd'hui − (Index−1) jours</b>, formate-la en <code>aaaa-MM-jj</code>, puis <b>« Rechercher des échantillons de Santé »</b> (Pas, <b>Somme</b>, filtré sur ce jour). Ajoute à « Lignes » le texte <code>[date]:[somme]</code>.</div></div>
        <div class="hs-step"><span class="hs-num">3</span><div>Après la boucle : <b>« Combiner le texte »</b> (Lignes, avec <b>nouvelles lignes</b>) → <b>« Copier dans le presse-papiers »</b>.</div></div>
        <div class="hs-step"><span class="hs-num">4</span><div>Lance-le, ouvre OmniFit, touche le bouton ci-dessus. Automatise-le ensuite (Automatisation → Heure de la journée).</div></div>
      </div>
    </div>

    <div class="hs-method">
      <div class="hs-method-h">Méthode B — Dans Safari (automatique)</div>
      <div class="muted" style="font-size:0.8rem;line-height:1.5;margin-bottom:10px">Si tu ouvres OmniFit dans Safari. Le raccourci ouvre cette adresse avec les 7 jours en paramètre (paires séparées par <code>;</code>).</div>
      <div class="hs-url">
        <div class="hs-url-label">Adresse à composer</div>
        <code id="hs-url-code">${base}?steps=</code><span style="color:var(--text-2)">‹Lignes, avec ; ›</span>
        <button class="btn btn-secondary btn-sm" id="hs-copy" style="margin-top:8px">${icons.copy} Copier l'adresse</button>
      </div>
      <div class="muted" style="font-size:0.76rem;margin-top:8px">Même boucle qu'en A, mais combine les paires avec <code>;</code> puis <b>« Ouvrir les URL »</b> sur <code>${base}?steps=</code>+‹Lignes›.</div>
    </div>

    <div class="muted" style="font-size:0.76rem;margin-top:4px;line-height:1.5">
      Format attendu : un <code>aaaa-MM-jj:pas</code> par ligne (méthode A) ou séparés par <code>;</code> (méthode B). Un simple nombre seul compte pour aujourd'hui. Chaque envoi <b>remplace</b> le total de chaque jour concerné (cohérent avec le cumul de Santé).
    </div>
  </div>`);

  openModal({ title: 'Synchro des pas — Santé', content, actions: [{ label: 'Fermer' }] });

  // Méthode A : lecture du presse-papier → enregistrement multi-jours
  content.querySelector('#hs-paste').addEventListener('click', async () => {
    let text = '';
    try { text = await navigator.clipboard.readText(); }
    catch (_) { toast('Presse-papier inaccessible. Autorise le collage ou utilise la méthode B.', 'error'); return; }
    const entries = parseStepsPayload(text);
    if (!entries.length) { toast('Aucune donnée de pas trouvée dans le presse-papier', 'error'); return; }
    for (const { date, count } of entries) store.addStepsLog(date, count);
    const n = entries.length;
    toast(n === 1 ? `${entries[0].count.toLocaleString('fr-FR')} pas enregistrés` : `${n} jours de pas importés`, 'success');
  });

  content.querySelector('#hs-copy').addEventListener('click', async () => {
    const url = `${base}?steps=`;
    try { await navigator.clipboard.writeText(url); toast('Adresse copiée', 'success'); }
    catch (_) {
      const code = content.querySelector('#hs-url-code');
      const range = document.createRange(); range.selectNodeContents(code);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      toast('Copie manuelle : texte sélectionné', 'info');
    }
  });
}

function openClearHistoryModal(rerender) {
  const cats = [
    { key: 'workouts', label: 'Entraînement', sub: 'Séances enregistrées' },
    { key: 'nutrition', label: 'Nutrition', sub: 'Repas, eau et objectifs figés' },
    { key: 'weights', label: 'Poids', sub: 'Historique de pesée' },
    { key: 'steps', label: 'Pas', sub: 'Compteur de pas quotidien' },
  ];
  const content = el(`<div>
    <div class="muted" style="font-size:0.78rem;margin-bottom:10px">Choisis les données à effacer. Les réglages, le profil, les routines et les recettes sont conservés.</div>
    <div class="field-stack">
      ${cats.map((c) => `<label class="settings-row" style="cursor:pointer">
        <div><div class="row-label">${c.label}</div><div class="row-sub">${c.sub}</div></div>
        <input type="checkbox" class="clr-check" data-cat="${c.key}" style="width:20px;height:20px">
      </label>`).join('')}
    </div>
  </div>`);
  openModal({
    title: 'Effacer l\'historique',
    content,
    actions: [
      { label: 'Annuler' },
      {
        label: 'Effacer', variant: 'btn-danger',
        onClick: (body) => {
          const opts = {};
          body.querySelectorAll('.clr-check').forEach((cb) => { if (cb.checked) opts[cb.dataset.cat] = true; });
          if (!Object.keys(opts).length) { toast('Coche au moins une catégorie', 'error'); return 'keep'; }
          const labels = cats.filter((c) => opts[c.key]).map((c) => c.label).join(', ');
          confirmModal('Confirmer', `Effacer définitivement : ${labels} ?`, () => {
            store.clearHistory(opts);
            toast('Historique effacé', 'success');
            rerender();
          }, true);
        },
      },
    ],
  });
}

function openRankLadderModal() {
  let selected = null; // id d'exercice

  const ladderRows = RANK_ORDER.map((id, i) => {
    const meta = RANK_META[id];
    const lo = i * DIV_LP * 3;
    const range = id === 'onyx' ? `${ONYX_LP}+ LP` : `${lo} – ${lo + DIV_LP * 3 - 1} LP`;
    return `<div class="ladder-row">
      ${rankBadge(id, 52)}
      <div><div class="ladder-name" style="color:${meta.color}">${meta.name}</div><div class="muted" style="font-size:0.72rem">${range}${id !== 'onyx' ? ' · 3 divisions (III → I)' : ' · rang unique'}</div></div>
    </div>`;
  }).join('');

  // Repères de la jauge : les niveaux StrengthLevel, placés à leur percentile.
  const LEVEL_FR = { beginner: 'Débutant', novice: 'Novice', intermediate: 'Intermédiaire', advanced: 'Avancé', elite: 'Élite' };
  // Repères de la jauge abrégés : Débutant (5 %) et Novice (20 %) sont trop
  // proches pour leurs noms complets sur un écran de téléphone.
  const LEVEL_SHORT = { beginner: 'Déb.', novice: 'Nov.', intermediate: 'Int.', advanced: 'Av.', elite: 'Élite' };
  const marks = Object.entries(LEVEL_PERCENTILE)
    .map(([l, p]) => `<i style="left:${p}%"></i><span style="left:${p}%">${LEVEL_SHORT[l]}</span>`).join('');

  const content = el(`<div>
    <div class="pct-block">
      <div class="eyebrow">Où te situes-tu ?</div>
      <p class="muted pct-intro">Entre une série : on te place parmi les pratiquants de musculation, d'après les standards StrengthLevel et ton poids de corps (${store.userData.profile.weight} kg).</p>
      <button type="button" class="ex-row" id="pct-exo">
        <span class="ex-row-l">Exercice</span><span class="ex-row-v" id="pct-exo-label">Choisir…</span>${icons.chevron}
      </button>
      <div class="grid-2">
        <label class="field"><span>Poids (kg)</span><input id="pct-weight" type="number" inputmode="decimal" step="0.5" min="0" placeholder="80"></label>
        <label class="field"><span>Répétitions</span><input id="pct-reps" type="number" inputmode="numeric" step="1" min="1" placeholder="8"></label>
      </div>
      <div class="pct-result" id="pct-result">
        <div class="pct-empty">Choisis un exercice, un poids et des répétitions.</div>
      </div>
    </div>

    <div class="eyebrow" style="margin-top:22px">Échelle des rangs</div>
    <div class="ladder-list">${ladderRows}</div>
  </div>`);

  openModal({ title: 'Rangs', content, actions: [] });

  const resultHost = content.querySelector('#pct-result');
  // Calcul en direct : pas de bouton « Calculer », le résultat suit la saisie.
  const update = () => {
    const weight = parseFloat(content.querySelector('#pct-weight').value);
    const reps = parseInt(content.querySelector('#pct-reps').value, 10);
    if (!selected || !weight || !reps) {
      resultHost.innerHTML = '<div class="pct-empty">Choisis un exercice, un poids et des répétitions.</div>';
      return;
    }
    const bw = store.userData.profile.weight;
    const r = liftPercentile(selected, weight, reps, bw, getStandards(), customRefMap()[selected] || null);
    if (r.percentile == null) {
      resultHost.innerHTML = `<div class="pct-empty">Pas de standard de force fiable pour cet exercice (gainage, cardio, mouvement trop spécifique). 1RM estimé : <b>${r.orm} kg</b>.</div>`;
      return;
    }
    const pct = Math.round(r.percentile);
    resultHost.innerHTML = `
      <div class="pct-hero">
        <div class="pct-top"><small>TOP</small>${String(r.top).replace('.', ',')}<small>%</small></div>
        <div class="pct-sub">Plus fort que <b>${pct} %</b> des pratiquants</div>
      </div>
      <div class="pct-gauge"><div class="pct-fill" style="width:${r.percentile}%"></div><div class="pct-marks">${marks}</div></div>
      <div class="pct-meta">
        <span>1RM estimé <b class="num">${r.orm} kg</b></span>
        <span>Niveau <b>${r.level ? LEVEL_FR[r.level] : 'Avant Débutant'}</b></span>
      </div>
      ${store.userData.profile.sex === 'F' ? '<div class="pct-note">Les standards disponibles sont ceux des hommes : le classement est sous-estimé pour une femme.</div>' : ''}`;
  };
  content.querySelector('#pct-weight').addEventListener('input', update);
  content.querySelector('#pct-reps').addEventListener('input', update);
  content.querySelector('#pct-exo').addEventListener('click', () => {
    openExercisePicker((exo) => {
      selected = exo.id;
      content.querySelector('#pct-exo-label').textContent = (exerciseLookup(exo.id) || exo).name;
      update();
    }, 'Choisir un exercice');
  });
}
