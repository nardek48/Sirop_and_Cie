/**
 * contracts.js — offre → accepté → chargé (joueur ou livreur) → livré chez le client.
 * c.loaded : null | 'player' | 'npc'
 */
import { CONFIG } from '../config.js';
import { Bus } from '../core/bus.js';
import { Fmt, rand, pick } from '../core/format.js';
import { Flavors } from './flavors.js';
import { Eco } from './eco.js';
import { Wallet } from './wallet.js';
import { Clock } from './clock.js';
import { Events } from './events.js';
import { Couriers } from './couriers.js';

const C = CONFIG.contracts;

export const Contracts = {
  find: (s, id) => s.active.find(c => c.id === Number(id)),

  generate(s) {
    const c = pick(C.clients.filter(x => Eco.clientOpen(s, x)));
    const flavor = pick(s.unlocked);
    const qty = Math.max(5, Math.round((c.qty * (1 + s.rep / C.repScale) + Eco.lineProdRate(s) * c.prodSec) * rand(0.7, 1.3)));
    s.offers.push({
      id: s.nextId++, place: c.place, client: c.name, icon: c.icon, flavor, qty,
      reward: Math.round(qty * Eco.basePrice(s, flavor) * c.mult * Eco.mult(s) * Events.rewardFactor(s)),
      time: Math.round(rand(...c.time)), repGain: c.repGain, ttl: C.offerTtlSec,
    });
  },

  accept(s, id) {
    const i = s.offers.findIndex(o => o.id === Number(id));
    if (i < 0) return;
    // La commande du tutoriel passe toujours, même si les emplacements sont pleins
    if (s.active.length >= s.slots && !s.offers[i].tuto) return Bus.toast('Plus de place : termine un contrat ou achète un emplacement', 'bad');
    const o = s.offers.splice(i, 1)[0];
    s.active.push({ ...o, left: o.time, loaded: null });
    Bus.sfx('click');
  },
  decline(s, id) { s.offers = s.offers.filter(o => o.id !== Number(id)); },

  canLoad: (s, c) => !c.loaded && (s.stock[c.flavor] || 0) + 1e-9 >= c.qty,
  load(s, c, who) { s.stock[c.flavor] -= c.qty; c.loaded = who; },

  /**
   * Le joueur charge au quai toutes les commandes prêtes qui tiennent dans son véhicule.
   * @returns {{n:number,b:number,tooBig:boolean}}
   */
  loadAll(s) {
    let room = Eco.capacity(s) - Eco.carriedQty(s), n = 0, b = 0, tooBig = false;
    for (const c of s.active) {
      if (!this.canLoad(s, c)) continue;
      if (c.qty > room) { tooBig = true; continue; }
      this.load(s, c, 'player');
      room -= c.qty; n++; b += c.qty;
    }
    if (n) Bus.sfx('load');
    return { n, b, tooBig };
  },

  complete(s, c) {
    let reward = c.reward, bonus = '';
    if (c.place === 'cafe' && Clock.isNight(s)) { reward = Math.round(reward * C.nightCafeBonus); bonus = ' (bonus soirée 🌙)'; }
    Wallet.earn(s, reward);
    s.rep += c.repGain;
    s.stats.cDone++;
    s.stats.byClient[c.place] = (s.stats.byClient[c.place] || 0) + 1;
    s.active = s.active.filter(x => x !== c);
    Bus.toast(`${c.icon} ${c.client} : merci ! +${Fmt.money(reward)}${bonus}`, 'ok');
    Bus.float(`+${Fmt.money(reward)}  ⭐+${c.repGain}`, c.place, '#ffe28a');
    Bus.sfx('coin');
  },

  /** Le joueur livre tout ce qu'il porte pour ce lieu. @returns {number} */
  deliverAt(s, place) {
    const list = s.active.filter(c => c.loaded === 'player' && c.place === place);
    list.forEach(c => this.complete(s, c));
    return list.length;
  },

  /** Pénalité d'un contrat non livré : argent perdu et réputation perdue */
  penalty: (c, abandon = false) => ({
    money: Math.round(c.reward * C.penaltyRatio),
    rep: c.repGain * (abandon ? C.abandonRepLoss : 2),
  }),

  /** Retire un contrat non livré (retard ou abandon) : les caisses reviennent au stock */
  drop(s, c, pen) {
    if (c.loaded) s.stock[c.flavor] += c.qty;
    if (c.loaded === 'npc') Couriers.abort(s, c.id);
    s.money = Math.max(0, s.money - pen.money);
    s.rep = Math.max(0, s.rep - pen.rep);
    s.active = s.active.filter(x => x !== c);
  },

  fail(s, c) {
    const pen = this.penalty(c);
    this.drop(s, c, pen);
    s.stats.cFail++;
    Bus.toast(`Trop tard pour ${c.client} : −${Fmt.money(pen.money)}`, 'bad');
  },

  /** Le joueur renonce à un contrat : moins grave qu'un retard pour la réputation */
  abandon(s, id) {
    const c = this.find(s, id);
    if (!c || c.tuto) return;
    const pen = this.penalty(c, true);
    this.drop(s, c, pen);
    s.stats.cQuit++;
    Bus.toast(`Commande de ${c.client} abandonnée : −${Fmt.money(pen.money)}, ⭐ −${pen.rep}`, 'bad');
  },

  buySlot(s) {
    if (s.slots >= C.slotMax) return;
    if (Wallet.spend(s, Eco.slotCost(s))) s.slots++;
  },

  step(s, dt) {
    for (const o of s.offers) o.ttl -= dt;
    s.offers = s.offers.filter(o => o.ttl > 0);

    s.nextOfferIn -= dt;
    if (s.nextOfferIn <= 0) {
      s.nextOfferIn = C.offerEverySec;
      if (s.offers.filter(o => !o.special).length < C.maxOffers) this.generate(s);
    }
    for (const c of [...s.active]) {
      c.left -= dt;
      if (c.left <= 0) this.fail(s, c);
    }
  },
};
