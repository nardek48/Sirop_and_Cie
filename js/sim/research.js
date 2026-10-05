/**
 * research.js — l'arbre du Labo : des améliorations permanentes (gardées au prestige).
 * On paie un fruit, il mûrit pendant un temps (même hors ligne), puis son effet marche pour toujours.
 * Un seul fruit à la fois ; le fruit du dessus d'une branche demande celui du dessous.
 * État : s.research = { done: [ids], cur: id|null, left: secondes }
 */
import { CONFIG } from '../config.js';
import { Bus } from '../core/bus.js';
import { Fmt } from '../core/format.js';

const R = CONFIG.research;
export const fruitById = id => R.fruits.find(f => f.id === id);
/** Fruit d'en dessous dans la même branche (null pour le premier) */
export const prevFruit = f => R.fruits.find(g => g.b === f.b && g.tier === f.tier - 1) || null;

export const Research = {
  has: (s, id) => !!(s.research && s.research.done.includes(id)),

  /** 'done' | 'growing' | 'open' (on peut le lancer) | 'locked' | 'soon' (pas encore dans le jeu) */
  state(s, f) {
    const r = s.research;
    if (r.done.includes(f.id)) return 'done';
    if (r.cur === f.id) return 'growing';
    if (f.soon) return 'soon';
    const p = prevFruit(f);
    return !p || r.done.includes(p.id) ? 'open' : 'locked';
  },

  /** Pourquoi on ne peut pas lancer ce fruit (texte), ou '' si c'est possible */
  why(s, f) {
    const st = this.state(s, f);
    if (st === 'done') return 'Déjà mûr';
    if (st === 'soon') return 'Bientôt dans le jeu';
    if (st === 'locked') { const p = prevFruit(f); return `D’abord : ${p.icon} ${p.name}`; }
    if (s.research.cur) { const c = fruitById(s.research.cur); return `Un fruit mûrit déjà : ${c.icon} ${c.name}`; }
    if (s.money < f.cost) return `Il manque ${Fmt.money(f.cost - s.money)}`;
    return '';
  },

  start(s, id) {
    const f = fruitById(id);
    if (!f || this.why(s, f)) return false;
    s.money -= f.cost;
    s.research.cur = f.id; s.research.left = f.sec;
    Bus.toast(`${f.icon} ${f.name} commence à mûrir (${Fmt.time(f.sec)})`, 'ok');
    return true;
  },

  /** 0..1 : avancement du fruit qui mûrit */
  progress(s) {
    const r = s.research, f = r.cur && fruitById(r.cur);
    return f ? 1 - r.left / f.sec : 0;
  },

  step(s, dt) {
    const r = s.research;
    if (!r.cur) return;
    r.left -= dt;
    if (r.left > 0) return;
    const f = fruitById(r.cur);
    r.done.push(r.cur); r.cur = null; r.left = 0;
    if (f) { Bus.toast(`${f.icon} ${f.name} est mûr ! ${f.what}`, 'ok'); Bus.sfx('pick'); }
  },

  /* ---- Effets (multiplicateurs lus par l'économie) ---- */
  cookK: s => (Research.has(s, 'u1') ? 1.5 : 1),
  bottleK: s => (Research.has(s, 'u2') ? 1.5 : 1),
  yieldK: s => (Research.has(s, 'n1') ? 1.5 : 1),
  growK: s => (Research.has(s, 'n2') ? 2 : 1),
  speedK: s => (Research.has(s, 'l1') ? 1.3 : 1),
  carryK: s => (Research.has(s, 'l2') ? 1.5 : 1),
  recipeK: s => (Research.has(s, 'r1') ? 1.25 : 1),
  recipeMax: s => CONFIG.recipes.max + (Research.has(s, 'r2') ? 1 : 0),
};
