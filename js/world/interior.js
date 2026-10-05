/**
 * interior.js — l'intérieur de l'usine, où l'on marche.
 *
 * Une salle avec toute la chaîne de production, animée par les VRAIES valeurs du jeu :
 * matières (sacs et cagettes), marmite de cuisson (bulles et vapeur selon le débit),
 * cuve tampon (niveau), embouteillage (bouteilles sur le tapis), entrepôt (caisses),
 * comptoir (clients). La machine qui ralentit tout est signalée (🐢 ou ⚠️).
 *
 * Toucher une machine ouvre sa fiche (panneau « machine ») pour l'améliorer.
 * Le tableau noir ouvre « Changer de parfum » (et, de là, la gestion complète de l'usine).
 * Deux sorties : la porte du bas (devant l'usine) et la porte de droite (le quai).
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
import { Art } from './art.js';

/**
 * Images de l'intérieur (assets/usine/*.png). Tant qu'une image manque, l'ancien dessin sert.
 * Les repères (fractions de largeur / hauteur de chaque image) placent ce que le code dessine
 * par-dessus : flammes, sirop, niveau de la cuve, bouteilles, caisses, texte du tableau.
 */
const img = k => Art.img['usine_' + k];
const IMG = {
  marmite: { w: 190, syrup: 0.13, fire: 0.96 },               // surface du sirop, bas de l'ouverture du foyer
  cuve:    { w: 120, win: [0.445, 0.25, 0.115, 0.52] },        // fenêtre : x, y, largeur, hauteur
  embout:  { w: 285, belt: 0.62, from: 0.31, nozzle: 0.36, to: 0.96, screen: [0.325, 0.27, 0.065, 0.12] },
  etagere: { shelves: [0.86, 0.54, 0.2] },                     // dessus des planches, de bas en haut
  comptoir:{ top: 0.36 },                                      // bord avant du plateau
  tableau: { black: [0.07, 0.07, 0.86, 0.67] },                // zone noire : x, y, largeur, hauteur
};

const W = 1100, H = 1300;
/** Décalage vertical de chaque ligne de production (ligne 1 au mur du fond, lignes 2 et 3 dessous) */
const ROW_DY = [0, 460, 760];
/** Rangée d'une ligne : la ligne 1 est en bas, près de l'entrée ; la dernière contre le mur du fond */
const slotOf = i => ROW_DY.length - 1 - i;
const dyOf = i => ROW_DY[slotOf(i)];
const boardOf = i => BOARDS[slotOf(i)];
const ROW_KEYS = ['mat', 'cook', 'tank', 'bottle'];   // ce qu'a chaque ligne (l'entrepôt et le comptoir sont communs)
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
// Comptoir : en bas, à gauche de la porte d'entrée (le passage de droite reste libre)
const COUNTER = { x: 290, y: 1150, w: 150, h: 46, spot: { x: 365, y: 1132 } };
/** Un tableau noir par ligne (son parfum), juste sous ses matières premières ; on se tient à sa droite */
const BOARD_Y = 380;
const BOARDS = [0, 460, 760].map(dy => ({ x: 60, y: BOARD_Y + dy, w: 150, h: 96, spot: { x: 252, y: BOARD_Y + dy + 66 } }));
const DOOR = { x: 500, w: 100 };               // porte du bas
const QUAI = { y: 350, h: 110 };               // porte de droite
const CLIENT_SHIRTS = ['#3a6ea5', '#f07fb0', '#3f8f5a', '#e8c22e'];

/** Explication d'une machine, pour les enfants (fiche machine) */
export const MACHINE_INFO = {
  mat: 'Le sucre 🧂 et les fruits attendent ici. Chaque parfum a son fruit : feuilles de menthe 🌿, grenades 🍎, citrons 🍋… Sans eux, la marmite ne peut rien cuire !',
  cook: 'La marmite cuit le sucre et les fruits pour faire du sirop. Plus elle est grande, plus elle cuit vite.',
  tank: 'La cuve garde le sirop chaud en attendant la mise en bouteille. Plus elle est grande, plus elle en garde.',
  bottle: 'La machine remplit les bouteilles, une par une, sur le tapis roulant.',
  ware: 'Les bouteilles pleines sont rangées ici. Quand c’est plein, l’usine s’arrête : vends ou livre !',
  counter: 'Les clients du village viennent acheter tes bouteilles au comptoir.',
};

/** « 120 🧂 45 🍋 » : les matières d'une ligne */
const matLabel = (s, Ln) => Flavors.fruits(s, Ln.flavor).concat('sugar').map(x => `${Fmt.int(s.mat[x] || 0)} ${CONFIG.materials[x].icon}`).join(' ');

export const Interior = {
  W, H,
  viewH: 700,                     // hauteur visible visée (la salle défile si elle est plus haute)
  p: { x: 550, y: 1230 },          // position du joueur dans la salle (jamais sauvegardée)
  coins: [],
  fx: ROW_DY.map(() => ({ belt: 0, steam: [], bubbles: [] })),   // animations de chaque ligne

  /** Où l'on apparaît en entrant par une porte */
  spawn(from) {
    Object.assign(this.p, from === 'quai' ? { x: W - 60, y: QUAI.y + QUAI.h / 2 } : { x: DOOR.x + DOOR.w / 2, y: H - 70 });
    this.coins = [];
    for (const f of this.fx) { f.steam = []; f.bubbles = []; }
  },

  /* ---------------- Collisions ---------------- */
  solids(s) {
    const n = Eco.lineCount(s);
    const L = [
      { x: 0, y: 0, w: W, h: BASE - 70 },                                   // mur du fond et pied des machines
      { x: 0, y: 0, w: 26, h: H },                                          // mur de gauche
      { x: W - 26, y: 0, w: 26, h: QUAI.y },                                // mur de droite, au-dessus de la porte
      { x: W - 26, y: QUAI.y + QUAI.h, w: 26, h: H },                       // … et en dessous
      { x: 0, y: H - 26, w: DOOR.x, h: 26 },                                // mur du bas, à gauche de la porte
      { x: DOOR.x + DOOR.w, y: H - 26, w: W, h: 26 },                       // … et à droite
      { x: COUNTER.x, y: COUNTER.y, w: COUNTER.w, h: COUNTER.h },           // comptoir
    ];
    { const m = MACHINES.ware; L.push({ x: m.x, y: BASE - 80, w: m.w, h: 96 }); }   // entrepôt (commun, au fond)
    // Lignes achetées : leurs machines et leur tableau
    for (let i = 0; i < n; i++) {
      const B = boardOf(i), dy = dyOf(i);
      L.push({ x: B.x + 20, y: B.y + B.h - 18, w: B.w - 40, h: 20 });
      for (const k of ROW_KEYS) { const m = MACHINES[k]; L.push({ x: m.x, y: BASE - 80 + dy, w: m.w, h: 96 }); }
    }
    return L;
  },

  /* ---------------- Interactions ---------------- */
  /**
   * @param {object} s état
   * @param {{machine:Function, board:Function, exit:Function}} act ce que font les interactions
   */
  build(s, act) {
    const L = [];
    { const m = MACHINES.ware;
      L.push({ id: 'm-ware', x: m.spot, y: SPOT_Y, hit: { x: m.x, y: 60, w: m.w, h: BASE - 40 },
        label: `${m.icon} ${m.name} · niv. ${s.lv.ware}${rt.bneck === 'ware' ? ' · 🐢' : ''}`, run: () => act.machine('ware') }); }
    L.push({
      id: 'm-counter', ...COUNTER.spot, hit: COUNTER,
      label: `🛎️ Comptoir · niv. ${s.lv.counter} · ${s.counterOn ? 'ouvert' : 'fermé'}`, run: () => act.machine('counter'),
    });
    const lines = Eco.lines(s), multi = lines.length > 1;
    lines.forEach((Ln, i) => {
      const B = boardOf(i), f = Flavors.get(s, Ln.flavor);
      L.push({ id: 'board' + i, ...B.spot, hit: B, label: `🍬 ${multi ? `Ligne ${i + 1} · ` : ''}${f.name} · changer de parfum`, run: () => act.board(i) });
      for (const k of ROW_KEYS) {
        const m = MACHINES[k], dy = dyOf(i), bn = rt.bnecks[i], lab = multi ? ` · ligne ${i + 1}` : '';
        const hot = bn === k || (k === 'tank' && bn === 'switch');
        L.push({
          id: i ? `m-${k}-${i}` : 'm-' + k, x: m.spot, y: SPOT_Y + dy,
          // Matières : seulement la pile (le tableau de la rangée du dessus est juste au-dessus)
          hit: k === 'mat' ? { x: m.x, y: BASE - 110 + dy, w: m.w, h: 130 } : { x: m.x, y: 60 + dy, w: m.w, h: BASE - 40 },
          label: k === 'mat' ? `${m.icon} Matières${lab} · ` + matLabel(s, Ln)
            : `${m.icon} ${m.name}${lab} · niv. ${s.lv[k]}${hot ? ' · 🐢' : ''}`,
          run: () => act.machine(k, i),
        });
      }
    });
    // Ligne suivante à acheter, et la dernière (fermée)
    for (let i = lines.length; i < ROW_DY.length; i++) {
      const dy = dyOf(i), next = i === lines.length, cost = CONFIG.lines.costs[i];
      L.push({
        id: 'line' + i, x: 510, y: SPOT_Y + dy, hit: { x: 245, y: 120 + dy, w: 640, h: BASE - 100 },
        label: next ? `🏭 Ligne ${i + 1} · acheter ${Fmt.money(cost)}` : `🔒 Ligne ${i + 1} · après la ligne ${i}`,
        run: () => (next ? act.buyLine() : act.locked(i)),
      });
    }
    L.push({ id: 'exit', x: DOOR.x + DOOR.w / 2, y: H - 40, hit: { x: DOOR.x, y: H - 60, w: DOOR.w, h: 60 }, label: '🚪 Sortir', run: () => act.exit('usine') });
    L.push({ id: 'exitQuai', x: W - 50, y: QUAI.y + QUAI.h / 2, hit: { x: W - 60, y: QUAI.y, w: 60, h: QUAI.h }, label: '📦 Sortir au quai', run: () => act.exit('quai') });
    return L;
  },

  /** Où faire apparaître « +12 $ » des ventes */
  counterFloat: () => ({ x: COUNTER.x + 110, y: COUNTER.y + 20 }),

  /* ---------------- Dessin ---------------- */
  /**
   * Dessine la salle. Les éléments à trier par profondeur (machines, comptoir, clients)
   * passent par add(y, fn), comme dans le village.
   */
  draw(c, s, t, dt, add) {
    this.room(c, s, t);
    const lines = Eco.lines(s);
    ROW_DY.forEach((_, i) => {
      const Ln = lines[i], fx = this.fx[i], dy = dyOf(i), B = boardOf(i);
      const lf = (rt.lineFlow && rt.lineFlow[i]) || { cook: 0, bottle: 0 };
      // Une ligne pas encore achetée : machines en silhouette
      if (!Ln) { add(BASE + dy + 1, () => this.ghostRow(c, s, i, dy)); return; }
      const f = Flavors.get(s, Ln.bulkFlavor), cookColor = Flavors.get(s, Ln.flavor).color;
      fx.belt += dt * (lf.bottle > 0 ? 30 + 22 * Math.log2(1 + lf.bottle) : 0);
      const at = draw => () => { c.save(); c.translate(0, dy); draw(); c.restore(); };
      add(BASE + dy, at(() => this.pipes(c, t, lf, f.color)));
      add(BASE + dy + 1, at(() => this.materials(c, s, Ln)));
      add(BASE + dy + 1, at(() => this.cauldron(c, s, t, dt, lf.cook, cookColor, fx)));
      add(BASE + dy + 1, at(() => this.tank(c, s, Ln, f.color)));
      add(BASE + dy + 1, at(() => this.bottler(c, t, lf.bottle, f.color, fx)));
      add(BASE + dy + 2, at(() => this.rowSigns(c, s, t, i)));
      add(B.y + B.h, () => this.board(c, s, Ln, B, lines.length > 1 ? i + 1 : 0));
      this.workers(c, t, i, dy, lf, add);
    });
    add(BASE + 1, () => {
      this.warehouse(c, s);
      const m = MACHINES.ware; Gfx.sign(c, `${m.icon} ${m.name} · ${s.lv.ware}`, m.spot, BASE + 22, 12);
    });
    add(COUNTER.y + COUNTER.h, () => this.counter(c, s, t, dt));
    this.clients(c, s, t, add);
  },

  room(c, s, t) {
    // Sol : planches (image répétée, sinon lignes dessinées)
    const sol = Art.pattern(c, 'usine_sol', 0.55);
    c.fillStyle = sol || '#e2cda3'; c.fillRect(0, 0, W, H);
    if (!sol) {
      c.strokeStyle = 'rgba(122,82,48,.22)'; c.lineWidth = 2;
      for (let y = BASE - 70, r = 0; y < H; y += 34, r++) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
        for (let x = (r % 2) * 90; x < W; x += 180) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 34); c.stroke(); }
      }
    }
    // Mur du fond : briques
    const wallH = BASE - 70, mur = Art.pattern(c, 'usine_mur', 0.6);
    c.fillStyle = mur || '#b8674f'; c.fillRect(0, 0, W, wallH);
    if (!mur) {
      c.strokeStyle = '#9c523d'; c.lineWidth = 2;
      for (let y = 0, r = 0; y < wallH; y += 22, r++) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
        for (let x = (r % 2) * 24; x < W; x += 48) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 22); c.stroke(); }
      }
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
    const path1 = [[332, 160], [332, 96], [470, 96], [470, 112]];   // part de derrière le bord de la marmite
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
  materials(c, s, Ln) {
    const n = v => Math.max(0, Math.min(6, Math.ceil(Math.log10(1 + v) * 1.6)));
    // Cagettes : les fruits du parfum en production, chacun à sa couleur
    const fr = Flavors.fruits(s, Ln.flavor);
    const sugar = n(s.mat.sugar), fruit = n(fr.reduce((a, m) => a + (s.mat[m] || 0), 0));
    const slots = [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1], [1, 2]];
    const sac = img('sucre');
    if (sac && sugar) {                                              // pile d'image, plus grosse avec le stock
      const w = 24 + 12 * sugar, h = w * sac.height / sac.width;
      c.drawImage(sac, 96 - w / 2, BASE - 6 - h, w, h);
    } else for (let i = 0; i < sugar; i++) {
      const [cx, r] = slots[i], x = 72 + cx * 26, y = BASE - 6 - r * 26;
      c.fillStyle = '#f4efe4'; c.strokeStyle = '#b9ad95'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(x - 13, y - 30, 26, 30, 8); c.fill(); c.stroke();
      c.fillStyle = '#b9ad95'; c.fillRect(x - 6, y - 34, 12, 5);
    }
    for (let i = 0; i < fruit; i++) {
      const [cx, r] = slots[i], x = 160 + cx * 24 - 12, y = BASE - 6 - r * 22;
      const fm = fr[i % fr.length], cag = img('cagette-' + fm);
      if (cag) {                                                       // cagette pleine du fruit (image)
        const w = 30, h = w * cag.height / cag.width;
        c.drawImage(cag, x - w / 2, y - h, w, h);
        continue;
      }
      Gfx.crate(c, x, y, 26, 20);
      c.fillStyle = CONFIG.flavors[fm] ? CONFIG.flavors[fm].color : '#d23c4f';
      for (let k = -1; k <= 1; k++) { c.beginPath(); c.arc(x + k * 7, y - 20, 4, 0, Math.PI * 2); c.fill(); }
    }
    if (!sugar && !fruit) Gfx.label(c, 'vide !', 135, BASE - 30, 14, '#ffb1a8');
  },

  /** Marmite : feu, bulles et vapeur selon le débit de cuisson */
  cauldron(c, s, t, dt, flow, color, anim) {
    const x = 332, on = flow > 0, k = Math.min(1, 0.25 + Math.log2(1 + flow) / 5);
    const pot = img('marmite');
    let surf = 152;                                                    // surface du sirop (bulles, vapeur)
    if (pot) {
      const M = IMG.marmite, w = M.w, h = w * pot.height / pot.width, top = BASE - h, fy = top + h * M.fire;
      surf = top + h * M.syrup;
      c.drawImage(Art.tinted('usine_marmite', color), x - w / 2, top, w, h);   // sirop magenta → couleur du parfum
      if (on) {
        c.fillStyle = 'rgba(255,140,40,.35)'; c.beginPath(); c.ellipse(x, fy - 10, 22, 14, 0, 0, Math.PI * 2); c.fill();
        for (let i = 0; i < 3; i++) {
          const fx = x - 10 + i * 10, fh = 8 + Math.sin(t * 12 + i * 2) * 4 * k + 6 * k;
          c.fillStyle = i % 2 ? '#ffb43a' : '#ff6a2b';
          c.beginPath(); c.moveTo(fx - 6, fy); c.quadraticCurveTo(fx, fy - fh * 2, fx + 6, fy); c.fill();
        }
      }
    } else this.cauldronShape(c, t, x, on, k, color);
    this.cauldronFx(c, dt, x, on, k, anim, surf);
  },

  /** Ancienne marmite dessinée (si l'image manque) */
  cauldronShape(c, t, x, on, k, color) {
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
  },

  /** Bulles et vapeur au-dessus du sirop (surf = hauteur de sa surface) */
  cauldronFx(c, dt, x, on, k, anim, surf) {
    if (on) {
      if (Math.random() < dt * 10 * k) anim.bubbles.push({ x: x - 60 + Math.random() * 120, t: 0 });
      if (Math.random() < dt * 3 * k) anim.steam.push({ x: x - 40 + Math.random() * 80, t: 0 });
    }
    for (const b of anim.bubbles) b.t += dt;
    for (const p of anim.steam) p.t += dt;
    anim.bubbles = anim.bubbles.filter(b => b.t < 0.6);
    anim.steam = anim.steam.filter(p => p.t < 2.2);
    c.fillStyle = 'rgba(255,255,255,.55)';
    for (const b of anim.bubbles) { c.beginPath(); c.arc(b.x, surf - b.t * 6, 3 + b.t * 6, 0, Math.PI * 2); c.fill(); }
    for (const p of anim.steam) {
      c.fillStyle = `rgba(255,255,255,${0.45 * (1 - p.t / 2.2)})`;
      c.beginPath(); c.arc(p.x + Math.sin(p.t * 3 + p.x) * 8, surf - 16 - p.t * 45, 10 + p.t * 10, 0, Math.PI * 2); c.fill();
    }
  },

  /** Cuve tampon : hublot avec le niveau de sirop */
  tank(c, s, Ln, color) {
    const x = 450, w = 120, top = 110, bot = BASE - 10, im = img('cuve');
    let wx, wy, ww, wh, r;                                             // fenêtre où l'on voit le niveau
    if (im) {
      const h = w * im.height / im.width, y0 = BASE - h, [fx, fy, fw, fh] = IMG.cuve.win;
      c.drawImage(im, x, y0, w, h);
      wx = x + w * fx; wy = y0 + h * fy; ww = w * fw; wh = h * fh; r = ww / 2;
    } else {
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#9aa3aa'); g.addColorStop(0.4, '#e3e8ec'); g.addColorStop(1, '#8a939a');
    c.fillStyle = g;
    c.beginPath(); c.roundRect(x, top, w, bot - top, [40, 40, 6, 6]); c.fill();
    c.strokeStyle = '#6d7479'; c.lineWidth = 2; c.stroke();
    // Pieds
    c.fillStyle = '#6d7479'; c.fillRect(x + 12, bot, 10, 10); c.fillRect(x + w - 22, bot, 10, 10);
    // Hublot
    wx = x + 40; wy = top + 34; ww = 40; wh = bot - top - 54; r = 8;
    c.fillStyle = '#2b3136'; c.beginPath(); c.roundRect(wx - 4, wy - 4, ww + 8, wh + 8, 10); c.fill();
    c.fillStyle = '#d7e9f2'; c.beginPath(); c.roundRect(wx, wy, ww, wh, 8); c.fill();
    }
    const lvl = Math.max(0, Math.min(1, Ln.bulk / Eco.tankCap(s)));
    if (lvl > 0) {
      c.save(); c.beginPath(); c.roundRect(wx, wy, ww, wh, r); c.clip();
      c.fillStyle = color; c.fillRect(wx, wy + wh * (1 - lvl), ww, wh * lvl);
      c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(wx + ww * 0.15, wy + wh * (1 - lvl), Math.max(2, ww * 0.15), wh * lvl);
      c.restore();
    }
    // Graduations
    c.strokeStyle = '#2b3136'; c.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) { const y = wy + wh * i / 4; c.beginPath(); c.moveTo(wx + ww - Math.min(10, ww / 2), y); c.lineTo(wx + ww, y); c.stroke(); }
  },

  /** Embouteillage : remplisseuse et tapis roulant */
  bottler(c, t, flow, color, anim) {
    const im = img('embouteilleuse');
    if (im) {
      const E = IMG.embout, X = 600, w = E.w, h = w * im.height / im.width, top = BASE - h;
      c.drawImage(im, X, top, w, h);
      {                                                              // petit voyant fixe : vert quand ça tourne
        const [sx, sy, sw] = E.screen;
        c.fillStyle = flow > 0 ? '#5fd36b' : '#9aa3aa';
        c.beginPath(); c.arc(X + w * (sx + sw / 2), top + h * sy - 5, 3, 0, Math.PI * 2); c.fill();
      }
      // Bouteilles sur le tapis : remplies en passant sous la buse
      const by = top + h * E.belt, x1 = X + w * E.to, fillX = X + w * E.nozzle;
      for (let x = X + w * E.from + (anim.belt % 34); x < x1 - 4; x += 34) this.bottleAt(c, x, by, x > fillX + 4, color);
      return;
    }
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
    const off = anim.belt % 20;
    for (let x = bx0 - 6 + off; x < bx1 + 6; x += 20) c.fillRect(x, by + 3, 3, 10);
    c.fillStyle = '#555'; c.fillRect(bx0, by + 16, 8, 14); c.fillRect(bx1 - 8, by + 16, 8, 14);
    // Bouteilles (colorées = pleines, après le bras de remplissage)
    const fillX = fx + 112;
    for (let x = bx0 + (anim.belt % 34); x < bx1 - 4; x += 34) this.bottleAt(c, x, by, x > fillX, color);
  },

  /** Une bouteille posée en (x, by) : vide, ou pleine de sirop avec son bouchon */
  bottleAt(c, x, by, full, color) {
    c.fillStyle = 'rgba(220,240,250,.9)'; c.strokeStyle = '#7d98a6'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(x - 7, by - 26, 14, 26, 4); c.fill(); c.stroke();
    c.fillRect(x - 3, by - 34, 6, 9);
    if (full) { c.fillStyle = color; c.beginPath(); c.roundRect(x - 6, by - 18, 12, 17, 3); c.fill(); c.fillStyle = '#c2453a'; c.fillRect(x - 3, by - 36, 6, 4); }
  },

  /** Entrepôt : étagères, caisses selon le remplissage */
  warehouse(c, s) {
    const x = 905, w = 160, top = 96, rows = 3, cols = 4;
    const fill = Math.max(0, Math.min(1, Eco.totalStock(s) / Eco.wareCap(s)));
    const n = Math.round(fill * rows * cols);
    const im = img('etagere');
    // Dessus des planches, de bas en haut (image étirée sur toute la hauteur, sinon montants dessinés)
    const shelfY = im ? IMG.etagere.shelves.map(f => top + f * (BASE - top)) : [0, 1, 2].map(r => BASE - 6 - r * 66);
    if (im) c.drawImage(im, x, top, w, BASE - top);
    else { c.fillStyle = '#8b5a33'; c.fillRect(x, top, 8, BASE - top); c.fillRect(x + w - 8, top, 8, BASE - top); }
    // Couleurs des caisses : parfums en stock
    const cols2 = s.unlocked.filter(k => (s.stock[k] || 0) >= 1).map(k => Flavors.get(s, k).color);
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const y = shelfY[r];
      if (!im) { c.fillStyle = '#a8733f'; c.fillRect(x, y, w, 8); }
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

  /**
   * Panneaux sous les machines d'une ligne + ce qui la ralentit (dessiné dans le repère de la ligne).
   * Ligne 1 : toutes les machines (entrepôt compris). Lignes 2 et 3 : matières, cuisson, cuve, embouteillage.
   */
  rowSigns(c, s, t, i) {
    for (const k of ROW_KEYS) {
      const m = MACHINES[k];
      Gfx.sign(c, k === 'mat' ? `${m.icon} ${m.name}` : `${m.icon} ${m.name} · ${s.lv[k]}`, m.spot, BASE + 22, 12);
    }
    const raw = rt.bnecks[i] || '';
    const bn = raw === 'switch' ? 'tank' : raw;
    const m = MACHINES[bn];
    // « Entrepôt plein » : déjà dit par le bandeau rouge en haut de la salle
    if (!m || raw === 'ware') return;
    const alert = raw === 'mat' || raw === 'ware' || raw === 'switch';
    const txt = !alert ? '🐢 Le plus lent' : raw === 'mat' ? '⚠️ Plus de matières !' : '⚠️ Ça bloque ici !';
    const y = 58 + Math.sin(t * 4) * 4;
    Gfx.label(c, txt, m.x + m.w / 2, y, alert ? 16 : 14, alert ? '#ffd0c8' : '#fff');
  },

  /** Ligne pas encore achetée : machines en pointillés et panneau */
  ghostRow(c, s, i, dy) {
    c.save();
    c.translate(0, dy);
    c.setLineDash([8, 6]); c.lineWidth = 3; c.strokeStyle = 'rgba(122,82,48,.45)';
    c.fillStyle = 'rgba(122,82,48,.08)';
    for (const k of ROW_KEYS) {
      const m = MACHINES[k];
      c.beginPath(); c.roundRect(m.x + 6, 150, m.w - 12, BASE - 156, 12); c.fill(); c.stroke();
    }
    c.setLineDash([]);
    const next = i === Eco.lineCount(s);
    Gfx.sign(c, next ? `🏭 Ligne ${i + 1} · ${Fmt.money(CONFIG.lines.costs[i])}` : `🔒 Ligne ${i + 1}`, 565, 236, 16);
    if (next) Gfx.label(c, 'Touche pour l’acheter : un 2e parfum en même temps !'.replace('2e', `${i + 1}e`), 565, 270, 13, '#fffaf0');
    c.restore();
  },

  /**
   * Deux ouvriers par ligne : l'un surveille la marmite, l'autre range les bouteilles au bout du tapis.
   * Ils bougent quand la ligne produit, et attendent sinon.
   */
  workers(c, t, i, dy, lf, add) {
    const busy = lf.cook > 0 || lf.bottle > 0;
    const crew = [{ x0: 290, x1: 400, sp: 0.9 }, { x0: 760, x1: 870, sp: 1.2 }];
    crew.forEach((w, k) => {
      const ph = t * w.sp + i * 1.7 + k * 2.1, u = busy ? (Math.sin(ph) + 1) / 2 : 0.5;
      const x = w.x0 + (w.x1 - w.x0) * u, y = BASE + dy + 88 + k * 4; // sous les panneaux, pas devant
      const dir = !busy ? 'haut' : Math.cos(ph) > 0 ? 'droite' : 'gauche';
      add(y, () => {
        Gfx.shadow(c, x, y, 12, 4);
        drawCharacter(c, x, y, { key: 'ouvrier', dir, moving: busy, phase: t * 9 + k, shirt: '#3a6ea5', cap: '#27496f', hair: '#5a3a22' });
      });
    });
  },

  /** Bandeau d'alerte en haut de la salle (null si tout va bien) */
  alert(s) {
    if (Eco.totalStock(s) >= Eco.wareCap(s) * 0.9) return '⚠️ Entrepôt presque plein : vends ou livre !';
    const i = (rt.bnecks || []).indexOf('mat');
    if (i >= 0) return `⚠️ Plus de matières${Eco.lineCount(s) > 1 ? ` sur la ligne ${i + 1}` : ''} !`;
    return null;
  },

  /** Tableau noir : le parfum en production */
  board(c, s, Ln, B, num) {
    const { x, y, w, h } = B, f = Flavors.get(s, Ln.flavor), im = img('tableau');
    if (im) {                                                          // zone noire de l'image calée sur B
      const [bx, by, bw, bh] = IMG.tableau.black, IW = w / bw, IH = h / bh;
      c.drawImage(im, x - bx * IW, y - by * IH, IW, IH);
    } else {
      c.fillStyle = '#8b5a33';
      c.fillRect(x + 20, y + h - 4, 8, 26); c.fillRect(x + w - 28, y + h - 4, 8, 26);
      c.fillRect(x - 6, y - 6, w + 12, h + 12);
      c.fillStyle = '#2f4a3a'; c.fillRect(x, y, w, h);
    }
    c.fillStyle = '#e9f1e4'; c.textAlign = 'center';
    c.font = '600 12px "DM Sans", system-ui, sans-serif'; c.fillText(num ? `Ligne ${num}` : 'Parfum du jour', x + w / 2, y + 22);
    c.font = '800 20px "DM Sans", system-ui, sans-serif'; c.fillText(f.name, x + w / 2, y + 50, w - 16);
    c.fillStyle = f.color; c.beginPath(); c.arc(x + w / 2, y + 72, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e9f1e4'; c.font = '600 11px "DM Sans", system-ui, sans-serif';
    c.fillText(`${Fmt.money(f.price)} / bt`, x + w / 2, y + 90);
  },

  /** Comptoir : caisse enregistreuse, bouteilles en vitrine, pièces qui sautent */
  counter(c, s, t, dt) {
    const { x, y, w, h } = COUNTER, im = img('comptoir');
    if (im) {                                                          // bord avant du plateau sur y
      const ih = w * im.height / im.width;
      c.drawImage(im, x, y - IMG.comptoir.top * ih, w, ih);
    } else {
      c.fillStyle = '#8b5a33'; c.beginPath(); c.roundRect(x, y, w, h, 6); c.fill();
      c.fillStyle = '#a8733f'; c.fillRect(x, y, w, 10);
      c.fillStyle = '#6d4424'; for (let i = 1; i < 5; i++) c.fillRect(x + i * w / 5, y + 14, 3, h - 18);
      // Caisse
      c.fillStyle = '#c2453a'; c.beginPath(); c.roundRect(x + w - 60, y - 26, 44, 28, 5); c.fill();
      c.fillStyle = '#ffe28a'; c.fillRect(x + w - 54, y - 22, 32, 8);
    }
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
      const x = COUNTER.x + 35 + i * 45, y = COUNTER.y + COUNTER.h + 44 + (i % 2) * 6;
      add(y, () => {
        Gfx.shadow(c, x, y, 13, 5);
        drawCharacter(c, x, y, { key: 'villageois', alt: i % 2 ? '' : 'e', dir: 'haut', moving: false, phase: 0, shirt: CLIENT_SHIRTS[i % 4], hair: i % 2 ? '#2b2b2b' : '#a0522d' });
      });
    }
  },
};

/** Liste des fiches machines (ordre de la chaîne) */
export const MACHINE_KEYS = ['mat', 'cook', 'tank', 'bottle', 'ware', 'counter'];
export const machineMeta = k => (k === 'counter' ? { name: 'Comptoir', icon: '🛎️' } : MACHINES[k]);
