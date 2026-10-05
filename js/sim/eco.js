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

  /** « Bien reposé » (dormir dans sa maison) : production accélérée */
  restMult: s => (s.rested > 0 ? 1 + CONFIG.home.restBonus : 1),
  /* Lignes de production : la ligne 1 est l'état lui-même (s.flavor, s.bulk, s.bulkFlavor) */
  lines: s => [s, ...(s.lines || [])],
  lineCount: s => 1 + (s.lines ? s.lines.length : 0),
  /** Cuisson d'UNE ligne pour un parfum donné (bt/s) */
  cookRateOf: (s, fl) => Eco.lvValue(s, 'cook') * Eco.mult(s) * Eco.restMult(s) / (Flavors.get(s, fl) || { time: 1 }).time,
  /** Embouteillage d'UNE ligne (bt/s) */
  bottleRateLine: s => Eco.lvValue(s, 'bottle') * Eco.mult(s) * Eco.restMult(s),
  /** Totaux, toutes lignes */
  cookRate: s => Eco.lines(s).reduce((a, L) => a + Eco.cookRateOf(s, L.flavor), 0),
  bottleRate: s => Eco.bottleRateLine(s) * Eco.lineCount(s),
  /** Consommation de matières de toutes les lignes, à pleine vitesse : { matière: kg/s } */
  matDemand(s) {
    const d = {};
    for (const L of Eco.lines(s)) {
      const r = Eco.cookRateOf(s, L.flavor);
      for (const [m, q] of Object.entries(Flavors.needs(s, L.flavor))) d[m] = (d[m] || 0) + q * r;
    }
    return d;
  },
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

  /** Véhicule utilisé : celui choisi au garage de la maison (s.ride), sinon le meilleur acheté */
  rideIdx: s => (s.ride == null ? s.vehicle : Math.max(0, Math.min(s.ride, s.vehicle))),
  vehicle: s => CONFIG.vehicles[Eco.rideIdx(s)],
  /** Production réelle possible (bouteilles/s) : le plus lent de la cuisson et de l'embouteillage */
  prodRate: s => Math.min(Eco.cookRate(s), Eco.bottleRate(s)),
  /** Production d'UNE ligne : la taille des commandes et des véhicules suit celle-ci
   *  (une commande = un parfum = une ligne ; plus de lignes = plus de commandes en même temps) */
  lineProdRate: s => Eco.prodRate(s) / Eco.lineCount(s),
  /** Capacité d'un véhicule : au moins `cap`, sinon `capSec` secondes de production */
  capacityOf: (s, v) => Math.max(v.cap, Math.round(Eco.lineProdRate(s) * v.capSec)),
  capacity: s => Eco.capacityOf(s, Eco.vehicle(s)),
  speed: s => Eco.vehicle(s).speed,

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
