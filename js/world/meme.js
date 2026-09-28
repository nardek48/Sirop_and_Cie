/**
 * meme.js — Mémé Grenadine, la guide du village.
 * Elle marche jusqu'à l'endroit que lui indique le tutoriel (World.hooks.memeSpot),
 * puis s'installe sur le banc du parc une fois le tutoriel fini.
 */
import { CONFIG } from '../config.js';
import { Gfx } from './gfx.js';
import { drawCharacter } from './characters.js';

const SPEED = 170;          // px/s, un peu moins vite que le joueur
const SHIRT = '#d23c4f';    // couleur grenadine
const HAIR = '#e4e1dc';

export const Meme = {
  x: CONFIG.tuto.spots.usine.x, y: CONFIG.tuto.spots.usine.y,
  dir: 'bas', flip: 1, moving: false, phase: 0,
  path: null, goal: null,
  say: '', sayT: 0,

  /** Place Mémé immédiatement (au chargement) */
  place(p) { this.x = p.x; this.y = p.y; this.goal = p; this.path = null; },

  /** Petite bulle au-dessus de sa tête */
  talk(text, sec = 4) { this.say = text; this.sayT = sec; },

  near(p, d = CONFIG.player.reach) { return Math.hypot(p.x - this.x, p.y - this.y) <= d; },

  update(dt, s, world) {
    this.sayT = Math.max(0, this.sayT - dt);
    const spot = world.hooks.memeSpot ? world.hooks.memeSpot(s) : CONFIG.tuto.spots.banc;
    if (!this.goal || spot.x !== this.goal.x || spot.y !== this.goal.y) {
      this.goal = spot;
      this.path = world.route(this, spot);
    }
    this.moving = false;
    if (this.path && this.path.length) {
      const wp = this.path[0], dx = wp.x - this.x, dy = wp.y - this.y, d = Math.hypot(dx, dy);
      // Très loin (retour du banc à l'usine) : elle presse le pas
      const sp = (Math.hypot(this.goal.x - this.x, this.goal.y - this.y) > 1200 ? SPEED * 2.5 : SPEED) * dt;
      if (d <= sp) { this.x = wp.x; this.y = wp.y; this.path.shift(); }
      else { this.x += dx / d * sp; this.y += dy / d * sp; }
      this.moving = true;
      this.phase += dt * 11;
      if (Math.abs(dx) > Math.abs(dy)) { this.dir = dx > 0 ? 'droite' : 'gauche'; this.flip = Math.sign(dx); }
      else this.dir = dy > 0 ? 'bas' : 'haut';
    } else {
      // À l'arrêt : elle regarde le joueur quand il est proche
      const p = s.player;
      if (this.near(p, 220)) this.dir = Math.abs(p.x - this.x) < 20 ? 'bas' : p.x > this.x ? 'droite' : 'gauche';
      else this.dir = 'bas';
    }
  },

  draw(c) {
    const x = this.x, y = this.y;
    Gfx.shadow(c, x, y, 14, 5);
    const top = drawCharacter(c, x, y, { key: 'meme', dir: this.dir, moving: this.moving, phase: this.phase, shirt: SHIRT, hair: HAIR });
    // Chignon et lunettes (dessin de secours ; une feuille de sprites 'meme' les remplace)
    const hy = top + 12;
    c.fillStyle = HAIR;
    c.beginPath(); c.arc(x - (this.dir === 'droite' ? 6 : this.dir === 'gauche' ? -6 : 0), hy - 12, 6, 0, Math.PI * 2); c.fill();
    if (this.dir === 'bas') {
      c.strokeStyle = '#6b4226'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x - 4, hy + 2, 3.6, 0, Math.PI * 2); c.moveTo(x + 7.6, hy + 2); c.arc(x + 4, hy + 2, 3.6, 0, Math.PI * 2); c.stroke();
    }
    // Tablier blanc (de face ou de profil)
    if (this.dir !== 'haut') {
      c.fillStyle = 'rgba(255,250,240,.9)';
      c.beginPath(); c.roundRect(x - 7, y - 30, 14, 16, 3); c.fill();
    }
    Gfx.label(c, 'Mémé Grenadine', x, top - 6, 12, '#ffd0d6');
    if (this.sayT > 0) Gfx.speech(c, this.say, x, top - 22, Math.min(1, this.sayT * 2));
  },
};
