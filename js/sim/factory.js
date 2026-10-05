/**
 * factory.js — chaîne : matières → cuisson → cuve tampon → embouteillage → entrepôt.
 */
import { CONFIG } from '../config.js';
import { rt } from '../core/game.js';
import { Bus } from '../core/bus.js';
import { Flavors } from './flavors.js';
import { Eco } from './eco.js';
import { Wallet } from './wallet.js';

export const Factory = {
  buyMaterial(s, mat, qty) { if (Wallet.spend(s, qty * CONFIG.materials[mat].price)) s.mat[mat] += qty; },
  upgrade(s, k) { if (Wallet.spend(s, Eco.lvCost(s, k))) s.lv[k]++; },

  unlock(s, fl) {
    if (s.unlocked.includes(fl) || !Wallet.spend(s, CONFIG.flavors[fl].unlock)) return;
    s.unlocked.push(fl);
    s.flavor = fl;
    const M = CONFIG.materials[fl];
    Bus.toast(`Nouveau parfum : ${CONFIG.flavors[fl].name} ! Son fruit : ${M.icon} ${M.name.toLowerCase()} (à l’usine, ou à planter dans un champ)`, 'ok');
    Bus.sfx('unlock');
  },
  /** Choisir le parfum d'une ligne (0 = ligne 1) */
  select(s, fl, line = 0) {
    if (!s.unlocked.includes(fl) && !s.recipes.some(r => r.id === fl)) return;
    const L = Eco.lines(s)[line];
    if (L) L.flavor = fl;
  },

  nextLineCost: s => (Eco.lineCount(s) < CONFIG.lines.max ? CONFIG.lines.costs[Eco.lineCount(s)] : null),
  /** Acheter une ligne : elle démarre sur un parfum que les autres lignes ne font pas */
  buyLine(s) {
    const cost = this.nextLineCost(s);
    if (cost == null || !Wallet.spend(s, cost)) return false;
    const used = Eco.lines(s).map(L => L.flavor);
    const fl = [...s.unlocked].reverse().find(f => !used.includes(f)) || s.flavor;
    s.lines.push({ flavor: fl, bulk: 0, bulkFlavor: fl });
    Bus.toast(`🏭 Ligne ${Eco.lineCount(s)} ouverte : elle cuit du ${Flavors.get(s, fl).name} ! Change son parfum au tableau noir.`, 'ok');
    Bus.sfx('unlock');
    return true;
  },

  buyRestock(s) {
    if (s.auto.restock || !Wallet.spend(s, CONFIG.restock.cost)) return;
    s.auto.restock = true;
    Bus.toast('Réapprovisionnement automatique activé', 'ok');
  },

  /** Rachète ~60 s de consommation quand le stock passe sous 30 % de la cible. */
  autoRestock(s) {
    const R = CONFIG.restock;
    for (const [m, perSec] of Object.entries(Eco.matDemand(s))) {
      if (!perSec) continue;
      const target = Math.max(R.minBatch, perSec * R.secondsOfStock);
      if (s.mat[m] >= target * R.trigger) continue;
      const qty = Math.ceil(target - s.mat[m]), cost = qty * CONFIG.materials[m].price;
      if (s.money >= cost) { s.money -= cost; s.mat[m] += qty; }
    }
  },

  /**
   * Un pas pour toutes les lignes. Chaque ligne : cuisson → sa cuve → embouteillage.
   * Les matières et l'entrepôt sont communs (la ligne 1 se sert en premier).
   */
  step(s, dt) {
    const lines = Eco.lines(s);
    let cookSum = 0, botSum = 0;
    rt.lineFlow = []; rt.bnecks = [];
    lines.forEach((L, i) => {
      const r = this.stepLine(s, L, dt);
      cookSum += r.cook; botSum += r.bot;
      rt.lineFlow[i] = { cook: r.cook / dt, bottle: r.bot / dt };
      rt.bnecks[i] = r.bneck;
    });
    rt.flow.cook = cookSum / dt;
    rt.flow.bottle = botSum / dt;
    rt.bneck = rt.bnecks[0];
  },

  /** @returns {{cook:number, bot:number, bneck:string}} */
  stepLine(s, L, dt) {
    // La cuve ne contient qu'un parfum : on attend qu'elle soit vide pour changer.
    if (L.bulk < 1e-6) { L.bulk = 0; L.bulkFlavor = L.flavor; }

    // 1. Cuisson — limitée par la vitesse, la place en cuve et les matières (sucre + fruit(s) du parfum)
    const need = Flavors.needs(s, L.flavor);
    const cookCap = Eco.cookRateOf(s, L.flavor) * dt;
    let cook = 0, limit = '';
    if (L.bulkFlavor === L.flavor) {
      const byTank = Eco.tankCap(s) - L.bulk;
      const byMat = Math.min(...Object.entries(need).map(([m, q]) => (q ? Math.max(0, s.mat[m] || 0) / q : Infinity)));
      cook = Math.max(0, Math.min(cookCap, byTank, byMat));
      if (cook < cookCap * 0.98 && byMat <= byTank) limit = 'mat';
    } else limit = 'switch';
    for (const [m, q] of Object.entries(need)) s.mat[m] = (s.mat[m] || 0) - cook * q;
    L.bulk += cook;

    // 2. Embouteillage — limité par la vitesse, le vrac et la place en entrepôt (commune)
    const botCap = Eco.bottleRateLine(s) * dt;
    const byWare = Math.max(0, Eco.wareCap(s) - Eco.totalStock(s));
    const bot = Math.min(botCap, L.bulk, byWare);
    L.bulk -= bot;
    s.stock[L.bulkFlavor] = (s.stock[L.bulkFlavor] || 0) + bot;
    s.stats.bottles += bot;

    // Goulot affiché, de l'aval vers l'amont (un entrepôt plein bloque tout)
    const wareFull = Eco.totalStock(s) >= Eco.wareCap(s) * 0.98;
    const tankFull = L.bulk >= Eco.tankCap(s) * 0.98;
    const bneck = wareFull ? 'ware'
      : limit ? limit
      : tankFull ? 'bottle'
      : Eco.cookRateOf(s, L.flavor) < Eco.bottleRateLine(s) ? 'cook' : 'bottle';
    return { cook, bot, bneck };
  },
};
