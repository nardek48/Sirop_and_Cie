/**
 * bindings.js — liaisons état → DOM.
 *  data-t="nom:arg"        → textContent
 *  data-d="nom:arg"        → disabled
 *  data-w="nom:arg"        → largeur d'une barre (0..1)
 *  data-c="classe|nom:arg" → bascule une classe
 */
import { CONFIG, clientByPlace, typeById } from '../config.js';
import { rt } from '../core/game.js';
import { Fmt } from '../core/format.js';
import { Flavors } from '../sim/flavors.js';
import { Eco } from '../sim/eco.js';
import { Clock } from '../sim/clock.js';
import { Events } from '../sim/events.js';
import { Contracts } from '../sim/contracts.js';
import { RealEstate, Garage, Recipes } from '../sim/world-systems.js';
import { Quests } from '../sim/quests.js';
import { Prestige } from '../sim/sim.js';
import { Form } from './form.js';

const BNECK = {
  mat: 'Matières épuisées', cook: 'Goulot : cuisson', bottle: 'Goulot : embouteillage',
  ware: 'Entrepôt plein : vends ou livre !', switch: 'Changement de parfum : vidage de la cuve',
};

export const B = {
  /* --- Barre du haut & HUD --- */
  money: s => Fmt.money(s.money),
  rps: () => Fmt.money(rt.rps) + '/s',
  rep: s => Fmt.int(s.rep),
  stockTop: s => `${Fmt.int(Eco.totalStock(s))} / ${Fmt.int(Eco.wareCap(s))}`,
  stars: s => (s.stars ? `✨ ${s.stars} · +${Math.round(s.stars * CONFIG.prestige.bonusPerStar * 100)} %` : ''),
  cargoTop: s => { const n = Eco.carriedQty(s); return n ? `📦 ${Fmt.int(n)} / ${Fmt.int(Eco.capacity(s))}` : ''; },
  clock: s => Clock.label(s),
  eventTxt: s => { const e = Events.current(s); return e ? `${e.icon} ${e.name} · ${Fmt.time(s.event.left)}` : ''; },
  questTitle: s => { const q = Quests.current(s); return q ? q.text : 'Toutes les quêtes sont terminées. Bravo !'; },
  questProg: s => {
    const q = Quests.current(s);
    if (!q) return '';
    if (s.quest.ready) return '🎁 Réussie ! Va voir le maire';
    const p = Quests.progress(s);
    return `${Fmt.int(p.cur)} / ${Fmt.int(p.goal)} · récompense ${Fmt.money(q.reward)}`;
  },
  questPct: s => { const p = Quests.progress(s); return p.cur / p.goal; },
  questReady: s => s.quest.ready,
  questDone: s => !Quests.current(s),

  /* --- Usine --- */
  mat: (s, m) => Fmt.num(s.mat[m]) + ' kg',
  cantMat: (s, a) => { const [m, q] = a.split(','); return s.money < q * CONFIG.materials[m].price; },
  recipe: s => { const f = Flavors.get(s, s.flavor); return `${f.name} : ${Fmt.num(f.sugar)} kg sucre + ${Fmt.num(f.fruit)} kg fruits / bt`; },
  lvLv: (s, k) => 'Niv. ' + s.lv[k],
  lvCost: (s, k) => Fmt.money(Eco.lvCost(s, k)),
  cantLv: (s, k) => s.money < Eco.lvCost(s, k),
  rate: (s, k) => Fmt.num({ cook: Eco.cookRate, bottle: Eco.bottleRate, counter: Eco.counterRate }[k](s)) + ' bt/s',
  flow: (s, k) => 'réel : ' + Fmt.num(rt.flow[k] || 0) + ' bt/s',
  tankPct: s => s.bulk / Eco.tankCap(s),
  tankTxt: s => `${Fmt.int(s.bulk)} / ${Fmt.int(Eco.tankCap(s))} L · ${Flavors.get(s, s.bulkFlavor).name}`,
  warePct: s => Eco.totalStock(s) / Eco.wareCap(s),
  wareTxt: s => {
    const bonus = Eco.houseTotal(s, 'storage');
    return `${Fmt.int(Eco.totalStock(s))} / ${Fmt.int(Eco.wareCap(s))} bt${bonus ? ` (dont +${Fmt.int(bonus)} maisons)` : ''}`;
  },
  counterNote: s => {
    const notes = [];
    if (Clock.isNight(s)) notes.push('🌙 nuit : moins de clients');
    if (Events.is(s, 'canicule')) notes.push('🥵 canicule : ×1,5');
    return notes.join(' · ');
  },
  bneck: (s, k) => rt.bneck === k,
  bneckLabel: () => BNECK[rt.bneck] || '',
  counterBtn: s => (s.counterOn ? '🟢 Ouvert, fermer' : '🔴 Fermé, ouvrir'),
  stockFl: (s, f) => Fmt.int(s.stock[f] || 0),
  resFl: (s, f) => { const r = Eco.reserved(s, f); return r ? Fmt.int(r) : '—'; },
  cantUnlock: (s, f) => s.money < CONFIG.flavors[f].unlock,
  cantRestock: s => s.money < CONFIG.restock.cost,

  /* --- Contrats --- */
  slotsTxt: s => `${s.active.length} / ${s.slots}`,
  slotCost: s => (s.slots >= CONFIG.contracts.slotMax ? 'max' : Fmt.money(Eco.slotCost(s))),
  cantSlot: s => s.slots >= CONFIG.contracts.slotMax || s.money < Eco.slotCost(s),
  capTxt: s => { const v = Eco.vehicle(s); return `${v.icon} ${v.name} : ${Fmt.int(Eco.capacity(s))} bouteilles par voyage`; },
  nextOffer: s => (s.offers.filter(o => !o.special).length >= CONFIG.contracts.maxOffers ? 'tableau plein' : Fmt.time(s.nextOfferIn)),
  offerTtl: (s, id) => { const o = s.offers.find(x => x.id === Number(id)); return o ? Fmt.time(o.ttl) : ''; },
  cantAccept: s => s.active.length >= s.slots,
  cLeft: (s, id) => { const c = Contracts.find(s, id); return c ? Fmt.time(c.left) : ''; },
  cTimePct: (s, id) => { const c = Contracts.find(s, id); return c ? c.left / c.time : 0; },
  cStock: (s, id) => {
    const c = Contracts.find(s, id); if (!c) return '';
    const have = c.loaded ? c.qty : Math.min(s.stock[c.flavor] || 0, c.qty);
    return `${Fmt.int(have)} / ${Fmt.int(c.qty)} bt`;
  },
  cStockPct: (s, id) => { const c = Contracts.find(s, id); return !c ? 0 : c.loaded ? 1 : (s.stock[c.flavor] || 0) / c.qty; },
  cStatus: (s, id) => {
    const c = Contracts.find(s, id); if (!c) return '';
    const where = c.place === 'mairie' ? '🏛️ la Mairie' : `${clientByPlace(c.place).icon} ${clientByPlace(c.place).name}`;
    if (c.loaded === 'player') return `📦 Dans tes bras : va à ${where}`;
    if (c.loaded === 'npc') return '🚚 Un livreur est en route';
    if (Contracts.canLoad(s, c)) return c.qty > Eco.capacity(s) - Eco.carriedQty(s)
      ? '🛞 Trop lourd pour toi : un livreur ou un plus gros véhicule'
      : '✅ Prête : charge-la au quai 📦 de l’usine';
    return '⏳ Pas encore assez de bouteilles';
  },

  /* --- Agence --- */
  houseCost: (s, t) => Fmt.money(Eco.nextHouseCost(s, typeById(t))),
  cantHouse: (s, t) => Eco.freePlot(s) < 0 || s.money < Eco.nextHouseCost(s, typeById(t)),
  plotsTxt: s => `${Eco.plotsAvail(s) - s.houses.length} / ${Eco.plotsAvail(s)}`,
  useTotal: (s, u) => `${Fmt.num(u === 'rent' ? Eco.rent(s) : Eco.houseTotal(s, u))} ${CONFIG.houses.uses[u].unit}`,
  cantReno: (s, id) => { const h = RealEstate.find(s, id); return !h || h.lvl >= CONFIG.houses.maxLevel || s.money < Eco.renoCost(h); },

  /* --- Garage --- */
  cantVehicle: s => { const v = Garage.next(s); return !v || s.money < v.cost; },
  cantCourier: s => s.couriers >= CONFIG.couriers.max || s.rep < CONFIG.couriers.rep || s.money < Eco.courierCost(s),
  courierTxt: s => `${s.couriers} / ${CONFIG.couriers.max}`,
  courierCost: s => (s.couriers >= CONFIG.couriers.max ? 'complet' : Fmt.money(Eco.courierCost(s))),
  courierBusy: s => {
    const busy = s.npcs.filter(n => n.state !== 'idle').length;
    return s.couriers ? `${busy} en tournée, ${s.couriers - busy} au quai` : 'Personne pour l’instant';
  },

  /* --- Labo --- */
  laboPrev: s => {
    const { a, b } = Form.labo;
    if (!CONFIG.flavors[a] || !CONFIG.flavors[b] || a === b) return 'Choisis deux parfums différents';
    const p = Recipes.preview(a, b);
    return `${Fmt.money(p.price)} / bt · ${Fmt.num(p.sugar)} kg sucre + ${Fmt.num(p.fruit)} kg fruits · cuisson ×${Fmt.num(p.time)}`;
  },
  laboErr: s => Recipes.check(s, Form.labo),
  laboCost: s => (s.recipes.length >= CONFIG.recipes.max ? 'Labo plein' : Fmt.money(Eco.recipeCost(s))),
  cantLabo: s => !!Recipes.check(s, Form.labo) || s.money < Eco.recipeCost(s),

  /* --- Mairie --- */
  stat: (s, k) => ({
    earned: () => Fmt.money(s.stats.earned), run: () => Fmt.money(s.run.earned),
    bottles: () => Fmt.int(s.stats.bottles), sold: () => Fmt.int(s.stats.sold),
    done: () => s.stats.cDone, fail: () => s.stats.cFail, picked: () => s.stats.picked, play: () => Fmt.time(s.stats.playSec),
  })[k](),
  cantDistrict: (s, id) => s.districts[id] || s.rep < CONFIG.districts[id].rep || s.money < CONFIG.districts[id].cost,
  cantClaim: s => !s.quest.ready,
  pGain: s => Eco.prestigeGain(s),
  pPct: s => s.run.earned / CONFIG.prestige.minRunEarned,
  cantPrestige: s => !Prestige.can(s),
};
