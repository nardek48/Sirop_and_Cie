/**
 * Labo : inventer des recettes secrètes en mélangeant deux parfums.
 * C'est l'écran « créatif » : on choisit deux bouteilles, on voit le mélange, on le nomme et le colore.
 */
import { CONFIG, RECIPE_COLORS } from '../../config.js';
import { Fmt, esc } from '../../core/format.js';
import { Form } from '../form.js';

const M = CONFIG.materials;
/** Grosse bouteille : couleur du sirop, fruit sur l'étiquette */
const bigBottle = (color, icon, cls = '') => `<span class="bottle xl ${cls}" style="--c:${color}" aria-hidden="true"><em>${icon || ''}</em></span>`;

export const labo = {
  title: '🧪 Labo des recettes',
  key: s => [s.recipes.length, s.unlocked.join(), Form.labo.color, Form.labo.a, Form.labo.b, s.flavor].join('|'),
  html(s) {
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
    const list = s.recipes.map(r => `
      <article class="recipe-card">
        ${bigBottle(r.color, '✨', 'md')}
        <div class="grow"><b>${esc(r.name)}</b>
          <div class="sub">${M[r.a].icon} ${CONFIG.flavors[r.a].name} + ${M[r.b].icon} ${CONFIG.flavors[r.b].name}</div>
          <div class="sub">${Fmt.money(r.price)} / bouteille</div></div>
        <button class="btn ghost sm" data-act="select" data-arg="${r.id}|0">${s.flavor === r.id ? '✓ Ligne 1' : 'Produire'}</button>
      </article>`).join('') || '<p class="empty">Aucune recette pour l’instant. À toi d’inventer !</p>';

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
      <section class="card"><h3>Recettes découvertes (${s.recipes.length} / ${CONFIG.recipes.max})</h3>
        <div class="recipes">${list}</div>
        <p class="hint">Une recette se vend ${Fmt.num(CONFIG.recipes.priceBonus * 2)} fois le prix moyen de ses deux parfums, et les clients peuvent la commander.</p>
      </section>
    </div>`;
  },
};
