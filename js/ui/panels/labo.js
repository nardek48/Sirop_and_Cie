/**
 * Labo : inventer des recettes secrètes en mélangeant deux parfums.
 * C'est l'écran « créatif » : l'enfant choisit le nom et la couleur.
 */
import { CONFIG, RECIPE_COLORS } from '../../config.js';
import { Fmt, esc } from '../../core/format.js';
import { Form } from '../form.js';

export const labo = {
  title: '🧪 Labo des recettes secrètes',
  key: s => [s.recipes.length, s.unlocked.join(), Form.labo.color, Form.labo.a, Form.labo.b].join('|'),
  html(s) {
    const F = Form.labo;
    const base = Object.entries(CONFIG.flavors).filter(([k]) => s.unlocked.includes(k));
    const opts = sel => base.map(([k, f]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${f.name}</option>`).join('');
    const swatches = RECIPE_COLORS.map(c =>
      `<button class="sw ${c === F.color ? 'on' : ''}" style="--c:${c}" data-act="laboColor" data-arg="${c}" aria-label="Couleur ${c}"></button>`).join('');
    const list = s.recipes.map(r => `
      <div class="owned">
        <span class="bottle" style="--c:${r.color}" aria-hidden="true"></span>
        <div class="grow"><b>${esc(r.name)}</b>
          <div class="sub">${CONFIG.flavors[r.a].name} + ${CONFIG.flavors[r.b].name} · ${Fmt.money(r.price)} / bt</div></div>
        <button class="btn ghost sm" data-act="select" data-arg="${r.id}">${s.flavor === r.id ? 'En production' : 'Produire'}</button>
      </div>`).join('') || '<p class="empty">Aucune recette pour l’instant. À toi d’inventer !</p>';

    if (base.length < 2) return `
      <section class="card"><h3>Il faut deux parfums</h3>
        <p>Débloque la Grenadine à l’usine, puis reviens mélanger tes parfums ici.</p></section>`;

    return `
    <div class="cols">
      <section class="card">
        <h3>Nouveau mélange</h3>
        <div class="mix">
          <label class="field" for="labo-a">Parfum 1<select id="labo-a" data-form="labo.a" data-rerender>${opts(F.a)}</select></label>
          <span class="plus" aria-hidden="true">+</span>
          <label class="field" for="labo-b">Parfum 2<select id="labo-b" data-form="labo.b" data-rerender>${opts(F.b)}</select></label>
        </div>
        <label class="field" for="labo-name">Nom de la recette
          <input id="labo-name" data-form="labo.name" maxlength="18" placeholder="Ex. Menthe-Fusée" value="${esc(F.name)}"></label>
        <div class="sub">Couleur de la bouteille</div>
        <div class="swatches">${swatches}</div>
        <p class="preview"><span class="bottle" style="--c:${F.color}" aria-hidden="true"></span><span data-t="laboPrev"></span></p>
        <p class="warn" data-t="laboErr"></p>
        <button class="btn block" data-act="laboCreate" data-d="cantLabo">Inventer · <span data-t="laboCost"></span></button>
      </section>
      <section class="card"><h3>Tes recettes (${s.recipes.length} / ${CONFIG.recipes.max})</h3>${list}
        <p class="hint">Une recette se vend ${Math.round((CONFIG.recipes.priceBonus - 1) * 100)} % plus cher que ses deux parfums réunis, et les clients peuvent la commander.</p>
      </section>
    </div>`;
  },
};
