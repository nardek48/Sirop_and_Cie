/**
 * Labo : inventer des recettes secrètes en mélangeant deux parfums.
 * C'est l'écran « créatif » : on choisit deux bouteilles, on voit le mélange, on le nomme et le colore.
 */
import { CONFIG, RECIPE_COLORS } from '../../config.js';
import { Fmt, esc } from '../../core/format.js';
import { Form } from '../form.js';
import { Research } from '../../sim/research.js';
import { tree } from './arbre.js';
import { Recipes } from '../../sim/world-systems.js';

const M = CONFIG.materials;
/** Grosse bouteille : couleur du sirop, fruit sur l'étiquette */
const bigBottle = (color, icon, cls = '') => `<span class="bottle xl ${cls}" style="--c:${color}" aria-hidden="true"><em>${icon || ''}</em></span>`;

/** Onglets du Labo ; « Arbre » montre un point quand un fruit peut être lancé */
const tabBar = s => {
  const can = !s.research.cur && CONFIG.research.fruits.some(f => !Research.why(s, f));
  const t = (id, label) => `<button type="button" class="tab ${Form.laboTab === id ? 'on' : ''}" data-act="laboTab" data-arg="${id}" aria-pressed="${Form.laboTab === id}">${label}</button>`;
  return `<div class="tabs lab-tabs">${t('recettes', '🧪 Recettes')}${t('arbre', `🌳 Arbre${can ? ' <span class="dot"></span>' : ''}`)}</div>`;
};

export const labo = {
  title: '🧪 Labo',
  key: s => [Form.laboTab, Form.laboTab === 'arbre' ? tree.key(s) : '', s.recipes.length, s.unlocked.join(), Form.labo.color, Form.labo.a, Form.labo.b, s.flavor,
    Form.third.id, Form.third.c, s.recipes.map(r => r.c || '').join(), s.research.done.includes('r3'), s.money >= CONFIG.recipes.third.cost].join('|'),
  html(s) {
    const tabs = tabBar(s);
    if (Form.laboTab === 'arbre') return tabs + tree.html(s);
    return tabs + labo.recipes(s);
  },

  recipes(s) {
    const F = Form.labo;
    const base = Object.entries(CONFIG.flavors).filter(([k]) => s.unlocked.includes(k));
    if (base.length < 2) return `
      <section class="card"><h3>Il faut deux parfums</h3>
        <p>Débloque la Grenadine à l’usine, puis reviens mélanger tes parfums ici.</p></section>`;

    const A = CONFIG.flavors[F.a] || base[0][1], B = CONFIG.flavors[F.b] || base[1][1];
    const pick = (slot, cur) => base.map(([k, f]) => `
      <button type="button" class="lab-pick ${cur === k ? 'is-active' : ''}" data-act="labo${slot}" data-arg="${k}" aria-pressed="${cur === k}">
        ${bigBottle(f.color, M[k].icon, 'sm')}<small>${f.name}</small></button>`).join('');
    const swatches = RECIPE_COLORS.map(c =>
      `<button class="sw ${c === F.color ? 'on' : ''}" style="--c:${c}" data-act="laboColor" data-arg="${c}" aria-label="Couleur ${c}"></button>`).join('');
    const T = Form.third, cost = CONFIG.recipes.third.cost;
    const list = s.recipes.map(r => {
      const opts = Recipes.thirdOptions(s, r), open = T.id === r.id && opts.length;
      const parts = [r.a, r.b, r.c].filter(Boolean).map(k => `${M[k].icon} ${CONFIG.flavors[k].name}`).join(' + ');
      let add = '';
      if (open) {   // Trois parfums : choix du 3e parfum (seulement ceux qui font monter le prix) et aperçu
        const nr = T.c ? Recipes.thirdPreview(r, T.c) : null;
        add = `<div class="third">
          <b>Quel 3e parfum ?</b>
          <div class="lab-picks">${opts.map(k => `<button type="button" class="lab-pick ${T.c === k ? 'is-active' : ''}" data-act="thirdPick" data-arg="${k}" aria-pressed="${T.c === k}">
            ${bigBottle(CONFIG.flavors[k].color, M[k].icon, 'sm')}<small>${CONFIG.flavors[k].name}</small></button>`).join('')}</div>
          <p class="sub">${nr ? `Prix : ${Fmt.money(r.price)} → <b class="ok">${Fmt.money(nr.price)}</b> la bouteille (+${Math.round((nr.price / r.price - 1) * 100)} %)` : 'Choisis un parfum pour voir le nouveau prix.'}</p>
          <div class="third-btns"><button class="btn ghost sm" data-act="thirdOpen" data-arg="${r.id}">Annuler</button>
            <button class="btn sm" data-act="thirdAdd" ${!nr || s.money < cost ? 'disabled' : ''}>Ajouter · ${Fmt.money(cost)}</button></div>
        </div>`;
      }
      return `
      <article class="recipe-card${open ? ' third-open' : ''}">
        ${bigBottle(r.color, r.c ? '🌈' : '✨', 'md')}
        <div class="grow"><b>${esc(r.name)}${r.c ? ' <span class="third-badge">3 parfums</span>' : ''}</b>
          <div class="sub">${parts}</div>
          <div class="sub">${Fmt.money(r.price)} / bouteille</div></div>
        <div class="recipe-btns">
          <button class="btn ghost sm" data-act="select" data-arg="${r.id}|0">${s.flavor === r.id ? '✓ Ligne 1' : 'Produire'}</button>
          ${opts.length && !open ? `<button class="btn ghost sm" data-act="thirdOpen" data-arg="${r.id}">＋ Parfum</button>` : ''}
        </div>
        ${add}
      </article>`;
    }).join('') || '<p class="empty">Aucune recette pour l’instant. À toi d’inventer !</p>';

    return `
    <div class="cols lab">
      <section class="card">
        <h3>Mélange</h3>
        <div class="mixer">
          <div class="mix-slot">${bigBottle(A.color, M[F.a].icon)}<b>${A.name}</b></div>
          <span class="plus" aria-hidden="true">+</span>
          <div class="mix-slot">${bigBottle(B.color, M[F.b].icon)}<b>${B.name}</b></div>
        </div>
        <div class="mix-arrow" aria-hidden="true">↓</div>
        <div class="mix-result">${bigBottle(F.color, '✨', 'glow')}
          <p class="sub" data-t="laboPrev"></p></div>
        <h4>Parfum 1</h4><div class="lab-picks">${pick('A', F.a)}</div>
        <h4>Parfum 2</h4><div class="lab-picks">${pick('B', F.b)}</div>
        <label class="field" for="labo-name">Nom de la recette
          <input id="labo-name" data-form="labo.name" maxlength="18" placeholder="Ex. Menthe-Fusée" value="${esc(F.name)}"></label>
        <h4>Couleur de la bouteille</h4>
        <div class="swatches">${swatches}</div>
        <p class="warn" data-t="laboErr"></p>
        <button class="btn block" data-act="laboCreate" data-d="cantLabo">✨ Inventer · <span data-t="laboCost"></span></button>
      </section>
      <section class="card"><h3>Recettes découvertes (${s.recipes.length} / ${Research.recipeMax(s)})</h3>
        <div class="recipes">${list}</div>
        <p class="hint">Une recette se vend ${Fmt.num(CONFIG.recipes.priceBonus * 2)} fois le prix moyen de ses parfums, et les clients peuvent la commander.${s.research.done.includes('r3') ? ` Avec 🌈 Trois parfums, « ＋ Parfum » lui ajoute un 3e parfum pour ${Fmt.money(cost)} : elle se vend alors ${Fmt.num(CONFIG.recipes.third.bonus * 3)} fois le prix moyen de ses trois parfums (seuls ceux qui font monter le prix sont proposés).` : ''}</p>
      </section>
    </div>`;
  },
};
