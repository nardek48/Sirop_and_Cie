/**
 * render.js — dessin de la scène (hors personnages) : sol, bâtiments, récoltes,
 * maisons, décor, quartiers verrouillés, météo et lumière de nuit.
 * Coordonnées monde, sauf weather() et lights() qui travaillent en pixels écran.
 */
import { CONFIG, clientByPlace, typeById } from '../config.js';
import { Fmt } from '../core/format.js';
import { rt } from '../core/game.js';
import { Eco } from '../sim/eco.js';
import { Events } from '../sim/events.js';
import { MAP } from './map.js';
import { Art } from './art.js';
import { Gfx } from './gfx.js';

const TAU = Math.PI * 2;

export const Render = {
  grass: null, flowers: [], lightCv: null,

  init(ctx) {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // Texture d'herbe en motif
    const g = document.createElement('canvas');
    g.width = g.height = 64;
    const c = g.getContext('2d');
    c.fillStyle = '#8cc46a'; c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#7fb85e';
    for (let i = 0; i < 14; i++) c.fillRect(Math.floor(rnd() * 62), Math.floor(rnd() * 62), 2, 5);
    this.grass = ctx.createPattern(g, 'repeat');
    // Fleurs (graine fixe : toujours au même endroit)
    const zones = [{ x: 20, y: 20, w: 2240, h: 140 }, { x: 1680, y: 660, w: 900, h: 420 }, { x: 540, y: 870, w: 1110, h: 200 }, { x: 2700, y: 860, w: 680, h: 650 }];
    const cols = ['#f7d64a', '#f07fb0', '#ffffff', '#b58ee0', '#ff8a5c'];
    for (const z of zones) for (let i = 0; i < 50; i++) {
      const x = z.x + rnd() * z.w, y = z.y + rnd() * z.h;
      if (Math.hypot(x - MAP.fountain.x, y - MAP.fountain.y) < 80) continue;
      this.flowers.push({ x, y, c: cols[Math.floor(rnd() * cols.length)] });
    }
    this.lightCv = document.createElement('canvas');
  },

  /* ---------------- Sol ---------------- */
  ground(c, s, t) {
    const R = MAP.road;
    c.fillStyle = this.grass; c.fillRect(0, 0, MAP.w, MAP.h);

    // Mer, plage et vagues
    const W = MAP.water;
    c.fillStyle = '#6fb3d9'; c.fillRect(W.x, W.y, W.w, W.h);
    c.fillStyle = '#e9dcb4'; c.fillRect(W.x - 8, W.y, 8, W.h); c.fillRect(W.x - 8, W.h, W.w + 8, 12);
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const y = 30 + i * 36, off = Math.sin(t * 1.5 + i) * 14;
      for (const [x0, dy, sg] of [[40, 0, 1], [190, 16, -1]]) {
        c.beginPath(); c.moveTo(W.x + x0 + off * sg, y + dy); c.quadraticCurveTo(W.x + x0 + 30 + off * sg, y + dy - 8, W.x + x0 + 60 + off * sg, y + dy); c.stroke();
      }
    }
    c.fillStyle = '#a07048'; c.fillRect(2420, 190, 60, 110);
    c.strokeStyle = '#7a5230'; c.lineWidth = 2;
    for (let y = 198; y < 300; y += 14) { c.beginPath(); c.moveTo(2420, y); c.lineTo(2480, y); c.stroke(); }

    // Rails de la Colline (derrière la gare) + tunnel
    const r = MAP.rails;
    c.fillStyle = '#b9a88c'; c.fillRect(r.x0, r.y - 16, MAP.w - r.x0, 32);
    c.fillStyle = '#7a5230';
    for (let x = r.x0 + 6; x < MAP.w; x += 22) c.fillRect(x, r.y - 14, 8, 28);
    c.fillStyle = '#6d6d6d'; c.fillRect(r.x0, r.y - 9, MAP.w - r.x0, 4); c.fillRect(r.x0, r.y + 5, MAP.w - r.x0, 4);

    // Route + trottoirs
    c.fillStyle = '#ddd2bf'; c.fillRect(0, R.y - 18, MAP.w, 18); c.fillRect(0, R.y + R.h, MAP.w, 18);
    c.fillStyle = '#8d8a86'; c.fillRect(0, R.y, MAP.w, R.h);
    c.strokeStyle = '#f4efe4'; c.lineWidth = 4; c.setLineDash([30, 24]);
    c.beginPath(); c.moveTo(0, CONFIG.roadY); c.lineTo(MAP.w, CONFIG.roadY); c.stroke();
    c.setLineDash([]);

    // Allées vers les portes
    c.fillStyle = '#ddd2bf';
    for (const b of MAP.buildings) { const d = CONFIG.places[b.id]; c.fillRect(d.x - 22, b.y + b.h, 44, R.y - 18 - b.y - b.h + 1); }

    // Verger communal
    c.fillStyle = '#79ad58'; c.fillRect(80, 660, 430, 410);
    c.strokeStyle = '#9b6a3a'; c.lineWidth = 4; c.strokeRect(80, 660, 430, 410);
    c.fillStyle = '#9b6a3a';
    for (let x = 80; x <= 510; x += 43) { c.fillRect(x - 3, 652, 6, 16); c.fillRect(x - 3, 1062, 6, 16); }
    c.fillStyle = '#79ad58'; c.fillRect(250, 656, 90, 10);
    Gfx.sign(c, '🌳 Verger communal', 295, 645);

    // Champs : chemin + parcelles labourées
    c.fillStyle = '#d8c08f'; c.fillRect(525, 1100, 40, 60);
    c.fillRect(0, 1160, 2650, 26);
    for (const p of MAP.fields.canne) { c.fillStyle = '#9b7b4f'; c.fillRect(p.x - 90, p.y - 100, 180, 110); }

    // Bois de sureau (Colline)
    c.fillStyle = '#76a85a'; c.fillRect(2730, 880, 540, 260);

    // Terrains
    MAP.plots.forEach((p, i) => {
      if (s.houses.some(h => h.plot === i)) {
        c.fillStyle = '#9fcf7c'; c.fillRect(p.x, p.y, p.w, p.h);
        c.fillStyle = '#ddd2bf'; c.fillRect(p.x + p.w / 2 - 12, R.y + R.h + 18, 24, p.y - R.y - R.h - 18 + 20);
        return;
      }
      c.fillStyle = '#d8c08f'; c.fillRect(p.x, p.y, p.w, p.h);
      c.strokeStyle = '#b09460'; c.lineWidth = 2; c.setLineDash([8, 6]); c.strokeRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8); c.setLineDash([]);
      c.fillStyle = '#7a5230'; c.fillRect(p.x + p.w / 2 - 3, p.y + 60, 6, 40);
      Gfx.sign(c, `À vendre · ${i + 1}`, p.x + p.w / 2, p.y + 58);
    });

    for (const f of this.flowers) {
      c.fillStyle = f.c; c.beginPath(); c.arc(f.x, f.y, 3.2, 0, TAU); c.fill();
      c.fillStyle = '#f3c93a'; c.beginPath(); c.arc(f.x, f.y, 1.2, 0, TAU); c.fill();
    }
  },

  /* ---------------- Bâtiments ---------------- */
  building(c, b, s, t, dark) {
    const { x, y, w, h } = b, top = y + h * 0.38, door = CONFIG.places[b.id];
    const client = b.client ? clientByPlace(b.id) : null;
    const name = b.name || client.name, icon = b.icon || client.icon;
    const lit = dark > 0.2;

    Gfx.shadow(c, x + w / 2 + 6, y + h + 2, w / 2 + 6, 8);

    // Cheminées (usine : fumée quand la cuisson tourne ; labo : bulles colorées)
    if (b.id === 'usine' || b.id === 'labo') {
      const cx = b.id === 'usine' ? x + 57 : x + w - 34, wide = b.id === 'usine' ? 34 : 18;
      c.fillStyle = b.id === 'usine' ? '#6e3f31' : '#8d7aa8';
      c.fillRect(cx - wide / 2, y - (b.id === 'usine' ? 50 : 26), wide, 70);
      const on = b.id === 'usine' ? rt.flow.cook > 0.01 : s.recipes.length > 0;
      if (on) for (let i = 0; i < 4; i++) {
        const k = (t * 0.5 + i / 4) % 1;
        c.fillStyle = b.id === 'usine' ? `rgba(245,245,245,${0.6 * (1 - k)})` : `hsla(${(i * 80 + t * 40) % 360},70%,70%,${0.8 * (1 - k)})`;
        c.beginPath(); c.arc(cx + Math.sin(k * 6 + i) * 10, y - (b.id === 'usine' ? 60 : 32) - k * 80, (b.id === 'usine' ? 10 : 5) + k * 12, 0, TAU); c.fill();
      }
    }

    c.fillStyle = b.wall; c.fillRect(x, top, w, y + h - top);
    c.fillStyle = 'rgba(0,0,0,.07)'; c.fillRect(x, y + h - 10, w, 10);

    // Toit en trapèze + tuiles
    c.fillStyle = b.roof;
    c.beginPath(); c.moveTo(x - 10, top + 6); c.lineTo(x + w + 10, top + 6); c.lineTo(x + w - 14, y); c.lineTo(x + 14, y); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const k = i / 4, yy = y + (top + 6 - y) * k;
      c.beginPath(); c.moveTo(x + 14 - 24 * k, yy); c.lineTo(x + w - 14 + 24 * k, yy); c.stroke();
    }

    // Drapeau de la mairie
    if (b.id === 'mairie') {
      c.fillStyle = '#5b4030'; c.fillRect(x + w / 2 - 2, y - 46, 4, 50);
      c.fillStyle = Events.is(s, 'fete') ? '#e0562b' : '#d98a1c';
      c.beginPath(); c.moveTo(x + w / 2 + 2, y - 46);
      for (let i = 0; i <= 6; i++) c.lineTo(x + w / 2 + 2 + i * 5, y - 46 + Math.sin(t * 5 + i) * 2);
      c.lineTo(x + w / 2 + 32, y - 30); c.lineTo(x + w / 2 + 2, y - 30); c.fill();
    }

    // Fenêtres (allumées la nuit)
    const n = Math.max(2, Math.floor(w / 62));
    for (let i = 0; i < n; i++) {
      const wx = x + (i + 0.5) * w / n;
      if (Math.abs(wx - door.x) < 44 || (b.id === 'usine' && Math.abs(wx - CONFIG.places.quai.x) < 50)) continue;
      c.fillStyle = '#5b4030'; c.fillRect(wx - 16, top + 22, 32, 28);
      c.fillStyle = lit ? '#ffd97a' : '#fdf1cf'; c.fillRect(wx - 13, top + 25, 26, 22);
      c.fillStyle = '#5b4030'; c.fillRect(wx - 1, top + 25, 2, 22);
    }

    // Porte (garage : grande porte à lamelles)
    if (b.id === 'garage') {
      c.fillStyle = '#5c6670'; c.fillRect(door.x - 40, y + h - 62, 80, 62);
      c.fillStyle = '#7d8a96';
      for (let i = 0; i < 6; i++) c.fillRect(door.x - 38, y + h - 60 + i * 10, 76, 6);
    } else {
      c.fillStyle = '#6b4226'; c.beginPath(); c.roundRect(door.x - 18, y + h - 50, 36, 50, [12, 12, 0, 0]); c.fill();
      c.fillStyle = '#f3c93a'; c.beginPath(); c.arc(door.x + 9, y + h - 24, 2.5, 0, TAU); c.fill();
    }

    // Horloge de la gare
    if (b.id === 'gare') {
      c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(x + w / 2, top + 36, 18, 0, TAU); c.fill();
      c.strokeStyle = '#3b2a1a'; c.lineWidth = 3; c.stroke();
      c.beginPath(); c.moveTo(x + w / 2, top + 36); c.lineTo(x + w / 2 + Math.cos(t / 3) * 12, top + 36 + Math.sin(t / 3) * 12); c.stroke();
    }

    // Quai de chargement (usine)
    if (b.id === 'usine') {
      const q = CONFIG.places.quai;
      c.fillStyle = '#4a3a30'; c.fillRect(q.x - 40, y + h - 62, 80, 62);
      c.fillStyle = '#8d8a86';
      for (let i = 0; i < 6; i++) c.fillRect(q.x - 38, y + h - 60 + i * 10, 76, 6);
      const crates = Math.min(6, Math.ceil(Eco.totalStock(s) / 15));
      for (let i = 0; i < crates; i++) Gfx.crate(c, q.x - 66 + (i % 2) * 22, y + h - 2 - Math.floor(i / 2) * 16, 20, 15);
      Gfx.sign(c, '📦 Quai', q.x, y + h - 70);
    }

    Gfx.sign(c, `${icon} ${name}`, x + w / 2, top - 2, 15);

    // Bâtiment pas encore ouvert : planches en croix sur la porte et panneau « Bientôt ! »
    if (b.panel && s.opened[b.id] === false) {
      c.fillStyle = 'rgba(60,50,40,.28)'; c.fillRect(x, top, w, y + h - top);
      c.save(); c.translate(door.x, y + h - 26);
      c.fillStyle = '#a0703f'; c.strokeStyle = '#6b4226'; c.lineWidth = 2;
      for (const a of [-0.5, 0.5]) { c.save(); c.rotate(a); c.fillRect(-30, -5, 60, 10); c.strokeRect(-30, -5, 60, 10); c.restore(); }
      c.restore();
      Gfx.sign(c, '🔒 Bientôt !', door.x, y + h - 52, 13);
    }

    if (client && !Eco.clientOpen(s, client) && (!client.district || s.districts[client.district])) {
      c.fillStyle = 'rgba(60,50,40,.45)'; c.fillRect(x - 10, y, w + 20, h);
      Gfx.label(c, `🔒 ⭐ ${client.rep}`, x + w / 2, y + h / 2 + 10, 18);
    }
    if (b.id === 'contrats' && s.offers.length) {
      const bx = x + w - 6, by = y + 6 + Math.sin(t * 4) * 3;
      c.fillStyle = '#e0562b'; c.beginPath(); c.arc(bx, by, 15, 0, TAU); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
      Gfx.label(c, String(s.offers.length), bx, by + 6, 16);
    }
  },

  /* ---------------- Récoltes ---------------- */
  tree(c, p, grow, kind) {
    if (Art.draw(c, kind === 'sureau' ? 'sureau' : 'arbre', p.x, p.y + 6, 90, 110)) return;
    const ripe = grow <= 0, regrow = kind === 'sureau' ? CONFIG.fields.sureau.regrow : CONFIG.fields.verger.regrow;
    Gfx.shadow(c, p.x, p.y + 4, 30, 9);
    c.fillStyle = '#7a5230'; c.fillRect(p.x - 7, p.y - 26, 14, 30);
    c.fillStyle = kind === 'sureau' ? (ripe ? '#4f7f3c' : '#6e9d5a') : (ripe ? '#3f8f4a' : '#5da564');
    for (const [dx, dy, r] of [[0, -58, 32], [-22, -44, 22], [22, -44, 22], [0, -36, 24]]) { c.beginPath(); c.arc(p.x + dx, p.y + dy, r, 0, TAU); c.fill(); }
    if (ripe) {
      c.fillStyle = kind === 'sureau' ? '#3a2a5e' : '#d23c4f';
      const r = kind === 'sureau' ? 3.5 : 5;
      for (const [dx, dy] of [[-14, -60], [12, -66], [20, -44], [-22, -40], [2, -40], [-4, -76], [8, -52]]) { c.beginPath(); c.arc(p.x + dx, p.y + dy, r, 0, TAU); c.fill(); }
    } else this.ring(c, p.x, p.y - 58, 1 - grow / regrow);
  },

  cane(c, p, grow, t) {
    if (Art.draw(c, 'canne', p.x, p.y + 4, 180, 120)) return;
    const k = grow <= 0 ? 1 : 0.35 + 0.5 * (1 - grow / CONFIG.fields.canne.regrow);
    for (let i = 0; i < 9; i++) {
      const sx = p.x - 72 + i * 18, hgt = (70 + (i % 3) * 10) * k, sway = Math.sin(t * 1.4 + i) * 3;
      c.strokeStyle = grow <= 0 ? '#c9b24a' : '#8fb05a'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(sx, p.y); c.lineTo(sx + sway, p.y - hgt); c.stroke();
      c.strokeStyle = '#5f8a3a'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(sx + sway, p.y - hgt); c.lineTo(sx + sway + 12, p.y - hgt + 10); c.stroke();
    }
    if (grow > 0) this.ring(c, p.x, p.y - 100, 1 - grow / CONFIG.fields.canne.regrow);
  },

  ring(c, x, y, k) {
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 4;
    c.beginPath(); c.arc(x, y, 12, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.95)';
    c.beginPath(); c.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + k * TAU); c.stroke();
  },

  /* ---------------- Maisons ---------------- */
  house(c, p, h, dark) {
    const t = typeById(h.type), u = CONFIG.houses.uses[h.use];
    if (Art.draw(c, 'maison_' + t.id, p.x + p.w / 2, p.y + p.h - 4, p.w * t.scale, p.h * t.scale)) return;
    const w = p.w * t.scale, hh = p.h * t.scale * 0.95, x = p.x + (p.w - w) / 2, y = p.y + p.h - hh - 8, top = y + hh * 0.42;
    Gfx.shadow(c, x + w / 2 + 4, y + hh, w / 2 + 4, 6);
    if (t.id === 'domaine') for (const tx of [x - 8, x + w - 22]) {
      c.fillStyle = '#e8dcc4'; c.fillRect(tx, y - 10, 30, hh + 10);
      c.fillStyle = u.roof; c.beginPath(); c.moveTo(tx - 4, y - 8); c.lineTo(tx + 15, y - 38); c.lineTo(tx + 34, y - 8); c.fill();
    }
    c.fillStyle = '#f3e3c3'; c.fillRect(x, top, w, y + hh - top);
    c.fillStyle = u.roof;
    c.beginPath(); c.moveTo(x - 8, top + 5); c.lineTo(x + w + 8, top + 5); c.lineTo(x + w - 10, y); c.lineTo(x + 10, y); c.closePath(); c.fill();
    if (h.use === 'shop') for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#fff' : '#c2453a'; c.fillRect(x + i * w / 6, top + 5, w / 6, 10); }
    c.fillStyle = '#6b4226'; c.fillRect(x + w / 2 - 10, y + hh - 28, 20, 28);
    if (w > 100) for (const wx of [x + w * 0.2, x + w * 0.8 - 18]) { c.fillStyle = dark > 0.2 ? '#ffd97a' : '#fdf1cf'; c.fillRect(wx, top + 16, 18, 16); }
    if (h.use === 'orchard') { c.fillStyle = '#3f8f4a'; c.beginPath(); c.arc(x + w + 14, y + hh - 20, 14, 0, TAU); c.fill(); }
    Gfx.sign(c, `${u.icon} ${'★'.repeat(h.lvl)}`, x + w / 2, y + 2, 12);
  },

  /* ---------------- Décor ---------------- */
  fountain(c, t) {
    const f = MAP.fountain;
    c.fillStyle = '#b8b0a3'; c.beginPath(); c.ellipse(f.x, f.y, f.r + 8, 24, 0, 0, TAU); c.fill();
    c.fillStyle = '#7cc0e3'; c.beginPath(); c.ellipse(f.x, f.y - 2, f.r, 17, 0, 0, TAU); c.fill();
    c.fillStyle = '#b8b0a3'; c.fillRect(f.x - 6, f.y - 40, 12, 38);
    c.fillStyle = 'rgba(200,235,255,.9)';
    for (let i = 0; i < 6; i++) {
      const k = (t * 1.2 + i / 6) % 1, a = (i / 6) * TAU;
      c.beginPath(); c.arc(f.x + Math.cos(a) * 26 * k, f.y - 44 + 60 * k * k - 30 * k, 3, 0, TAU); c.fill();
    }
  },

  windmill(c, t) {
    const m = MAP.windmill;
    Gfx.shadow(c, m.x, m.y + 2, 40, 10);
    c.fillStyle = '#e8dcc4';
    c.beginPath(); c.moveTo(m.x - 34, m.y); c.lineTo(m.x - 22, m.y - 110); c.lineTo(m.x + 22, m.y - 110); c.lineTo(m.x + 34, m.y); c.fill();
    c.fillStyle = '#8a3f2e'; c.beginPath(); c.moveTo(m.x - 28, m.y - 108); c.lineTo(m.x, m.y - 140); c.lineTo(m.x + 28, m.y - 108); c.fill();
    c.fillStyle = '#6b4226'; c.fillRect(m.x - 10, m.y - 32, 20, 32);
    c.save(); c.translate(m.x, m.y - 112); c.rotate(t * 0.8);
    c.fillStyle = '#f4efe4'; c.strokeStyle = '#7a5230'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { c.rotate(TAU / 4); c.fillRect(4, -7, 64, 14); c.strokeRect(4, -7, 64, 14); }
    c.restore();
    c.fillStyle = '#3b2a1a'; c.beginPath(); c.arc(m.x, m.y - 112, 6, 0, TAU); c.fill();
  },

  /** Train qui traverse la Colline toutes les 45 s */
  train(c, t) {
    const r = MAP.rails, cycle = t % 45;
    if (cycle > 14) return;
    const x = MAP.w + 40 - cycle * 90;
    c.save();
    c.beginPath(); c.rect(r.x0, 0, MAP.w - r.x0, MAP.h); c.clip();
    const cars = ['#c2453a', '#3a6ea5', '#e8c22e', '#3f8f5a'];
    cars.forEach((col, i) => {
      const cx = x + i * 96;
      c.fillStyle = col; c.beginPath(); c.roundRect(cx, r.y - 40, 88, 36, 6); c.fill();
      c.fillStyle = '#bfe3f2'; for (let k = 0; k < 3; k++) c.fillRect(cx + 10 + k * 26, r.y - 34, 16, 12);
      c.fillStyle = '#2b2b2b'; for (const wx of [cx + 16, cx + 72]) { c.beginPath(); c.arc(wx, r.y - 2, 8, 0, TAU); c.fill(); }
    });
    c.fillStyle = '#2b2b2b'; c.fillRect(x + 8, r.y - 62, 16, 24);
    for (let i = 0; i < 3; i++) { c.fillStyle = `rgba(240,240,240,${0.6 - i * 0.18})`; c.beginPath(); c.arc(x + 16 + i * 22, r.y - 72 - i * 10, 10 + i * 5, 0, TAU); c.fill(); }
    c.restore();
    // entrée du tunnel
    c.fillStyle = '#6d6d6d'; c.beginPath(); c.roundRect(r.x0 - 4, r.y - 52, 26, 70, [14, 14, 0, 0]); c.fill();
    c.fillStyle = '#1e1e1e'; c.beginPath(); c.roundRect(r.x0 + 2, r.y - 44, 20, 62, [10, 10, 0, 0]); c.fill();
  },

  decor(c, d, dark) {
    if (d.kind === 'lampadaire') {
      c.fillStyle = '#3b3b3b'; c.fillRect(d.x - 3, d.y - 56, 6, 56);
      c.fillRect(d.x - 8, d.y - 4, 16, 4);
      c.fillStyle = dark > 0.15 ? '#ffe7a0' : '#d9d2c3';
      c.beginPath(); c.roundRect(d.x - 8, d.y - 68, 16, 14, 4); c.fill();
    } else if (d.kind === 'banc') {
      c.fillStyle = '#8a5a34'; c.fillRect(d.x - 26, d.y - 18, 52, 8); c.fillRect(d.x - 26, d.y - 30, 52, 6);
      c.fillStyle = '#3b3b3b'; c.fillRect(d.x - 22, d.y - 10, 4, 10); c.fillRect(d.x + 18, d.y - 10, 4, 10);
    } else if (d.kind === 'buisson') {
      c.fillStyle = '#4f8f45';
      for (const [dx, dy, r] of [[-12, -12, 14], [10, -12, 14], [0, -22, 15]]) { c.beginPath(); c.arc(d.x + dx, d.y + dy, r, 0, TAU); c.fill(); }
    } else if (d.kind === 'rocher') {
      c.fillStyle = '#9b9588'; c.beginPath(); c.ellipse(d.x, d.y - 12, 26, 16, 0, 0, TAU); c.fill();
      c.fillStyle = '#b8b2a5'; c.beginPath(); c.ellipse(d.x - 6, d.y - 18, 12, 7, 0, 0, TAU); c.fill();
    } else if (d.kind === 'panneau') {
      c.fillStyle = '#7a5230'; c.fillRect(d.x - 3, d.y - 40, 6, 40);
      Gfx.sign(c, d.text || '', d.x, d.y - 36, 13);
    } else if (d.kind === 'fleurs') {
      c.fillStyle = '#4f8f45'; c.fillRect(d.x - 20, d.y - 6, 40, 6);
      const cols = ['#f07fb0', '#ffd23f', '#e0562b', '#b98ae0', '#fff'];
      for (let i = 0; i < 7; i++) {
        const fx = d.x - 18 + i * 6, fy = d.y - 10 - (i % 3) * 5;
        c.fillStyle = '#3f7a38'; c.fillRect(fx - 1, fy, 2, d.y - fy);
        c.fillStyle = cols[i % cols.length]; c.beginPath(); c.arc(fx, fy, 4, 0, TAU); c.fill();
      }
    } else if (d.kind === 'sapin') {
      c.fillStyle = '#6b4226'; c.fillRect(d.x - 5, d.y - 14, 10, 14);
      c.fillStyle = '#2f6b3f';
      for (const [w, top, bot] of [[26, 88, 50], [22, 70, 34], [17, 52, 14]]) {
        c.beginPath(); c.moveTo(d.x, d.y - top); c.lineTo(d.x + w, d.y - bot); c.lineTo(d.x - w, d.y - bot); c.closePath(); c.fill();
      }
    } else if (d.kind === 'cloture') {
      c.fillStyle = '#c9a36b'; c.strokeStyle = '#8a6a3c'; c.lineWidth = 1.5;
      c.fillRect(d.x - 32, d.y - 20, 64, 5); c.fillRect(d.x - 32, d.y - 10, 64, 5);
      for (const px of [-28, -9, 10, 28]) { c.beginPath(); c.roundRect(d.x + px - 3, d.y - 28, 6, 28, [3, 3, 0, 0]); c.fill(); c.stroke(); }
    } else if (d.kind === 'tonneau') {
      c.fillStyle = '#9a6234'; c.beginPath(); c.roundRect(d.x - 14, d.y - 36, 28, 36, 8); c.fill();
      c.fillStyle = '#5c5c5c'; c.fillRect(d.x - 15, d.y - 30, 30, 3); c.fillRect(d.x - 15, d.y - 8, 30, 3);
      c.fillStyle = '#b07a48'; c.beginPath(); c.ellipse(d.x, d.y - 35, 12, 3, 0, 0, TAU); c.fill();
    } else if (d.kind === 'parasol') {
      c.fillStyle = '#8a5a34'; c.fillRect(d.x - 2, d.y - 62, 4, 62);
      c.fillStyle = '#e8dcc2'; c.beginPath(); c.ellipse(d.x, d.y - 20, 18, 6, 0, 0, TAU); c.fill();
      c.fillRect(d.x - 2, d.y - 20, 4, 20);
      for (let i = 0; i < 6; i++) {
        c.fillStyle = i % 2 ? '#fff6e6' : '#e0562b';
        c.beginPath(); c.moveTo(d.x, d.y - 70);
        c.lineTo(d.x - 32 + i * 64 / 6, d.y - 50); c.lineTo(d.x - 32 + (i + 1) * 64 / 6, d.y - 50); c.closePath(); c.fill();
      }
    }
  },

  /** Voile + barrière sur un quartier fermé */
  lockedDistrict(c, id, t) {
    const D = CONFIG.districts[id], M = MAP.districts[id], a = M.area, b = M.barrier;
    c.fillStyle = 'rgba(52,66,46,.58)'; c.fillRect(a.x, a.y, a.w, a.h);
    if (id === 'champs') {
      c.fillStyle = '#9b6a3a';
      for (let x = 0; x < b.w; x += 40) c.fillRect(x - 3, b.y - 16, 6, 30);
      c.fillRect(0, b.y - 10, b.w, 5); c.fillRect(0, b.y + 2, b.w, 5);
    } else {
      for (let y = 0; y < b.h; y += 24) { c.fillStyle = (y / 24) % 2 ? '#e0562b' : '#f4efe4'; c.fillRect(b.x, y, b.w, 24); }
    }
    const cx = a.x + a.w / 2, cy = id === 'champs' ? a.y + 170 : 900;
    Gfx.label(c, `🔒 ${D.icon} ${D.name}`, cx, cy, 30);
    Gfx.label(c, `${Fmt.money(D.cost)}${D.rep ? ` · ⭐ ${D.rep}` : ''}`, cx, cy + 34, 20, '#ffe28a');
  },

  /* ---------------- Écran : météo & nuit ---------------- */
  weather(c, s, t, W, H) {
    if (Events.is(s, 'pluie')) {
      c.fillStyle = 'rgba(40,60,90,.14)'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(210,225,255,.55)'; c.lineWidth = 1.5;
      c.beginPath();
      for (let i = 0; i < 160; i++) {
        const x = ((i * 137.5 + t * 240) % (W + 100)) - 50, y = ((i * 73.3 + t * 820) % (H + 60)) - 30;
        c.moveTo(x, y); c.lineTo(x - 5, y + 16);
      }
      c.stroke();
    } else if (Events.is(s, 'canicule')) {
      c.fillStyle = 'rgba(255,170,60,.11)'; c.fillRect(0, 0, W, H);
    }
  },

  /**
   * Voile de nuit avec des trous de lumière (lampadaires, portes, joueur).
   * @param {{x:number,y:number,r:number}[]} lights positions écran (px canvas)
   */
  lights(c, dark, lights) {
    if (dark < 0.01) return;
    const L = this.lightCv, W = c.canvas.width, H = c.canvas.height;
    if (L.width !== W || L.height !== H) { L.width = W; L.height = H; }
    const l = L.getContext('2d');
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, W, H);
    l.fillStyle = `rgba(14,20,52,${dark})`; l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'destination-out';
    for (const p of lights) {
      const g = l.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.arc(p.x, p.y, p.r, 0, TAU); l.fill();
    }
    c.drawImage(L, 0, 0);
    // halo chaud
    c.globalCompositeOperation = 'lighter';
    for (const p of lights) {
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 0.6);
      g.addColorStop(0, `rgba(255,200,110,${0.22 * dark})`); g.addColorStop(1, 'rgba(255,200,110,0)');
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r * 0.6, 0, TAU); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  },
};
