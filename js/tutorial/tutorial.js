/**
 * tutorial.js — le moteur du tutoriel de Mémé Grenadine.
 *
 * Proposé (jamais imposé) au début d'une nouvelle partie, et rejouable à la mairie.
 * Pendant le tutoriel :
 *  - le temps du village est en pause (voir Sim.step) ;
 *  - seule l'interaction de l'étape est possible (plus Mémé) ;
 *  - un repère, un anneau et une main montrent quoi faire ;
 *  - l'étape est sauvegardée (s.tuto.step) : on reprend où on en était.
 *
 * Le monde ne connaît pas le tutoriel : il passe par World.hooks.
 */
import { CONFIG } from '../config.js';
import { Game } from '../core/game.js';
import { Bus } from '../core/bus.js';
import { Eco } from '../sim/eco.js';
import { Sim } from '../sim/sim.js';
import { UI } from '../ui/ui.js';
import { MAP } from '../world/map.js';
import { World } from '../world/world.js';
import { Meme } from '../world/meme.js';
import { STEPS } from './steps.js';
import { Overlay } from './overlay.js';
import { Tips } from './tips.js';

const T0 = CONFIG.tuto;
const ICONS = { usine: '🏭', contrats: '📜', quai: '📦', epicerie: '🏪' };
const EXIT = '.sheet-head [data-act="closePanel"]';
// Arbres du verger, du plus proche de la route au plus loin (index de MAP.fields.verger)
const TREES = [6, 3, 0, 7, 4, 1, 8, 5, 2];

export const Tuto = {
  stepT: 0,        // secondes passées sur l'étape
  idle: 0,         // secondes sans toucher au clavier, à la souris ou à l'écran
  callT: 0,        // prochain appel de Mémé
  mark: {},        // valeurs notées au début de l'étape
  tree: 6,         // arbre à cueillir
  panel: null,     // menu ouvert (UI.active)
  showing: false,

  init() {
    Overlay.init();
    Tips.init();
    World.hooks.filter = (L, s) => this.filter(L, s);
    World.hooks.guide = s => this.guide(s);
    World.hooks.memeSpot = s => this.spot(s);
    World.hooks.talk = () => this.talk();
    World.hooks.after = (dt, s) => this.frame(dt, s);
    for (const ev of ['keydown', 'pointerdown']) window.addEventListener(ev, () => { this.idle = 0; }, true);
  },

  cur: s => STEPS[s.tuto.step],
  contract: s => s.active.find(c => c.tuto),

  /* ---------------- Début, étapes, fin ---------------- */

  /** Fenêtre de bienvenue d'une nouvelle partie */
  propose() {
    UI.modal(`
      <div class="tuto-intro" aria-hidden="true">👵</div>
      <h2>Bienvenue à Sirop-sur-Mer !</h2>
      <p>Je suis <b>Mémé Grenadine</b>. Veux-tu que je te montre comment marche ta fabrique ? Ça prend 3 minutes.</p>`,
    [{ label: 'Non merci, je sais jouer', run: () => this.decline() },
     { label: 'Oui, montre-moi !', primary: true, run: () => this.start() }]);
  },

  decline() {
    const s = Game.s;
    s.tuto.done = true; s.tuto.skipped = true;
    UI.modal(`
      <h2>Alors, bonne chance !</h2>
      <ul>
        <li><b>Flèches</b> ou <b>ZQSD</b> pour marcher, <b>E</b> pour agir</li>
        <li>Ou clique sur un bâtiment : ton personnage y va tout seul</li>
        <li>Les missions du maire sont en haut à gauche</li>
        <li>Je serai sur le banc du parc 🪑, et tu peux revoir le tutoriel à la mairie 🏛️</li>
      </ul>`, [{ label: 'C’est parti !', primary: true }]);
  },

  start(s = Game.s) {
    UI.close();
    s.tuto.active = true; s.tuto.step = 0; s.tuto.skipped = false;
    s.offers = [];              // seule la commande de Mémé sera proposée
    this.enter(s);
  },

  /** Prépare l'étape en cours (rejouable : sert aussi à la reprise après rechargement) */
  enter(s = Game.s) {
    const st = this.cur(s);
    this.stepT = 0; this.idle = 0; this.callT = T0.callAfter;
    this.mark = { picked: s.stats.picked, cook: s.lv.cook };
    if (st.enter) st.enter(s, this);
    if (st.say) Meme.talk(st.say);
    Overlay.lastSel = null;
  },

  next(s = Game.s) {
    if (!s.tuto.active) return;
    s.tuto.step++;
    if (s.tuto.step >= STEPS.length) return this.finish(s, false);
    Bus.sfx('click');
    this.enter(s);
  },

  /** @param {boolean} skipped true si le joueur a passé le tutoriel */
  finish(s, skipped) {
    s.tuto.active = false; s.tuto.done = true; s.tuto.skipped = skipped; s.tuto.step = 0;
    // La commande d'entraînement disparaît (ses bouteilles reviennent au stock)
    const c = this.contract(s);
    if (c) { if (c.loaded) s.stock[c.flavor] += c.qty; s.active = s.active.filter(x => x !== c); }
    s.offers = s.offers.filter(o => !o.tuto);
    if (!s.offers.length) Sim.seed(s);
    s.nextOfferIn = Math.min(s.nextOfferIn, 8);
    this.hideUI();
    Tips.cool = 25;             // laisser respirer avant le premier conseil
    if (!skipped) {
      Meme.talk('À bientôt, mon petit !', 5);
      UI.toast('👵 Mémé : « Bravo ! La fabrique est à toi ! »', 'ok');
      Bus.sfx('quest');
    }
  },

  skip() {
    UI.confirm('Passer le tutoriel ? Tu pourras le revoir à la mairie 🏛️.', () => this.finish(Game.s, true), 'Passer');
  },

  /** Bouton « Compris ! », « Suivant »… */
  button() { if (Game.s.tuto.active) this.next(); },

  /** « Je suis perdu » : la main revient, et on emmène le joueur devant la cible */
  lost() {
    const s = Game.s;
    if (!s.tuto.active) return;
    this.idle = 0; this.stepT = 0; Overlay.lastSel = null;
    const f = this.focusOf(s);
    if (!f || !f.world) return;
    UI.close();
    const w = f.world.stand;
    World.teleport(w.x, w.y);
    Meme.talk('Te voilà ! C’est ici.');
  },

  /** Le joueur parle à Mémé */
  talk() {
    const s = Game.s;
    if (s.tuto.active) {
      const st = this.cur(s);
      if (st.id === 'bonjour') return this.next(s);
      Meme.talk(st.say || 'Suis la flèche !');
      this.idle = 0; this.stepT = 0;     // remontre la main
      return;
    }
    if (!s.tuto.done) return this.propose();
    Tips.advice();
  },

  /* ---------------- Préparations des étapes ---------------- */

  /** Choisit l'arbre à cueillir ; s'il n'y en a aucun de mûr, Mémé en fait mûrir un */
  pickTree(s) {
    const V = s.fields.verger;
    let i = TREES.find(k => V[k] <= 0);
    if (i === undefined) { i = TREES[0]; V[i] = 0; }
    this.tree = i;
  },

  /** Crée la commande de Mémé pour l'épicerie (avec les bouteilles mises de côté) */
  ensureOffer(s) {
    if (this.contract(s) || s.offers.some(o => o.tuto)) return;
    const fl = s.flavor, need = T0.qty + Eco.reserved(s, fl);
    if ((s.stock[fl] || 0) < need) s.stock[fl] = need;
    s.offers.unshift({
      id: s.nextId++, place: 'epicerie', client: 'Épicerie du coin', icon: '🏪', flavor: fl, qty: T0.qty,
      reward: T0.reward, time: 600, repGain: 1, ttl: 1e9, special: true, tuto: true,
    });
  },

  /* ---------------- Branchements du monde ---------------- */

  /** Où se tient Mémé */
  spot(s) {
    const S = T0.spots;
    if (s.tuto.active) return S[this.cur(s).meme];
    return s.tuto.done ? S.banc : S.usine;
  },

  /** Pendant le tutoriel, seules l'interaction de l'étape et Mémé restent possibles */
  filter(L, s) {
    if (!s.tuto.active) return L;
    const w = this.cur(s).world;
    return L.filter(i => i.id === 'meme' || i.id === w || (w === 'tree' && i.id.startsWith('verger')));
  },

  /** Point du village visé par l'étape : repère au-dessus, position où se tenir */
  point(s, w) {
    if (w === 'meme') return { x: Meme.x, y: Meme.y, icon: '👵', ring: { x: Meme.x, y: Meme.y - 34 }, stand: { x: Meme.x + 50, y: Meme.y } };
    if (w === 'tree') {
      const t = MAP.fields.verger[this.tree];
      // y décalé : le repère se pose juste au-dessus du feuillage, pas sur la route
      return { x: t.x, y: t.y + 70, icon: '🌳', ring: { x: t.x, y: t.y - 30 }, stand: { x: t.x, y: t.y + 30 } };
    }
    const d = CONFIG.places[w];
    return { x: d.x, y: d.y, icon: ICONS[w] || '⭐', ring: { x: d.x, y: d.y - 24 }, stand: { x: d.x, y: d.y + 14 } };
  },

  /**
   * Ce qu'il faut montrer maintenant :
   * { sel } un élément de l'interface, { world } un point du village, ou null.
   */
  focusOf(s) {
    const st = this.cur(s), p = this.panel;
    if (p) {
      if (st.panel === p) return st.sel ? { sel: st.sel } : null;
      return { sel: EXIT };                          // mauvais menu, ou étape dans le village : sortir
    }
    if (st.hud) return { sel: st.hud };
    if (st.world) return { world: this.point(s, st.world) };
    return null;
  },

  /** Repère et flèche du village (undefined = hors tutoriel, repères normaux) */
  guide(s) {
    if (!s.tuto.active) return undefined;
    const f = this.focusOf(s);
    return f && f.world ? f.world : null;
  },

  /* ---------------- À chaque image ---------------- */
  frame(dt, s) {
    if (!s.tuto.active) {
      if (this.showing) this.hideUI();        // partie effacée pendant le tutoriel
      Tips.frame(dt, s);
      return;
    }
    if (Tips.current) Tips.close();
    this.showing = true;
    this.panel = UI.active;
    this.stepT += dt; this.idle += dt; this.callT -= dt;
    let st = this.cur(s);

    // La commande d'entraînement a disparu avant d'être chargée : on revient à « accepter »
    if (st.id === 'charger' && !this.contract(s)) { s.tuto.step = STEPS.findIndex(x => x.id === 'accepter'); this.enter(s); st = this.cur(s); }
    if (st.done(s, this)) { this.next(s); return; }

    // Mémé appelle le joueur s'il ne fait plus rien
    if (this.idle > T0.callAfter && this.callT <= 0 && !UI.active) {
      Meme.talk(st.say || 'Ohé ! Par ici !');
      this.callT = T0.callAfter;
    }

    const btn = st.btn && (!st.canSkip || st.canSkip(s)) ? st.btn : '';
    Overlay.card({ html: st.text, step: s.tuto.step, total: STEPS.length, next: btn });
    Overlay.low(!!UI.active);
    document.body.classList.add('tuto-on');
    document.body.classList.toggle('tuto-quest', st.hud === '#quest');

    if (UI.modalOpen()) { Overlay.hideFocus(); return; }
    const f = this.focusOf(s);
    const hand = this.stepT < 6 || this.idle > T0.handAfter;
    if (!f) Overlay.focus(null, false);
    else if (f.sel) Overlay.focus(f, hand);
    else {
      const r = f.world.ring, p = World.toScreen(r.x, r.y);
      Overlay.focus({ x: p.x, y: p.y, r: 48 * World.zoom, clip: p.rect }, hand);
    }
  },

  hideUI() {
    Overlay.hide();
    document.body.classList.remove('tuto-on', 'tuto-quest');
    this.showing = false;
  },
};
