/**
 * world.js — le village jouable : entrées, interactions, déplacement, caméra
 * et assemblage du rendu (tri par profondeur, repères, nuit, météo).
 *
 * Deux scènes : le village, et l'intérieur de l'usine (interior.js), où l'on entre
 * par la porte de l'usine. Dans l'usine, le joueur a sa propre position (Interior.p) :
 * s.player reste devant la porte, la sauvegarde ne voit donc jamais l'intérieur.
 */
import { CONFIG, clientByPlace, typeById } from '../config.js';
import { Game, rt } from '../core/game.js';
import { Bus } from '../core/bus.js';
import { Fmt } from '../core/format.js';
import { Store } from '../core/store.js';
import { Eco } from '../sim/eco.js';
import { Clock } from '../sim/clock.js';
import { Events } from '../sim/events.js';
import { Contracts } from '../sim/contracts.js';
import { Fields, Districts } from '../sim/world-systems.js';
import { Quests } from '../sim/quests.js';
import { Openings } from '../sim/openings.js';
import { UI } from '../ui/ui.js';
import { MAP } from './map.js';
import { Render } from './render.js';
import { Gfx } from './gfx.js';
import { drawCharacter, drawCarry, drawVehicle, drawPet } from './characters.js';
import { Pet } from './pet.js';
import { Villagers } from './villagers.js';
import { Meme } from './meme.js';
import { loadTiledDecor } from './tiled.js';
import { Interior } from './interior.js';
import { MachineSel } from '../ui/panels/machine.js';

const DIRS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
const inRect = (p, r) => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export const World = {
  cv: null, ctx: null, dpr: 1, vw: 0, vh: 0, zoom: 1,
  cam: { x: 0, y: 0 },
  keys: new Set(),
  target: null, pending: null, near: null, list: [],
  floats: [], confetti: [], time: 0, last: 0, fps: 60,
  anim: { phase: 0, moving: false, dir: 'bas', flip: 1 },
  stuckT: 0, counterT: 0, stepT: 0,
  debug: { solids: false },
  mode: 'play',          // 'play' ou 'edit' (Mode architecte, voir js/editor/)
  scene: 'village',      // 'village' ou 'usine' (intérieur de l'usine, voir interior.js)
  baseDecor: MAP.decor,  // décor du fichier (Tiled) ou par défaut ; s.decor le remplace s'il existe
  /**
   * Branchements du tutoriel (js/tutorial/), pour que le monde n'en dépende pas :
   *  filter(list)  → interactions autorisées     guide(s) → {x,y,icon} | null | undefined
   *  memeSpot(s)   → où se tient Mémé            talk()   → le joueur parle à Mémé
   *  after(dt, s)  → appelé à chaque image, après le dessin
   * Mode architecte :
   *  pointer(type, p, e) → 'down' | 'move' | 'up' sur le village (p en coordonnées monde)
   *  drawEdit(c, s)      → dessin par-dessus la scène (sélection, fantôme)
   */
  hooks: { filter: null, guide: null, memeSpot: null, talk: null, after: null, pointer: null, drawEdit: null },

  init() {
    this.cv = document.getElementById('world');
    this.ctx = this.cv.getContext('2d');
    Render.init(this.ctx);
    Villagers.init();

    const p = Game.s.player;
    if (this.blocked(p.x, p.y)) this.resetPlayer();
    Pet.reset(p);
    Meme.place(this.hooks.memeSpot ? this.hooks.memeSpot(Game.s) : CONFIG.tuto.spots.banc);

    new ResizeObserver(() => this.resize()).observe(this.cv);
    this.resize();
    this.snapCamera(true);

    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());
    this.cv.addEventListener('pointerdown', e => this.onPointer(e));
    // Glisser (Mode architecte) : on suit le pointeur même hors du canvas
    this.cv.addEventListener('pointermove', e => this.editPointer('move', e));
    window.addEventListener('pointerup', e => this.editPointer('up', e));
    Bus.on('float', (text, where, color) => this.float(text, where, color));

    // Décor Tiled optionnel (remplace le décor par défaut s'il est présent)
    loadTiledDecor('assets/decor.tiled.json').then(d => { if (d && d.length) this.baseDecor = d; });

    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  },

  resetPlayer() {
    this.scene = 'village'; this.fitZoom();
    Object.assign(Game.s.player, Store.fresh().player);
    this.target = null; this.pending = null;
    Pet.reset(Game.s.player);
  },

  resize() {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = r.width; this.vh = r.height;
    this.cv.width = Math.max(1, Math.round(r.width * this.dpr));
    this.cv.height = Math.max(1, Math.round(r.height * this.dpr));
    this.fitZoom();
  },
  /** Village : ~1000×620 visibles ; usine : toute la salle si l'écran le permet */
  fitZoom() {
    const w = this.vw, h = this.vh;
    this.zoom = this.inside
      ? Math.max(0.6, Math.min(1.3, Math.min(w / Interior.W, h / Interior.H)))
      : Math.max(0.6, Math.min(1.15, Math.min(w / 1000, h / 620)));
  },

  toWorld(cx, cy) { return { x: this.cam.x + cx / this.zoom, y: this.cam.y + cy / this.zoom }; },
  /** Coordonnées monde → pixels de la fenêtre (pour placer l'interface du tutoriel) */
  toScreen(x, y) {
    const r = this.cv.getBoundingClientRect();
    return { x: r.left + (x - this.cam.x) * this.zoom, y: r.top + (y - this.cam.y) * this.zoom, rect: r };
  },
  /** Transporte le joueur (bouton « Je suis perdu ») */
  teleport(x, y) {
    this.scene = 'village'; this.fitZoom();
    const p = Game.s.player;
    if (this.blocked(x, y)) y = CONFIG.roadY;
    p.x = x; p.y = y;
    this.target = null; this.pending = null; this.keys.clear();
    Pet.reset(p);
    this.snapCamera(true);
  },
  maxX(s) { return s.districts.colline ? MAP.w - 30 : MAP.districts.colline.barrier.x - 20; },

  /* ---------------- Scènes ---------------- */
  get inside() { return this.scene === 'usine'; },
  /** Position du joueur dans la scène courante */
  me(s) { return this.inside ? Interior.p : s.player; },
  /** Taille de la scène courante */
  dims() { return this.inside ? { w: Interior.W, h: Interior.H } : { w: MAP.w, h: MAP.h }; },

  /** Entrer dans l'usine, par la porte ('usine') ou par le quai ('quai') */
  enterFactory(from = 'usine') {
    UI.close();
    this.scene = 'usine';
    Interior.spawn(from);
    this.fitZoom();
    this.target = null; this.pending = null; this.keys.clear();
    this.anim.dir = from === 'quai' ? 'gauche' : 'haut'; this.anim.flip = from === 'quai' ? -1 : 1;
    Pet.reset(Interior.p);
    this.snapCamera(true);
    Bus.sfx('door');
  },
  /** Ressortir devant la porte de l'usine ou au quai */
  exitFactory(to = 'usine') {
    UI.close();
    this.scene = 'village';
    this.fitZoom();
    const p = Game.s.player, d = CONFIG.places[to];
    p.x = d.x; p.y = d.y + 30;
    this.target = null; this.pending = null; this.keys.clear();
    this.anim.dir = 'bas';
    Pet.reset(p);
    this.snapCamera(true);
    Bus.sfx('door');
  },
  /** Ce que font les interactions de l'usine */
  factoryActs: {
    machine: k => { MachineSel.k = k; UI.open('machine'); },
    board: () => UI.open('usine'),
    exit: to => World.exitFactory(to),
  },

  /* ---------------- Entrées ---------------- */
  onKey(e, down) {
    if (e.target.closest && e.target.closest('input,select,textarea')) return;
    const code = e.code;
    if (down && code === 'Escape') { UI.closeModal(); UI.close(); return; }
    if (down && (code === 'KeyE' || ((code === 'Space' || code === 'Enter') && !UI.active && !UI.modalOpen()))) {
      e.preventDefault();
      if (!e.repeat) this.interact();
      return;
    }
    // e.code = position physique : KeyW = Z et KeyA = Q sur un clavier AZERTY
    if (!DIRS.includes(code) || UI.active || UI.modalOpen()) return;
    e.preventDefault();
    if (down) this.keys.add(code); else this.keys.delete(code);
  },

  /** Position monde d'un événement pointeur */
  pointerPos(e) {
    const r = this.cv.getBoundingClientRect();
    return this.toWorld(e.clientX - r.left, e.clientY - r.top);
  },
  editPointer(type, e) {
    if (this.mode === 'edit' && this.hooks.pointer) this.hooks.pointer(type, this.pointerPos(e), e);
  },

  onPointer(e) {
    if (this.mode === 'edit') { this.cv.setPointerCapture?.(e.pointerId); this.editPointer('down', e); return; }
    if (UI.active || UI.modalOpen()) return;
    const p = this.pointerPos(e);
    const hit = this.list.find(i => inRect(p, i.hit));
    if (hit) { this.target = this.route(this.me(Game.s), hit); this.pending = hit.id; }
    else { this.target = [p]; this.pending = null; }
  },

  /** Trajet simple : rejoindre la route, la longer, puis monter/descendre vers la cible */
  route(from, to) {
    if (Math.hypot(to.x - from.x, to.y - from.y) < 160) return [{ x: to.x, y: to.y }];
    // Dans l'usine : passer par l'allée libre entre les machines et le comptoir
    if (this.inside) { const Y = 420; return [{ x: from.x, y: Y }, { x: to.x, y: Y }, { x: to.x, y: to.y }]; }
    const Y = CONFIG.roadY, pts = [];
    // Depuis les Champs, remonter d'abord par le chemin
    if (from.y > 1110 && to.y < 1110) pts.push({ x: from.x, y: 1172 }, { x: 545, y: 1172 });
    if (Math.abs((pts.at(-1) || from).y - Y) > 40) pts.push({ x: (pts.at(-1) || from).x, y: Y });
    if (to.y > 1110 && from.y < 1110) pts.push({ x: 545, y: Y }, { x: 545, y: 1172 }, { x: to.x, y: 1172 });
    else pts.push({ x: to.x, y: Y });
    pts.push({ x: to.x, y: to.y });
    return pts;
  },

  interact() {
    if (UI.modalOpen()) { UI.closeModal(); return; }
    if (UI.active) { UI.close(); return; }
    if (this.near) this.run(this.near);
  },
  run(it) { it.run(); UI.key = null; UI.render(Game.s); },

  /* ---------------- Interactions disponibles ---------------- */
  build(s) {
    const L = [], P = CONFIG.places;
    for (const b of MAP.buildings) {
      if (b.district && !s.districts[b.district]) continue;
      const door = P[b.id], at = { x: door.x, y: door.y + 14 };
      if (b.id === 'mairie') {
        const fete = Eco.carried(s).some(c => c.place === 'mairie');
        L.push({
          id: b.id, ...at, hit: b,
          label: fete ? 'Livrer la Fête 🎉' : s.quest.ready ? 'Récompense du maire 🎁' : 'Entrer · Mairie',
          run: () => { if (Contracts.deliverAt(s, 'mairie')) return; if (Quests.claim(s)) return; UI.open('mairie'); },
        });
      } else if (b.panel && !Openings.isOpen(s, b.id)) {
        const O = CONFIG.openings[b.id];
        L.push({
          id: b.id, ...at, hit: b, label: `🔒 ${b.name} · Bientôt !`,
          run: () => Bus.toast(`${O.icon} ${O.name} ouvrira ${Openings.hint(s, b.id)}`),
        });
      } else if (b.panel) {
        const hit = b.id === 'usine' ? { x: b.x, y: b.y, w: b.w * 0.6, h: b.h } : b;
        // L'usine se visite (sauf pendant le tutoriel, qui montre le tableau de l'usine)
        const run = b.id === 'usine' ? () => (s.tuto.active ? UI.open('usine') : this.enterFactory('usine')) : () => UI.open(b.panel);
        L.push({ id: b.id, ...at, hit, label: `Entrer · ${b.name}`, run });
      } else {
        const c = clientByPlace(b.id), open = Eco.clientOpen(s, c);
        const carried = Eco.carried(s).filter(k => k.place === b.id).length;
        L.push({
          id: b.id, ...at, hit: b,
          label: !open ? `🔒 ${c.name} (⭐ ${c.rep})` : carried ? `Livrer ${c.name}` : c.name,
          run: () => this.visitClient(s, b.id, c, open),
        });
      }
    }
    const u = MAP.buildings[0];
    const ready = s.active.filter(c => Contracts.canLoad(s, c)).length;
    L.push({
      id: 'quai', x: P.quai.x, y: P.quai.y + 14, hit: { x: u.x + u.w * 0.6, y: u.y, w: u.w * 0.4, h: u.h },
      label: ready ? `Charger ${ready} commande${ready > 1 ? 's' : ''} 📦` : 'Quai de chargement',
      run: () => this.loadQuai(s),
    });
    for (const [g, list] of Object.entries(MAP.fields)) {
      if (!Fields.open(s, g)) continue;
      const F = CONFIG.fields[g], cane = g === 'canne';
      list.forEach((pos, i) => L.push({
        id: g + i, x: pos.x, y: pos.y + (cane ? 26 : 30),
        hit: cane ? { x: pos.x - 90, y: pos.y - 100, w: 180, h: 120 } : { x: pos.x - 40, y: pos.y - 75, w: 80, h: 110 },
        label: s.fields[g][i] > 0 ? `Repousse… ${Math.ceil(s.fields[g][i])} s` : `Récolter · ${F.icon} ${F.name}`,
        run: () => Fields.pick(s, g, i, { x: pos.x, y: pos.y - 30 }),
      }));
    }
    MAP.plots.forEach((p, i) => {
      if (p.district && !s.districts[p.district]) return;
      const h = s.houses.find(x => x.plot === i), u2 = h && CONFIG.houses.uses[h.use];
      L.push({
        id: 'plot' + i, x: p.x + p.w / 2, y: p.y - 10, hit: p,
        label: h ? `${typeById(h.type).name} · ${u2.icon} ${u2.name}` : 'Terrain à vendre',
        run: () => { if (!h) Bus.toast('Pour construire ici, passe à l’Agence immobilière 🏡'); UI.open('agence'); },
      });
    });
    for (const [id, M] of Object.entries(MAP.districts)) {
      if (s.districts[id]) continue;
      const D = CONFIG.districts[id];
      L.push({
        id: 'd-' + id, x: M.sign.x, y: M.sign.y, hit: M.area,
        label: `Ouvrir ${D.name} · ${Fmt.money(D.cost)}`,
        run: () => UI.confirm(`Ouvrir ${D.icon} ${D.name} pour ${Fmt.money(D.cost)} ?<br><small>${D.desc}</small>`, () => Districts.unlock(Game.s, id), 'Ouvrir'),
      });
    }
    // Mémé en premier : prioritaire au clic
    L.unshift({
      id: 'meme', x: Meme.x, y: Meme.y, hit: { x: Meme.x - 24, y: Meme.y - 72, w: 48, h: 80 },
      label: 'Parler à Mémé 👵', run: () => this.hooks.talk && this.hooks.talk(),
    });
    return this.hooks.filter ? this.hooks.filter(L, s) : L;
  },

  loadQuai(s) {
    const r = Contracts.loadAll(s);
    if (r.n) Bus.toast(`📦 ${r.n} commande${r.n > 1 ? 's' : ''} chargée${r.n > 1 ? 's' : ''} (${Fmt.int(r.b)} bouteilles). En route !`, 'ok');
    else if (r.tooBig) {
      Bus.toast(`Trop lourd ! Ton ${Eco.vehicle(s).name.toLowerCase()} porte ${Eco.capacity(s)} bouteilles. Passe au garage 🚲`, 'bad');
      Bus.emit('tip', 'tooBig');       // conseil de Mémé, la première fois
    }
    else if (!s.active.length) Bus.toast('Aucun contrat en cours : va au bureau des contrats 📜');
    else if (Eco.carried(s).length) Bus.toast('Tu portes déjà les commandes prêtes. Va les livrer !');
    else Bus.toast('Pas encore assez de bouteilles pour tes commandes ⏳');
  },

  visitClient(s, place, c, open) {
    if (!open) return Bus.toast(`${c.icon} ${c.name} ne te connaît pas encore : il faut ⭐ ${c.rep}`);
    if (Contracts.deliverAt(s, place)) return;
    const mine = s.active.filter(k => k.place === place);
    if (mine.some(k => !k.loaded)) Bus.toast('Sa commande n’est pas encore chargée : passe au quai 📦 de l’usine');
    else if (mine.some(k => k.loaded === 'npc')) Bus.toast('Un livreur arrive avec la commande 🚚');
    else Bus.toast(`${c.icon} « Pas de commande pour l’instant, merci ! »`);
  },

  /* ---------------- Déplacement ---------------- */
  solids(s) {
    if (this.inside) return Interior.solids();
    const list = [
      ...MAP.buildings.map(b => ({ x: b.x, y: b.y + 20, w: b.w, h: b.h - 20 })),
      MAP.water,
      { x: MAP.fountain.x - 50, y: MAP.fountain.y - 30, w: 100, h: 56 },
      { x: MAP.windmill.x - 34, y: MAP.windmill.y - 40, w: 68, h: 40 },
    ];
    for (const [id, M] of Object.entries(MAP.districts)) if (!s.districts[id]) list.push(M.barrier);
    return list;
  },

  blocked(x, y, solids = this.solids(Game.s)) {
    const hw = 10, hh = 6, D = this.dims();
    if (x - hw < 0 || x + hw > D.w || y - hh < 0 || y + hh > D.h) return true;
    return solids.some(r => x + hw > r.x && x - hw < r.x + r.w && y + hh > r.y && y - hh < r.y + r.h);
  },

  /** Mode architecte : les flèches déplacent la caméra, pas le personnage */
  panCamera(dt) {
    const k = this.keys, sp = 700 * dt / this.zoom;
    this.cam.x += ((k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0)) * sp;
    this.cam.y += ((k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0)) * sp;
    this.clampCamera();
  },
  clampCamera() {
    const vw = this.vw / this.zoom, vh = this.vh / this.zoom, D = this.dims();
    this.cam.x = vw >= D.w ? (D.w - vw) / 2 : Math.max(0, Math.min(D.w - vw, this.cam.x));
    this.cam.y = vh >= D.h ? (D.h - vh) / 2 : Math.max(0, Math.min(D.h - vh, this.cam.y));
  },

  move(dt, s) {
    const p = this.me(s), k = this.keys;
    let vx = 0, vy = 0;
    if (this.mode === 'edit') { this.anim.moving = false; this.panCamera(dt); return; }
    if (!UI.active && !UI.modalOpen()) {
      vx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
      vy = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    }
    if (vx || vy) { this.target = null; this.pending = null; }
    else if (this.target && !UI.active) {
      const wp = this.target[0], dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy);
      if (d < 6) {
        this.target.shift();
        if (!this.target.length) { this.target = null; this.arrive(s); }
      } else { vx = dx / d; vy = dy / d; }
    }

    const len = Math.hypot(vx, vy);
    this.anim.moving = len > 0;
    if (!len) { this.stuckT = 0; return; }
    vx /= len; vy /= len;
    const solids = this.solids(s);
    const sp = (this.inside ? CONFIG.vehicles[0].speed : Eco.speed(s)) * dt, ox = p.x, oy = p.y;
    if (!this.blocked(p.x + vx * sp, p.y, solids)) p.x += vx * sp;
    if (!this.blocked(p.x, p.y + vy * sp, solids)) p.y += vy * sp;
    this.anim.phase += dt * 13;
    if (Math.abs(vx) > Math.abs(vy)) { this.anim.dir = vx > 0 ? 'droite' : 'gauche'; this.anim.flip = Math.sign(vx); }
    else this.anim.dir = vy > 0 ? 'bas' : 'haut';

    // Petit bruit de pas (à pied uniquement)
    this.stepT += dt;
    if ((s.vehicle === 0 || this.inside) && this.stepT > 0.3) { this.stepT = 0; Bus.sfx('step'); }

    // Bloqué pendant un trajet automatique → on abandonne
    if (this.target && Math.hypot(p.x - ox, p.y - oy) < sp * 0.3) {
      this.stuckT += dt;
      if (this.stuckT > 0.4) { this.target = null; this.pending = null; this.stuckT = 0; }
    } else this.stuckT = 0;
  },

  arrive(s) {
    if (!this.pending) return;
    const it = this.list.find(i => i.id === this.pending), p = this.me(s);
    this.pending = null;
    if (it && Math.hypot(p.x - it.x, p.y - it.y) <= CONFIG.player.reach) this.run(it);
  },

  float(text, where, color = '#fff') {
    const pos = typeof where === 'string' ? CONFIG.places[where] : where;
    // Un lieu nommé est dans le village ; une position {x,y} est dans la scène courante
    const scene = typeof where === 'string' ? 'village' : this.scene;
    if (pos) this.floats.push({ text, x: pos.x, y: pos.y - 70, t: 0, color, scene });
  },

  snapCamera(instant = false) {
    const p = this.me(Game.s), vw = this.vw / this.zoom, vh = this.vh / this.zoom, D = this.dims();
    const tx = vw >= D.w ? (D.w - vw) / 2 : Math.max(0, Math.min(D.w - vw, p.x - vw / 2));
    const ty = vh >= D.h ? (D.h - vh) / 2 : Math.max(0, Math.min(D.h - vh, p.y - 30 - vh / 2));
    const k = instant ? 1 : 0.14;
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  },

  /* ---------------- Boucle d'image ---------------- */
  frame(ts) {
    const dt = Math.min(0.05, (ts - this.last) / 1000);
    this.last = ts; this.time += dt;
    this.fps += ((dt ? 1 / dt : 60) - this.fps) * 0.05;
    const s = Game.s;

    MAP.decor = s.decor || this.baseDecor;          // décor du joueur (Mode architecte) ou du fichier
    if (this.inside && (s.tuto.active || this.mode === 'edit')) this.exitFactory('usine');   // tutoriel relancé, Mode architecte
    this.list = this.mode === 'edit' ? [] : this.inside ? Interior.build(s, this.factoryActs) : this.build(s);
    this.move(dt, s);
    if (this.inside) Pet.fetchT = 0;                // pas de cueillette depuis l'usine
    Pet.update(dt, s, this.me(s), this);
    Villagers.update(dt, s, s.player, this.maxX(s));
    Meme.update(dt, s, this);

    const p = this.me(s);
    let best = null, bd = CONFIG.player.reach;
    for (const i of this.list) { const d = Math.hypot(p.x - i.x, p.y - i.y); if (d <= bd) { bd = d; best = i; } }
    this.near = best;
    UI.setAction(best && best.label);

    if (this.mode === 'play') this.snapCamera();

    // Ventes au comptoir → texte flottant périodique au-dessus de l'usine
    this.counterT += dt;
    if (this.counterT > 2.5) {
      if (rt.counterAcc >= 0.5) this.float(`+${Fmt.money(rt.counterAcc)}`, this.inside ? Interior.counterFloat() : { x: 230, y: 360 }, '#c8f7c5');
      rt.counterAcc = 0; this.counterT = 0;
    }
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter(f => f.t < 1.6);

    if (this.inside) this.drawFactory(s, dt); else this.draw(s);
    if (this.hooks.after) this.hooks.after(dt, s);
    requestAnimationFrame(t => this.frame(t));
  },

  /* ---------------- Rendu ---------------- */
  draw(s) {
    const c = this.ctx, z = this.zoom * this.dpr, t = this.time, dark = Clock.darkness(s);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#8cc46a';
    c.fillRect(0, 0, this.cv.width, this.cv.height);
    c.setTransform(z, 0, 0, z, -this.cam.x * z, -this.cam.y * z);

    Render.ground(c, s, t);
    if (s.districts.colline) Render.train(c, t);

    // Tri par profondeur : ce qui est plus bas à l'écran passe devant
    const items = [];
    const add = (y, f) => items.push({ y, f });
    for (const b of MAP.buildings) add(b.y + b.h, () => Render.building(c, b, s, t, dark));
    MAP.fields.verger.forEach((pos, i) => add(pos.y, () => Render.tree(c, pos, s.fields.verger[i], 'verger')));
    MAP.fields.sureau.forEach((pos, i) => add(pos.y, () => Render.tree(c, pos, s.fields.sureau[i], 'sureau')));
    MAP.fields.canne.forEach((pos, i) => add(pos.y, () => Render.cane(c, pos, s.fields.canne[i], t)));
    for (const h of s.houses) { const pl = MAP.plots[h.plot]; add(pl.y + pl.h - 6, () => Render.house(c, pl, h, dark)); }
    for (const d of MAP.decor) add(d.y, () => Render.decor(c, d, dark));
    add(MAP.fountain.y + 20, () => Render.fountain(c, t));
    add(MAP.windmill.y, () => Render.windmill(c, t));
    this.addCouriers(s, add);
    this.addVillagers(s, add);
    if (s.look.pet !== 'aucun') add(Pet.y, () => drawPet(c, Pet.x, Pet.y, s.look.pet, Pet.flip, Pet.moving, Pet.phase, s.look.petName));
    add(Meme.y, () => Meme.draw(c));
    add(s.player.y, () => this.drawPlayer(c, s));
    items.sort((a, b) => a.y - b.y).forEach(i => i.f());

    for (const id of Object.keys(MAP.districts)) if (!s.districts[id]) Render.lockedDistrict(c, id, t);
    if (Events.is(s, 'fete')) this.drawFete(c, t);
    if (this.mode === 'play') this.drawGuides(c, s);
    if (this.debug.solids) this.drawDebug(c, s);

    this.drawFloats(c);
    if (this.mode === 'edit' && this.hooks.drawEdit) this.hooks.drawEdit(c, s);
    if (this.near && !UI.active) Gfx.bubble(c, `E · ${this.near.label}`, s.player.x, s.player.y - 96);

    // Passes écran : météo, puis nuit
    c.setTransform(1, 0, 0, 1, 0, 0);
    Render.weather(c, s, t, this.cv.width, this.cv.height);
    if (dark > 0.01) Render.lights(c, dark, this.lightPoints(s));
  },

  drawFloats(c) {
    for (const f of this.floats) {
      if (f.scene !== this.scene) continue;
      c.globalAlpha = Math.max(0, 1 - f.t / 1.6);
      Gfx.label(c, f.text, f.x, f.y - f.t * 40, 18, f.color);
    }
    c.globalAlpha = 1;
  },

  /** Rendu de l'intérieur de l'usine */
  drawFactory(s, dt) {
    const c = this.ctx, z = this.zoom * this.dpr, t = this.time;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#3b2a1a';
    c.fillRect(0, 0, this.cv.width, this.cv.height);
    c.setTransform(z, 0, 0, z, -this.cam.x * z, -this.cam.y * z);
    const items = [];
    const add = (y, f) => items.push({ y, f });
    Interior.draw(c, s, t, dt, add);
    const p = Interior.p;
    if (s.look.pet !== 'aucun') add(Pet.y, () => drawPet(c, Pet.x, Pet.y, s.look.pet, Pet.flip, Pet.moving, Pet.phase, s.look.petName));
    add(p.y, () => this.drawPlayer(c, s));
    items.sort((a, b) => a.y - b.y).forEach(i => i.f());
    this.drawFloats(c);
    if (this.near && !UI.active) Gfx.bubble(c, `E · ${this.near.label}`, p.x, p.y - 96);
  },

  drawPlayer(c, s) {
    const p = this.me(s), a = this.anim, v = this.inside ? 'pied' : Eco.vehicle(s).id;
    const crates = Math.min(4, Math.ceil(Eco.carriedQty(s) / 25));
    const mode = drawVehicle(c, p.x, p.y, v, a.flip, a.moving, a.phase, crates, s.look.shirt);
    if (mode === 'replace') { Gfx.label(c, s.look.name, p.x, p.y - 74, 13); return; }
    if (mode !== 'under') Gfx.shadow(c, p.x, p.y, 14, 5);
    const dir = v === 'velo' && (a.dir === 'haut' || a.dir === 'bas') ? (a.flip < 0 ? 'gauche' : 'droite') : a.dir;
    const top = drawCharacter(c, p.x, p.y - (v === 'velo' ? 10 : 0), { key: 'player', dir, moving: a.moving && v !== 'velo', phase: a.phase, shirt: s.look.shirt });
    drawCarry(c, p.x, top, v === 'charrette' ? 0 : crates, s.look.name);
  },

  /** Livreurs : position interpolée sur le trajet quai → route → client */
  addCouriers(s, add) {
    const q = CONFIG.places.quai, Y = CONFIG.roadY, c = this.ctx;
    s.npcs.forEach((n, k) => {
      let pos;
      if (n.state === 'idle' || !n.dest) pos = { x: q.x + 46 + k * 26, y: q.y + 24, moving: false, dir: 'bas', crates: 0 };
      else {
        const d = CONFIG.places[n.dest];
        let pts = [{ x: q.x, y: q.y + 14 }, { x: q.x, y: Y + 20 + k * 6 }, { x: d.x, y: Y + 20 + k * 6 }, { x: d.x, y: d.y + 14 }];
        if (n.state === 'back') pts = pts.reverse();
        const segs = pts.slice(1).map((b, i) => Math.hypot(b.x - pts[i].x, b.y - pts[i].y));
        const total = segs.reduce((a, b) => a + b, 0);
        let dist = Math.min(1, n.t / (n.dur || 1)) * total, i = 0;
        while (i < segs.length - 1 && dist > segs[i]) { dist -= segs[i]; i++; }
        const a = pts[i], b = pts[i + 1], kk = segs[i] ? Math.min(1, dist / segs[i]) : 1, dx = b.x - a.x, dy = b.y - a.y;
        pos = {
          x: a.x + dx * kk, y: a.y + dy * kk, moving: true, crates: n.state === 'go' ? 2 : 0,
          dir: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'droite' : 'gauche') : (dy > 0 ? 'bas' : 'haut'),
        };
      }
      add(pos.y, () => {
        Gfx.shadow(c, pos.x, pos.y, 14, 5);
        const top = drawCharacter(c, pos.x, pos.y, { key: 'livreur', dir: pos.dir, moving: pos.moving, phase: this.anim.phase + k, shirt: '#3a6ea5', cap: '#27496f' });
        drawCarry(c, pos.x, top, pos.crates, `Livreur ${k + 1}`);
      });
    });
  },

  addVillagers(s, add) {
    const c = this.ctx, n = Villagers.visible(s);
    Villagers.list.slice(0, n).forEach(v => add(v.y, () => {
      Gfx.shadow(c, v.x, v.y, 13, 5);
      const top = drawCharacter(c, v.x, v.y, { key: 'villageois', dir: v.dir, moving: v.moving, phase: v.phase, shirt: v.shirt, hair: v.hair });
      if (v.sayT > 0) Gfx.speech(c, v.say, v.x, top - 8, Math.min(1, v.sayT * 2));
    }));
  },

  /** Guirlandes et confettis de la fête, entre la mairie et le garage */
  drawFete(c, t) {
    const cols = ['#e0562b', '#e8c22e', '#3a6ea5', '#3f8f5a', '#f07fb0'];
    // Tendues au-dessus des portes, assez haut pour ne pas cacher les personnages
    for (const y0 of [436, 452]) {
      for (let x = 1100; x < 1640; x += 22) {
        const sag = Math.sin(((x - 1100) / 540) * Math.PI) * 16;
        c.fillStyle = cols[(x / 22) % cols.length | 0];
        c.beginPath(); c.moveTo(x, y0 + sag); c.lineTo(x + 18, y0 + sag); c.lineTo(x + 9, y0 + sag + 16); c.fill();
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = 1100 + ((i * 97 + t * 30) % 540), y = 380 + ((i * 53 + t * 70) % 260);
      c.fillStyle = cols[i % cols.length]; c.fillRect(x, y, 5, 3);
    }
  },

  /** Repères : épingles sur la destination, flèche autour du joueur */
  drawGuides(c, s) {
    const p = s.player, t = this.time;
    let pins = [];
    // Le tutoriel impose son propre repère (ou aucun quand la cible est dans un menu)
    const g = this.hooks.guide ? this.hooks.guide(s) : undefined;
    if (g !== undefined) pins = g ? [g] : [];
    else {
      for (const pl of new Set(Eco.carried(s).map(k => k.place))) pins.push({ ...CONFIG.places[pl], icon: '📦' });
      if (!pins.length && s.active.some(k => Contracts.canLoad(s, k))) pins.push({ ...CONFIG.places.quai, icon: '📦' });
      if (s.quest.ready) pins.push({ ...CONFIG.places.mairie, icon: '🎁' });
    }
    for (const d of pins) Gfx.pin(c, d.x, d.y - 200 + Math.sin(t * 5) * 6, d.icon);
    if (!pins.length) return;
    const d = pins.reduce((a, b) => (Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a));
    if (Math.hypot(d.x - p.x, d.y - p.y) <= 220) return;
    const ang = Math.atan2(d.y - p.y, d.x - p.x);
    c.save(); c.translate(p.x + Math.cos(ang) * 52, p.y - 24 + Math.sin(ang) * 40); c.rotate(ang);
    c.fillStyle = '#e0562b'; c.strokeStyle = '#fff'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, -11); c.lineTo(-3, 0); c.lineTo(-8, 11); c.closePath(); c.stroke(); c.fill();
    c.restore();
  },

  drawDebug(c, s) {
    c.strokeStyle = 'rgba(255,0,0,.8)'; c.lineWidth = 2;
    for (const r of this.solids(s)) c.strokeRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = 'rgba(0,120,255,.7)';
    for (const i of this.list) { c.beginPath(); c.arc(i.x, i.y, CONFIG.player.reach, 0, Math.PI * 2); c.stroke(); }
  },

  /** Points lumineux de nuit, convertis en pixels écran */
  lightPoints(s) {
    const z = this.zoom * this.dpr, pts = [];
    const push = (x, y, r) => {
      const sx = (x - this.cam.x) * z, sy = (y - this.cam.y) * z, sr = r * z;
      if (sx > -sr && sy > -sr && sx < this.cv.width + sr && sy < this.cv.height + sr) pts.push({ x: sx, y: sy, r: sr });
    };
    for (const d of MAP.decor) if (d.kind === 'lampadaire') push(d.x, d.y - 60, 130);
    for (const b of MAP.buildings) push(CONFIG.places[b.id].x, b.y + b.h - 20, 80);
    push(s.player.x, s.player.y - 30, 140);
    return pts;
  },
};
