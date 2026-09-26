/**
 * events.js — événements aléatoires : pluie, canicule, fête du village.
 * Un événement à la fois, toutes les 5 à 8 minutes.
 */
import { CONFIG } from '../config.js';
import { Bus } from '../core/bus.js';
import { rand, pick } from '../core/format.js';
import { Flavors } from './flavors.js';
import { Eco } from './eco.js';

const L = CONFIG.events.list;

export const Events = {
  is: (s, id) => s.event.id === id,
  current: s => (s.event.id ? L[s.event.id] : null),

  regrowFactor: s => (s.event.id === 'pluie' ? 3 : 1),
  counterFactor: s => (s.event.id === 'canicule' ? 1.5 : 1),
  rewardFactor: s => (s.event.id === 'canicule' ? 1.3 : 1),

  start(s, id) {
    const e = L[id];
    s.event.id = id;
    s.event.left = e.dur;
    if (id === 'fete') this.addFeteOrder(s, e);
    Bus.toast(`${e.icon} ${e.name} : ${e.desc} !`, 'ok');
    Bus.sfx('event');
  },

  /** Commande géante à livrer à la mairie (≈ 90 s de production) */
  addFeteOrder(s, e) {
    const fl = pick(s.unlocked), f = Flavors.get(s, fl);
    const qty = Math.max(25, Math.round(Eco.bottleRate(s) * 90));
    s.offers.push({
      id: s.nextId++, place: 'mairie', client: 'Fête du village', icon: '🎉', flavor: fl, qty,
      reward: Math.round(qty * f.price * 3 * Eco.mult(s)), time: 200, repGain: 5, ttl: e.dur, special: true,
    });
  },

  end(s) {
    const e = L[s.event.id];
    s.event.id = null;
    Bus.toast(`${e.icon} ${e.name} : c’est terminé.`);
  },

  step(s, dt) {
    const E = s.event;
    if (E.id) { E.left -= dt; if (E.left <= 0) this.end(s); return; }
    E.next -= dt;
    if (E.next <= 0) { E.next = rand(...CONFIG.events.every); this.start(s, pick(Object.keys(L))); }
  },
};
