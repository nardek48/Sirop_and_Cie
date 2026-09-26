/**
 * couriers.js — livreurs (PNJ). Simulés en temps abstrait (t / dur) pour
 * fonctionner hors ligne ; le monde interpole leur position sur le trajet
 * quai → route → client.
 */
import { CONFIG } from '../config.js';
import { Bus } from '../core/bus.js';
import { Eco } from './eco.js';
import { Wallet } from './wallet.js';
import { Contracts } from './contracts.js';

const K = CONFIG.couriers;

export const Couriers = {
  /** Distance « par la route » entre deux lieux */
  dist(a, b) {
    const A = CONFIG.places[a], B = CONFIG.places[b], Y = CONFIG.roadY;
    return Math.abs(A.y - Y) + Math.abs(A.x - B.x) + Math.abs(B.y - Y);
  },

  hire(s) {
    if (s.couriers >= K.max) return;
    if (s.rep < K.rep) return Bus.toast(`Il faut ⭐ ${K.rep} pour embaucher`, 'bad');
    if (!Wallet.spend(s, Eco.courierCost(s))) return;
    s.couriers++;
    s.npcs.push({ state: 'idle', cid: null, dest: null, t: 0, dur: 0 });
    Bus.toast(`Livreur n°${s.couriers} embauché !`, 'ok');
  },

  /** Contrat échoué pendant la livraison : le livreur fait demi-tour */
  abort(s, cid) {
    for (const n of s.npcs) {
      if (n.cid !== cid || n.state !== 'go') continue;
      n.state = 'back'; n.t = Math.max(0, n.dur - n.t); n.cid = null;
    }
  },

  step(s, dt) {
    for (const n of s.npcs) {
      if (n.state === 'idle') {
        const c = s.active.find(k => Contracts.canLoad(s, k));
        if (!c) continue;
        Contracts.load(s, c, 'npc');
        Object.assign(n, { state: 'go', cid: c.id, dest: c.place, t: 0, dur: this.dist('quai', c.place) / K.speed });
        continue;
      }
      n.t += dt;
      if (n.t < n.dur) continue;
      if (n.state === 'go') {
        const c = Contracts.find(s, n.cid);
        if (c) Contracts.complete(s, c);
        Object.assign(n, { state: 'back', cid: null, t: 0 });
      } else Object.assign(n, { state: 'idle', dest: null, t: 0 });
    }
  },
};
