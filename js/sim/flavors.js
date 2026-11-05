/**
 * flavors.js — accès unifié aux parfums de base (CONFIG) et aux recettes secrètes (état).
 */
import { CONFIG } from '../config.js';

export const Flavors = {
  /** @returns {{name,price,sugar,fruit,time,color,recipe?}} */
  get(s, id) { return CONFIG.flavors[id] || s.recipes.find(r => r.id === id); },
  ids(s) { return [...Object.keys(CONFIG.flavors), ...s.recipes.map(r => r.id)]; },
  baseIds() { return Object.keys(CONFIG.flavors); },

  /**
   * Matières pour une bouteille : { sugar, <fruit>: kg, … }.
   * Parfum de base : son propre fruit. Recette secrète : moitié des fruits de chacun de ses parfums.
   */
  needs(s, id) {
    const f = this.get(s, id);
    if (!f) return { sugar: 1 };
    if (!f.recipe) return { sugar: f.sugar, [id]: f.fruit };
    return { sugar: f.sugar, [f.a]: f.fruit / 2, [f.b]: (f.fruit / 2) + (f.a === f.b ? f.fruit / 2 : 0) };
  },
  /** Fruits demandés par un parfum (sans le sucre) */
  fruits(s, id) { return Object.keys(this.needs(s, id)).filter(m => m !== 'sugar'); },
  /** Le fruit « principal » d'un parfum */
  mainFruit(s, id) { return this.fruits(s, id)[0] || 'menthe'; },
  /** Parfum qui demande un fruit de ville (Fraise, ou recette avec de la Fraise) : jamais commandé au village */
  isCity(s, id) { return this.fruits(s, id).some(m => CONFIG.materials[m] && CONFIG.materials[m].city); },
  /** Fruit que donnent le verger et les maisons-vergers : jamais un fruit de ville (il ne pousse pas ici) */
  localFruit(s, id) {
    const own = this.fruits(s, id).find(m => !CONFIG.materials[m].city);
    if (own) return own;
    const base = Object.keys(CONFIG.flavors).filter(k => s.unlocked.includes(k) && !CONFIG.materials[k].city);
    return base.sort((a, b) => CONFIG.flavors[b].price - CONFIG.flavors[a].price)[0] || 'menthe';
  },
};
