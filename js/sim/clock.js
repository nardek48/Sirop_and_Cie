/**
 * clock.js — cycle jour/nuit. s.clock = secondes écoulées dans la journée.
 * Nuit : 20 h → 5 h 30. Le comptoir vend moins la nuit, le Café paie un bonus « soirée ».
 */
import { CONFIG } from '../config.js';

export const Clock = {
  hour(s) { return ((s.clock / CONFIG.clock.daySec) * 24 + CONFIG.clock.startHour) % 24; },
  isNight(s) { const h = this.hour(s); return h >= 20 || h < 5.5; },

  /** Opacité du voile de nuit (0 = plein jour) */
  darkness(s) {
    const h = this.hour(s), M = CONFIG.clock.maxDark;
    if (h >= 18 && h < 20) return ((h - 18) / 2) * M;
    if (h >= 20 || h < 5) return M;
    if (h >= 5 && h < 6.5) return (1 - (h - 5) / 1.5) * M;
    return 0;
  },

  label(s) {
    const h = this.hour(s), hh = Math.floor(h), mm = Math.floor(((h - hh) * 60) / 10) * 10;
    return `${this.isNight(s) ? '🌙' : '☀️'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  },

  counterFactor(s) { return this.isNight(s) ? CONFIG.counter.nightFactor : 1; },

  step(s, dt) { s.clock = (s.clock + dt) % CONFIG.clock.daySec; },
};
