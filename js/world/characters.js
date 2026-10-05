/**
 * characters.js — dessin des personnages (4 directions), véhicules et compagnons.
 * Chaque dessin essaie d'abord la feuille de sprites (Art), puis la forme de secours.
 */
import { Art } from './art.js';
import { Gfx } from './gfx.js';

const SKIN = '#f2c9a0', PANTS = '#3b2a1a';
/** Planches dont le vêtement est magenta, repeint avec o.shirt */
const TINT = new Set(['player', 'villageois']);

/**
 * Personnage vu en 3/4, ancré aux pieds.
 * @param {object} o { key, alt, dir:'bas'|'haut'|'gauche'|'droite', moving, phase, shirt, hair, cap, name, crates }
 *   alt : suffixe d'une variante (ex. 'e' → planche « villageoise ») si elle est chargée
 * @returns {number} y du haut de la tête (pour placer étiquettes et caisses)
 */
export function drawCharacter(c, x, y, o) {
  const frame = o.moving ? 1 + (Math.floor(o.phase / Math.PI) % 2) : 0;
  // Variante (villageoise), puis vêtement magenta repeint de sa couleur (joueur, villageois)
  const key = o.alt && Art.sheets[o.key + o.alt] ? o.key + o.alt : o.key;
  const sheet = TINT.has(o.key) ? Art.sheetTint(key, o.shirt) : key;
  if (Art.drawFrame(c, sheet, x, y, o.dir, frame)) return y - 64;

  const sw = o.moving ? Math.sin(o.phase) * 3.5 : 0;
  const bob = o.moving ? Math.abs(Math.sin(o.phase)) * 1.5 : 0;
  const side = o.dir === 'gauche' ? -1 : o.dir === 'droite' ? 1 : 0;
  const hair = o.hair || '#5a3a22';

  // Jambes : côte à côte de face/dos, en ciseaux de profil
  if (side) {
    // jambe du fond plus sombre, pour que les deux pas se distinguent
    c.fillStyle = '#23180e'; c.fillRect(x - 3 - sw * side, y - 13, 6, 13);
    c.fillStyle = PANTS; c.fillRect(x - 3 + sw * side, y - 13, 6, 13);
  } else {
    c.fillStyle = PANTS;
    c.fillRect(x - 8, y - 13 - Math.max(0, sw), 6, 13);
    c.fillRect(x + 2, y - 13 - Math.max(0, -sw), 6, 13);
  }
  // Corps
  c.fillStyle = o.shirt;
  c.beginPath(); c.roundRect(x - (side ? 9 : 12), y - 36 - bob, side ? 18 : 24, 24, 7); c.fill();
  // Bras
  c.fillStyle = SKIN;
  if (side) c.fillRect(x - 2 - sw * 0.8, y - 32 - bob, 5, 12);
  else { c.fillRect(x - 16, y - 32 - bob + sw, 5, 12); c.fillRect(x + 11, y - 32 - bob - sw, 5, 12); }
  // Tête
  const hy = y - 46 - bob;
  c.fillStyle = o.dir === 'haut' ? hair : SKIN;
  c.beginPath(); c.arc(x, hy, 12, 0, Math.PI * 2); c.fill();
  c.fillStyle = o.cap || hair;
  if (o.dir === 'haut') { c.beginPath(); c.arc(x, hy - 3, 12.5, Math.PI, 0); c.fill(); }
  else if (side) {
    c.beginPath(); c.arc(x, hy - 3, 12.5, Math.PI, 0); c.fill();
    c.beginPath(); c.arc(x - side * 8, hy - 1, 6, 0, Math.PI * 2); c.fill();      // cheveux à l'arrière
    if (o.cap) c.fillRect(side > 0 ? x + 4 : x - 18, hy - 5, 14, 4);             // visière
  } else {
    c.beginPath(); c.arc(x, hy - 3, 12.5, Math.PI, 0); c.fill();
    if (o.cap) c.fillRect(x - 8, hy - 5, 16, 4);
  }
  // Yeux
  c.fillStyle = '#2a1c10';
  if (o.dir === 'bas') { c.fillRect(x - 5, hy, 3, 4); c.fillRect(x + 2, hy, 3, 4); }
  else if (side) { c.fillRect(x + side * 5 - 1, hy, 3, 4); c.fillStyle = '#e0a88a'; c.fillRect(x + side * 11 - 1, hy + 3, 2, 3); }
  return y - 58 - bob;
}

/** Caisses empilées sur la tête + étiquette du nom */
export function drawCarry(c, x, top, crates, name) {
  for (let i = 0; i < crates; i++) Gfx.crate(c, x, top - 2 - i * 13, 26, 13);
  if (name) Gfx.label(c, name, x, top - 6 - crates * 13, 13);
}

/**
 * Véhicule du joueur. Dessiné avant le personnage (dessous) ou à sa place (camionnette).
 * @returns {'under'|'replace'|null}
 */
export function drawVehicle(c, x, y, vehicle, flip, moving, phase, crates, shirt) {
  const f = flip < 0 ? -1 : 1;
  // Véhicules en images (assets/village) : vus de côté vers la droite, retournés vers la gauche
  const im = Art.img['v_' + vehicle];
  if (im) {
    const bump = moving ? Math.abs(Math.sin(phase)) * 1.2 : 0;
    if (vehicle === 'velo') { Gfx.shadow(c, x, y, 26, 5); Art.put(c, im, x, y + 1 - bump, 62, f < 0); return 'under'; }
    if (vehicle === 'charrette') {
      const cx = x - f * 40;                                     // tirée derrière le joueur, poignée vers lui
      Gfx.shadow(c, cx, y, 28, 5);
      const h = Art.put(c, im, cx, y + 1 - bump, 74, f > 0);
      for (let i = 0; i < Math.min(3, crates); i++) Gfx.crate(c, cx + f * 6 - 12 + i * 12, y - h * 0.62 - (i % 2) * 6, 14, 12);
      return 'under';
    }
    if (vehicle === 'camionnette') {
      Gfx.shadow(c, x, y, 44, 8);
      Art.put(c, im, x, y + 1 - bump, 104, f < 0);
      Gfx.label(c, '🍾', x - f * 13, y - 70, 13);
      return 'replace';
    }
  }
  if (vehicle === 'velo') {
    c.strokeStyle = '#2b2b2b'; c.lineWidth = 3;
    const spin = moving ? phase : 0;
    for (const dx of [-15, 15]) {
      c.beginPath(); c.arc(x + dx, y - 9, 9, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(x + dx, y - 9); c.lineTo(x + dx + Math.cos(spin) * 9, y - 9 + Math.sin(spin) * 9); c.stroke();
    }
    c.strokeStyle = '#d23c4f'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(x - 15, y - 9); c.lineTo(x, y - 20); c.lineTo(x + 15 * f, y - 9); c.moveTo(x, y - 20); c.lineTo(x + 12 * f, y - 26); c.stroke();
    return 'under';
  }
  if (vehicle === 'charrette') {
    const cx = x - f * 42;
    c.strokeStyle = '#7a5230'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x - f * 10, y - 18); c.lineTo(cx + f * 22, y - 16); c.stroke();
    c.fillStyle = '#a0703f'; c.fillRect(cx - 24, y - 30, 48, 18);
    c.strokeStyle = '#6b4226'; c.strokeRect(cx - 24, y - 30, 48, 18);
    for (let i = 0; i < Math.min(3, crates); i++) Gfx.crate(c, cx - 12 + i * 12, y - 30 - (i % 2) * 6, 14, 12);
    c.fillStyle = '#3b2a1a'; c.beginPath(); c.arc(cx, y - 9, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#a0703f'; c.beginPath(); c.arc(cx, y - 9, 4, 0, Math.PI * 2); c.fill();
    return 'under';
  }
  if (vehicle === 'camionnette') {
    Gfx.shadow(c, x, y, 44, 8);
    const bx = x - 42;
    c.save(); c.translate(x, 0); c.scale(f, 1); c.translate(-x, 0);
    c.fillStyle = '#f4efe4'; c.beginPath(); c.roundRect(bx, y - 52, 58, 42, 5); c.fill();
    c.fillStyle = shirt; c.beginPath(); c.roundRect(bx + 56, y - 42, 30, 32, [0, 10, 4, 0]); c.fill();
    c.fillStyle = '#bfe3f2'; c.fillRect(bx + 62, y - 38, 18, 12);
    c.fillStyle = '#d98a1c'; c.fillRect(bx + 4, y - 36, 50, 8);
    c.fillStyle = '#2b2b2b';
    for (const wx of [bx + 16, bx + 70]) { c.beginPath(); c.arc(wx, y - 8, 9, 0, Math.PI * 2); c.fill(); }
    c.restore();
    Gfx.label(c, '🍾', x - f * 13, y - 58, 13);
    return 'replace';
  }
  return null;
}

/** Compagnon (chien ou chat), ancré aux pattes. */
export function drawPet(c, x, y, type, flip, moving, phase, name) {
  if (Art.sheets[type]) {                                    // planche dessinée : ombre, image, nom
    Gfx.shadow(c, x, y, 16, 4);
    Art.drawFrame(c, type, x, y, flip < 0 ? 'gauche' : 'droite', moving ? 1 + (Math.floor(phase / Math.PI) % 2) : 0);
    if (name) Gfx.label(c, name, x, y - 44, 11);
    return;
  }
  const f = flip < 0 ? -1 : 1, dog = type === 'chien';
  const body = dog ? '#b07a45' : '#8d8d99', dark = dog ? '#6b4226' : '#5d5d68';
  const step = moving ? Math.sin(phase * 1.3) * 3 : 0;
  Gfx.shadow(c, x, y, 16, 4);
  c.fillStyle = dark;
  for (const [dx, s] of [[-9, 1], [-4, -1], [5, 1], [10, -1]]) c.fillRect(x + dx * f - 2, y - 9 + (moving ? s * step * 0.4 : 0), 4, 9);
  c.fillStyle = body;
  c.beginPath(); c.ellipse(x, y - 13, 15, 8, 0, 0, Math.PI * 2); c.fill();
  // queue
  c.strokeStyle = body; c.lineWidth = 4; c.lineCap = 'round';
  const wag = Math.sin(phase * (dog ? 3 : 1)) * (dog ? 6 : 3);
  c.beginPath(); c.moveTo(x - 14 * f, y - 15);
  if (dog) c.lineTo(x - 22 * f, y - 22 + wag);
  else c.quadraticCurveTo(x - 26 * f, y - 20, x - 22 * f + wag, y - 32);
  c.stroke(); c.lineCap = 'butt';
  // tête
  const hx = x + 15 * f, hy = y - 22;
  c.fillStyle = body; c.beginPath(); c.arc(hx, hy, 8, 0, Math.PI * 2); c.fill();
  c.fillStyle = dark;
  if (dog) { c.beginPath(); c.ellipse(hx - 5 * f, hy - 2, 3.5, 7, 0.3 * f, 0, Math.PI * 2); c.fill(); }
  else {
    for (const ex of [-5, 4]) { c.beginPath(); c.moveTo(hx + ex - 3, hy - 5); c.lineTo(hx + ex, hy - 13); c.lineTo(hx + ex + 3, hy - 5); c.fill(); }
  }
  c.fillStyle = '#1b130c';
  c.fillRect(hx + 3 * f - 1, hy - 2, 2.5, 2.5);
  c.fillRect(hx + 8 * f - 1, hy + 1, 3, 2.5);
  if (name) Gfx.label(c, name, x, y - 36, 11);
}
