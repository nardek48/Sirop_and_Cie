/**
 * flavors.js — accès unifié aux parfums de base (CONFIG) et aux recettes secrètes (état).
 */
import { CONFIG } from '../config.js';

export const Flavors = {
  /** @returns {{name,price,sugar,fruit,time,color,recipe?}} */
  get(s, id) { return CONFIG.flavors[id] || s.recipes.find(r => r.id === id); },
  ids(s) { return [...Object.keys(CONFIG.flavors), ...s.recipes.map(r => r.id)]; },
  baseIds() { return Object.keys(CONFIG.flavors); },
};
