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
