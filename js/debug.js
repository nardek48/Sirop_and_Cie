/**
 * debug.js — outils de test pour le développeur (F2, ou #debug dans l'adresse).
 * Permet de tester une idée en 10 secondes au lieu de 10 minutes.
 */
import { CONFIG } from './config.js';
import { Game, rt } from './core/game.js';
import { Store } from './core/store.js';
import { Events } from './sim/events.js';
import { Contracts } from './sim/contracts.js';
import { Quests } from './sim/quests.js';
import { Sim } from './sim/sim.js';
import { UI } from './ui/ui.js';
import { World } from './world/world.js';
import { VERSION } from './version.js';
import { Tuto } from './tutorial/tutorial.js';

const TOOLS = {
  money1k:   ['+1 K $',          s => { s.money += 1e3; }],
  money100k: ['+100 K $',        s => { s.money += 1e5; }],
  money10m:  ['+10 M $',         s => { s.money += 1e7; }],
  rep:       ['+10 ⭐',          s => { s.rep += 10; }],
  stock:     ['Stock plein',     s => { for (const k of s.unlocked) s.stock[k] = (s.stock[k] || 0) + 200; }],
  mats:      ['+1000 matières',  s => { s.mat.sugar += 1000; s.mat.fruit += 1000; }],
  ripe:      ['Tout est mûr',    s => { for (const a of Object.values(s.fields)) a.fill(0); }],
  offer:     ['Nouvelle offre',  s => Contracts.generate(s)],
  event:     ['Événement',       s => { const ids = Object.keys(CONFIG.events.list); const i = (ids.indexOf(s.event.id) + 1) % ids.length; if (s.event.id) Events.end(s); Events.start(s, ids[i]); }],
  night:     ['+3 h',            s => { s.clock = (s.clock + CONFIG.clock.daySec / 8) % CONFIG.clock.daySec; }],
  quest:     ['Quête réussie',   s => { if (Quests.current(s)) s.quest.ready = true; }],
  districts: ['Tout ouvrir',     s => { s.districts.champs = s.districts.colline = true; }],
  home:      ['Retour usine',    () => World.resetPlayer()],
  hour:      ['Avancer 1 h',     s => Sim.advance(s, 3600)],
  tuto:      ['Tuto : recommencer', () => Tuto.start()],
  tutoNext:  ['Tuto : étape suivante', () => Tuto.next()],
  opened:    ['Ouvrir bâtiments', s => { for (const k of Object.keys(s.opened)) s.opened[k] = true; }],
  tips:      ['Revoir conseils', s => { s.seen = {}; }],
};

export const Debug = {
  el: null,

  init() {
    window.addEventListener('keydown', e => { if (e.code === 'F2') { e.preventDefault(); this.toggle(); } });
    if (location.hash === '#debug') this.toggle();
  },

  toggle() {
    if (!this.el) this.build();
    this.el.hidden = !this.el.hidden;
  },

  build() {
    const el = document.createElement('aside');
    el.className = 'debug';
    el.hidden = true;
    el.innerHTML = `
      <div class="split"><b>🛠 Debug</b><button type="button" class="btn ghost sm" data-dbg="close">✕</button></div>
      <div class="dbg-grid">${Object.entries(TOOLS).map(([k, [l]]) => `<button type="button" class="btn ghost sm" data-dbg="${k}">${l}</button>`).join('')}</div>
      <div class="dbg-row">Vitesse du temps
        ${[1, 10, 50].map(v => `<button type="button" class="btn ghost sm" data-speed="${v}">×${v}</button>`).join('')}</div>
      <label class="dbg-row"><input type="checkbox" id="dbg-solids"> Afficher collisions et zones</label>
      <div class="dbg-row"><button type="button" class="btn danger sm" data-dbg="wipe">Effacer la sauvegarde</button></div>
      <pre class="dbg-info" id="dbg-info"></pre>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.speed) { rt.timeScale = Number(b.dataset.speed); this.refreshSpeed(); return; }
      const k = b.dataset.dbg;
      if (k === 'close') { el.hidden = true; return; }
      if (k === 'wipe') { Store.wipe(); Game.s = Store.fresh(); Sim.seed(Game.s); World.resetPlayer(); Tuto.propose(); return; }
      TOOLS[k][1](Game.s);
      UI.key = null; UI.render(Game.s);
    });
    el.querySelector('#dbg-solids').addEventListener('change', e => { World.debug.solids = e.target.checked; });
    document.querySelector('.world-wrap').append(el);
    this.el = el;
    this.refreshSpeed();
    setInterval(() => this.info(), 250);
  },

  refreshSpeed() {
    for (const b of this.el.querySelectorAll('[data-speed]')) b.classList.toggle('on', Number(b.dataset.speed) === rt.timeScale);
  },

  info() {
    if (!this.el || this.el.hidden) return;
    const s = Game.s, p = s.player;
    this.el.querySelector('#dbg-info').textContent =
      `${VERSION} · fps ${World.fps.toFixed(0)} · x ${p.x | 0} y ${p.y | 0}\n` +
      `quête ${s.quest.i + 1} ${s.quest.ready ? '(prête)' : ''} · événement ${s.event.id || '—'} (${s.event.id ? s.event.left | 0 : s.event.next | 0} s)\n` +
      `livreurs ${s.npcs.map(n => n.state).join(', ') || '—'}\n` +
      `tuto ${s.tuto.active ? `étape ${s.tuto.step + 1}` : s.tuto.done ? 'fini' : 'pas commencé'} · ouverts ${Object.keys(s.opened).filter(k => s.opened[k]).join(', ') || '—'}`;
  },
};
