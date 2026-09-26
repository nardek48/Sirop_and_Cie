/**
 * Intérieur de l'usine : parfums, chaîne de production, stock, réapprovisionnement.
 */
import { CONFIG } from '../../config.js';
import { Fmt } from '../../core/format.js';
import { Flavors } from '../../sim/flavors.js';
import { Eco } from '../../sim/eco.js';

const stage = (k, body, bneckKey = k) => {
  const c = CONFIG.levels[k];
  return `
  <div class="stage" data-c="hot|bneck:${bneckKey}">
    <div class="stage-head"><span>${c.icon}</span>${c.name}<span class="lv" data-t="lvLv:${k}"></span></div>
    ${body}
    <div class="push">
      <button class="btn sm" data-act="up" data-arg="${k}" data-d="cantLv:${k}">Améliorer · <span data-t="lvCost:${k}"></span></button>
    </div>
  </div>`;
};

const dot = color => `<span class="dot" style="--c:${color}"></span>`;

export const usine = {
  title: '🏭 Usine',
  key: s => [s.flavor, s.unlocked.join(), s.auto.restock].join('|'),
  html(s) {
    const base = Object.entries(CONFIG.flavors).map(([k, f]) => s.unlocked.includes(k)
      ? `<button class="flavor ${s.flavor === k ? 'is-active' : ''}" data-act="select" data-arg="${k}">
           <span>${dot(f.color)}<b>${f.name}</b></span>
           <small>${Fmt.money(f.price)} / bt · stock <span data-t="stockFl:${k}"></span></small>
         </button>`
      : `<button class="flavor locked" data-act="unlock" data-arg="${k}" data-d="cantUnlock:${k}">
           <span>${dot(f.color)}<b>${f.name}</b></span>
           <small>🔒 Débloquer · ${Fmt.money(f.unlock)}</small>
         </button>`).join('');
    const secret = s.recipes.map(r => `
      <button class="flavor secret ${s.flavor === r.id ? 'is-active' : ''}" data-act="select" data-arg="${r.id}">
        <span>${dot(r.color)}<b>${r.name}</b> ✨</span>
        <small>${Fmt.money(r.price)} / bt · stock <span data-t="stockFl:${r.id}"></span></small>
      </button>`).join('');

    const matBtn = (m, q) => `<button class="btn ghost sm" data-act="buyMat" data-arg="${m},${q}" data-d="cantMat:${m},${q}">+${q} ${CONFIG.materials[m].icon} · ${Fmt.money(q * CONFIG.materials[m].price)}</button>`;

    const stockRows = s.unlocked.map(k => {
      const f = Flavors.get(s, k);
      return `<tr><td>${dot(f.color)}${f.name}</td><td data-t="stockFl:${k}"></td><td data-t="resFl:${k}"></td>
        <td>${Fmt.money(Eco.sellPrice(s, k, CONFIG.counter.priceFactor))}</td></tr>`;
    }).join('');

    return `
    <section class="card">
      <h3>Parfum en production</h3>
      <div class="flavors">${base}${secret}</div>
      ${s.recipes.length ? '' : '<p class="hint">Les recettes secrètes s’inventent au Labo 🧪, juste à côté.</p>'}
    </section>
    <section class="card">
      <div class="split"><h3>Chaîne de production</h3><span class="tag" data-t="bneckLabel"></span></div>
      <div class="pipeline">
        <div class="stage" data-c="hot|bneck:mat">
          <div class="stage-head"><span>🧺</span>Matières</div>
          <div class="mat-row"><span>🧂 Sucre</span><b data-t="mat:sugar"></b></div>
          <div class="mat-row"><span>🍓 Fruits</span><b data-t="mat:fruit"></b></div>
          <div class="sub" data-t="recipe"></div>
          <div class="push grid2">${matBtn('sugar', 100)}${matBtn('fruit', 100)}${matBtn('sugar', 1000)}${matBtn('fruit', 1000)}</div>
        </div>
        ${stage('cook', `<div class="big" data-t="rate:cook"></div><div class="sub" data-t="flow:cook"></div>`)}
        ${stage('tank', `<div class="bar"><i data-w="tankPct"></i></div><div class="sub" data-t="tankTxt"></div>`, 'bottle')}
        ${stage('bottle', `<div class="big" data-t="rate:bottle"></div><div class="sub" data-t="flow:bottle"></div>`)}
        ${stage('ware', `<div class="bar"><i data-w="warePct"></i></div><div class="sub" data-t="wareTxt"></div>`)}
        ${stage('counter', `<div class="big" data-t="rate:counter"></div><div class="sub" data-t="flow:sell"></div>
           <div class="sub" data-t="counterNote"></div>
           <button class="btn ghost sm" data-act="counter" data-t="counterBtn"></button>`, 'ware')}
      </div>
      <p class="hint">Astuce : les fruits du verger 🌳 et la canne des Champs 🌾 sont gratuits, il suffit d’aller les récolter.</p>
    </section>
    <div class="cols">
      <section class="card">
        <h3>Stock</h3>
        <div class="scroll-x"><table class="tbl"><thead><tr><th>Parfum</th><th>Stock</th><th>Réservé</th><th>Comptoir</th></tr></thead>
        <tbody>${stockRows}</tbody></table></div>
      </section>
      <section class="card">
        <h3>Réapprovisionnement</h3>
        <div class="auto-row">
          <div><b>Réapprovisionnement auto</b><div class="sub">Rachète sucre et fruits quand le stock baisse.</div></div>
          ${s.auto.restock ? '<span class="ok">✓ Actif</span>'
            : `<button class="btn sm" data-act="restock" data-d="cantRestock">${Fmt.money(CONFIG.restock.cost)}</button>`}
        </div>
        <p class="hint">Les livreurs et les véhicules s’achètent au Garage 🚲.</p>
      </section>
    </div>`;
  },
};
