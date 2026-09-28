/**
 * openings.js — bâtiments fermés au début, qui ouvrent au bon moment
 * (garage, agence, labo). Règles dans CONFIG.openings.
 */
import { CONFIG } from '../config.js';
import { Bus } from '../core/bus.js';
import { Fmt } from '../core/format.js';

/** Valeur actuelle de chaque critère */
const STATS = {
  earned: s => s.stats.earned,
  cDone: s => s.stats.cDone,
  flavors: s => s.unlocked.length,
};

export const Openings = {
  isOpen: (s, id) => !(id in s.opened) || s.opened[id],

  /** Texte « ouvrira quand… (où tu en es) » pour un bâtiment fermé */
  hint(s, id) {
    const o = CONFIG.openings[id], v = STATS[o.stat](s);
    const now = o.stat === 'earned' ? `${Fmt.money(v)} / ${Fmt.money(o.goal)}` : `${Fmt.int(v)} / ${o.goal}`;
    return `${o.need} (${now})`;
  },

  step(s) {
    for (const [id, o] of Object.entries(CONFIG.openings)) {
      if (s.opened[id] || STATS[o.stat](s) < o.goal) continue;
      s.opened[id] = true;
      Bus.toast(`🎉 Nouveau : ${o.icon} ${o.name} est ouvert !`, 'ok');
      Bus.float('Nouveau ! 🎉', id, '#ffe28a');
      Bus.sfx('unlock');
    }
  },
};
