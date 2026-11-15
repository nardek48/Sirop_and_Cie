/**
 * Verrerie : le four (3 niveaux) qui décore les bouteilles ; chaque niveau fait vendre les sirops plus cher.
 */
import { CONFIG } from '../../config.js';
import { Fmt } from '../../core/format.js';
import { Glass } from '../../sim/world-systems.js';

export const verrerie = {
  title: '🏺 Verrerie',
  key: s => [s.oven, Glass.open(s)].join('|'),
  html(s) {
    const G = CONFIG.glass, max = G.bonus.length, cost = Glass.nextCost(s);
    const steps = G.bonus.map((b, i) => `
      <li class="${i < s.oven ? 'on' : ''}"><b>Niveau ${i + 1}</b><span>sirops +${Math.round(b * 100)} %</span>
        <small>${i === 0 ? 'avec le fruit du Labo' : Fmt.money(G.costs[i])}</small></li>`).join('');
    const btn = cost == null ? '<p class="ok">🔥 Four au maximum : tes bouteilles sont toutes décorées.</p>'
      : `<button class="btn" data-act="ovenUp" data-d="cantOven">Améliorer le four · ${Fmt.money(cost)}</button>`;
    return `
    <div class="cols">
      <section class="card">
        <h3>🔥 Le four · niveau ${s.oven} / ${max}</h3>
        <p>Le four fond le sable de la plage et décore tes bouteilles. Les sirops en verre décoré se vendent <b>${Math.round(Glass.bonus(s) * 100)} % plus cher</b>, partout : comptoir, commandes, wagon et bateau.</p>
        <ol class="glass-steps">${steps}</ol>
        ${btn}
      </section>
      <section class="card">
        <h3>Bon à savoir</h3>
        <p class="hint">Le fruit 🏺 La Verrerie du Labo reste pour toujours. Le four, lui, repart au niveau 1 quand tu revends l’entreprise, comme les machines de l’usine.</p>
      </section>
    </div>`;
  },
};
