/**
 * Fiche « Changer de parfum », ouverte par le tableau noir d'une ligne dans l'usine visitable.
 * Les mêmes boutons que le tableau de l'usine, en plus grand, avec l'état de la cuve de la ligne.
 */
import { Eco } from '../../sim/eco.js';
import { flavorButtons } from './usine.js';

/** Ligne dont on change le parfum */
export const ParfumSel = { line: 0 };

export const parfum = {
  get title() { return ParfumSel.line > 0 ? `🍬 Ligne ${ParfumSel.line + 1} · parfum` : '🍬 Changer de parfum'; },
  key: s => [ParfumSel.line, Eco.lines(s).map(L => L.flavor).join(), s.unlocked.join(), s.recipes.length].join('|'),
  html(s) {
    const i = Math.min(ParfumSel.line, Eco.lineCount(s) - 1);
    return `
    <section class="card">
      <p class="machine-info" style="margin:0 0 12px">Touche un parfum pour que la marmite${Eco.lineCount(s) > 1 ? ` de la ligne ${i + 1}` : ''} le cuise. Les parfums 🔒 se débloquent avec de l’argent.</p>
      <div class="flavors flavors-big">${flavorButtons(s, i)}</div>
      <p class="sub switch-txt" data-t="switchTxt:${i}"></p>
      ${s.recipes.length ? '' : '<p class="hint">Les recettes secrètes ✨ s’inventent au Labo 🧪, juste à côté de l’usine.</p>'}
    </section>
    <div class="row-btns machine-nav" style="justify-content:center">
      <button class="btn ghost sm" data-act="openPanel" data-arg="usine">📋 Tableau de l’usine</button>
    </div>`;
  },
};
