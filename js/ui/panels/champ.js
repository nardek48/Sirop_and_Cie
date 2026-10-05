/**
 * Fiche d'un champ à cultiver (touché dans les Champs) : choisir ce qu'on plante,
 * voir où il en est, ou l'acheter.
 */
import { CONFIG } from '../../config.js';
import { Fmt } from '../../core/format.js';
import { Farm } from '../../sim/world-systems.js';

/** Champ affiché */
export const FieldSel = { i: 0 };

export const champ = {
  get title() { return `🌱 Champ ${FieldSel.i + 1}`; },
  key: s => [FieldSel.i, s.farm.owned, s.farm.crop[FieldSel.i], s.unlocked.length].join('|'),
  html(s) {
    const i = FieldSel.i, F = s.farm, FC = CONFIG.farm;
    if (i > F.owned) return `
      <section class="card"><p class="machine-info" style="margin:0">🔒 Achète d’abord le champ ${F.owned + 1}. Les champs s’achètent l’un après l’autre.</p></section>`;
    if (i === F.owned) return `
      <section class="card machine-card">
        <p class="machine-info">Un champ de plus, c’est plus de sucre ou de fruits gratuits pour ton usine.</p>
        <button class="btn block" data-act="farmBuy" data-d="cantFarm">🌱 Acheter ce champ · ${Fmt.money(FC.costs[i])}</button>
      </section>`;
    const M = CONFIG.materials;
    const crops = Object.entries(FC.crops).map(([k, c]) => (Farm.cropOpen(s, k) ? `
      <button type="button" class="flavor ${F.crop[i] === k ? 'is-active' : ''}" data-act="plant" data-arg="${i}:${k}">
        <span><b>${c.icon} ${c.name}</b></span>
        <small>donne : ${M[c.mat].name.toLowerCase()} ${M[c.mat].icon}${c.mat !== 'sugar' ? ` (sirop de ${CONFIG.flavors[c.mat].name})` : ''}</small>
      </button>` : `
      <button type="button" class="flavor locked" disabled>
        <span><b>${c.icon} ${c.name}</b></span>
        <small>🔒 avec le parfum ${CONFIG.flavors[c.flavor].name}</small>
      </button>`)).join('');
    return `
    <section class="card machine-card">
      <p class="sub" data-t="farmState:${i}" style="margin:0"></p>
      <div class="bar"><i data-w="farmPct:${i}"></i></div>
      <h3 style="margin:6px 0 0">Que veux-tu planter ?</h3>
      <div class="flavors flavors-big">${crops}</div>
      <p class="hint">Quand c’est mûr ✨, récolte-le toi-même : ça donne le <b>double</b> ! Sinon, il est ramassé tout seul au bout d’une minute.
        Changer de plante fait tout repousser depuis le début.</p>
    </section>`;
  },
};
