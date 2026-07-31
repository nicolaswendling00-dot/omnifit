// OmniFit — Recettes préenregistrées (plats composés courants)
//
// Contrairement à data/foods.js qui donne des macros POUR 100 g d'un aliment
// simple, chaque entrée ici décrit UNE PORTION STANDARD d'un plat composé :
// les macros sont donc absolues, pas ramenées à 100 g.
//
// Valeurs INDICATIVES : un plat composé varie énormément selon la recette et le
// restaurant. Elles servent à saisir un repas en un clic sans tout détailler.
// Pour une saisie précise, passer par l'onglet « Tous » ou le scan code-barre.
// Le multiplicateur de portions reste disponible en retouchant le repas ajouté.
//
// Structure : { id, n: nom, c: catégorie, d: description, p: protéines,
//               g: glucides, f: lipides, fb: fibres } — pour une portion.

export const PRESET_RECIPE_CATEGORIES = [
  'Burgers', 'Tacos & wraps', 'Sandwichs', 'Pizzas',
  'Asiatique', 'Salades composées', 'Pâtes & riz', 'Plats français', 'Petit-déjeuner',
];

export const PRESET_RECIPES = [
  // ---- Burgers ----
  { id: 'pr_burger_cheese', n: 'Cheeseburger maison', c: 'Burgers', d: 'Pain, steak haché 5 %, cheddar, crudités, sauce', p: 36, g: 35, f: 26, fb: 3 },
  { id: 'pr_burger_double_bacon', n: 'Double burger bacon', c: 'Burgers', d: 'Pain, 2 steaks, bacon, cheddar, sauce', p: 48, g: 38, f: 45, fb: 3 },
  { id: 'pr_burger_chicken', n: 'Burger poulet croustillant', c: 'Burgers', d: 'Pain, poulet pané, salade, sauce', p: 32, g: 48, f: 24, fb: 3 },
  { id: 'pr_burger_veggie', n: 'Burger végétarien', c: 'Burgers', d: 'Pain complet, galette légumes/pois chiches, crudités', p: 18, g: 46, f: 16, fb: 8 },

  // ---- Tacos & wraps ----
  { id: 'pr_tacos_mex', n: 'Tacos mexicains (2)', c: 'Tacos & wraps', d: '2 tortillas de maïs, poulet, salsa, oignon, coriandre', p: 28, g: 40, f: 16, fb: 5 },
  { id: 'pr_tacos_french', n: 'Tacos français poulet-fromage (M)', c: 'Tacos & wraps', d: 'Galette, poulet, frites, sauce fromagère', p: 45, g: 95, f: 50, fb: 6 },
  { id: 'pr_burrito_boeuf', n: 'Burrito bœuf & haricots', c: 'Tacos & wraps', d: 'Tortilla, bœuf, haricots rouges, riz, fromage', p: 32, g: 70, f: 22, fb: 10 },
  { id: 'pr_wrap_cesar', n: 'Wrap poulet César', c: 'Tacos & wraps', d: 'Tortilla, poulet grillé, salade, parmesan, sauce César', p: 30, g: 42, f: 18, fb: 4 },
  { id: 'pr_quesadilla', n: 'Quesadilla poulet', c: 'Tacos & wraps', d: 'Tortilla, poulet, fromage fondu, poivrons', p: 30, g: 38, f: 22, fb: 3 },

  // ---- Sandwichs ----
  { id: 'pr_jambon_beurre', n: 'Jambon-beurre', c: 'Sandwichs', d: 'Demi-baguette, jambon blanc, beurre', p: 20, g: 55, f: 18, fb: 3 },
  { id: 'pr_kebab', n: 'Kebab galette + frites', c: 'Sandwichs', d: 'Galette, viande kebab, crudités, sauce blanche, frites', p: 38, g: 85, f: 40, fb: 6 },
  { id: 'pr_club', n: 'Club sandwich poulet', c: 'Sandwichs', d: 'Pain de mie, poulet, bacon, tomate, salade, mayo', p: 30, g: 45, f: 24, fb: 4 },
  { id: 'pr_panini', n: 'Panini jambon-fromage', c: 'Sandwichs', d: 'Pain panini, jambon, mozzarella, tomate', p: 26, g: 48, f: 22, fb: 3 },
  { id: 'pr_croque', n: 'Croque-monsieur', c: 'Sandwichs', d: 'Pain de mie, jambon, emmental, béchamel', p: 28, g: 38, f: 28, fb: 2 },

  // ---- Pizzas (pizza entière ~30 cm) ----
  { id: 'pr_pizza_margherita', n: 'Pizza margherita (entière)', c: 'Pizzas', d: 'Pâte, sauce tomate, mozzarella, basilic', p: 34, g: 105, f: 30, fb: 6 },
  { id: 'pr_pizza_reine', n: 'Pizza reine (entière)', c: 'Pizzas', d: 'Pâte, tomate, mozzarella, jambon, champignons', p: 42, g: 105, f: 34, fb: 6 },
  { id: 'pr_pizza_4fromages', n: 'Pizza 4 fromages (entière)', c: 'Pizzas', d: 'Pâte, crème, mozzarella, chèvre, bleu, parmesan', p: 44, g: 100, f: 44, fb: 5 },

  // ---- Asiatique ----
  { id: 'pr_pho_boeuf', n: 'Phở bò (bœuf)', c: 'Asiatique', d: 'Bouillon, nouilles de riz, bœuf, herbes fraîches', p: 30, g: 60, f: 8, fb: 3 },
  { id: 'pr_pho_poulet', n: 'Phở gà (poulet)', c: 'Asiatique', d: 'Bouillon, nouilles de riz, poulet, herbes fraîches', p: 28, g: 58, f: 6, fb: 3 },
  { id: 'pr_pad_thai', n: 'Pad thaï poulet', c: 'Asiatique', d: 'Nouilles de riz sautées, poulet, œuf, cacahuètes', p: 28, g: 72, f: 20, fb: 4 },
  { id: 'pr_ramen', n: 'Ramen tonkotsu', c: 'Asiatique', d: 'Bouillon porc, nouilles, chashu, œuf mollet', p: 32, g: 68, f: 26, fb: 4 },
  { id: 'pr_bo_bun', n: 'Bò bún', c: 'Asiatique', d: 'Vermicelles, bœuf sauté, crudités, nems, nuoc-mâm', p: 28, g: 65, f: 14, fb: 5 },
  { id: 'pr_riz_cantonais', n: 'Riz cantonais', c: 'Asiatique', d: 'Riz sauté, œuf, jambon, petits pois', p: 20, g: 75, f: 14, fb: 3 },
  { id: 'pr_curry_coco', n: 'Poulet curry coco & riz', c: 'Asiatique', d: 'Poulet, lait de coco, curry, riz basmati', p: 35, g: 65, f: 22, fb: 4 },
  { id: 'pr_sushi_saumon', n: 'Sushis saumon (12 pièces)', c: 'Asiatique', d: 'Riz vinaigré, saumon, algue nori', p: 26, g: 62, f: 8, fb: 2 },
  { id: 'pr_bibimbap', n: 'Bibimbap', c: 'Asiatique', d: 'Riz, bœuf, légumes marinés, œuf, gochujang', p: 26, g: 70, f: 16, fb: 6 },

  // ---- Salades composées ----
  { id: 'pr_salade_cesar', n: 'Salade César poulet', c: 'Salades composées', d: 'Romaine, poulet grillé, parmesan, croûtons, sauce César', p: 32, g: 18, f: 26, fb: 4 },
  { id: 'pr_salade_grecque', n: 'Salade grecque', c: 'Salades composées', d: 'Tomate, concombre, feta, olives, huile d’olive', p: 12, g: 16, f: 24, fb: 5 },
  { id: 'pr_salade_nicoise', n: 'Salade niçoise', c: 'Salades composées', d: 'Thon, œuf, haricots verts, tomate, olives', p: 26, g: 20, f: 18, fb: 5 },
  { id: 'pr_buddha_bowl', n: 'Buddha bowl quinoa', c: 'Salades composées', d: 'Quinoa, pois chiches, avocat, légumes rôtis, graines', p: 20, g: 62, f: 20, fb: 12 },
  { id: 'pr_salade_chevre', n: 'Salade chèvre-miel-noix', c: 'Salades composées', d: 'Mesclun, toasts de chèvre, miel, noix', p: 18, g: 28, f: 32, fb: 5 },
  { id: 'pr_taboule', n: 'Taboulé libanais', c: 'Salades composées', d: 'Persil, boulgour, tomate, citron, huile d’olive', p: 6, g: 42, f: 12, fb: 6 },
  { id: 'pr_salade_poulet_avocat', n: 'Salade poulet-avocat', c: 'Salades composées', d: 'Salade, poulet grillé, avocat, tomates cerises', p: 34, g: 14, f: 24, fb: 8 },

  // ---- Pâtes & riz ----
  { id: 'pr_pates_bolo', n: 'Pâtes bolognaise', c: 'Pâtes & riz', d: 'Pâtes, sauce tomate, bœuf haché, parmesan', p: 30, g: 85, f: 16, fb: 6 },
  { id: 'pr_pates_carbo', n: 'Pâtes carbonara', c: 'Pâtes & riz', d: 'Pâtes, lardons, œuf, parmesan, crème', p: 28, g: 82, f: 28, fb: 4 },
  { id: 'pr_pates_pesto', n: 'Pâtes au pesto', c: 'Pâtes & riz', d: 'Pâtes, pesto basilic, pignons, parmesan', p: 18, g: 80, f: 22, fb: 5 },
  { id: 'pr_lasagnes', n: 'Lasagnes bolognaise', c: 'Pâtes & riz', d: 'Pâtes, bœuf, béchamel, tomate, fromage', p: 32, g: 55, f: 26, fb: 5 },
  { id: 'pr_risotto', n: 'Risotto aux champignons', c: 'Pâtes & riz', d: 'Riz arborio, champignons, parmesan, beurre', p: 14, g: 72, f: 18, fb: 4 },
  { id: 'pr_poke_saumon', n: 'Poke bowl saumon', c: 'Pâtes & riz', d: 'Riz, saumon cru, avocat, edamame, sauce soja', p: 32, g: 68, f: 18, fb: 6 },

  // ---- Plats français ----
  { id: 'pr_steak_frites', n: 'Steak-frites', c: 'Plats français', d: 'Steak de bœuf, frites, sauce', p: 40, g: 55, f: 28, fb: 6 },
  { id: 'pr_quiche', n: 'Quiche lorraine (part)', c: 'Plats français', d: 'Pâte brisée, lardons, œufs, crème', p: 16, g: 28, f: 28, fb: 2 },
  { id: 'pr_blanquette', n: 'Blanquette de veau & riz', c: 'Plats français', d: 'Veau, sauce crème, carottes, champignons, riz', p: 35, g: 55, f: 20, fb: 3 },
  { id: 'pr_hachis', n: 'Hachis parmentier', c: 'Plats français', d: 'Bœuf haché, purée de pommes de terre, gratiné', p: 26, g: 45, f: 20, fb: 5 },
  { id: 'pr_omelette', n: 'Omelette 3 œufs jambon-fromage', c: 'Plats français', d: '3 œufs, jambon, emmental', p: 32, g: 3, f: 26, fb: 0 },

  // ---- Petit-déjeuner ----
  { id: 'pr_porridge', n: 'Porridge avoine-banane', c: 'Petit-déjeuner', d: 'Flocons d’avoine, lait, banane, miel', p: 14, g: 62, f: 10, fb: 8 },
  { id: 'pr_oeufs_avocat', n: 'Œufs brouillés & toast avocat', c: 'Petit-déjeuner', d: '2 œufs, pain complet, avocat', p: 22, g: 32, f: 28, fb: 8 },
  { id: 'pr_skyr_bowl', n: 'Bowl skyr, fruits rouges & granola', c: 'Petit-déjeuner', d: 'Skyr, fruits rouges, granola', p: 28, g: 48, f: 10, fb: 6 },
  { id: 'pr_pancakes_prot', n: 'Pancakes protéinés', c: 'Petit-déjeuner', d: 'Avoine, whey, œuf, banane', p: 30, g: 45, f: 12, fb: 4 },
  { id: 'pr_tartines_pb', n: 'Tartines beurre de cacahuète-banane', c: 'Petit-déjeuner', d: 'Pain complet, beurre de cacahuète, banane', p: 14, g: 55, f: 20, fb: 7 },
];

// Normalise une recette préenregistrée vers la forme utilisée par le reste de
// l'app (mêmes clés que les recettes utilisateur), pour que l'ajout, l'édition
// et le multiplicateur fonctionnent sans code spécifique.
export function presetToRecipe(r) {
  return {
    id: r.id,
    name: r.n,
    prot: r.p,
    carbs: r.g,
    fat: r.f,
    fiber: r.fb,
    ingredients: [],
    isPreset: true,
    desc: r.d,
  };
}
