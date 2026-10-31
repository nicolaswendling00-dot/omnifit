// OmniFit — Navigation entre onglets
//
// Les modules de page ne connaissent pas l'orchestrateur (app.js) et ne peuvent
// donc pas changer d'onglet eux-mêmes. app.js enregistre ici sa fonction de
// navigation au démarrage ; les pages l'appellent via goToPage().
// Permet par exemple de toucher la carte Calories de l'accueil pour ouvrir
// l'onglet Nutrition.

export const PAGE_HOME = 0;
export const PAGE_NUTRITION = 1;
export const PAGE_WORKOUT = 2;
export const PAGE_ACTIVITY = 3;
export const PAGE_SETTINGS = 4;

let handler = null;

export function setNavigator(fn) {
  handler = typeof fn === 'function' ? fn : null;
}

export function goToPage(index) {
  if (handler) handler(index);
}

// ---------- Jour consulté, commun à tous les onglets ----------
// null = aujourd'hui : suit le passage de minuit sans rien faire. Choisir un
// autre jour dans un onglet le choisit pour tous ; app.js est prévenu pour
// redessiner les autres onglets à leur prochain affichage.
let viewDate = null;
let dateHandler = null;
const localISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const getViewDate = () => viewDate || localISO();
export const isViewingToday = () => !viewDate || viewDate === localISO();

export function setViewDate(iso) {
  const next = !iso || iso >= localISO() ? null : iso; // jamais dans le futur
  if (next === viewDate) return false;
  viewDate = next;
  if (dateHandler) dateHandler();
  return true;
}

export function setDateListener(fn) {
  dateHandler = typeof fn === 'function' ? fn : null;
}
