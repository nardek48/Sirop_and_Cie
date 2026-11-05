/**
 * cities.js — les autres villes (v0.12.0) : ouvertes par un fruit de l'arbre du Labo,
 * elles optimisent le village sans le remplacer (toute la production reste à Sirop-sur-Mer).
 *
 * Le wagon automatique part toutes les `every` secondes, même jeu fermé, mais seulement si
 * l'entrepôt est presque plein : il n'emporte que le surplus, le vend en ville et rapporte
 * le fruit de la ville (les fraises), introuvable au village.
 * État : s.cities[id] = { next, trips, sent, fruit, last } — remis à zéro au prestige
 * (la ville reste ouverte : le fruit de l'arbre est gardé).
 */
import { CONFIG } from '../config.js';
import { Bus } from '../core/bus.js';
import { Fmt } from '../core/format.js';
import { Eco } from './eco.js';
import { Wallet } from './wallet.js';
import { Flavors } from './flavors.js';
import { Research } from './research.js';

export const Cities = {
  open: (s, id) => Research.has(s, CONFIG.cities[id].research),
  /** La ville d'un parfum de ville (ex. 'fraise' → 'fraises'), ou null */
  ofFlavor: fl => (CONFIG.flavors[fl] && CONFIG.flavors[fl].city) || null,
  state(s, id) { return (s.cities[id] ||= { next: CONFIG.cities[id].wagon.every, trips: 0, sent: 0, fruit: 0, last: null }); },
  /** Secondes avant le prochain départ du wagon */
  wait(s, id) { return Math.max(0, Math.ceil(this.state(s, id).next)); },
  /** Le wagon peut-il partir (entrepôt assez plein) ? */
  ready(s, id) { return Eco.totalStock(s) >= Eco.wareCap(s) * CONFIG.cities[id].wagon.fullAt; },

  /** Bonus du mini-jeu du train : le wagon part tout de suite (au prochain pas de simulation) */
  hurry(s) { for (const id of Object.keys(CONFIG.cities)) if (this.open(s, id)) this.state(s, id).next = 0; },

  /**
   * Un départ : le parfum (hors parfums de ville) qui a le plus de bouteilles libres,
   * seulement ce qui dépasse keepRatio de l'entrepôt, au plus capSec s de production.
   * @returns {object|null} le chargement vendu, ou null si le wagon est resté à quai
   */
  ship(s, id) {
    const W = CONFIG.cities[id].wagon, st = this.state(s, id);
    if (!this.ready(s, id)) return null;
    let best = null;
    for (const fl of s.unlocked) {
      if (Flavors.isCity(s, fl)) continue;
      const free = (s.stock[fl] || 0) - Eco.reserved(s, fl);
      if (!best || free > best.free) best = { fl, free };
    }
    const room = Eco.totalStock(s) - Eco.wareCap(s) * W.keepRatio;
    const n = Math.floor(Math.min(Math.max(W.minCap, Eco.prodRate(s) * W.capSec), room, best ? best.free : 0));
    if (n <= 0) return null;
    s.stock[best.fl] -= n;
    const money = Math.round(n * Eco.basePrice(s, best.fl) * W.pay * Eco.mult(s));
    const fruit = n * W.fruitPerBottle, mat = CONFIG.cities[id].fruit;
    Wallet.earn(s, money);
    s.mat[mat] = (s.mat[mat] || 0) + fruit;
    Object.assign(st, { trips: st.trips + 1, sent: st.sent + n, fruit: st.fruit + fruit, last: { fl: best.fl, n, money, fruit } });
    const C = CONFIG.cities[id], M = CONFIG.materials[mat];
    Bus.toast(`🚂 Le wagon revient de la ${C.name} : ${Fmt.int(n)} ${Flavors.get(s, best.fl).name} vendues, +${Fmt.money(money)} et +${Fmt.int(fruit)} kg ${M.icon}`, 'ok');
    Bus.sfx('coin');
    return st.last;
  },

  step(s, dt) {
    for (const id of Object.keys(CONFIG.cities)) {
      if (!this.open(s, id)) continue;
      const st = this.state(s, id);
      st.next -= dt;
      if (st.next > 0) continue;
      st.next = CONFIG.cities[id].wagon.every;
      this.ship(s, id);
    }
  },
};
