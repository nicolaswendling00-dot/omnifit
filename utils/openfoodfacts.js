// OmniFit — utils/openfoodfacts.js
// Appel à l'API Open Food Facts V2. Module séparé : ne s'occupe QUE du réseau/parsing,
// aucune logique caméra ni UI ici.

const API_BASE = 'https://world.openfoodfacts.org/api/v2/product/';

// Récupère les macros pour 100g d'un produit à partir de son code-barre (EAN-13, etc.)
// Retourne { name, kcal, prot, carbs, fat, fiber } ou null si produit introuvable.
// Lève une erreur en cas de souci réseau (pas de connexion, timeout...).
export async function fetchProductByBarcode(code) {
  let res;
  try {
    res = await fetch(`${API_BASE}${encodeURIComponent(code)}.json`);
  } catch (e) {
    throw new Error('Pas de connexion internet — le scan nécessite un accès réseau.');
  }
  if (!res.ok) throw new Error('Open Food Facts est indisponible pour le moment.');

  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const n = p.nutriments || {};

  // Cible précisément les valeurs "pour 100g" ; 0 par défaut si absentes (ex: fibres).
  return {
    name: p.product_name || p.generic_name || p.product_name_fr || 'Produit scanné',
    brand: p.brands || '',
    kcal: Math.round(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0),
    prot: round1(n.proteins_100g ?? 0),
    carbs: round1(n.carbohydrates_100g ?? 0),
    fat: round1(n.fat_100g ?? 0),
    fiber: round1(n.fiber_100g ?? 0),
  };
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
