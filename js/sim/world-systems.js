/**
 * world-systems.js — systèmes liés au territoire : récoltes, quartiers,
 * immobilier, véhicules, recettes secrètes.
 */
import { CONFIG, typeById } from '../config.js';
import { Bus } from '../core/bus.js';
import { Eco } from './eco.js';
import { Wallet } from './wallet.js';
import { Events } from './events.js';
import { Clock } from './clock.js';
import { Flavors } from './flavors.js';
import { Research } from './research.js';
import { Fmt } from '../core/format.js';

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
    const mat = F.mat === 'auto' ? Flavors.mainFruit(s, s.flavor) : F.mat;
    const n = Math.round(F.yield * Research.yieldK(s));       // « Engrais » : +50 %
    s.mat[mat] = (s.mat[mat] || 0) + n;
    arr[i] = F.regrow;
    s.stats.picked++;
    Bus.float(`+${n} kg ${CONFIG.materials[mat].icon}`, pos, mat === 'sugar' ? '#fff3c4' : '#ffd0d6');
    Bus.sfx('pick');
    return true;
  },

  step(s, dt) {
    const k = Events.regrowFactor(s) * Research.growK(s) * dt;   // « Pousse rapide » : ×2
    for (const arr of Object.values(s.fields))
      for (let i = 0; i < arr.length; i++) if (arr[i] > 0) arr[i] = Math.max(0, arr[i] - k);
  },
};

/* ---------- Champs à cultiver ---------- */
export const Farm = {
  crop: (s, i) => CONFIG.farm.crops[s.farm.crop[i]],
  owns: (s, i) => i < s.farm.owned,
  ripe: (s, i) => i < s.farm.owned && s.farm.t[i] <= 0,
  /** Prix du prochain champ (null s'ils sont tous à toi) */
  nextCost: s => (s.farm.owned < CONFIG.farm.count ? CONFIG.farm.costs[s.farm.owned] : null),

  /** Récolte normale : au moins `yield` kg, sinon quelques secondes de consommation de l'usine */
  yieldOf(s, i) {
    const C = this.crop(s, i);
    const need = C.mat === 'sugar' ? Flavors.get(s, s.flavor).sugar : CONFIG.flavors[C.mat].fruit;
    return Math.round(Math.max(C.yield, Eco.cookRate(s) * need * C.prodSec) * Research.yieldK(s));   // « Engrais » : +50 %
  },
  /** Plante disponible ? (les fruits arrivent avec leur parfum) */
  cropOpen: (s, crop) => { const C = CONFIG.farm.crops[crop]; return !!C && (!C.flavor || s.unlocked.includes(C.flavor)); },

  buy(s) {
    const cost = this.nextCost(s);
    if (cost == null || !Wallet.spend(s, cost)) return false;
    const i = s.farm.owned++;
    s.farm.t[i] = this.crop(s, i).grow; s.farm.wait[i] = 0;
    Bus.toast(`🌱 Champ ${i + 1} à toi ! Choisis ce que tu veux y planter.`, 'ok');
    Bus.sfx('unlock');
    return true;
  },

  plant(s, i, crop) {
    const C = CONFIG.farm.crops[crop];
    if (!C || !this.cropOpen(s, crop) || !this.owns(s, i) || s.farm.crop[i] === crop) return false;
    s.farm.crop[i] = crop; s.farm.t[i] = C.grow; s.farm.wait[i] = 0;
    Bus.toast(`${C.icon} Champ ${i + 1} : on plante ${C.name.toLowerCase()} !`, 'ok');
    Bus.sfx('pick');
    return true;
  },

  /** Récolte à la main (joueur ou compagnon) : double */
  harvest(s, i, pos, who = 'player') {
    if (!this.owns(s, i)) return false;
    if (s.farm.t[i] > 0) {
      if (who === 'player') Bus.toast(`Pas encore mûr… encore ${Math.ceil(s.farm.t[i])} s`);
      return false;
    }
    const C = this.crop(s, i), n = this.yieldOf(s, i) * CONFIG.farm.handMult;
    s.mat[C.mat] += n;
    s.farm.t[i] = C.grow; s.farm.wait[i] = 0;
    s.stats.picked++;
    Bus.float(`+${Fmt.int(n)} kg ${CONFIG.materials[C.mat].icon} ×${CONFIG.farm.handMult}`, pos, C.mat === 'sugar' ? '#fff3c4' : '#c8f7c5');
    Bus.sfx('pick');
    return true;
  },

  /** Pousse ; un champ mûr oublié est ramassé tout seul (récolte normale) et se replante */
  step(s, dt) {
    const k = Events.regrowFactor(s) * Research.growK(s) * dt, F = s.farm;
    for (let i = 0; i < F.owned; i++) {
      if (F.t[i] > 0) { F.t[i] = Math.max(0, F.t[i] - k); continue; }
      F.wait[i] += dt;
      if (F.wait[i] < CONFIG.farm.autoSec) continue;
      const C = this.crop(s, i);
      s.mat[C.mat] += this.yieldOf(s, i);
      F.t[i] = C.grow; F.wait[i] = 0;
    }
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
    const o = Eco.orchard(s);
    if (o > 0) { const m = Flavors.mainFruit(s, s.flavor); s.mat[m] = (s.mat[m] || 0) + o * dt; }
  },
};

/* ---------- Garage : véhicules du joueur ---------- */
export const Garage = {
  next: s => CONFIG.vehicles[s.vehicle + 1] || null,
  buy(s) {
    const v = this.next(s);
    if (!v || !Wallet.spend(s, v.cost)) return;
    s.vehicle++;
    s.ride = null;                       // on monte tout de suite dans le nouveau
    Bus.toast(`${v.icon} ${v.name} : ${Eco.capacity(s)} bouteilles, et ça roule !`, 'ok');
    Bus.sfx('unlock');
  },
  /** Prendre un véhicule déjà acheté (0 = à pied) */
  ride(s, i) {
    if (!(i >= 0 && i <= s.vehicle)) return false;
    s.ride = i === s.vehicle ? null : i;
    const v = Eco.vehicle(s);
    Bus.toast(i === 0 ? '👟 Tu pars à pied !' : `${v.icon} Tu prends : ${v.name.toLowerCase()} (${Eco.capacity(s)} bouteilles)`, 'ok');
    Bus.sfx('click');
    return true;
  },
};

/* ---------- Ta maison : dormir la nuit ---------- */
export const Home = {
  canSleep: s => Clock.isNight(s),
  /** Minutes de jeu avant la nuit (pour le dire au joueur) */
  untilNight(s) {
    const h = Clock.hour(s), wait = (20 - h + 24) % 24;
    return Math.ceil(wait / 24 * CONFIG.clock.daySec / 60);
  },
  /** Dormir : on saute au matin et on se réveille « Bien reposé » */
  sleep(s) {
    if (!this.canSleep(s)) return false;
    const C = CONFIG.clock, H = CONFIG.home;
    s.clock = (((H.wakeHour - C.startHour + 24) % 24) / 24) * C.daySec;
    s.rested = H.restSec;
    s.stats.sleeps = (s.stats.sleeps || 0) + 1;
    Bus.toast(`☀️ Bonjour ! Bien reposé : production +${Math.round(H.restBonus * 100)} % pendant ${Math.round(H.restSec / 60)} min`, 'ok');
    Bus.sfx('quest');
    return true;
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
    if (s.recipes.length >= Research.recipeMax(s)) return `Le labo est plein : ${Research.recipeMax(s)} recettes maximum`;
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
