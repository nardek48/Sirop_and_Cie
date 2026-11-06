/**
 * fishing.js — pêche au ponton du Port : quelle espèce mord, son poids, et le carnet du pêcheur.
 * Sans DOM : le mini-jeu (js/minigames/fishing.js) demande un poisson puis enregistre la prise.
 * État : s.fishing = { caught, carnet: { [espèce]: { n, best } } }, gardé au prestige.
 * Récompense : ⭐ de réputation à la 1re prise de chaque espèce, trophée quand le carnet est complet.
 */
import { CONFIG } from '../config.js';
import { Bus } from '../core/bus.js';

const SPECIES = () => CONFIG.fishing.species;

export const Fishing = {
  get: id => SPECIES().find(f => f.id === id) || null,

  /** L'espèce qui mord, tirée au sort parmi celles de la zone du lancer (d en mètres) */
  pick(d, r = Math.random) {
    const pool = SPECIES().filter(f => d >= f.zone[0] && d <= f.zone[1]);
    let left = r() * pool.reduce((a, f) => a + f.w, 0);
    for (const f of pool) { left -= f.w; if (left <= 0) return f; }
    return pool[0] || SPECIES()[0];
  },

  /** Poids de la prise (2 décimales sous 1 kg, 1 au-dessus) */
  weight(f, r = Math.random) {
    const kg = f.kg[0] + r() * (f.kg[1] - f.kg[0]);
    return +kg.toFixed(f.kg[1] < 1 ? 2 : 1);
  },

  /**
   * Note la prise dans le carnet ; une nouvelle espèce rapporte des ⭐, la dernière donne le trophée.
   * @returns {{isNew:boolean, record:boolean, n:number, rep:number, master:boolean}}
   */
  record(s, id, kg) {
    const prev = s.fishing.carnet[id];
    const out = { isNew: !prev, record: !!prev && kg > prev.best, n: (prev ? prev.n : 0) + 1, rep: 0, master: false };
    s.fishing.carnet[id] = { n: out.n, best: Math.max(kg, prev ? prev.best : 0) };
    s.fishing.caught++;
    if (out.isNew) {
      out.rep = CONFIG.fishing.repPerSpecies;
      s.rep += out.rep;
      out.master = Fishing.master(s);
      if (out.master) Bus.toast(`${CONFIG.fishing.master} : ton carnet de pêche est complet !`, 'ok');
    }
    return out;
  },

  /** Trophée : toutes les espèces sont dans le carnet */
  master: s => SPECIES().every(f => s.fishing.carnet[f.id]),

  /** Espèces déjà prises / total */
  progress: s => ({ got: SPECIES().filter(f => s.fishing.carnet[f.id]).length, total: SPECIES().length }),
};
