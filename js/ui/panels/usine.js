/**
 * Intérieur de l'usine : parfums, chaîne de production, stock, réapprovisionnement.
 */
import { CONFIG } from '../../config.js';
import { Fmt } from '../../core/format.js';
import { Flavors } from '../../sim/flavors.js';
import { Factory } from '../../sim/factory.js';
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

const M = CONFIG.materials;
const buyBtn = (m, q) => `<button class="btn ghost sm" data-act="buyMat" data-arg="${m},${q}" data-d="cantMat:${m},${q}">+${q} ${M[m].icon} · ${Fmt.money(q * M[m].price)}</button>`;

/** Ligne choisie (fiche « Changer de parfum », achat d'une ligne) */
export const UsineSel = { line: 0 };

/** Matières d'UNE ligne : une rangée par matière (stock + achats), compacte */
export function lineMat(s, i) {
  const L = Eco.lines(s)[i] || s;
  const need = Object.entries(Flavors.needs(s, L.flavor));
  return `<div class="mat-lines">${need.map(([m, q]) => `
    <div class="mat-line">
      <span title="${M[m].name}">${M[m].icon} ${M[m].name}</span>
      <b data-t="mat:${m}"></b>
      ${buyBtn(m, 100)}${buyBtn(m, 1000)}
    </div>`).join('')}
    <div class="sub">${Fmt.num(need.find(([m]) => m === 'sugar')[1])} kg 🧂 + ${need.filter(([m]) => m !== 'sugar').map(([m, q]) => `${Fmt.num(q)} kg ${M[m].icon}`).join(' + ')} par bouteille</div>
  </div>`;
}

/**
 * Boutons des parfums (de base et recettes secrètes) pour une ligne :
 * aussi utilisés par la fiche « Changer de parfum » (tableau noir de l'usine visitable).
 */
export function flavorButtons(s, line = 0, compact = false) {
    const lines = Eco.lines(s), cur = (lines[line] || s).flavor;
    // « ligne 2 » : ce parfum est déjà cuit par une autre ligne
    const other = k => { const j = lines.findIndex((L, i) => i !== line && L.flavor === k); return j >= 0 ? ` · ligne ${j + 1}` : ''; };
    const base = Object.entries(CONFIG.flavors).map(([k, f]) => s.unlocked.includes(k)
      ? `<button class="flavor ${cur === k ? 'is-active' : ''}" data-act="select" data-arg="${k}|${line}">
           <span>${dot(f.color)}<b>${f.name}</b></span>
           <small>${Fmt.money(f.price)} / bt${compact ? '' : ` · stock <span data-t="stockFl:${k}"></span>`}${other(k)}</small>
         </button>`
      : `<button class="flavor locked" data-act="unlock" data-arg="${k}" data-d="cantUnlock:${k}">
           <span>${dot(f.color)}<b>${f.name}</b></span>
           <small>🔒 Débloquer · ${Fmt.money(f.unlock)}</small>
         </button>`).join('');
    const secret = s.recipes.map(r => `
      <button class="flavor secret ${cur === r.id ? 'is-active' : ''}" data-act="select" data-arg="${r.id}|${line}">
        <span>${dot(r.color)}<b>${r.name}</b> ✨</span>
        <small>${Fmt.money(r.price)} / bt${compact ? '' : ` · stock <span data-t="stockFl:${r.id}"></span>`}${other(r.id)}</small>
      </button>`).join('');
    return base + secret;
}

/**
 * Lignes de production : une carte par ligne, avec SES matières premières,
 * puis juste en dessous le panneau des parfums de la ligne. La ligne suivante s'achète à la fin.
 */
function linesBlock(s) {
  const lines = Eco.lines(s), n = lines.length, cost = Factory.nextLineCost(s);
  const card = (L, i) => `
    <article class="line-card">
      <header><b>${n > 1 ? `Ligne ${i + 1}` : 'Ta ligne'}</b> <span class="sub" data-t="lineTxt:${i}"></span></header>
      <div class="bar"><i data-w="lineTank:${i}"></i></div>
      <h4>🧺 Matières premières</h4>
      ${lineMat(s, i)}
      <h4>🍬 Parfum</h4>
      <div class="flavors flavors-compact">${flavorButtons(s, i, true)}</div>
    </article>`;
  const buy = cost == null ? '' : `
    <article class="line-card line-next">
      <header><b>🏭 Ligne ${n + 1}</b></header>
      <p class="sub">Un parfum de plus en même temps, avec sa cuve et ses matières. Les machines sont communes : améliorer la cuisson améliore toutes les lignes.</p>
      <button class="btn" data-act="buyLine" data-d="cantLine">Acheter · ${Fmt.money(cost)}</button>
    </article>`;
  return `
    <div class="split"><h3>${n > 1 ? 'Lignes de production' : 'Ta ligne de production'}</h3></div>
    <div class="line-cards">${lines.map(card).join('')}${buy}</div>`;
}

export const usine = {
  title: '🏭 Usine',
  key: s => [Eco.lines(s).map(L => L.flavor).join(), UsineSel.line, s.unlocked.join(), s.auto.restock].join('|'),
  html(s) {


    const stockRows = s.unlocked.map(k => {
      const f = Flavors.get(s, k);
      return `<tr><td>${dot(f.color)}${f.name}</td><td data-t="stockFl:${k}"></td><td data-t="resFl:${k}"></td>
        <td>${Fmt.money(Eco.sellPrice(s, k, CONFIG.counter.priceFactor))}</td></tr>`;
    }).join('');

    return `
    <section class="card">
      ${linesBlock(s)}
      ${s.recipes.length ? '' : '<p class="hint">Les recettes secrètes s’inventent au Labo 🧪, juste à côté.</p>'}
    </section>
    <section class="card">
      <div class="split"><h3>Chaîne de production</h3><span class="tag" data-t="bneckLabel"></span></div>
      <div class="pipeline">
        ${stage('cook', `<div class="big" data-t="rate:cook"></div><div class="sub" data-t="flow:cook"></div>`)}
        ${stage('tank', `<div class="big" data-t="tankCapTxt"></div><div class="sub">par ligne</div>`, 'bottle')}
        ${stage('bottle', `<div class="big" data-t="rate:bottle"></div><div class="sub" data-t="flow:bottle"></div>`)}
        ${stage('ware', `<div class="bar"><i data-w="warePct"></i></div><div class="sub" data-t="wareTxt"></div>`)}
        ${stage('counter', `<div class="big" data-t="rate:counter"></div><div class="sub" data-t="flow:sell"></div>
           <div class="sub" data-t="counterNote"></div>
           <button class="btn ghost sm" data-act="counter" data-t="counterBtn"></button>`, 'ware')}
      </div>
      <p class="hint">Astuce : chaque parfum a son fruit 🌿🍎🍋. Le verger 🌳 donne celui du parfum en production, et tes champs 🌾 ce que tu y plantes : récolte-les toi-même, ça donne le double !</p>
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
          <div><b>Réapprovisionnement auto</b><div class="sub">Rachète le sucre et les fruits du parfum en production quand le stock baisse.</div></div>
          ${s.auto.restock ? '<span class="ok">✓ Actif</span>'
            : `<button class="btn sm" data-act="restock" data-d="cantRestock">${Fmt.money(CONFIG.restock.cost)}</button>`}
        </div>
        <p class="hint">Les livreurs et les véhicules s’achètent au Garage 🚲.</p>
      </section>
    </div>`;
  },
};
