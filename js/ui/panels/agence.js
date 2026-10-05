/**
 * Agence immobilière : maisons à construire sur les terrains du village.
 */
import { CONFIG, typeById } from '../../config.js';
import { Fmt } from '../../core/format.js';
import { Eco } from '../../sim/eco.js';
import { Form } from '../form.js';

export const agence = {
  title: '🏡 Agence immobilière',
  key: s => s.houses.map(h => h.id + h.use + h.lvl).join() + JSON.stringify(Form.houseUse) + s.districts.colline,
  html(s) {
    const U = CONFIG.houses.uses;
    const summary = Object.entries(U).map(([k, u]) => `
      <div class="use"><div class="sub">${u.icon} ${u.name}</div><b data-t="useTotal:${k}"></b></div>`).join('');

    const types = CONFIG.houses.types.map(t => {
      const sel = Form.houseUse[t.id] || 'rent';
      const opts = Object.entries(U).map(([k, u]) =>
        `<option value="${k}" ${sel === k ? 'selected' : ''}>${u.icon} ${u.name} (+${Fmt.num(u.base * t.mult)} ${u.unit})</option>`).join('');
      return `
      <article class="proj">
        <div class="proj-ico" aria-hidden="true">${t.icon}</div>
        <b>${t.name}</b>
        <div class="sub">Effet ×${t.mult}</div>
        <label class="sr" for="use-${t.id}">Usage</label>
        <select id="use-${t.id}" data-form="houseUse.${t.id}" data-rerender>${opts}</select>
        <div class="sub">Coût : <b data-t="houseCost:${t.id}"></b></div>
        <button class="btn block" data-act="house" data-arg="${t.id}" data-d="cantHouse:${t.id}">Construire</button>
      </article>`;
    }).join('');

    const owned = s.houses.map(h => {
      const t = typeById(h.type), u = U[h.use], max = h.lvl >= CONFIG.houses.maxLevel;
      return `
      <article class="prop">
        <span class="prop-ico" aria-hidden="true">${t.icon}</span>
        <div class="grow"><b>${t.name}</b> <span class="lvl">Niv. ${h.lvl}</span>
          <div class="sub">Terrain ${h.plot + 1} · ${u.icon} ${u.name} · +${Fmt.num(Eco.houseEffect(h))} ${u.unit}</div></div>
        <div class="prop-btns">
          <button class="btn sm" data-act="reno" data-arg="${h.id}" data-d="cantReno:${h.id}">${max ? 'Niveau max' : 'Rénover · ' + Fmt.money(Eco.renoCost(h))}</button>
          <button class="btn ghost danger-t sm" data-act="sellHouse" data-arg="${h.id}">Vendre · ${Fmt.money(Eco.sellValue(h))}</button>
        </div>
      </article>`;
    }).join('') || '<p class="empty">Tu ne possèdes encore aucune maison.</p>';

    return `
    <section class="card">
      <div class="uses">${summary}</div>
    </section>
    <div class="cols agence">
      <section class="card">
        <div class="split"><h3>Nouveaux projets</h3><span class="sub">Terrains libres : <b data-t="plotsTxt"></b></span></div>
        <div class="projs">${types}</div>
        <p class="hint">La maison apparaît sur le prochain terrain libre, au sud de la route.
          ${s.districts.colline ? '' : 'La Colline ⛰️ ajoute 4 terrains. '}Chaque achat augmente de ${Math.round((CONFIG.houses.costGrowth - 1) * 100)} % le prix du suivant.</p>
      </section>
      <section class="card"><h3>Tes propriétés (${s.houses.length})</h3><div class="props">${owned}</div></section>
    </div>`;
  },
};
