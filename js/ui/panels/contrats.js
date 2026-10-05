/**
 * Bureau des contrats : offres, contrats en cours et leur statut de livraison.
 */
import { CONFIG } from '../../config.js';
import { Fmt } from '../../core/format.js';
import { Flavors } from '../../sim/flavors.js';
import { Eco } from '../../sim/eco.js';

export const contrats = {
  title: '📜 Bureau des contrats',
  key: s => [s.offers.map(o => o.id), s.active.map(c => c.id), s.slots, s.recipes.length, s.unlocked.length, Eco.lines(s).map(L => L.flavor).join(),
             CONFIG.contracts.clients.filter(c => Eco.clientOpen(s, c)).length].join('|'),
  html(s) {
    const fl = k => { const f = Flavors.get(s, k); return `<span class="fl"><span class="dot" style="--c:${f.color}"></span>${f.name}</span>`; };
    const next = CONFIG.contracts.clients.find(c => !Eco.clientOpen(s, c));
    const nextTxt = !next ? 'Tous les clients sont débloqués.'
      : next.district && !s.districts[next.district] ? `Prochain client : ${next.icon} ${next.name}, quand ${CONFIG.districts[next.district].name} sera ouverte`
      : `Prochain client : ${next.icon} ${next.name} à ⭐ ${next.rep}`;

    const offers = s.offers.map(o => `
      <article class="contract ${o.special ? 'special' : ''}">
        <header><span class="c-ico">${o.icon}</span><b>${o.client}</b>${fl(o.flavor)}</header>
        <div class="meta pills"><span>📦 ${Fmt.int(o.qty)} bt</span><span>💰 ${Fmt.money(o.reward)}</span>
          <span>⏱ ${Fmt.time(o.time)}</span><span>⭐ +${o.repGain}</span></div>
        <div class="sub offer-stock" data-c="enough|offerOk:${o.id}">🏭 En stock : <span data-t="offerStock:${o.id}"></span></div>
        <div class="foot"><small>${o.tuto ? 'Commande de Mémé 👵 : pas de limite' : `Expire dans <span data-t="offerTtl:${o.id}"></span>`}</small>
          <button class="btn ghost sm" data-act="decline" data-arg="${o.id}">Refuser</button>
          <button class="btn sm" data-act="accept" data-arg="${o.id}" data-d="cantAccept:${o.id}">Accepter</button></div>
      </article>`).join('') || '<p class="empty">Aucune offre pour le moment. Reviens dans un instant.</p>';

    const active = s.active.map(c => `
      <article class="contract ${c.special ? 'special' : ''}">
        <header><span class="c-ico">${c.icon}</span><b>${c.client}</b>${fl(c.flavor)}</header>
        <div class="status" data-t="cStatus:${c.id}"></div>
        <div class="meta"><span>💰 ${Fmt.money(c.reward)}</span><span>⭐ +${c.repGain}</span>
          <span>${c.tuto ? 'Pas de pénalité' : `Échec : −${Fmt.money(c.reward * CONFIG.contracts.penaltyRatio)}`}</span></div>
        <div class="sub">Bouteilles : <span data-t="cStock:${c.id}"></span></div>
        <div class="bar"><i data-w="cStockPct:${c.id}"></i></div>
        <div class="sub">Temps restant : <span data-t="cLeft:${c.id}"></span></div>
        <div class="bar time"><i data-w="cTimePct:${c.id}"></i></div>
        ${c.tuto ? '' : `<div class="foot end"><button class="btn ghost sm danger-t" data-act="abandon" data-arg="${c.id}">Abandonner</button></div>`}
      </article>`).join('') || `
      <div class="c-empty">
        <div class="c-empty-ico" aria-hidden="true">📨</div>
        <b>Choisis un contrat</b>
        <ol class="c-steps">
          <li><span>✅</span>Accepter</li><li><span>📦</span>Charger au quai</li><li><span>📍</span>Livrer au client</li>
        </ol>
      </div>`;

    // Stock de chaque sirop : en entrepôt, réservé par les contrats acceptés, et la ligne qui le fabrique
    const lines = Eco.lines(s);
    const stock = Flavors.ids(s).filter(k => s.unlocked.includes(k) || s.recipes.some(r => r.id === k)).map(k => {
      const f = Flavors.get(s, k), li = lines.findIndex(L => L.flavor === k);
      return `<li class="stock-chip"><span class="dot" style="--c:${f.color}"></span><b>${f.name}</b>
        <span class="n" data-t="stockFl:${k}"></span><small data-t="stockRes:${k}"></small>
        ${li >= 0 ? `<small class="mk">🔥 ${lines.length > 1 ? `ligne ${li + 1}` : 'en production'}</small>` : ''}</li>`;
    }).join('');

    return `
    <section class="card">
      <div class="split"><h3>🏭 Stock de sirop</h3><span class="sub">Entrepôt : <b data-t="stockTop"></b> bt</span></div>
      <ul class="stock-chips">${stock}</ul>
    </section>
    <div class="cols">
      <section class="card"><div class="split"><h3>Offres</h3><span class="sub">Prochaine : <b data-t="nextOffer"></b></span></div>${offers}</section>
      <section class="card">
        <div class="split"><h3>En cours</h3>
          <span class="sub">Places <b data-t="slotsTxt"></b>
            <button class="btn ghost sm" data-act="slot" data-d="cantSlot">+1 · <span data-t="slotCost"></span></button></span></div>
        ${active}
      </section>
    </div>
    <p class="hint"><span data-t="capTxt"></span> · ${nextTxt} · Le Café des Arts paie 25 % de plus la nuit 🌙.</p>`;
  },
};
