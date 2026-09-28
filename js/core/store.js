/**
 * store.js — état initial, sauvegarde localStorage versionnée, migration.
 */
import { CONFIG, SHIRTS } from '../config.js';

const zeros = n => Array(n).fill(0);

export const Store = {
  KEY: 'siropcie_save_v3',

  /** @returns {object} un état de départ neuf */
  fresh() {
    const F = CONFIG.fields;
    return {
      version: CONFIG.version,
      money: CONFIG.startMoney, rep: 0, stars: 0,
      mat: { ...CONFIG.startMaterials },
      flavor: 'menthe', unlocked: ['menthe'], recipes: [],
      bulk: 0, bulkFlavor: 'menthe',
      stock: Object.fromEntries(Object.keys(CONFIG.flavors).map(k => [k, 0])),
      lv: Object.fromEntries(Object.keys(CONFIG.levels).map(k => [k, 1])),
      slots: CONFIG.contracts.slotBase,
      auto: { restock: false },
      counterOn: true,
      offers: [], active: [], nextOfferIn: 8, nextId: 1,
      couriers: 0, npcs: [],
      vehicle: 0,
      districts: { champs: false, colline: false },
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
    for (const k of ['mat', 'stock', 'lv', 'auto', 'stats', 'run', 'player', 'look', 'districts', 'quest', 'event', 'tuto', 'opened', 'seen'])
      out[k] = { ...base[k], ...(data[k] || {}) };
    // Partie commencée avant le tutoriel (v0.1.0) : tout est déjà ouvert, pas de tutoriel imposé
    if (!data.tuto) {
      out.tuto.done = true;
      for (const b of Object.keys(out.opened)) { out.opened[b] = true; out.seen['open_' + b] = true; }
    }
    out.stats.byClient = { ...(data.stats && data.stats.byClient) };
    out.fields = { ...base.fields };
    for (const [k, arr] of Object.entries(data.fields || {}))
      if (Array.isArray(arr) && arr.length === base.fields[k]?.length) out.fields[k] = arr;
    for (const r of out.recipes) if (out.stock[r.id] == null) out.stock[r.id] = 0;
    while (out.npcs.length < out.couriers) out.npcs.push({ state: 'idle', cid: null, dest: null, t: 0, dur: 0 });
    out.version = CONFIG.version;
    return out;
  },

  save(s) {
    try { s.lastSeen = Date.now(); localStorage.setItem(this.KEY, JSON.stringify(s)); return true; }
    catch (e) { return false; }
  },
  wipe() { try { localStorage.removeItem(this.KEY); } catch (e) { /* stockage indisponible */ } },
};
