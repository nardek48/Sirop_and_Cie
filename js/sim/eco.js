/**
 * eco.js — valeurs dérivées de l'état (fonctions pures).
 */
import { CONFIG, typeById } from '../config.js';
import { Flavors } from './flavors.js';
import { Clock } from './clock.js';
import { Events } from './events.js';

const H = CONFIG.houses;

export const Eco = {
  mult: s => 1 + s.stars * CONFIG.prestige.bonusPerStar,
  lvValue: (s, k) => {
    const L = CONFIG.levels[k], n = s.lv[k] - 1;
    if (!L.step) return L.base * L.growth ** n;
    return L.base * (1 + L.step * n) * CONFIG.milestone.mult ** Math.floor(n / CONFIG.milestone.every);
  },
  lvCost: (s, k) => Math.ceil(CONFIG.levels[k].cost * CONFIG.levels[k].costGrowth ** (s.lv[k] - 1)),

  houseEffect: h => H.uses[h.use].base * typeById(h.type).mult * (1 + H.renoBonus * (h.lvl - 1)),
  houseTotal: (s, use) => s.houses.filter(h => h.use === use).reduce((a, h) => a + Eco.houseEffect(h), 0),

  cookRate: s => Eco.lvValue(s, 'cook') * Eco.mult(s) / Flavors.get(s, s.flavor).time,
  bottleRate: s => Eco.lvValue(s, 'bottle') * Eco.mult(s),
  tankCap: s => Eco.lvValue(s, 'tank'),
  wareCap: s => Eco.lvValue(s, 'ware') + Eco.houseTotal(s, 'storage'),
  counterRate: s => (Eco.lvValue(s, 'counter') + Eco.houseTotal(s, 'shop')) * Clock.counterFactor(s) * Events.counterFactor(s),
  rent: s => Eco.houseTotal(s, 'rent') * Eco.mult(s),
  orchard: s => Eco.houseTotal(s, 'orchard'),

  sellPrice: (s, fl, factor = 1) => Flavors.get(s, fl).price * factor * Eco.mult(s),
  totalStock: s => Object.values(s.stock).reduce((a, b) => a + b, 0),
  /** Bouteilles réservées : contrats acceptés pas encore chargés */
  reserved: (s, fl) => s.active.filter(c => c.flavor === fl && !c.loaded).reduce((a, c) => a + c.qty, 0),
  carried: s => s.active.filter(c => c.loaded === 'player'),
  carriedQty: s => Eco.carried(s).reduce((a, c) => a + c.qty, 0),

  vehicle: s => CONFIG.vehicles[s.vehicle],
  /** Production réelle possible (bouteilles/s) : le plus lent de la cuisson et de l'embouteillage */
  prodRate: s => Math.min(Eco.cookRate(s), Eco.bottleRate(s)),
  /** Capacité d'un véhicule : au moins `cap`, sinon `capSec` secondes de production */
  capacityOf: (s, v) => Math.max(v.cap, Math.round(Eco.prodRate(s) * v.capSec)),
  capacity: s => Eco.capacityOf(s, CONFIG.vehicles[s.vehicle]),
  speed: s => CONFIG.vehicles[s.vehicle].speed,

  clientOpen: (s, c) => s.rep >= c.rep && (!c.district || s.districts[c.district]),

  plotsAvail: s => H.plots + (s.districts.colline ? H.collinePlots : 0),
  freePlot: s => { for (let i = 0; i < Eco.plotsAvail(s); i++) if (!s.houses.some(h => h.plot === i)) return i; return -1; },
  nextHouseCost: (s, t) => Math.ceil(t.cost * H.costGrowth ** s.houses.length),
  renoCost: h => Math.ceil(typeById(h.type).cost * H.renoRatio * H.renoGrowth ** (h.lvl - 1)),
  sellValue: h => Math.floor(typeById(h.type).cost * H.sellRatio * (1 + 0.3 * (h.lvl - 1))),

  slotCost: s => Math.ceil(CONFIG.contracts.slotCost * CONFIG.contracts.slotCostGrowth ** (s.slots - CONFIG.contracts.slotBase)),
  courierCost: s => Math.ceil(CONFIG.couriers.cost * CONFIG.couriers.costGrowth ** s.couriers),
  recipeCost: s => Math.ceil(CONFIG.recipes.cost * CONFIG.recipes.costGrowth ** s.recipes.length),
  prestigeGain: s => {
    const P = CONFIG.prestige;
    if (s.run.earned < P.minRunEarned) return 0;
    return Math.floor(P.base + P.perDecade * Math.log10(s.run.earned / P.minRunEarned));
  },
};
