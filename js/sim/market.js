/**
 * market.js — vente passive au comptoir, jamais sur les bouteilles réservées aux contrats.
 */
import { CONFIG } from '../config.js';
import { rt } from '../core/game.js';
import { Eco } from './eco.js';
import { Wallet } from './wallet.js';

export const Market = {
  step(s, dt) {
    rt.flow.sell = 0;
    if (!s.counterOn) return;
    let budget = Eco.counterRate(s) * dt, sold = 0, gain = 0;
    const order = s.unlocked
      .map(fl => [fl, (s.stock[fl] || 0) - Eco.reserved(s, fl)])
      .filter(([, q]) => q > 0)
      .sort((a, b) => b[1] - a[1]);                 // écoule d'abord le plus gros stock
    for (const [fl, q] of order) {
      if (budget <= 0) break;
      const n = Math.min(q, budget);
      s.stock[fl] -= n; budget -= n; sold += n;
      gain += n * Eco.sellPrice(s, fl, CONFIG.counter.priceFactor);
    }
    if (gain) { Wallet.earn(s, gain); if (!rt.silent) rt.counterAcc += gain; }
    s.stats.sold += sold;
    rt.flow.sell = sold / dt;
  },
};
