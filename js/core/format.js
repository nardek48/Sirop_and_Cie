/**
 * format.js — nombres, argent, durées, échappement HTML.
 */
import { CONFIG } from '../config.js';

const loc = (v, d) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

export const Fmt = {
  /** 1,2 · 845 · 12,4 K · 3,1 M … */
  num(n) {
    if (!isFinite(n)) return '∞';
    const a = Math.abs(n);
    if (a < 1) return loc(n, 2);
    if (a < 10) return loc(n, 1);
    if (a < 1000) return loc(Math.floor(n), 0);
    const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
    const i = Math.min(u.length, Math.floor(Math.log10(a) / 3));
    return loc(n / 10 ** (3 * i), 2) + ' ' + u[i - 1];
  },
  int(n) { return this.num(Math.floor(n + 1e-9)); },
  money(n) { return this.num(n) + ' ' + CONFIG.currency; },
  time(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  },
};

export const esc = str => String(str).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
