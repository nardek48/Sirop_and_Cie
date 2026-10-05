/**
 * form.js — état des formulaires d'interface (non sauvegardé).
 * Séparé de ui.js pour que les liaisons puissent le lire sans dépendance circulaire.
 */
import { RECIPE_COLORS } from '../config.js';

export const Form = {
  houseUse: {},                                            // usage choisi par type de maison
  laboTab: 'recettes',                                     // onglet du Labo : 'recettes' | 'arbre'
  resSel: 'u1',                                            // fruit choisi dans l'arbre
  labo: { a: 'menthe', b: 'grenadine', name: '', color: RECIPE_COLORS[0] },
};
