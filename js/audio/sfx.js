/**
 * sfx.js — effets sonores synthétisés en Web Audio (aucun fichier).
 * Le son démarre au premier clic ou à la première touche (règle des navigateurs).
 */
import { Bus } from '../core/bus.js';

/** Recettes : liste de notes [fréquence, début (s), durée (s), forme, volume, glissando vers] */
const SOUNDS = {
  coin:   [[988, 0, .08, 'square', .06], [1319, .07, .16, 'square', .06]],
  buy:    [[660, 0, .06, 'triangle', .08], [880, .05, .08, 'triangle', .08]],
  pick:   [[620, 0, .09, 'sine', .12, 940]],
  load:   [[170, 0, .09, 'square', .07], [130, .08, .1, 'square', .07]],
  error:  [[220, 0, .16, 'sawtooth', .05, 140]],
  click:  [[740, 0, .04, 'sine', .07]],
  door:   [[330, 0, .07, 'triangle', .07], [247, .06, .09, 'triangle', .06]],
  quest:  [[523, 0, .1, 'triangle', .09], [659, .09, .1, 'triangle', .09], [784, .18, .1, 'triangle', .09], [1047, .27, .22, 'triangle', .09]],
  unlock: [[392, 0, .1, 'square', .05], [523, .1, .1, 'square', .05], [784, .2, .24, 'square', .05]],
  event:  [[440, 0, .14, 'triangle', .08], [554, .14, .14, 'triangle', .08], [659, .28, .2, 'triangle', .08]],
  step:   [[110, 0, .025, 'triangle', .035]],
  woof:   [[300, 0, .07, 'sawtooth', .04, 200], [260, .1, .09, 'sawtooth', .04, 180]],
  meow:   [[700, 0, .25, 'sine', .05, 520]],
};

export const Sfx = {
  ctx: null, muted: false,

  init() {
    try { this.muted = localStorage.getItem('siropcie_mute') === '1'; } catch (e) { /* */ }
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    Bus.on('sfx', n => this.play(n));
    this.updateButton();
  },

  unlock() {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* audio indisponible */ }
  },

  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem('siropcie_mute', this.muted ? '1' : '0'); } catch (e) { /* */ }
    this.updateButton();
  },

  updateButton() {
    const b = document.getElementById('mute-btn');
    if (b) { b.textContent = this.muted ? '🔇' : '🔊'; b.setAttribute('aria-label', this.muted ? 'Activer le son' : 'Couper le son'); }
  },

  play(name) {
    const notes = SOUNDS[name], ctx = this.ctx;
    if (!notes || !ctx || this.muted || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    for (const [f, start, dur, type, vol, to] of notes) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t0 + start);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + start + dur);
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(vol, t0 + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + start);
      o.stop(t0 + start + dur + 0.02);
    }
  },
};
