/**
 * quests.js — le fil de quêtes du maire. Une quête à la fois ;
 * la récompense se récupère en allant voir le maire (porte de la mairie).
 *
 * Les quêtes sont des DONNÉES : { goal, n, arg?, reward, text }.
 *  - goal   : un type d'objectif de GOALS (livrer, récolter, débloquer un parfum…)
 *  - n      : combien (quantité, niveau, argent…) ; 1 pour les objectifs « oui / non »
 *  - arg    : précision si le type en demande une (quel parfum, quel client…)
 *  - reward : récompense en $
 *  - text   : ce que dit le maire (auto-généré si vide)
 *
 * D'où viennent les quêtes, du plus fort au plus faible :
 *  1. s.quests : la liste modifiée dans l'éditeur de quêtes (gardée dans la partie) ;
 *  2. assets/quests.json : le fichier publié avec le jeu (chargé au démarrage) ;
 *  3. DEFAULT_QUESTS ci-dessous.
 */
import { CONFIG } from '../config.js';
import { Bus } from '../core/bus.js';
import { Fmt } from '../core/format.js';
import { Wallet } from './wallet.js';

/* ------------------------------------------------------------------
 * Types d'objectifs. val(s, arg) donne la progression ; réussi quand val ≥ n.
 * args : liste des précisions possibles [{ id, name }] (ou fonction qui la construit).
 * once : objectif « oui / non » (n vaut toujours 1).
 * money : n est une somme d'argent (affichage en $).
 * ------------------------------------------------------------------ */
const flavorArgs = () => Object.entries(CONFIG.flavors).filter(([, f]) => f.unlock > 0).map(([id, f]) => ({ id, name: f.name }));
const levelArgs = () => Object.entries(CONFIG.levels).map(([id, l]) => ({ id, name: `${l.icon} ${l.name}` }));
const clientArgs = () => CONFIG.contracts.clients.map(c => ({ id: c.place, name: `${c.icon} ${c.name}` }));
const vehicleArgs = () => CONFIG.vehicles.slice(1).map((v, i) => ({ id: String(i + 1), name: `${v.icon} ${v.name}` }));
const districtArgs = () => Object.entries(CONFIG.districts).map(([id, d]) => ({ id, name: `${d.icon} ${d.name}` }));
const argName = (list, id) => (list().find(a => a.id === id) || {}).name || '?';
/** « 🚂 Train Express » → « Train Express » (pour les phrases) */
const plain = str => str.replace(/^\P{L}+/u, '');
const plural = (n, one, many) => (n > 1 ? many : one);

export const GOALS = {
  accept:    { icon: '📜', name: 'Accepter un contrat', once: true,
    text: () => 'Accepte un contrat au bureau des contrats',
    val: s => (s.active.length || s.stats.cDone ? 1 : 0) },
  deliver:   { icon: '📦', name: 'Livrer des commandes',
    text: n => (n === 1 ? 'Livre ta première commande' : `Livre ${Fmt.int(n)} commandes`),
    val: s => s.stats.cDone },
  deliverTo: { icon: '🚚', name: 'Livrer un client', args: clientArgs,
    text: (n, a) => `Livre ${Fmt.int(n)} ${plural(n, 'commande', 'commandes')} à ${plain(argName(clientArgs, a))}`,
    val: (s, a) => s.stats.byClient[a] || 0 },
  pick:      { icon: '🌳', name: 'Récolter',
    text: n => `Récolte ${Fmt.int(n)} ${plural(n, 'fois', 'fois')} au verger ou aux champs`,
    val: s => s.stats.picked },
  level:     { icon: '🔧', name: 'Améliorer une machine', args: levelArgs, level: true,
    text: (n, a) => `Monte ${plain(argName(levelArgs, a))} de l’usine au niveau ${Fmt.int(n)}`,
    val: (s, a) => s.lv[a] || 0 },
  flavor:    { icon: '🍬', name: 'Débloquer un parfum', args: flavorArgs, once: true,
    text: (n, a) => `Débloque le parfum ${argName(flavorArgs, a)}`,
    val: (s, a) => (s.unlocked.includes(a) ? 1 : 0) },
  vehicle:   { icon: '🚲', name: 'Acheter un véhicule', args: vehicleArgs, once: true,
    text: (n, a) => `Achète ${a === '1' ? 'un' : 'une'} ${plain(argName(vehicleArgs, a)).toLowerCase()} au garage`,
    val: (s, a) => (s.vehicle >= Number(a) ? 1 : 0) },
  houses:    { icon: '🏡', name: 'Construire des maisons',
    text: n => (n === 1 ? 'Construis ta première maison' : `Construis ${Fmt.int(n)} maisons`),
    val: s => s.houses.length },
  rep:       { icon: '⭐', name: 'Réputation',
    text: n => `Atteins ${Fmt.int(n)} ${plural(n, 'étoile', 'étoiles')} de réputation`,
    val: s => s.rep },
  district:  { icon: '🗺️', name: 'Ouvrir un quartier', args: districtArgs, once: true,
    text: (n, a) => `Ouvre ${plain(argName(districtArgs, a))}`,
    val: (s, a) => (s.districts[a] ? 1 : 0) },
  farm:      { icon: '🌱', name: 'Avoir des champs',
    text: n => `Achète ton ${Fmt.int(n)}${n === 1 ? 'er' : 'e'} champ`,
    val: s => s.farm.owned },
  lines:     { icon: '🏭', name: 'Lignes de production',
    text: n => `Ouvre ${Fmt.int(n)} lignes de production à l’usine`,
    val: s => 1 + (s.lines ? s.lines.length : 0) },
  recipes:   { icon: '🧪', name: 'Inventer des recettes',
    text: n => (n === 1 ? 'Invente une recette secrète au labo' : `Invente ${Fmt.int(n)} recettes secrètes au labo`),
    val: s => s.recipes.length },
  couriers:  { icon: '🛵', name: 'Embaucher des livreurs',
    text: n => (n === 1 ? 'Embauche un livreur' : `Embauche ${Fmt.int(n)} livreurs`),
    val: s => s.couriers },
  bottles:   { icon: '🍾', name: 'Produire des bouteilles',
    text: n => `Produis ${Fmt.int(n)} bouteilles`,
    val: s => s.stats.bottles },
  sold:      { icon: '🛎️', name: 'Vendre au comptoir',
    text: n => `Vends ${Fmt.int(n)} bouteilles au comptoir`,
    val: s => s.stats.sold },
  money:     { icon: '💰', name: 'Avoir de l’argent en caisse', money: true,
    text: n => `Aie ${Fmt.money(n)} en caisse`,
    val: s => s.money },
  earn:      { icon: '🏦', name: 'Gagner de l’argent', money: true,
    text: n => `Gagne ${Fmt.money(n)} avec ton entreprise`,
    val: s => s.run.earned },
  sleep:     { icon: '😴', name: 'Dormir dans sa maison',
    text: n => (n === 1 ? 'Dors une nuit dans ta maison 🏠' : `Dors ${Fmt.int(n)} nuits dans ta maison 🏠`),
    val: s => s.stats.sleeps || 0 },
  stars:     { icon: '✨', name: 'Étoiles de prestige',
    text: n => `Obtiens ${Fmt.int(n)} ${plural(n, 'étoile', 'étoiles')} en revendant l’entreprise`,
    val: s => s.stars },
};

/** Les 15 quêtes d'origine (v0.0.3) */
export const DEFAULT_QUESTS = [
  { goal: 'accept', n: 1, reward: 30 },
  { goal: 'deliver', n: 1, reward: 50 },
  { goal: 'pick', n: 3, reward: 40, text: 'Récolte 3 fois au verger' },
  { goal: 'level', arg: 'cook', n: 2, reward: 60, text: 'Améliore la cuisson de l’usine' },
  { goal: 'flavor', arg: 'grenadine', n: 1, reward: 120, text: 'Débloque la Grenadine' },
  { goal: 'vehicle', arg: '1', n: 1, reward: 200 },
  { goal: 'houses', n: 1, reward: 300 },
  { goal: 'rep', n: 10, reward: 400 },
  { goal: 'farm', n: 3, reward: 600 },
  { goal: 'recipes', n: 1, reward: 1000 },
  { goal: 'couriers', n: 1, reward: 1500 },
  { goal: 'deliver', n: 25, reward: 3000 },
  { goal: 'district', arg: 'colline', n: 1, reward: 8000, text: 'Ouvre la Colline' },
  { goal: 'deliverTo', arg: 'gare', n: 3, reward: 20000, text: 'Livre 3 commandes au Train Express' },
  { goal: 'earn', n: 1e8, reward: 1000000, text: 'Gagne 100 M $ avec ton entreprise' },
];

export const MAX_QUESTS = 60;
const MAX_N = 1e15;

/** Texte automatique d'une quête */
export const autoText = q => { const g = GOALS[q.goal]; return g ? g.text(q.n, q.arg) : ''; };

/**
 * Nettoie une quête venue d'un fichier ou de l'éditeur.
 * @returns {object|null} la quête corrigée, ou null si elle est inutilisable
 */
export function cleanQuest(q) {
  if (!q || typeof q !== 'object') return null;
  // v0.5.0 : « Ouvre les Champs » n'existe plus, les champs s'achètent un par un
  if (q.goal === 'district' && q.arg === 'champs') q = { ...q, goal: 'farm', n: 3, arg: undefined, text: q.text === 'Ouvre les Champs' ? '' : q.text };
  const g = GOALS[q.goal];
  if (!g) return null;
  const out = { goal: q.goal };
  if (g.args) {
    const ids = g.args().map(a => a.id);
    out.arg = ids.includes(String(q.arg)) ? String(q.arg) : ids[0];
  }
  const n = Math.floor(Number(q.n));
  out.n = g.once ? 1 : Math.min(MAX_N, Math.max(1, Number.isFinite(n) ? n : 1));
  const r = Math.floor(Number(q.reward));
  out.reward = Math.min(MAX_N, Math.max(0, Number.isFinite(r) ? r : 0));
  const text = String(q.text ?? '').replace(/[<>]/g, '').trim().slice(0, 90);
  out.text = text || autoText(out);
  return out;
}

/** @returns {object[]} liste propre (quêtes invalides retirées) */
export const cleanList = list => (Array.isArray(list) ? list : []).map(cleanQuest).filter(Boolean).slice(0, MAX_QUESTS);

/** Fichier assets/quests.json */
export const QUEST_FILE = { game: 'sirop-et-cie', type: 'quests', format: 1 };
export const questsToFile = list => JSON.stringify({ ...QUEST_FILE, quests: list }, null, 1);
/** @returns {object[]|null} */
export function questsFromFile(text) {
  try {
    const data = typeof text === 'string' ? JSON.parse(text) : text;
    const list = cleanList(Array.isArray(data) ? data : data && data.quests);
    return list.length ? list : null;
  } catch (e) { return null; }
}

export const Quests = {
  base: cleanList(DEFAULT_QUESTS),   // remplacée par assets/quests.json s'il est présent
  rev: 0,                            // change à chaque modification (pour redessiner la mairie)

  /** Charge assets/quests.json (navigateur) */
  async loadFile(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const list = questsFromFile(await res.text());
      if (list) { this.base = list; this.rev++; }
    } catch (e) { /* fichier absent : quêtes par défaut */ }
  },

  /** Les quêtes de cette partie (données brutes) */
  list: s => s.quests || Quests.base,
  count(s) { return this.list(s).length; },

  current(s) {
    const q = this.list(s)[s.quest.i];
    return q ? { text: q.text, goal: q.n, reward: q.reward, val: st => GOALS[q.goal].val(st, q.arg) } : null;
  },

  progress(s) {
    const q = this.current(s);
    if (!q) return { cur: 1, goal: 1 };
    return { cur: Math.min(q.goal, Math.max(0, q.val(s))), goal: q.goal };
  },

  step(s) {
    const q = this.current(s);
    if (!q || s.quest.ready || q.val(s) < q.goal) return;
    s.quest.ready = true;
    Bus.toast(`🎁 Quête réussie : ${q.text}. Va voir le maire !`, 'ok');
    Bus.sfx('quest');
  },

  /** @returns {boolean} true si une récompense a été donnée */
  claim(s) {
    const q = this.current(s);
    if (!q || !s.quest.ready) return false;
    Wallet.earn(s, q.reward);
    Bus.float(`+${Fmt.money(q.reward)} 🎁`, 'mairie', '#ffe28a');
    Bus.toast(`Le maire te remercie : +${Fmt.money(q.reward)}`, 'ok');
    Bus.sfx('coin');
    s.quest.i++;
    s.quest.ready = false;
    return true;
  },
};
