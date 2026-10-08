/**
 * store.js — état initial, sauvegarde localStorage versionnée, migration.
 */
import { CONFIG, SHIRTS } from '../config.js';
import { cleanList } from '../sim/quests.js';

const zeros = n => Array(n).fill(0);

export const Store = {
  KEY: 'siropcie_save_v3',

  /** @returns {object} un état de départ neuf */
  fresh() {
    const F = CONFIG.fields;
    return {
      version: CONFIG.version,
      money: CONFIG.startMoney, rep: 0, stars: 0,
      mat: { ...Object.fromEntries(Object.keys(CONFIG.materials).map(k => [k, 0])), ...CONFIG.startMaterials },
      flavor: 'menthe', unlocked: ['menthe'], recipes: [],
      bulk: 0, bulkFlavor: 'menthe',       // ligne 1 (s.flavor, s.bulk, s.bulkFlavor)
      lines: [],                           // lignes 2 et 3 : { flavor, bulk, bulkFlavor }
      stock: Object.fromEntries(Object.keys(CONFIG.flavors).map(k => [k, 0])),
      lv: Object.fromEntries(Object.keys(CONFIG.levels).map(k => [k, 1])),
      slots: CONFIG.contracts.slotBase,
      auto: { restock: false },
      counterOn: true,
      offers: [], active: [], nextOfferIn: 8, nextId: 1,
      couriers: 0, npcs: [],
      vehicle: 0,
      districts: { colline: false },
      // Champs à cultiver : combien sont à toi, ce qui y pousse, temps avant d'être mûr, attente une fois mûr
      farm: {
        owned: CONFIG.farm.free,
        crop: Array.from({ length: CONFIG.farm.count }, (_, i) => (i % 2 ? 'canne' : 'menthe')),
        t: Array.from({ length: CONFIG.farm.count }, (_, i) => CONFIG.farm.crops[i % 2 ? 'canne' : 'menthe'].grow),
        wait: zeros(CONFIG.farm.count),
      },
      houses: [],
      fields: Object.fromEntries(Object.entries(F).map(([k, f]) => [k, zeros(f.count)])),
      quest: { i: 0, ready: false },
      event: { id: null, left: 0, next: CONFIG.events.firstIn },
      clock: CONFIG.clock.startSec,
      player: { x: 800, y: CONFIG.roadY },
      look: { name: 'Sirotin', shirt: SHIRTS[0], pet: 'chien', petName: 'Caramel' },
      stats: { earned: 0, bottles: 0, sold: 0, cDone: 0, cFail: 0, cQuit: 0, picked: 0, playSec: 0, byClient: {} },
      run: { earned: 0 },
      // Tutoriel : active = en cours, step = étape, done = terminé ou passé
      tuto: { active: false, step: 0, done: false, skipped: false },
      opened: { garage: false, agence: false, labo: false },   // bâtiments ouverts
      seen: {},                                                // conseils de Mémé déjà montrés
      tipsOn: true,
      decor: null,          // décor modifié au Mode architecte (null = celui du fichier Tiled)
      quests: null,         // quêtes du maire modifiées dans l'éditeur (null = celles du fichier)
      ride: null,           // véhicule choisi au garage de la maison (null = le meilleur acheté)
      rested: 0,            // secondes de « Bien reposé » restantes (dormir dans sa maison)
      research: { done: [], cur: null, left: 0 },   // arbre du Labo (gardé au prestige)
      train: { trips: 0, best: 0, readyAt: 0 },      // voyages en train (mini-jeu) : nombre, record d'étoiles, prochain voyage payé
      home: {               // décoration de ta maison (voir world/home.js)
        wall: 'creme', floor: 'bois',
        deco: { mur: 'tableau', coin: 'plante', salon: 'canape', tapis: 'rouge', couette: 'bleu' },
      },
      lastSeen: Date.now(),
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? this.migrate(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  },

  /** Fusionne une sauvegarde sur l'état par défaut (tolère les champs ajoutés). */
  migrate(data) {
    const base = this.fresh();
    const out = { ...base, ...data };
    for (const k of ['mat', 'stock', 'lv', 'auto', 'stats', 'run', 'player', 'look', 'districts', 'quest', 'event', 'tuto', 'opened', 'seen', 'train'])
      out[k] = { ...base[k], ...(data[k] || {}) };
    // Partie commencée avant le tutoriel (v0.1.0) : tout est déjà ouvert, pas de tutoriel imposé
    if (!data.tuto) {
      out.tuto.done = true;
      for (const b of Object.keys(out.opened)) { out.opened[b] = true; out.seen['open_' + b] = true; }
    }
    out.stats.byClient = { ...(data.stats && data.stats.byClient) };
    out.farm = this.migrateFarm(base.farm, data);
    // Lignes 2 et 3 : parfum connu, cuve valide
    const okFl = fl => !!CONFIG.flavors[fl] || (out.recipes || []).some(r => r && r.id === fl);
    out.lines = (Array.isArray(data.lines) ? data.lines : []).slice(0, CONFIG.lines.max - 1)
      .filter(l => l && typeof l === 'object')
      .map(l => ({ flavor: okFl(l.flavor) ? l.flavor : out.flavor, bulk: Math.max(0, Number(l.bulk) || 0), bulkFlavor: okFl(l.bulkFlavor) ? l.bulkFlavor : out.flavor }));
    // v0.6.0 : les « fruits & plantes » deviennent le fruit du parfum en production
    if (data.mat && Number.isFinite(data.mat.fruit)) {
      out.mat = { ...Object.fromEntries(Object.keys(CONFIG.materials).map(k => [k, 0])), ...data.mat };
      const fl = out.flavor, rec = (data.recipes || []).find(r => r && r.id === fl);
      const to = CONFIG.materials[fl] ? fl : rec && CONFIG.materials[rec.a] ? rec.a : 'menthe';
      out.mat[to] = (out.mat[to] || 0) + data.mat.fruit;
    }
    delete out.mat.fruit;
    for (const k of Object.keys(out.mat)) if (!CONFIG.materials[k] || !Number.isFinite(out.mat[k])) delete out.mat[k];
    for (const k of Object.keys(CONFIG.materials)) if (!Number.isFinite(out.mat[k])) out.mat[k] = 0;
    out.farm.crop = out.farm.crop.map(c => (CONFIG.farm.crops[c] ? c : 'menthe'));
    // Arbre du Labo : fruits connus seulement
    { const r = data.research || {}, ok = id => CONFIG.research.fruits.some(f => f.id === id && !f.soon);
      const done = (Array.isArray(r.done) ? r.done : []).filter(ok);
      out.research = { done: [...new Set(done)], cur: ok(r.cur) && !done.includes(r.cur) ? r.cur : null, left: Math.max(0, Number(r.left) || 0) }; }
    out.home = { ...base.home, ...(data.home || {}), deco: { ...base.home.deco, ...((data.home && data.home.deco) || {}) } };
    out.fields = { ...base.fields };
    for (const [k, arr] of Object.entries(data.fields || {}))
      if (Array.isArray(arr) && arr.length === base.fields[k]?.length) out.fields[k] = arr;
    for (const r of out.recipes) if (out.stock[r.id] == null) out.stock[r.id] = 0;
    out.quests = Array.isArray(data.quests) ? cleanList(data.quests) : null;
    while (out.npcs.length < out.couriers) out.npcs.push({ state: 'idle', cid: null, dest: null, t: 0, dur: 0 });
    out.version = CONFIG.version;
    return out;
  },

  /** Champs : nettoie, et convertit les parties d'avant la v0.5.0 (Champs achetés = 8 champs) */
  migrateFarm(base, data) {
    const F = CONFIG.farm, d = data.farm;
    if (!d || typeof d !== 'object') {
      const out = { ...base, crop: [...base.crop], t: [...base.t], wait: [...base.wait] };
      if (data.districts && data.districts.champs) { out.owned = F.count; out.crop = Array(F.count).fill('canne'); out.t.fill(0); }
      return out;
    }
    const arr = (a, def) => Array.from({ length: F.count }, (_, i) => (Array.isArray(a) && a[i] != null ? a[i] : def[i]));
    const out = {
      owned: Math.max(F.free, Math.min(F.count, Math.floor(Number(d.owned) || F.free))),
      crop: arr(d.crop, base.crop).map((c, i) => (F.crops[c] ? c : base.crop[i])),
      t: arr(d.t, base.t).map(v => Math.max(0, Number(v) || 0)),
      wait: arr(d.wait, base.wait).map(v => Math.max(0, Number(v) || 0)),
    };
    return out;
  },

  save(s) {
    try { s.lastSeen = Date.now(); localStorage.setItem(this.KEY, JSON.stringify(s)); return true; }
    catch (e) { return false; }
  },
  wipe() { try { localStorage.removeItem(this.KEY); } catch (e) { /* stockage indisponible */ } },

  /* ---------------- Fichier de sauvegarde (exporter / importer) ---------------- */

  BACKUP_KEY: 'siropcie_save_backup',
  FILE_TAG: 'sirop-et-cie',

  /**
   * Contenu du fichier exporté : une enveloppe reconnaissable + la partie.
   * @param {object} s état du jeu
   * @param {string} gameVersion ex. 'v0.3.0'
   */
  toFile(s, gameVersion) {
    return JSON.stringify({
      game: this.FILE_TAG, format: 1, gameVersion,
      date: new Date().toISOString(),
      save: { ...s, lastSeen: Date.now() },
    });
  },

  /**
   * Lit un fichier de sauvegarde. Accepte l'enveloppe ou un état brut.
   * @returns {{ok:true, save:object, date:?string, gameVersion:?string} | {ok:false, error:string}}
   */
  fromFile(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'Ce fichier n’est pas une sauvegarde (il est illisible).' }; }
    if (!data || typeof data !== 'object') return { ok: false, error: 'Ce fichier n’est pas une sauvegarde.' };
    const wrapped = data.game === this.FILE_TAG;
    const raw = wrapped ? data.save : data;
    const looksLikeSave = raw && typeof raw === 'object'
      && Number.isFinite(raw.money) && raw.lv && typeof raw.lv === 'object' && Array.isArray(raw.unlocked);
    if (!looksLikeSave) return { ok: false, error: 'Ce fichier n’est pas une sauvegarde de Sirop & Cie.' };
    try {
      const save = this.sanitize(this.migrate(raw));
      save.lastSeen = Date.now();          // pas de rattrapage « hors ligne » depuis la date du fichier
      return { ok: true, save, date: wrapped ? data.date : null, gameVersion: wrapped ? data.gameVersion : null };
    } catch (e) {
      return { ok: false, error: 'Cette sauvegarde est abîmée : impossible de la charger.' };
    }
  },

  /** Un fichier vient de l'extérieur : les textes affichés dans les panneaux ne doivent pas contenir de HTML */
  sanitize(s) {
    const txt = (v, max) => String(v ?? '').replace(/[<>&"']/g, '').slice(0, max);
    const color = v => (/^#[0-9a-f]{3,8}$/i.test(v) ? v : '#c2453a');
    s.look.name = txt(s.look.name, 14) || 'Sirotin';
    s.look.petName = txt(s.look.petName, 14);
    s.look.shirt = color(s.look.shirt);
    s.recipes = (Array.isArray(s.recipes) ? s.recipes : []).filter(r => r && typeof r === 'object')
      .map(r => ({ ...r, id: txt(r.id, 24), name: txt(r.name, 18) || 'Recette', color: color(r.color) }));
    for (const r of s.recipes) if (s.stock[r.id] == null) s.stock[r.id] = 0;
    if (!Number.isFinite(s.money)) s.money = 0;
    return s;
  },

  /** Garde la partie actuelle de côté avant un import (pour pouvoir revenir en arrière) */
  backup(s) {
    try { localStorage.setItem(this.BACKUP_KEY, JSON.stringify({ date: Date.now(), save: s })); this._bk = true; return true; }
    catch (e) { return false; }
  },
  /** Une partie de côté existe-t-elle ? (mis en cache : appelé à chaque image par la mairie) */
  hasBackup() {
    if (this._bk === undefined) { try { this._bk = !!localStorage.getItem(this.BACKUP_KEY); } catch (e) { this._bk = false; } }
    return this._bk;
  },
  /** @returns {{date:number, save:object}|null} */
  getBackup() {
    try { const raw = localStorage.getItem(this.BACKUP_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  },
  dropBackup() { try { localStorage.removeItem(this.BACKUP_KEY); } catch (e) { /* */ } this._bk = false; },
};
