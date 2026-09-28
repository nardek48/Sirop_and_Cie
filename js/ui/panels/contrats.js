/**
 * Bureau des contrats : offres, contrats en cours et leur statut de livraison.
 */
import { CONFIG } from '../../config.js';
import { Fmt } from '../../core/format.js';
import { Flavors } from '../../sim/flavors.js';
import { Eco } from '../../sim/eco.js';

export const contrats = {
  title: '📜 Bureau des contrats',
  key: s => [s.offers.map(o => o.id), s.active.map(c => c.id), s.slots, s.recipes.length,
             CONFIG.contracts.clients.filter(c => Eco.clientOpen(s, c)).length].join('|'),
  html(s) {
    const fl = k => { const f = Flavors.get(s, k); return `<span class="fl"><span class="dot" style="--c:${f.color}"></span>${f.name}</span>`; };
    const next = CONFIG.contracts.clients.find(c => !Eco.clientOpen(s, c));
    const nextTxt = !next ? 'Tous les clients sont débloqués.'
      : next.district && !s.districts[next.district] ? `Prochain client : ${next.icon} ${next.name}, quand ${CONFIG.districts[next.district].name} sera ouverte`
      : `Prochain client : ${next.icon} ${next.name} à ⭐ ${next.rep}`;

    const offers = s.offers.map(o => `
      <article class="contract ${o.special ? 'special' : ''}">
        <header><span>${o.icon}</span>${o.client}${fl(o.flavor)}</header>
        <div class="meta"><span>📦 ${Fmt.int(o.qty)} bt</span><span>💰 ${Fmt.money(o.reward)}</span>
          <span>⏱ ${Fmt.time(o.time)}</span><span>⭐ +${o.repGain}</span></div>
        <div class="foot"><small>${o.tuto ? 'Commande de Mémé 👵 : pas de limite' : `Expire dans <span data-t="offerTtl:${o.id}"></span>`}</small>
          <button class="btn ghost sm" data-act="decline" data-arg="${o.id}">Refuser</button>
          <button class="btn sm" data-act="accept" data-arg="${o.id}" data-d="cantAccept:${o.id}">Accepter</button></div>
      </article>`).join('') || '<p class="empty">Aucune offre pour le moment. Reviens dans un instant.</p>';

    const active = s.active.map(c => `
      <article class="contract ${c.special ? 'special' : ''}">
        <header><span>${c.icon}</span>${c.client}${fl(c.flavor)}</header>
        <div class="status" data-t="cStatus:${c.id}"></div>
        <div class="meta"><span>💰 ${Fmt.money(c.reward)}</span><span>⭐ +${c.repGain}</span>
          <span>${c.tuto ? 'Pas de pénalité' : `Échec : −${Fmt.money(c.reward * CONFIG.contracts.penaltyRatio)}`}</span></div>
        <div class="sub">Bouteilles : <span data-t="cStock:${c.id}"></span></div>
        <div class="bar"><i data-w="cStockPct:${c.id}"></i></div>
        <div class="sub">Temps restant : <span data-t="cLeft:${c.id}"></span></div>
        <div class="bar time"><i data-w="cTimePct:${c.id}"></i></div>
        ${c.tuto ? '' : `<div class="foot end"><button class="btn ghost sm danger-t" data-act="abandon" data-arg="${c.id}">Abandonner</button></div>`}
      </article>`).join('') || '<p class="empty">Aucun contrat en cours.</p>';

    return `
    <section class="card">
      <div class="split">
        <h3>Comment livrer ?</h3>
        <div>Emplacements <b data-t="slotsTxt"></b>
          <button class="btn ghost sm" data-act="slot" data-d="cantSlot">+1 · <span data-t="slotCost"></span></button></div>
      </div>
      <ol class="steps"><li>Accepte un contrat</li><li>Charge les caisses au quai 📦</li><li>Marche jusqu’au client</li><li>Appuie sur E</li></ol>
      <p class="hint"><span data-t="capTxt"></span> · Prochaine offre : <span data-t="nextOffer"></span> · ${nextTxt}
        · Le Café des Arts paie 25 % de plus la nuit 🌙.</p>
    </section>
    <div class="cols">
      <section class="card"><h3>Offres</h3>${offers}</section>
      <section class="card"><h3>En cours</h3>${active}</section>
    </div>`;
  },
};
