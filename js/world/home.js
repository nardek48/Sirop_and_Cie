/**
 * home.js — ta maison : la façade dans le village et l'intérieur où l'on marche.
 *
 * Dedans : un lit (dormir la nuit → « Bien reposé »), des emplacements à décorer
 * (papier peint, sol, couette, cadre, coin, salon, tapis) et, derrière la cloison,
 * le petit garage où l'on choisit son véhicule parmi ceux déjà achetés.
 *
 * Comme interior.js (l'usine), ce module décrit et dessine ; world.js gère les entrées,
 * le déplacement et la caméra (World.scene === 'maison'). Les règles (dormir, changer
 * de véhicule) sont dans sim/world-systems.js.
 */
import { CONFIG } from '../config.js';
import { Clock } from '../sim/clock.js';
import { Eco } from '../sim/eco.js';
import { Gfx } from './gfx.js';
import { Art } from './art.js';
import { drawVehicle } from './characters.js';

/* ------------------------------------------------------------------
 * Catalogue de décoration : ajouter un choix = une ligne.
 * color : pour les couleurs (mur, sol, couette, tapis) ; icon : objet dessiné en grand.
 * ------------------------------------------------------------------ */
export const HOME_DECO = {
  wall: { name: 'Papier peint', icon: '🖌️', options: [
    { id: 'creme', name: 'Crème', color: '#f3e3c3' }, { id: 'menthe', name: 'Menthe', color: '#cfe8d6' },
    { id: 'ciel', name: 'Ciel', color: '#cfe1f3' }, { id: 'rose', name: 'Rose', color: '#f6d3dc' },
    { id: 'lavande', name: 'Lavande', color: '#e1d6f0' }, { id: 'citron', name: 'Citron', color: '#f6ecb0' },
  ] },
  floor: { name: 'Sol', icon: '🪵', options: [
    { id: 'bois', name: 'Bois clair', color: '#d2a670' }, { id: 'noyer', name: 'Bois foncé', color: '#8f5f38' },
    { id: 'carreaux', name: 'Carrelage', color: '#e8e1d3' }, { id: 'moquette', name: 'Moquette bleue', color: '#86a6cc' },
  ] },
  couette: { name: 'Couette du lit', icon: '🛏️', options: [
    { id: 'bleu', name: 'Bleue', color: '#3a6ea5' }, { id: 'rouge', name: 'Rouge', color: '#d23c4f' },
    { id: 'vert', name: 'Verte', color: '#3f8f5a' }, { id: 'violet', name: 'Violette', color: '#7b4fb0' },
    { id: 'jaune', name: 'Jaune', color: '#e8b52e' },
  ] },
  mur: { name: 'Au mur', icon: '🖼️', options: [
    { id: 'tableau', name: 'Tableau', icon: '🖼️' }, { id: 'carte', name: 'Carte', icon: '🗺️' },
    { id: 'horloge', name: 'Horloge', icon: '🕰️' }, { id: 'arcenciel', name: 'Arc-en-ciel', icon: '🌈' },
    { id: 'etoile', name: 'Étoile', icon: '⭐' }, { id: 'aucun', name: 'Rien' },
  ] },
  coin: { name: 'Dans le coin', icon: '🪴', options: [
    { id: 'plante', name: 'Plante', icon: '🪴' }, { id: 'aquarium', name: 'Aquarium', icon: '🐠' },
    { id: 'guitare', name: 'Guitare', icon: '🎸' }, { id: 'robot', name: 'Robot', icon: '🤖' },
    { id: 'nounours', name: 'Gros nounours', icon: '🧸' }, { id: 'aucun', name: 'Rien' },
  ] },
  salon: { name: 'Le salon', icon: '🛋️', options: [
    { id: 'canape', name: 'Canapé', icon: '🛋️' }, { id: 'tele', name: 'Télé', icon: '📺' },
    { id: 'piano', name: 'Piano', icon: '🎹' }, { id: 'ordi', name: 'Ordinateur', icon: '🖥️' },
    { id: 'aucun', name: 'Rien' },
  ] },
  tapis: { name: 'Tapis', icon: '🟥', options: [
    { id: 'rouge', name: 'Rouge', color: '#c94a3c' }, { id: 'bleu', name: 'Bleu', color: '#4f7fb8' },
    { id: 'vert', name: 'Vert', color: '#5a9e6a' }, { id: 'arcenciel', name: 'Arc-en-ciel', color: 'rainbow' },
    { id: 'aucun', name: 'Rien' },
  ] },
};
/** Ordre des rubriques dans la fiche « Décorer » */
export const DECO_SLOTS = ['wall', 'floor', 'couette', 'mur', 'coin', 'salon', 'tapis'];
/** Choix actuel d'une rubrique (avec repli si la sauvegarde contient un choix inconnu) */
export function decoPick(s, slot) {
  const H = s.home || {}, id = slot === 'wall' || slot === 'floor' ? H[slot] : (H.deco || {})[slot];
  const opts = HOME_DECO[slot].options;
  return opts.find(o => o.id === id) || opts[0];
}

/* ------------------------------------------------------------------
 * Dans le village : la maison et son garage, sous les terrains
 * ------------------------------------------------------------------ */
export const HOUSE = { x: 890, y: 870, w: 200, h: 160 };
export const HOUSE_GARAGE = { x: 1110, y: 948, w: 132, h: 82 };

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const emoji = (c, ch, x, y, size) => {
  // Couleur opaque : Chrome applique la transparence de fillStyle aux emoji en couleur
  c.fillStyle = '#000';
  c.font = `${size}px ${EMOJI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillText(ch, x, y);
};

/* ------------------------------------------------------------------
 * Intérieur
 * ------------------------------------------------------------------ */
const W = 1100, H = 640;
const WALL_Y = 210;                        // pied du mur du fond
const PART = { x: 700, w: 24, gap: [330, 450] };   // cloison salon | garage, avec passage
const DOOR = { x: 290, w: 90 };            // porte d'entrée (en bas)
const GDOOR = { x: 860, w: 130 };          // porte du garage (en bas)
const BED = { x: 40, y: 200, w: 170, h: 140 };
const SPOTS = {
  bed: { x: 240, y: 300 },
  mur: { x: 520, y: 262 },
  coin: { x: 640, y: 318 },
  salon: { x: 560, y: 528 },
  tapis: { x: 330, y: 470 },
  paint: { x: 120, y: 560 },
};
const SALON = { x: 510, y: 430, w: 100, h: 46 };
/** Places de parking : 0 = à pied (porte-chaussures), puis vélo, charrette, camionnette */
const PARK = [
  { x: 770, y: 600, spot: { x: 770, y: 548 } },
  { x: 790, y: 335, spot: { x: 790, y: 400 } },
  { x: 905, y: 335, spot: { x: 880, y: 400 } },
  { x: 1015, y: 335, spot: { x: 1010, y: 400 } },
];

export const HomeRoom = {
  W, H,
  p: { x: 335, y: 590 },
  zzz: [],

  spawn(from) {
    Object.assign(this.p, from === 'garageMaison' ? { x: GDOOR.x + GDOOR.w / 2, y: H - 60 } : { x: DOOR.x + DOOR.w / 2, y: H - 60 });
  },

  solids() {
    return [
      { x: 0, y: 0, w: W, h: WALL_Y + 20 },                                         // mur du fond
      { x: 0, y: 0, w: 24, h: H }, { x: W - 24, y: 0, w: 24, h: H },                 // côtés
      { x: 0, y: H - 24, w: DOOR.x, h: 24 },                                         // mur du bas…
      { x: DOOR.x + DOOR.w, y: H - 24, w: GDOOR.x - DOOR.x - DOOR.w, h: 24 },
      { x: GDOOR.x + GDOOR.w, y: H - 24, w: W, h: 24 },
      { x: PART.x, y: 0, w: PART.w, h: PART.gap[0] },                                // cloison, avec passage
      { x: PART.x, y: PART.gap[1], w: PART.w, h: H },
      { x: BED.x, y: BED.y, w: BED.w, h: BED.h },                                    // lit
      { x: SALON.x, y: SALON.y, w: SALON.w, h: SALON.h },                            // meuble du salon
      { x: 735, y: 290, w: W - 24 - 735, h: 60 },                                    // véhicules garés
    ];
  },

  /**
   * @param {object} s état
   * @param {{sleep:Function, deco:Function, ride:Function, exit:Function}} act
   */
  build(s, act) {
    const night = Clock.isNight(s);
    const L = [
      { id: 'h-bed', ...SPOTS.bed, hit: BED, label: night ? '😴 Dormir jusqu’au matin' : '🛏️ Le lit (on dort la nuit)', run: () => act.sleep() },
      { id: 'h-paint', ...SPOTS.paint, hit: { x: 70, y: 500, w: 100, h: 70 }, label: '🎨 Décorer ma maison', run: () => act.deco('wall') },
      { id: 'h-mur', ...SPOTS.mur, hit: { x: 460, y: 50, w: 120, h: 110 }, label: '🖼️ Changer le cadre', run: () => act.deco('mur') },
      { id: 'h-coin', ...SPOTS.coin, hit: { x: 600, y: 170, w: 90, h: 110 }, label: '🪴 Changer le coin', run: () => act.deco('coin') },
      { id: 'h-salon', ...SPOTS.salon, hit: { x: SALON.x - 10, y: SALON.y - 60, w: SALON.w + 20, h: SALON.h + 60 }, label: '🛋️ Changer le salon', run: () => act.deco('salon') },
      { id: 'h-tapis', ...SPOTS.tapis, hit: { x: 220, y: 430, w: 220, h: 80 }, label: '🟥 Changer le tapis', run: () => act.deco('tapis') },
      { id: 'h-exit', x: DOOR.x + DOOR.w / 2, y: H - 40, hit: { x: DOOR.x, y: H - 60, w: DOOR.w, h: 60 }, label: '🚪 Sortir', run: () => act.exit('maison') },
      { id: 'h-gexit', x: GDOOR.x + GDOOR.w / 2, y: H - 40, hit: { x: GDOOR.x, y: H - 60, w: GDOOR.w, h: 60 }, label: '🚪 Sortir par le garage', run: () => act.exit('garageMaison') },
    ];
    const cur = Eco.rideIdx(s);
    PARK.forEach((pk, i) => {
      const v = CONFIG.vehicles[i];
      const label = i === cur ? `✓ ${v.icon} ${i ? v.name : 'À pied'} : c’est ce que tu prends`
        : i <= s.vehicle ? (i ? `${v.icon} Prendre : ${v.name.toLowerCase()}` : '👟 Partir à pied')
        : `🔒 ${v.icon} ${v.name} · au garage du village`;
      L.push({ id: 'h-ride' + i, ...pk.spot, hit: { x: pk.x - 50, y: pk.y - 70, w: 100, h: 80 }, label, run: () => act.ride(i) });
    });
    return L;
  },

  /* ---------------- Dessin ---------------- */
  draw(c, s, t, dt, add) {
    this.room(c, s, t);
    this.rug(c, s);
    add(BED.y + BED.h, () => this.bed(c, s, t, dt));
    add(SALON.y + SALON.h, () => this.salon(c, s));
    add(WALL_Y + 60, () => this.corner(c, s));
    add(345, () => this.parking(c, s, t));
    add(PARK[0].y, () => this.shoes(c, s));
    add(560, () => this.paintPot(c));
  },

  room(c, s, t) {
    const wall = decoPick(s, 'wall').color, floor = decoPick(s, 'floor');
    // Sols : salon (au choix) et garage (béton)
    c.fillStyle = floor.color; c.fillRect(0, 0, PART.x, H);
    if (floor.id === 'carreaux') {
      c.fillStyle = 'rgba(120,100,70,.12)';
      for (let y = WALL_Y; y < H; y += 40) for (let x = ((y / 40) % 2) * 40; x < PART.x; x += 80) c.fillRect(x, y, 40, 40);
    } else if (floor.id !== 'moquette') {
      c.strokeStyle = 'rgba(70,40,15,.18)'; c.lineWidth = 2;
      for (let y = WALL_Y, r = 0; y < H; y += 30, r++) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(PART.x, y); c.stroke();
        for (let x = (r % 2) * 70; x < PART.x; x += 140) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 30); c.stroke(); }
      }
    }
    c.fillStyle = '#b9b4ab'; c.fillRect(PART.x, 0, W - PART.x, H);
    c.strokeStyle = 'rgba(0,0,0,.08)'; c.lineWidth = 2;
    for (let x = PART.x + 60; x < W; x += 90) { c.beginPath(); c.moveTo(x, WALL_Y); c.lineTo(x, H); c.stroke(); }

    // Mur du fond : papier peint à rayures douces
    c.fillStyle = wall; c.fillRect(0, 0, PART.x, WALL_Y);
    c.fillStyle = 'rgba(255,255,255,.22)';
    for (let x = 0; x < PART.x; x += 36) c.fillRect(x, 0, 14, WALL_Y);
    c.fillStyle = '#9a6a42'; c.fillRect(0, WALL_Y - 12, PART.x, 12);           // plinthe
    // Mur du garage : parpaings
    c.fillStyle = '#8f8a82'; c.fillRect(PART.x, 0, W - PART.x, WALL_Y);
    c.strokeStyle = 'rgba(0,0,0,.15)';
    for (let y = 0, r = 0; y < WALL_Y; y += 26, r++) {
      c.beginPath(); c.moveTo(PART.x, y); c.lineTo(W, y); c.stroke();
      for (let x = PART.x + (r % 2) * 30; x < W; x += 60) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 26); c.stroke(); }
    }
    // Outils accrochés au mur du garage
    emoji(c, '🔧', 780, 120, 34); emoji(c, '🪛', 830, 118, 30); emoji(c, '🧰', 1000, 150, 40);

    // Fenêtre : le ciel suit l'heure du jeu
    const dark = Clock.darkness(s);
    const sky = dark > 0.3 ? '#22325c' : dark > 0.05 ? '#f0a860' : '#a9d8f5';
    c.fillStyle = '#7a4a2a'; c.fillRect(300, 34, 150, 120);
    c.fillStyle = sky; c.fillRect(308, 42, 134, 104);
    if (dark > 0.3) {
      c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(410, 72, 14, 0, Math.PI * 2); c.fill();
      c.fillStyle = sky; c.beginPath(); c.arc(404, 67, 12, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      for (const [x, y] of [[330, 60], [352, 100], [380, 56], [428, 118]]) c.fillRect(x, y, 2, 2);
    } else {
      c.fillStyle = '#ffe28a'; c.beginPath(); c.arc(410, 74, 14, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#7a4a2a'; c.fillRect(373, 42, 4, 104); c.fillRect(308, 92, 134, 4);
    // Rideaux
    c.fillStyle = decoPick(s, 'couette').color;
    c.globalAlpha = 0.8; c.fillRect(290, 28, 22, 136); c.fillRect(438, 28, 22, 136); c.globalAlpha = 1;

    // Cadre au mur
    const mur = decoPick(s, 'mur');
    if (mur.icon) {
      c.fillStyle = '#7a4a2a'; c.fillRect(472, 52, 96, 96);
      c.fillStyle = '#fffaf0'; c.fillRect(480, 60, 80, 80);
      emoji(c, mur.icon, 520, 122, 54);
    }

    // Cloison avec passage, murs, portes
    c.fillStyle = '#7d5a3c';
    c.fillRect(PART.x, WALL_Y - 10, PART.w, PART.gap[0] - WALL_Y + 10); c.fillRect(PART.x, PART.gap[1], PART.w, H);
    c.fillRect(0, 0, 24, H); c.fillRect(W - 24, 0, 24, H);
    c.fillRect(0, H - 24, DOOR.x, 24); c.fillRect(DOOR.x + DOOR.w, H - 24, GDOOR.x - DOOR.x - DOOR.w, 24); c.fillRect(GDOOR.x + GDOOR.w, H - 24, W, 24);
    c.fillStyle = '#7d9a4f'; c.fillRect(DOOR.x + 8, H - 30, DOOR.w - 16, 26);       // paillasson
    c.fillStyle = '#5c5850'; c.fillRect(GDOOR.x + 6, H - 22, GDOOR.w - 12, 18);      // seuil du garage
    Gfx.sign(c, '🚪 Sortie', DOOR.x + DOOR.w / 2, H - 34, 12);
    Gfx.sign(c, '🚗 Garage', PART.x + 190, WALL_Y + 28, 12);
  },

  bed(c, s, t, dt) {
    const { x, y, w, h } = BED, col = decoPick(s, 'couette').color;
    c.fillStyle = '#8a5a34'; c.fillRect(x, y - 30, w, 40);                  // tête de lit
    c.fillStyle = '#a8733f'; c.fillRect(x, y + 6, w, h - 6);
    c.fillStyle = '#fffaf0'; c.beginPath(); c.roundRect(x + 10, y + 10, w - 20, 34, 10); c.fill();   // oreiller
    c.fillStyle = col; c.beginPath(); c.roundRect(x + 4, y + 46, w - 8, h - 50, 10); c.fill();
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + 4, y + 46, w - 8, 10);
    // Panier du compagnon au pied du lit
    if (s.look.pet !== 'aucun') {
      c.fillStyle = '#b07a44'; c.beginPath(); c.ellipse(x + w + 50, y + h + 30, 32, 14, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e9d3b0'; c.beginPath(); c.ellipse(x + w + 50, y + h + 26, 24, 9, 0, 0, Math.PI * 2); c.fill();
    }
    // La nuit, des « z » au-dessus de l'oreiller pour donner envie de dormir
    if (Clock.isNight(s)) {
      if (Math.random() < dt * 1.2) this.zzz.push({ t: 0 });
      for (const z of this.zzz) z.t += dt;
      this.zzz = this.zzz.filter(z => z.t < 2.4);
      for (const z of this.zzz) {
        c.globalAlpha = Math.max(0, 1 - z.t / 2.4);
        Gfx.label(c, 'z', x + w / 2 + z.t * 16, y - 10 - z.t * 30, 14 + z.t * 6, '#cfe1f3');
      }
      c.globalAlpha = 1;
    } else this.zzz = [];
  },

  corner(c, s) {
    const o = decoPick(s, 'coin');
    if (!o.icon) return;
    const x = 645, y = 262;
    Gfx.shadow(c, x, y, 34, 8);
    if (o.id === 'aquarium') {
      c.fillStyle = '#6b4a2e'; c.fillRect(x - 40, y - 34, 80, 34);
      c.fillStyle = 'rgba(120,200,240,.75)'; c.fillRect(x - 36, y - 84, 72, 50);
      c.strokeStyle = '#5a7a8a'; c.lineWidth = 3; c.strokeRect(x - 36, y - 84, 72, 50);
      emoji(c, '🐠', x - 6, y - 46, 30);
      return;
    }
    emoji(c, o.icon, x, y, 76);
  },

  salon(c, s) {
    const o = decoPick(s, 'salon');
    if (!o.icon) return;
    const x = SALON.x + SALON.w / 2, y = SALON.y + SALON.h;
    Gfx.shadow(c, x, y - 4, 52, 10);
    emoji(c, o.icon, x, y + 4, 90);
  },

  paintPot(c) {
    Gfx.shadow(c, 120, 552, 26, 7);
    emoji(c, '🎨', 120, 552, 46);
  },

  /** Tapis : sous tout le reste (dessiné avant le tri) */
  rug(c, s) {
    const o = decoPick(s, 'tapis');
    if (!o.color) return;
    const x = 330, y = 470, rx = 110, ry = 42;
    if (o.color === 'rainbow') {
      ['#d23c4f', '#e8703a', '#e8c22e', '#3f8f5a', '#3a6ea5', '#7b4fb0'].forEach((col, i) => {
        c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx - i * 16, ry - i * 6, 0, 0, Math.PI * 2); c.fill();
      });
    } else {
      c.fillStyle = o.color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 4;
      c.beginPath(); c.ellipse(x, y, rx - 14, ry - 8, 0, 0, Math.PI * 2); c.stroke();
    }
  },

  /** Les véhicules garés : achetés (en couleur), pas encore achetés (silhouette) */
  parking(c, s, t) {
    const cur = Eco.rideIdx(s);
    for (let i = 1; i < PARK.length; i++) {
      const pk = PARK[i], v = CONFIG.vehicles[i], owned = i <= s.vehicle;
      if (i === cur) {
        c.fillStyle = 'rgba(243,201,58,.35)'; c.beginPath(); c.ellipse(pk.x - (i === 2 ? 20 : 0), pk.y + 2, 58, 16, 0, 0, Math.PI * 2); c.fill();
      }
      c.save();
      if (!owned) c.globalAlpha = 0.25;
      Gfx.shadow(c, pk.x, pk.y, 30, 6);
      drawVehicle(c, pk.x, pk.y, v.id, 1, false, 0, 0, s.look.shirt);
      c.restore();
      Gfx.sign(c, owned ? (i === cur ? `✓ ${v.name}` : v.name) : `🔒 ${v.name}`, pk.x - (i === 2 ? 20 : 0), pk.y + 34, 11);
    }
  },
  shoes(c, s) {
    const pk = PARK[0], cur = Eco.rideIdx(s) === 0;
    c.fillStyle = '#8a5a34'; c.fillRect(pk.x - 34, pk.y - 26, 68, 26);
    emoji(c, '👟', pk.x - 14, pk.y - 8, 26); emoji(c, '👟', pk.x + 16, pk.y - 8, 26);
    Gfx.sign(c, cur ? '✓ À pied' : 'À pied', pk.x, pk.y - 34, 11);
  },
};

/* ------------------------------------------------------------------
 * Façade dans le village
 * ------------------------------------------------------------------ */
export const HomeOutside = {
  solids: () => [
    { x: HOUSE.x, y: HOUSE.y + 20, w: HOUSE.w, h: HOUSE.h - 20 },
    { x: HOUSE_GARAGE.x, y: HOUSE_GARAGE.y + 10, w: HOUSE_GARAGE.w, h: HOUSE_GARAGE.h - 10 },
  ],

  draw(c, s, t, dark) {
    if (this.drawArt(c, s, t, dark)) return;
    const { x, y, w, h } = HOUSE, top = y + h * 0.38, lit = dark > 0.2;
    const wall = decoPick(s, 'wall').color, roof = '#3a6ea5';
    Gfx.shadow(c, x + w / 2 + 6, y + h + 2, w / 2 + 6, 8);
    // Cheminée : fumée le soir et la nuit
    c.fillStyle = '#6e3f31'; c.fillRect(x + w - 56, y - 20, 22, 50);
    if (dark > 0.05) for (let i = 0; i < 3; i++) {
      const k = (t * 0.4 + i / 3) % 1;
      c.fillStyle = `rgba(240,240,240,${0.5 * (1 - k)})`;
      c.beginPath(); c.arc(x + w - 45 + Math.sin(k * 6 + i) * 8, y - 28 - k * 60, 7 + k * 10, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = wall; c.fillRect(x, top, w, y + h - top);
    c.fillStyle = 'rgba(0,0,0,.07)'; c.fillRect(x, y + h - 10, w, 10);
    c.fillStyle = roof;
    c.beginPath(); c.moveTo(x - 12, top + 6); c.lineTo(x + w + 12, top + 6); c.lineTo(x + w / 2, y - 6); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 2;
    for (let i = 1; i < 3; i++) { const k = i / 3, yy = y - 6 + (top + 12 - y) * k; c.beginPath(); c.moveTo(x + w / 2 - (w / 2 + 12) * k, yy); c.lineTo(x + w / 2 + (w / 2 + 12) * k, yy); c.stroke(); }
    // Fenêtres (allumées la nuit) et porte
    for (const wx of [x + 38, x + w - 38]) {
      c.fillStyle = '#7a4a2a'; c.fillRect(wx - 20, top + 22, 40, 36);
      c.fillStyle = lit ? '#ffd970' : '#bfe3f2'; c.fillRect(wx - 16, top + 26, 32, 28);
      c.fillStyle = '#7a4a2a'; c.fillRect(wx - 1, top + 26, 2, 28);
    }
    const dx = CONFIG.places.maison.x;
    c.fillStyle = '#8a4f2c'; c.beginPath(); c.roundRect(dx - 18, y + h - 58, 36, 58, [14, 14, 0, 0]); c.fill();
    c.fillStyle = '#f2c230'; c.beginPath(); c.arc(dx + 10, y + h - 28, 3, 0, Math.PI * 2); c.fill();
    // Petit garage accolé
    const G = HOUSE_GARAGE;
    c.fillStyle = '#d9cbb3'; c.fillRect(G.x, G.y, G.w, G.h);
    c.fillStyle = '#6b6b6b'; c.fillRect(G.x - 6, G.y - 8, G.w + 12, 12);
    c.fillStyle = '#a7a39b'; c.fillRect(G.x + 20, G.y + 22, G.w - 40, G.h - 22);
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2;
    for (let yy = G.y + 30; yy < G.y + G.h; yy += 10) { c.beginPath(); c.moveTo(G.x + 20, yy); c.lineTo(G.x + G.w - 20, yy); c.stroke(); }
    Gfx.sign(c, `🏠 Chez ${s.look.name}`, x + w / 2, y - 12, 13);
    Gfx.sign(c, `${Eco.vehicle(s).icon} Garage`, G.x + G.w / 2, G.y - 12, 11);
  },

  /**
   * Maison et garage en images (assets/batiments/maison-sirotin.png, garage-maison.png) :
   * leurs murs magenta prennent la couleur du papier peint choisi dans la maison.
   * @returns {boolean} false tant que les images ne sont pas chargées (on dessine alors l'ancienne façade)
   */
  drawArt(c, s, t, dark) {
    const wall = decoPick(s, 'wall').color;
    const house = Art.tinted('home_maison', wall), gar = Art.tinted('home_garage', wall);
    if (!house || !gar) return false;
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    const put = (img, B) => {
      const w = B.w + 20, hh = w * img.height / img.width, x = B.x - 10, y = B.y + B.h - hh;
      Gfx.shadow(c, x + w / 2 + 6, B.y + B.h + 2, w / 2 + 4, 8);
      c.drawImage(img, x, y, w, hh);
      return { x, y, w, hh };
    };
    const G = put(gar, HOUSE_GARAGE), M = put(house, HOUSE);
    // Cheminée (haut à droite de l'image) : fumée le soir et la nuit
    if (dark > 0.05) for (let i = 0; i < 3; i++) {
      const k = (t * 0.4 + i / 3) % 1;
      c.fillStyle = `rgba(240,240,240,${0.5 * (1 - k)})`;
      c.beginPath(); c.arc(M.x + M.w * 0.81 + Math.sin(k * 6 + i) * 8, M.y + M.hh * 0.08 - k * 60, 7 + k * 10, 0, Math.PI * 2); c.fill();
    }
    Gfx.sign(c, `🏠 Chez ${s.look.name}`, M.x + M.w / 2, M.y - 6, 13);
    Gfx.sign(c, `${Eco.vehicle(s).icon} Garage`, G.x + G.w / 2, G.y - 6, 11);
    return true;
  },

  /** Lumières de la nuit (coordonnées monde) */
  lights: () => [
    { x: HOUSE.x + 38, y: HOUSE.y + 100, r: 70 }, { x: HOUSE.x + HOUSE.w - 38, y: HOUSE.y + 100, r: 70 },
  ],
};
