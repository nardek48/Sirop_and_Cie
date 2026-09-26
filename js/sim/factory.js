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
    Bus.toast(`Nouveau parfum : ${CONFIG.flavors[fl].name} !`, 'ok');
    Bus.sfx('unlock');
  },
  select(s, fl) { if (s.unlocked.includes(fl)) s.flavor = fl; },

  buyRestock(s) {
    if (s.auto.restock || !Wallet.spend(s, CONFIG.restock.cost)) return;
    s.auto.restock = true;
    Bus.toast('Réapprovisionnement automatique activé', 'ok');
  },

  /** Rachète ~60 s de consommation quand le stock passe sous 30 % de la cible. */
  autoRestock(s) {
    const f = Flavors.get(s, s.flavor), rate = Eco.cookRate(s), R = CONFIG.restock;
    for (const m of ['sugar', 'fruit']) {
      if (!f[m]) continue;
      const target = Math.max(R.minBatch, f[m] * rate * R.secondsOfStock);
      if (s.mat[m] >= target * R.trigger) continue;
      const qty = Math.ceil(target - s.mat[m]), cost = qty * CONFIG.materials[m].price;
      if (s.money >= cost) { s.money -= cost; s.mat[m] += qty; }
    }
  },

  step(s, dt) {
    const f = Flavors.get(s, s.flavor);
    // La cuve ne contient qu'un parfum : on attend qu'elle soit vide pour changer.
    if (s.bulk < 1e-6) { s.bulk = 0; s.bulkFlavor = s.flavor; }

    // 1. Cuisson — limitée par la vitesse, la place en cuve et les matières
    const cookCap = Eco.cookRate(s) * dt;
    let cook = 0, limit = '';
    if (s.bulkFlavor === s.flavor) {
      const byTank = Eco.tankCap(s) - s.bulk;
      const byMat = Math.min(s.mat.sugar / f.sugar, f.fruit ? s.mat.fruit / f.fruit : Infinity);
      cook = Math.max(0, Math.min(cookCap, byTank, byMat));
      if (cook < cookCap * 0.98 && byMat <= byTank) limit = 'mat';
    } else limit = 'switch';
    s.mat.sugar -= cook * f.sugar;
    s.mat.fruit -= cook * f.fruit;
    s.bulk += cook;

    // 2. Embouteillage — limité par la vitesse, le vrac et la place en entrepôt
    const botCap = Eco.bottleRate(s) * dt;
    const byWare = Math.max(0, Eco.wareCap(s) - Eco.totalStock(s));
    const bot = Math.min(botCap, s.bulk, byWare);
    s.bulk -= bot;
    s.stock[s.bulkFlavor] = (s.stock[s.bulkFlavor] || 0) + bot;
    s.stats.bottles += bot;

    rt.flow.cook = cook / dt;
    rt.flow.bottle = bot / dt;

    // Goulot affiché, de l'aval vers l'amont (un entrepôt plein bloque tout)
    const wareFull = Eco.totalStock(s) >= Eco.wareCap(s) * 0.98;
    const tankFull = s.bulk >= Eco.tankCap(s) * 0.98;
    rt.bneck = wareFull ? 'ware'
      : limit ? limit
      : tankFull ? 'bottle'
      : Eco.cookRate(s) < Eco.bottleRate(s) ? 'cook' : 'bottle';
  },
};
