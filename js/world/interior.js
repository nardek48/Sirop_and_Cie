/**
 * interior.js — l'intérieur de l'usine, où l'on marche.
 *
 * Une salle avec toute la chaîne de production, animée par les VRAIES valeurs du jeu :
 * matières (sacs et cagettes), marmite de cuisson (bulles et vapeur selon le débit),
 * cuve tampon (niveau), embouteillage (bouteilles sur le tapis), entrepôt (caisses),
 * comptoir (clients). La machine qui ralentit tout est signalée (🐢 ou ⚠️).
 *
 * Toucher une machine ouvre sa fiche (panneau « machine ») pour l'améliorer.
 * Le tableau ouvre la gestion complète de l'usine. Deux sorties : la porte du bas
 * (devant l'usine) et la porte de droite (le quai).
 *
 * Ce module ne fait que décrire et dessiner la salle ; world.js s'occupe des entrées,
 * du déplacement et de la caméra (World.scene === 'usine').
 */
import { CONFIG } from '../config.js';
import { rt } from '../core/game.js';
import { Fmt } from '../core/format.js';
import { Eco } from '../sim/eco.js';
import { Flavors } from '../sim/flavors.js';
import { Clock } from '../sim/clock.js';
import { Gfx } from './gfx.js';
import { drawCharacter } from './characters.js';

const W = 1100, H = 680;
const BASE = 300;                 // pied des machines du fond
const SPOT_Y = 352;               // où l'on se tient devant elles

/** Machines : zone de dessin (hit), pied solide, endroit où se tenir */
const MACHINES = {
  mat:     { x: 50,  w: 170, spot: 135, name: 'Matières',       icon: '🧺' },
  cook:    { x: 245, w: 175, spot: 332, name: 'Cuisson',        icon: '🔥' },
  tank:    { x: 450, w: 120, spot: 510, name: 'Cuve tampon',    icon: '🛢️' },
  bottle:  { x: 600, w: 285, spot: 735, name: 'Embouteillage',  icon: '🍾' },
  ware:    { x: 905, w: 160, spot: 985, name: 'Entrepôt',       icon: '📦' },
};
const COUNTER = { x: 810, y: 512, w: 230, h: 46, spot: { x: 925, y: 496 } };
const BOARD = { x: 95, y: 440, w: 150, h: 96, spot: { x: 170, y: 592 } };
const DOOR = { x: 500, w: 100 };               // porte du bas
const QUAI = { y: 350, h: 110 };               // porte de droite
const CLIENT_SHIRTS = ['#3a6ea5', '#f07fb0', '#3f8f5a', '#e8c22e'];

/** Explication d'une machine, pour les enfants (fiche machine) */
export const MACHINE_INFO = {
  mat: 'Le sucre 🧂 et les fruits 🍓 attendent ici. Sans eux, la marmite ne peut rien cuire !',
  cook: 'La marmite cuit le sucre et les fruits pour faire du sirop. Plus elle est grande, plus elle cuit vite.',
  tank: 'La cuve garde le sirop chaud en attendant la mise en bouteille. Plus elle est grande, plus elle en garde.',
  bottle: 'La machine remplit les bouteilles, une par une, sur le tapis roulant.',
  ware: 'Les bouteilles pleines sont rangées ici. Quand c’est plein, l’usine s’arrête : vends ou livre !',
  counter: 'Les clients du village viennent acheter tes bouteilles au comptoir.',
};

export const Interior = {
  W, H,
  p: { x: 550, y: 600 },          // position du joueur dans la salle (jamais sauvegardée)
  belt: 0, steam: [], bubbles: [], coins: [],

  /** Où l'on apparaît en entrant par une porte */
  spawn(from) {
    Object.assign(this.p, from === 'quai' ? { x: W - 60, y: QUAI.y + QUAI.h / 2 } : { x: DOOR.x + DOOR.w / 2, y: H - 70 });
    this.steam = []; this.bubbles = []; this.coins = [];
  },

  /* ---------------- Collisions ---------------- */
  solids() {
    const L = [
      { x: 0, y: 0, w: W, h: BASE - 70 },                                   // mur du fond et pied des machines
      { x: 0, y: 0, w: 26, h: H },                                          // mur de gauche
      { x: W - 26, y: 0, w: 26, h: QUAI.y },                                // mur de droite, au-dessus de la porte
      { x: W - 26, y: QUAI.y + QUAI.h, w: 26, h: H },                       // … et en dessous
      { x: 0, y: H - 26, w: DOOR.x, h: 26 },                                // mur du bas, à gauche de la porte
      { x: DOOR.x + DOOR.w, y: H - 26, w: W, h: 26 },                       // … et à droite
      { x: COUNTER.x, y: COUNTER.y, w: COUNTER.w, h: COUNTER.h },           // comptoir
      { x: BOARD.x + 20, y: BOARD.y + BOARD.h - 18, w: BOARD.w - 40, h: 20 }, // tableau
    ];
    for (const m of Object.values(MACHINES)) L.push({ x: m.x, y: BASE - 80, w: m.w, h: 96 });
    return L;
  },

  /* ---------------- Interactions ---------------- */
  /**
   * @param {object} s état
   * @param {{machine:Function, board:Function, exit:Function}} act ce que font les interactions
   */
  build(s, act) {
    const L = [];
    for (const [k, m] of Object.entries(MACHINES)) {
      const hot = rt.bneck === k || (k === 'cook' && rt.bneck === 'switch');
      L.push({
        id: 'm-' + k, x: m.spot, y: SPOT_Y, hit: { x: m.x, y: 60, w: m.w, h: BASE - 40 },
        label: k === 'mat' ? `${m.icon} Matières · ${Fmt.int(s.mat.sugar)} 🧂 ${Fmt.int(s.mat.fruit)} 🍓`
          : `${m.icon} ${m.name} · niv. ${s.lv[k]}${hot ? ' · 🐢' : ''}`,
        run: () => act.machine(k),
      });
    }
    L.push({
      id: 'm-counter', ...COUNTER.spot, hit: COUNTER,
      label: `🛎️ Comptoir · niv. ${s.lv.counter} · ${s.counterOn ? 'ouvert' : 'fermé'}`, run: () => act.machine('counter'),
    });
    L.push({ id: 'board', ...BOARD.spot, hit: BOARD, label: '📋 Tableau : gérer toute l’usine', run: () => act.board() });
    L.push({ id: 'exit', x: DOOR.x + DOOR.w / 2, y: H - 40, hit: { x: DOOR.x, y: H - 60, w: DOOR.w, h: 60 }, label: '🚪 Sortir', run: () => act.exit('usine') });
    L.push({ id: 'exitQuai', x: W - 50, y: QUAI.y + QUAI.h / 2, hit: { x: W - 60, y: QUAI.y, w: 60, h: QUAI.h }, label: '📦 Sortir au quai', run: () => act.exit('quai') });
    return L;
  },

  /** Où faire apparaître « +12 $ » des ventes */
  counterFloat: () => ({ x: COUNTER.x + 180, y: COUNTER.y + 20 }),

  /* ---------------- Dessin ---------------- */
  /**
   * Dessine la salle. Les éléments à trier par profondeur (machines, comptoir, clients)
   * passent par add(y, fn), comme dans le village.
   */
  draw(c, s, t, dt, add) {
    this.room(c, s, t);
    const f = Flavors.get(s, s.bulkFlavor), fl = rt.flow;
    this.belt += dt * (fl.bottle > 0 ? 30 + 22 * Math.log2(1 + fl.bottle) : 0);

    add(BASE, () => this.pipes(c, t, fl, f.color));
    add(BASE + 1, () => this.materials(c, s));
    add(BASE + 1, () => this.cauldron(c, s, t, dt, fl.cook, Flavors.get(s, s.flavor).color));
    add(BASE + 1, () => this.tank(c, s, f.color));
    add(BASE + 1, () => this.bottler(c, s, t, fl.bottle, f.color));
    add(BASE + 1, () => this.warehouse(c, s));
    add(BASE + 2, () => this.machineSigns(c, s, t));
    add(BOARD.y + BOARD.h, () => this.board(c, s));
    add(COUNTER.y + COUNTER.h, () => this.counter(c, s, t, dt));
    this.clients(c, s, t, add);
  },

  room(c, s, t) {
    // Sol : planches
    c.fillStyle = '#e2cda3'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(122,82,48,.22)'; c.lineWidth = 2;
    for (let y = BASE - 70, r = 0; y < H; y += 34, r++) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      for (let x = (r % 2) * 90; x < W; x += 180) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 34); c.stroke(); }
    }
    // Mur du fond : briques
    const wallH = BASE - 70;
    c.fillStyle = '#b8674f'; c.fillRect(0, 0, W, wallH);
    c.strokeStyle = '#9c523d'; c.lineWidth = 2;
    for (let y = 0, r = 0; y < wallH; y += 22, r++) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      for (let x = (r % 2) * 24; x < W; x += 48) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 22); c.stroke(); }
    }
    // Fenêtres hautes : le ciel suit l'heure du jeu
    const dark = Clock.darkness(s);
    const sky = dark > 0.3 ? '#2a3a66' : dark > 0.05 ? '#f0a860' : '#a9d8f5';
    for (const x of [140, 390, 760, 990]) {
      c.fillStyle = '#6f3b2c'; c.fillRect(x - 50, 14, 100, 62);
      c.fillStyle = sky; c.fillRect(x - 44, 20, 88, 50);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x - 44, 20, 88, 8);
      c.fillStyle = '#6f3b2c'; c.fillRect(x - 2, 20, 4, 50); c.fillRect(x - 44, 43, 88, 4);
    }
    // Plinthe
    c.fillStyle = '#7a4232'; c.fillRect(0, wallH - 10, W, 10);
    // Murs de côté et du bas
    c.fillStyle = '#8a4a38';
    c.fillRect(0, 0, 26, H);
    c.fillRect(W - 26, 0, 26, QUAI.y); c.fillRect(W - 26, QUAI.y + QUAI.h, 26, H);
    c.fillRect(0, H - 26, DOOR.x, 26); c.fillRect(DOOR.x + DOOR.w, H - 26, W, 26);
    // Porte du bas (paillasson) et porte du quai (lumière du dehors)
    c.fillStyle = '#7d9a4f'; c.fillRect(DOOR.x + 8, H - 34, DOOR.w - 16, 30);
    c.fillStyle = '#f5e6b8'; c.fillRect(W - 26, QUAI.y, 26, QUAI.h);
    c.fillStyle = 'rgba(245,230,184,.35)';
    c.beginPath(); c.moveTo(W - 26, QUAI.y); c.lineTo(W - 110, QUAI.y + 20); c.lineTo(W - 110, QUAI.y + QUAI.h - 20); c.lineTo(W - 26, QUAI.y + QUAI.h); c.fill();
    Gfx.sign(c, '🚪 Sortie', DOOR.x + DOOR.w / 2, H - 38, 12);
    Gfx.sign(c, '📦 Quai', W - 64, QUAI.y - 6, 12);
  },

  /** Tuyaux : marmite → cuve → embouteillage, avec des gouttes qui circulent */
  pipes(c, t, fl, color) {
    const path1 = [[332, 128], [332, 96], [470, 96], [470, 110]];
    const path2 = [[560, 262], [612, 262]];
    c.lineCap = 'round';
    for (const [pts, on] of [[path1, fl.cook > 0], [path2, fl.bottle > 0]]) {
      c.strokeStyle = '#6d7479'; c.lineWidth = 14; this.line(c, pts);
      c.strokeStyle = '#a4acb2'; c.lineWidth = 8; this.line(c, pts);
      if (on) {
        c.fillStyle = color;
        const len = pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
        for (let d = (t * 70) % 24; d < len; d += 24) { const q = this.along(pts, d); c.beginPath(); c.arc(q.x, q.y, 3, 0, Math.PI * 2); c.fill(); }
      }
    }
    c.lineCap = 'butt';
  },
  line(c, pts) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); },
  along(pts, d) {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay);
      if (d <= l) return { x: ax + (bx - ax) * d / l, y: ay + (by - ay) * d / l };
      d -= l;
    }
    const [x, y] = pts.at(-1); return { x, y };
  },

  /** Sacs de sucre et cagettes de fruits : la pile suit le stock */
  materials(c, s) {
    const n = v => Math.max(0, Math.min(6, Math.ceil(Math.log10(1 + v) * 1.6)));
    const sugar = n(s.mat.sugar), fruit = n(s.mat.fruit);
    const slots = [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1], [1, 2]];
    for (let i = 0; i < sugar; i++) {
      const [cx, r] = slots[i], x = 72 + cx * 26, y = BASE - 6 - r * 26;
      c.fillStyle = '#f4efe4'; c.strokeStyle = '#b9ad95'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(x - 13, y - 30, 26, 30, 8); c.fill(); c.stroke();
      c.fillStyle = '#b9ad95'; c.fillRect(x - 6, y - 34, 12, 5);
    }
    for (let i = 0; i < fruit; i++) {
      const [cx, r] = slots[i], x = 160 + cx * 24 - 12, y = BASE - 6 - r * 22;
      Gfx.crate(c, x, y, 26, 20);
      c.fillStyle = i % 2 ? '#d23c4f' : '#e8703a';
      for (let k = -1; k <= 1; k++) { c.beginPath(); c.arc(x + k * 7, y - 20, 4, 0, Math.PI * 2); c.fill(); }
    }
    if (!sugar && !fruit) Gfx.label(c, 'vide !', 135, BASE - 30, 14, '#ffb1a8');
  },

  /** Marmite : feu, bulles et vapeur selon le débit de cuisson */
  cauldron(c, s, t, dt, flow, color) {
    const x = 332, on = flow > 0, k = Math.min(1, 0.25 + Math.log2(1 + flow) / 5);
    // Foyer
    c.fillStyle = '#4b4b4b'; c.fillRect(x - 70, BASE - 44, 140, 44);
    c.fillStyle = '#2d2d2d'; c.fillRect(x - 50, BASE - 34, 100, 26);
    if (on) for (let i = 0; i < 5; i++) {
      const fx = x - 36 + i * 18, fh = 14 + Math.sin(t * 12 + i * 2) * 6 * k + 8 * k;
      c.fillStyle = i % 2 ? '#ffb43a' : '#ff6a2b';
      c.beginPath(); c.moveTo(fx - 7, BASE - 8); c.quadraticCurveTo(fx, BASE - 8 - fh * 2, fx + 7, BASE - 8); c.fill();
    }
    // Cuve en cuivre
    const g = c.createLinearGradient(x - 80, 0, x + 80, 0);
    g.addColorStop(0, '#8f5427'); g.addColorStop(0.45, '#d48a45'); g.addColorStop(1, '#7c4520');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x - 82, 150); c.lineTo(x + 82, 150); c.quadraticCurveTo(x + 86, BASE - 30, x, BASE - 36); c.quadraticCurveTo(x - 86, BASE - 30, x - 82, 150); c.fill();
    c.fillStyle = '#6a3a1b'; c.beginPath(); c.ellipse(x, 150, 84, 20, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = color; c.beginPath(); c.ellipse(x, 152, 74, 14, 0, 0, Math.PI * 2); c.fill();
    // Bulles et vapeur
    if (on) {
      if (Math.random() < dt * 10 * k) this.bubbles.push({ x: x - 60 + Math.random() * 120, t: 0 });
      if (Math.random() < dt * 3 * k) this.steam.push({ x: x - 40 + Math.random() * 80, t: 0 });
    }
    for (const b of this.bubbles) b.t += dt;
    for (const p of this.steam) p.t += dt;
    this.bubbles = this.bubbles.filter(b => b.t < 0.6);
    this.steam = this.steam.filter(p => p.t < 2.2);
    c.fillStyle = 'rgba(255,255,255,.55)';
    for (const b of this.bubbles) { c.beginPath(); c.arc(b.x, 152 - b.t * 6, 3 + b.t * 6, 0, Math.PI * 2); c.fill(); }
    for (const p of this.steam) {
      c.fillStyle = `rgba(255,255,255,${0.45 * (1 - p.t / 2.2)})`;
      c.beginPath(); c.arc(p.x + Math.sin(p.t * 3 + p.x) * 8, 136 - p.t * 45, 10 + p.t * 10, 0, Math.PI * 2); c.fill();
    }
  },

  /** Cuve tampon : hublot avec le niveau de sirop */
  tank(c, s, color) {
    const x = 450, w = 120, top = 110, bot = BASE - 10;
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#9aa3aa'); g.addColorStop(0.4, '#e3e8ec'); g.addColorStop(1, '#8a939a');
    c.fillStyle = g;
    c.beginPath(); c.roundRect(x, top, w, bot - top, [40, 40, 6, 6]); c.fill();
    c.strokeStyle = '#6d7479'; c.lineWidth = 2; c.stroke();
    // Pieds
    c.fillStyle = '#6d7479'; c.fillRect(x + 12, bot, 10, 10); c.fillRect(x + w - 22, bot, 10, 10);
    // Hublot
    const wx = x + 40, wy = top + 34, ww = 40, wh = bot - top - 54;
    c.fillStyle = '#2b3136'; c.beginPath(); c.roundRect(wx - 4, wy - 4, ww + 8, wh + 8, 10); c.fill();
    c.fillStyle = '#d7e9f2'; c.beginPath(); c.roundRect(wx, wy, ww, wh, 8); c.fill();
    const lvl = Math.max(0, Math.min(1, s.bulk / Eco.tankCap(s)));
    if (lvl > 0) {
      c.save(); c.beginPath(); c.roundRect(wx, wy, ww, wh, 8); c.clip();
      c.fillStyle = color; c.fillRect(wx, wy + wh * (1 - lvl), ww, wh * lvl);
      c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(wx + 6, wy + wh * (1 - lvl), 6, wh * lvl);
      c.restore();
    }
    // Graduations
    c.strokeStyle = '#2b3136'; c.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) { const y = wy + wh * i / 4; c.beginPath(); c.moveTo(wx + ww - 10, y); c.lineTo(wx + ww, y); c.stroke(); }
  },

  /** Embouteillage : remplisseuse et tapis roulant */
  bottler(c, s, t, flow, color) {
    const fx = 612, bx0 = 700, bx1 = 880, by = BASE - 30;
    // Remplisseuse
    c.fillStyle = '#5f86a3'; c.beginPath(); c.roundRect(fx, 150, 88, BASE - 150 - 6, 8); c.fill();
    c.fillStyle = '#48708d'; c.fillRect(fx + 8, 162, 72, 30);
    c.fillStyle = flow > 0 ? (Math.sin(t * 8) > 0 ? '#7df08a' : '#3fbf55') : '#c0c6cb';
    c.beginPath(); c.arc(fx + 22, 177, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8c22e'; c.beginPath(); c.arc(fx + 44, 177, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d9dee2'; c.fillRect(fx + 62, 170, 12, 14);
    // Bras de remplissage au-dessus du tapis
    c.fillStyle = '#48708d'; c.fillRect(fx + 80, 206, 44, 12);
    const drop = flow > 0 ? Math.abs(Math.sin(t * 6)) * 8 : 0;
    c.fillStyle = '#6d7479'; c.fillRect(fx + 108, 218, 8, 12 + drop);
    // Tapis
    c.fillStyle = '#3a3a3a'; c.beginPath(); c.roundRect(bx0 - 10, by, bx1 - bx0 + 20, 16, 8); c.fill();
    c.fillStyle = '#6a6a6a';
    const off = this.belt % 20;
    for (let x = bx0 - 6 + off; x < bx1 + 6; x += 20) c.fillRect(x, by + 3, 3, 10);
    c.fillStyle = '#555'; c.fillRect(bx0, by + 16, 8, 14); c.fillRect(bx1 - 8, by + 16, 8, 14);
    // Bouteilles (colorées = pleines, après le bras de remplissage)
    const fillX = fx + 112;
    for (let x = bx0 + (this.belt % 34); x < bx1 - 4; x += 34) {
      const full = x > fillX;
      c.fillStyle = 'rgba(220,240,250,.9)'; c.strokeStyle = '#7d98a6'; c.lineWidth = 1.5;
      c.beginPath(); c.roundRect(x - 7, by - 26, 14, 26, 4); c.fill(); c.stroke();
      c.fillRect(x - 3, by - 34, 6, 9);
      if (full) { c.fillStyle = color; c.beginPath(); c.roundRect(x - 6, by - 18, 12, 17, 3); c.fill(); c.fillStyle = '#c2453a'; c.fillRect(x - 3, by - 36, 6, 4); }
    }
  },

  /** Entrepôt : étagères, caisses selon le remplissage */
  warehouse(c, s) {
    const x = 905, w = 160, top = 96, rows = 3, cols = 4;
    const fill = Math.max(0, Math.min(1, Eco.totalStock(s) / Eco.wareCap(s)));
    const n = Math.round(fill * rows * cols);
    c.fillStyle = '#8b5a33';
    c.fillRect(x, top, 8, BASE - top); c.fillRect(x + w - 8, top, 8, BASE - top);
    // Couleurs des caisses : parfums en stock
    const cols2 = s.unlocked.filter(k => (s.stock[k] || 0) >= 1).map(k => Flavors.get(s, k).color);
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const y = BASE - 6 - r * 66;
      c.fillStyle = '#a8733f'; c.fillRect(x, y, w, 8);
      for (let i = 0; i < cols; i++, k++) {
        if (k >= n) continue;
        const cx = x + 26 + i * 36;
        Gfx.crate(c, cx, y, 30, 26);
        c.fillStyle = cols2.length ? cols2[k % cols2.length] : '#c2453a';
        for (const d of [-8, 0, 8]) c.fillRect(cx + d - 2, y - 32, 4, 7);
      }
    }
    if (fill >= 0.98) Gfx.label(c, 'PLEIN !', x + w / 2, top - 8, 15, '#ffb1a8');
  },

  /** Panneaux sous les machines + la machine la plus lente */
  machineSigns(c, s, t) {
    for (const [k, m] of Object.entries(MACHINES)) {
      Gfx.sign(c, k === 'mat' ? `${m.icon} ${m.name}` : `${m.icon} ${m.name} · ${s.lv[k]}`, m.spot, BASE + 22, 12);
    }
    const bn = rt.bneck === 'switch' ? 'tank' : rt.bneck;
    const m = MACHINES[bn];
    if (!m) return;
    const alert = bn === 'mat' || bn === 'ware' || rt.bneck === 'switch';
    const y = 58 + Math.sin(t * 4) * 4;
    Gfx.label(c, alert ? '⚠️ Ça bloque ici !' : '🐢 Le plus lent', m.x + m.w / 2, y, alert ? 16 : 14, alert ? '#ffd0c8' : '#fff');
  },

  /** Tableau noir : le parfum en production */
  board(c, s) {
    const { x, y, w, h } = BOARD, f = Flavors.get(s, s.flavor);
    c.fillStyle = '#8b5a33';
    c.fillRect(x + 20, y + h - 4, 8, 26); c.fillRect(x + w - 28, y + h - 4, 8, 26);
    c.fillRect(x - 6, y - 6, w + 12, h + 12);
    c.fillStyle = '#2f4a3a'; c.fillRect(x, y, w, h);
    c.fillStyle = '#e9f1e4'; c.textAlign = 'center';
    c.font = '600 12px "DM Sans", system-ui, sans-serif'; c.fillText('Parfum du jour', x + w / 2, y + 22);
    c.font = '800 20px "DM Sans", system-ui, sans-serif'; c.fillText(f.name, x + w / 2, y + 50, w - 16);
    c.fillStyle = f.color; c.beginPath(); c.arc(x + w / 2, y + 72, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e9f1e4'; c.font = '600 11px "DM Sans", system-ui, sans-serif';
    c.fillText(`${Fmt.money(f.price)} / bt`, x + w / 2, y + 90);
  },

  /** Comptoir : caisse enregistreuse, bouteilles en vitrine, pièces qui sautent */
  counter(c, s, t, dt) {
    const { x, y, w, h } = COUNTER;
    c.fillStyle = '#8b5a33'; c.beginPath(); c.roundRect(x, y, w, h, 6); c.fill();
    c.fillStyle = '#a8733f'; c.fillRect(x, y, w, 10);
    c.fillStyle = '#6d4424'; for (let i = 1; i < 5; i++) c.fillRect(x + i * w / 5, y + 14, 3, h - 18);
    // Caisse
    c.fillStyle = '#c2453a'; c.beginPath(); c.roundRect(x + w - 60, y - 26, 44, 28, 5); c.fill();
    c.fillStyle = '#ffe28a'; c.fillRect(x + w - 54, y - 22, 32, 8);
    // Bouteilles en vitrine
    const shown = s.unlocked.filter(k => (s.stock[k] || 0) >= 1).slice(0, 5);
    shown.forEach((k, i) => {
      const bx = x + 22 + i * 24;
      c.fillStyle = Flavors.get(s, k).color; c.beginPath(); c.roundRect(bx - 6, y - 22, 12, 22, 3); c.fill();
      c.fillStyle = '#fff'; c.fillRect(bx - 2, y - 28, 4, 7);
    });
    Gfx.sign(c, s.counterOn ? '🟢 Ouvert' : '🔴 Fermé', x + w / 2, y + h + 26, 12);
    // Pièces
    if (s.counterOn && rt.flow.sell > 0 && Math.random() < dt * Math.min(4, 0.6 + rt.flow.sell)) this.coins.push({ x: x + w - 38, t: 0 });
    for (const p of this.coins) p.t += dt;
    this.coins = this.coins.filter(p => p.t < 0.8);
    for (const p of this.coins) {
      c.fillStyle = '#f2c230'; c.strokeStyle = '#b8860b'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(p.x + p.t * 20, y - 30 - Math.sin(p.t * Math.PI) * 30, 5, 0, Math.PI * 2); c.fill(); c.stroke();
    }
  },

  /** Clients devant le comptoir : plus il y a de ventes, plus il y a de monde */
  clients(c, s, t, add) {
    const n = s.counterOn && rt.flow.sell > 0 ? 1 + Math.min(2, Math.floor(rt.flow.sell)) : 0;
    for (let i = 0; i < n; i++) {
      const x = COUNTER.x + 50 + i * 62, y = COUNTER.y + COUNTER.h + 44 + (i % 2) * 6;
      add(y, () => {
        Gfx.shadow(c, x, y, 13, 5);
        drawCharacter(c, x, y, { key: 'villageois', dir: 'haut', moving: false, phase: 0, shirt: CLIENT_SHIRTS[i % 4], hair: i % 2 ? '#2b2b2b' : '#a0522d' });
      });
    }
  },
};

/** Liste des fiches machines (ordre de la chaîne) */
export const MACHINE_KEYS = ['mat', 'cook', 'tank', 'bottle', 'ware', 'counter'];
export const machineMeta = k => (k === 'counter' ? { name: 'Comptoir', icon: '🛎️' } : MACHINES[k]);
