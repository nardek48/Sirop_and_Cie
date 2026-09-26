/**
 * wallet.js — toutes les entrées et sorties d'argent passent par ici.
 */
import { rt } from '../core/game.js';
import { Bus } from '../core/bus.js';

export const Wallet = {
  earn(s, amt) { s.money += amt; s.stats.earned += amt; s.run.earned += amt; rt.earnedTick += amt; },
  /** @returns {boolean} false (et un message) si l'argent manque */
  spend(s, amt) {
    if (s.money + 1e-9 < amt) { Bus.toast('Pas assez d’argent', 'bad'); return false; }
    s.money -= amt;
    Bus.sfx('buy');
    return true;
  },
};
