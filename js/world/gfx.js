/**
 * gfx.js — petits éléments graphiques communs : panneaux, étiquettes, bulles, caisses, épingles.
 */
const FONT = '"DM Sans", system-ui, sans-serif';

export const Gfx = {
  sign(c, text, x, y, size = 13) {
    c.font = `700 ${size}px ${FONT}`;
    const w = c.measureText(text).width + 16, h = size + 10;
    c.fillStyle = '#fffaf0'; c.strokeStyle = '#7a5230'; c.lineWidth = 2;
    c.beginPath(); c.roundRect(x - w / 2, y - h, w, h, 6); c.fill(); c.stroke();
    c.fillStyle = '#3b2a1a'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, x, y - h / 2 + 1);
    c.textBaseline = 'alphabetic';
  },

  label(c, text, x, y, size = 14, color = '#fff') {
    c.font = `700 ${size}px ${FONT}`;
    c.textAlign = 'center'; c.lineJoin = 'round';
    c.lineWidth = 4; c.strokeStyle = 'rgba(40,25,10,.85)'; c.strokeText(text, x, y);
    c.fillStyle = color; c.fillText(text, x, y);
  },

  /** Bulle sombre (invite d'action) */
  bubble(c, text, x, y) {
    c.font = `700 14px ${FONT}`;
    const w = c.measureText(text).width + 22, h = 28;
    c.fillStyle = 'rgba(59,42,26,.92)';
    c.beginPath(); c.roundRect(x - w / 2, y - h, w, h, 9); c.fill();
    c.beginPath(); c.moveTo(x - 7, y); c.lineTo(x + 7, y); c.lineTo(x, y + 8); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, x, y - h / 2 + 1);
    c.textBaseline = 'alphabetic';
  },

  /** Bulle claire (paroles d'un habitant) */
  speech(c, text, x, y, alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    c.font = `600 12px ${FONT}`;
    const w = Math.min(220, c.measureText(text).width + 18), h = 24;
    c.fillStyle = '#fffaf0'; c.strokeStyle = '#3b2a1a'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(x - w / 2, y - h, w, h, 10); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 5, y - 1); c.lineTo(x + 5, y - 1); c.lineTo(x - 2, y + 7); c.closePath(); c.fill();
    c.fillStyle = '#3b2a1a'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, x, y - h / 2 + 1, w - 12);
    c.textBaseline = 'alphabetic';
    c.restore();
  },

  crate(c, x, yBottom, w, h) {
    c.fillStyle = '#c98b4a'; c.fillRect(x - w / 2, yBottom - h, w, h);
    c.strokeStyle = '#7a5230'; c.lineWidth = 2; c.strokeRect(x - w / 2, yBottom - h, w, h);
    c.beginPath(); c.moveTo(x - w / 2, yBottom - h); c.lineTo(x + w / 2, yBottom); c.stroke();
  },

  pin(c, x, y, icon = '📦') {
    c.fillStyle = '#e0562b'; c.strokeStyle = '#fff'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x, y + 26); c.lineTo(x - 14, y + 6); c.arc(x, y, 16, Math.PI * 0.8, Math.PI * 0.2); c.closePath(); c.stroke(); c.fill();
    this.label(c, icon, x, y + 6, 14);
  },

  shadow(c, x, y, rx, ry = rx * 0.35) {
    c.fillStyle = 'rgba(40,30,20,.22)';
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  },
};
