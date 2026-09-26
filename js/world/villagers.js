/**
 * villagers.js — habitants qui se promènent, achètent au comptoir et saluent le joueur.
 * Purement visuel : ils n'influencent pas la simulation.
 */
import { CONFIG } from '../config.js';
import { pick, rand } from '../core/format.js';
import { Flavors } from '../sim/flavors.js';
import { Clock } from '../sim/clock.js';
import { Events } from '../sim/events.js';

const SHIRTS = ['#6fa8dc', '#e6a23c', '#8e7cc3', '#76a5af', '#e06666', '#93c47d', '#c27ba0', '#f6b26b'];
const HAIRS = ['#2b1d12', '#7a4a24', '#d9b36c', '#a33b20', '#555555', '#e8e2d0'];

const HELLO = [n => `Bonjour ${n} !`, n => `Salut ${n} !`, () => 'Quel beau village !', n => `Ton sirop est le meilleur, ${n} !`, () => 'Il fait bon aujourd’hui.'];
const NIGHT = [() => 'Bonne nuit !', () => 'Il se fait tard…', n => `Encore au travail, ${n} ?`];
const HEAT = [() => 'Quelle chaleur ! J’ai soif…', () => 'Vite, un sirop bien frais !'];
const RAIN = [() => 'Quel temps de canard !', () => 'Le verger va adorer cette pluie.'];

export const Villagers = {
  list: [],

  init(n = 7) {
    this.list = Array.from({ length: n }, () => ({
      x: rand(100, 2500), y: CONFIG.roadY + rand(-30, 30), target: null, wait: rand(0, 3),
      shirt: pick(SHIRTS), hair: pick(HAIRS), moving: false, phase: rand(0, 6), dir: 'bas',
      say: '', sayT: 0, greetT: rand(4, 14),
    }));
  },

  /** Nombre d'habitants dehors (moins la nuit) */
  visible(s) { return Clock.isNight(s) ? 3 : this.list.length; },

  update(dt, s, player, maxX) {
    const n = this.visible(s), selling = s.counterOn && Object.values(s.stock).some(q => q >= 1);
    this.list.forEach((v, idx) => {
      v.sayT -= dt; v.greetT -= dt;
      if (idx >= n) return;

      if (v.wait > 0) { v.wait -= dt; v.moving = false; }
      else {
        if (!v.target) {
          v.target = selling && Math.random() < 0.3
            ? { x: CONFIG.places.usine.x + rand(-24, 24), y: 536, shop: true }
            : { x: rand(60, maxX), y: CONFIG.roadY + rand(-32, 32) };
        }
        const dx = v.target.x - v.x, dy = v.target.y - v.y, d = Math.hypot(dx, dy);
        if (d < 4) {
          if (v.target.shop) { v.say = `Un sirop ${Flavors.get(s, pick(s.unlocked)).name.toLowerCase()}, s’il vous plaît !`; v.sayT = 3; }
          v.target = null; v.wait = rand(1.5, 4);
        } else {
          const k = Math.min(1, (70 * dt) / d);
          v.x += dx * k; v.y += dy * k; v.moving = true; v.phase += dt * 10;
          v.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'droite' : 'gauche') : (dy > 0 ? 'bas' : 'haut');
        }
      }

      // Salue le joueur quand il passe à côté
      if (v.greetT <= 0 && Math.hypot(v.x - player.x, v.y - player.y) < 90) {
        const pool = Events.is(s, 'canicule') ? HEAT : Events.is(s, 'pluie') ? RAIN : Clock.isNight(s) ? NIGHT : HELLO;
        v.say = pick(pool)(s.look.name); v.sayT = 2.8; v.greetT = rand(18, 30);
      }
    });
  },
};
