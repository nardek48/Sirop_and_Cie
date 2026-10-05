/**
 * Fiche « Décorer ma maison » : ouverte en touchant un objet de la maison (world/home.js).
 * La rubrique touchée est en premier ; les autres suivent. Tout est gratuit.
 */
import { esc } from '../../core/format.js';
import { HOME_DECO, DECO_SLOTS, decoPick } from '../../world/home.js';

/** Rubrique choisie en entrant (cadre, coin, salon…) */
export const DecoSel = { slot: 'wall' };

function section(s, slot, first) {
  const D = HOME_DECO[slot], cur = decoPick(s, slot);
  const opts = D.options.map(o => {
    const look = o.color === 'rainbow'
      ? '<span class="deco-sw rainbow"></span>'
      : o.color ? `<span class="deco-sw" style="--c:${o.color}"></span>`
      : `<span class="deco-ico">${o.icon || '∅'}</span>`;
    return `<button type="button" class="deco-opt ${o.id === cur.id ? 'is-active' : ''}" data-act="decoSet" data-arg="${slot}:${o.id}"
      aria-pressed="${o.id === cur.id}">${look}<small>${esc(o.name)}</small></button>`;
  }).join('');
  return `
  <section class="card deco-sec ${first ? 'is-first' : ''}">
    <h3>${D.icon} ${D.name}</h3>
    <div class="deco-grid">${opts}</div>
  </section>`;
}

export const deco = {
  title: '🎨 Décorer ma maison',
  key: s => [DecoSel.slot, JSON.stringify(s.home)].join('|'),
  html(s) {
    const first = DECO_SLOTS.includes(DecoSel.slot) ? DecoSel.slot : 'wall';
    const rest = DECO_SLOTS.filter(k => k !== first);
    return `${section(s, first, true)}
      <p class="hint" style="margin:4px 2px 12px">Et aussi :</p>
      <div class="deco-rest">${rest.map(k => section(s, k, false)).join('')}</div>`;
  },
};
