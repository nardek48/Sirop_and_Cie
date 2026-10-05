/**
 * pet.js — le compagnon : il suit le joueur et part de temps en temps
 * récolter tout seul une récolte mûre proche.
 */
import { Bus } from '../core/bus.js';
import { Fields, Farm } from '../sim/world-systems.js';
import { MAP } from './map.js';

const FETCH_EVERY = 40;   // secondes entre deux cueillettes
const FETCH_RANGE = 900;  // distance max d'une récolte visée

export const Pet = {
  x: 0, y: 0, flip: 1, moving: false, phase: 0,
  state: 'follow', path: null, target: null, fetchT: 0,

  reset(p) { Object.assign(this, { x: p.x - 40, y: p.y + 6, state: 'follow', path: null, target: null }); },

  /** Récolte mûre la plus proche du joueur, dans un quartier ouvert */
  findRipe(s, p) {
    let best = null, bd = FETCH_RANGE;
    for (const [g, list] of Object.entries(MAP.fields)) {
      if (!Fields.open(s, g)) continue;
      list.forEach((pos, i) => {
        if (s.fields[g][i] > 0) return;
        const d = Math.hypot(pos.x - p.x, pos.y - p.y);
        if (d < bd) { bd = d; best = { g, i, x: pos.x + 26, y: pos.y + 30, pos: { x: pos.x, y: pos.y - 30 } }; }
      });
    }
    // Champs à cultiver mûrs (il récolte à la main : double, comme le joueur)
    MAP.farm.forEach((pos, i) => {
      if (!Farm.ripe(s, i)) return;
      const d = Math.hypot(pos.x - p.x, pos.y - p.y);
      if (d < bd) { bd = d; best = { farm: true, i, x: pos.x + 40, y: pos.y + 26, pos: { x: pos.x, y: pos.y - 40 } }; }
    });
    return best;
  },

  update(dt, s, player, world) {
    if (s.look.pet === 'aucun') return;
    this.fetchT += dt;

    // Pas de cueillette pendant le tutoriel : l'arbre à cueillir est pour le joueur
    if (this.state === 'follow' && this.fetchT > FETCH_EVERY && !s.tuto.active) {
      const t = this.findRipe(s, player);
      if (t) { this.state = 'fetch'; this.target = t; this.path = world.route(this, t); this.fetchT = 0; }
      else this.fetchT = FETCH_EVERY - 5;   // réessaie dans 5 s
    }

    const goal = this.state === 'follow'
      ? { x: player.x - world.anim.flip * 38, y: player.y + 8 }
      : this.path[0];
    const dx = goal.x - this.x, dy = goal.y - this.y, d = Math.hypot(dx, dy);

    // Trop loin (téléportation du joueur, changement de quartier) : il rejoint d'un bond
    if (this.state === 'follow' && d > 700) { this.reset(player); return; }

    if (this.state === 'follow' && d < 14) this.moving = false;
    else {
      const sp = this.state === 'follow' ? Math.min(460, (d - 8) * 4) : 290;
      const k = Math.min(1, (sp * dt) / (d || 1));
      this.x += dx * k; this.y += dy * k;
      this.moving = true;
      if (Math.abs(dx) > 1) this.flip = Math.sign(dx);
      this.phase += dt * 14;
    }

    if (this.state !== 'follow' && d < 8) {
      this.path.shift();
      if (this.path.length) return;
      if (this.state === 'fetch') {
        const t = this.target;
        if (t.farm ? Farm.harvest(s, t.i, t.pos, 'pet') : Fields.pick(s, t.g, t.i, t.pos, 'pet')) {
          Bus.float(`${s.look.petName} a récolté !`, { x: t.pos.x, y: t.pos.y - 26 }, '#fff');
          Bus.sfx(s.look.pet === 'chat' ? 'meow' : 'woof');
        }
        this.state = 'back';
        this.path = world.route(this, player);
      } else this.state = 'follow';
    }
  },
};
