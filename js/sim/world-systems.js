/**
 * world-systems.js — systèmes liés au territoire : récoltes, quartiers,
 * immobilier, véhicules, recettes secrètes.
 */
import { CONFIG, typeById } from '../config.js';
import { Bus } from '../core/bus.js';
import { Eco } from './eco.js';
import { Wallet } from './wallet.js';
import { Events } from './events.js';

/* ---------- Récoltes à la main (verger, bois de sureau, canne à sucre) ---------- */
export const Fields = {
  open: (s, g) => { const d = CONFIG.fields[g].district; return !d || s.districts[d]; },

  /**
   * @param {string} who 'player' | 'pet'
   * @returns {boolean} true si la récolte a eu lieu
   */
  pick(s, g, i, pos, who = 'player') {
    const F = CONFIG.fields[g], arr = s.fields[g];
    if (!this.open(s, g)) return false;
    if (arr[i] > 0) {
      if (who === 'player') Bus.toast(`Pas encore mûr… encore ${Math.ceil(arr[i])} s`);
      return false;
    }
    s.mat[F.mat] += F.yield;
    arr[i] = F.regrow;
    s.stats.picked++;
    Bus.float(`+${F.yield} kg ${F.mat === 'sugar' ? '🧂' : F.icon}`, pos, F.mat === 'sugar' ? '#fff3c4' : '#ffd0d6');
    Bus.sfx('pick');
    return true;
  },

  step(s, dt) {
    const k = Events.regrowFactor(s) * dt;
    for (const arr of Object.values(s.fields))
      for (let i = 0; i < arr.length; i++) if (arr[i] > 0) arr[i] = Math.max(0, arr[i] - k);
  },
};

/* ---------- Quartiers à débloquer ---------- */
export const Districts = {
  unlock(s, id) {
    const d = CONFIG.districts[id];
    if (s.districts[id]) return;
    if (s.rep < d.rep) return Bus.toast(`Il faut ⭐ ${d.rep} pour ouvrir ${d.name}`, 'bad');
    if (!Wallet.spend(s, d.cost)) return;
    s.districts[id] = true;
    Bus.toast(`${d.icon} ${d.name} est ouvert ! ${d.desc}`, 'ok');
    Bus.sfx('unlock');
  },
};

/* ---------- Immobilier : maisons sur les terrains du village ---------- */
export const RealEstate = {
  find: (s, id) => s.houses.find(h => h.id === Number(id)),
  buy(s, typeId, use) {
    const plot = Eco.freePlot(s);
    if (plot < 0) return Bus.toast('Plus aucun terrain libre dans le village', 'bad');
    const t = typeById(typeId);
    if (!Wallet.spend(s, Eco.nextHouseCost(s, t))) return;
    s.houses.push({ id: s.nextId++, type: typeId, use, lvl: 1, plot });
    Bus.toast(`${t.icon} ${t.name} construite sur le terrain ${plot + 1} !`, 'ok');
  },
  renovate(s, id) {
    const h = this.find(s, id);
    if (!h || h.lvl >= CONFIG.houses.maxLevel) return;
    if (Wallet.spend(s, Eco.renoCost(h))) h.lvl++;
  },
  sell(s, id) {
    const h = this.find(s, id);
    if (!h) return;
    s.money += Eco.sellValue(h);
    s.houses = s.houses.filter(x => x !== h);
  },
  step(s, dt) {
    const r = Eco.rent(s);
    if (r > 0) Wallet.earn(s, r * dt);
    s.mat.fruit += Eco.orchard(s) * dt;
  },
};

/* ---------- Garage : véhicules du joueur ---------- */
export const Garage = {
  next: s => CONFIG.vehicles[s.vehicle + 1] || null,
  buy(s) {
    const v = this.next(s);
    if (!v || !Wallet.spend(s, v.cost)) return;
    s.vehicle++;
    Bus.toast(`${v.icon} ${v.name} : ${v.cap} bouteilles, et ça roule !`, 'ok');
    Bus.sfx('unlock');
  },
};

/* ---------- Labo : recettes secrètes (mélange de deux parfums) ---------- */
export const Recipes = {
  /** Caractéristiques d'un mélange A + B */
  preview(a, b) {
    const A = CONFIG.flavors[a], B = CONFIG.flavors[b];
    return {
      price: Math.round((A.price + B.price) * CONFIG.recipes.priceBonus * 10) / 10,
      sugar: Math.round(((A.sugar + B.sugar) / 2 + 0.2) * 10) / 10,
      fruit: Math.round(((A.fruit + B.fruit) / 2 + 0.3) * 10) / 10,
      time: Math.round(Math.max(A.time, B.time) * 1.1 * 10) / 10,
    };
  },

  /** @returns {string} message d'erreur, ou '' si la recette est possible */
  check(s, { a, b, name }) {
    if (s.recipes.length >= CONFIG.recipes.max) return 'Le labo est plein : 4 recettes maximum';
    if (!s.unlocked.includes(a) || !s.unlocked.includes(b)) return 'Débloque d’abord ces deux parfums à l’usine';
    if (a === b) return 'Choisis deux parfums différents';
    if (s.recipes.some(r => (r.a === a && r.b === b) || (r.a === b && r.b === a))) return 'Ce mélange existe déjà';
    if (!name.trim()) return 'Donne un nom à ta recette';
    return '';
  },

  create(s, form) {
    const err = this.check(s, form);
    if (err) { Bus.toast(err, 'bad'); return false; }
    if (!Wallet.spend(s, Eco.recipeCost(s))) return false;
    const id = 'r' + s.nextId++;
    s.recipes.push({ id, name: form.name.trim().slice(0, 18), color: form.color, a: form.a, b: form.b, recipe: true, ...this.preview(form.a, form.b) });
    s.unlocked.push(id);
    s.stock[id] = 0;
    Bus.toast(`✨ Nouvelle recette secrète : ${form.name.trim()} !`, 'ok');
    Bus.sfx('unlock');
    return true;
  },
};
