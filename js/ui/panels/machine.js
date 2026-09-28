/**
 * Fiche d'une machine, ouverte en touchant une machine dans l'usine (world/interior.js).
 * Petite fenêtre : ce que fait la machine, son niveau, son débit, « Améliorer ».
 * ◀ ▶ passent d'une machine à l'autre ; « Tableau » ouvre la gestion complète.
 */
import { CONFIG } from '../../config.js';
import { Fmt } from '../../core/format.js';
import { MACHINE_INFO, MACHINE_KEYS, machineMeta } from '../../world/interior.js';

/** Machine affichée (choisie par l'intérieur de l'usine) */
export const MachineSel = { k: 'cook' };

const upBtn = k => `
  <button class="btn block" data-act="up" data-arg="${k}" data-d="cantLv:${k}">⬆️ Améliorer · <span data-t="lvCost:${k}"></span></button>`;

const matBtn = (m, q) => `<button class="btn ghost sm" data-act="buyMat" data-arg="${m},${q}" data-d="cantMat:${m},${q}">+${q} ${CONFIG.materials[m].icon} · ${Fmt.money(q * CONFIG.materials[m].price)}</button>`;

function body(s, k) {
  switch (k) {
    case 'mat': return `
      <div class="mat-row"><span>🧂 Sucre</span><b data-t="mat:sugar"></b></div>
      <div class="mat-row"><span>🍓 Fruits</span><b data-t="mat:fruit"></b></div>
      <p class="sub" data-t="recipe"></p>
      <div class="grid2">${matBtn('sugar', 100)}${matBtn('fruit', 100)}${matBtn('sugar', 1000)}${matBtn('fruit', 1000)}</div>
      <div class="auto-row">
        <div><b>Réapprovisionnement auto</b><div class="sub">Rachète sucre et fruits quand le stock baisse.</div></div>
        ${s.auto.restock ? '<span class="ok">✓ Actif</span>'
          : `<button class="btn sm" data-act="restock" data-d="cantRestock">${Fmt.money(CONFIG.restock.cost)}</button>`}
      </div>
      <p class="hint">Les fruits du verger 🌳 et la canne des Champs 🌾 sont gratuits : va les récolter !</p>`;
    case 'cook': case 'bottle': return `
      <div class="big" data-t="rate:${k}"></div><div class="sub" data-t="flow:${k}"></div>${upBtn(k)}`;
    case 'tank': return `
      <div class="bar"><i data-w="tankPct"></i></div><div class="sub" data-t="tankTxt"></div>${upBtn(k)}`;
    case 'ware': return `
      <div class="bar"><i data-w="warePct"></i></div><div class="sub" data-t="wareTxt"></div>${upBtn(k)}`;
    case 'counter': return `
      <div class="big" data-t="rate:counter"></div><div class="sub" data-t="flow:sell"></div>
      <div class="sub" data-t="counterNote"></div>
      <div class="row-btns" style="margin:10px 0"><button class="btn ghost sm" data-act="counter" data-t="counterBtn"></button></div>
      ${upBtn(k)}`;
    default: return '';
  }
}

export const machine = {
  get title() { const m = machineMeta(MachineSel.k); return `${m.icon} ${m.name}`; },
  key: s => [MachineSel.k, s.auto.restock].join('|'),
  html(s) {
    const k = MachineSel.k, i = MACHINE_KEYS.indexOf(k);
    const prev = MACHINE_KEYS[(i + MACHINE_KEYS.length - 1) % MACHINE_KEYS.length];
    const next = MACHINE_KEYS[(i + 1) % MACHINE_KEYS.length];
    const bneckKey = k === 'counter' ? 'ware' : k === 'tank' ? 'bottle' : k;
    return `
    <section class="card machine-card" data-c="hot|bneck:${bneckKey}">
      ${k === 'mat' ? '' : `<div class="lv machine-lv" data-t="lvLv:${k}"></div>`}
      <p class="machine-info">${MACHINE_INFO[k]}</p>
      ${body(s, k)}
    </section>
    <div class="row-btns machine-nav">
      <button class="btn ghost sm" data-act="machine" data-arg="${prev}" aria-label="Machine précédente">◀ ${machineMeta(prev).icon}</button>
      <button class="btn ghost sm" data-act="openPanel" data-arg="usine">📋 Tableau de l’usine</button>
      <button class="btn ghost sm" data-act="machine" data-arg="${next}" aria-label="Machine suivante">${machineMeta(next).icon} ▶</button>
    </div>`;
  },
};
