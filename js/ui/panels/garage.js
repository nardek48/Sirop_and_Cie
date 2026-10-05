/**
 * Garage : véhicules du joueur et livreurs.
 */
import { CONFIG } from '../../config.js';
import { Fmt } from '../../core/format.js';
import { Eco } from '../../sim/eco.js';

export const garage = {
  title: '🚲 Garage',
  key: s => [s.vehicle, Eco.rideIdx(s), s.couriers, s.rep >= CONFIG.couriers.rep].join('|'),
  html(s) {
    const cur = Eco.rideIdx(s);
    const rows = CONFIG.vehicles.map((v, i) => {
      const state = i === cur ? '<span class="ok">✓ Tu le prends</span>'
        : i <= s.vehicle ? `<button class="btn ghost sm" data-act="ride" data-arg="${i}">Prendre</button>`
        : i === s.vehicle + 1 ? `<button class="btn sm" data-act="vehicle" data-d="cantVehicle">Acheter · ${Fmt.money(v.cost)}</button>`
        : `<span class="sub">🔒 ${Fmt.money(v.cost)}</span>`;
      return `
      <div class="veh ${i === cur ? 'mine' : ''}">
        <span class="house-ico">${v.icon}</span>
        <div class="grow"><b>${v.name}</b>
          <div class="sub">Vitesse ${Math.round(v.speed / 2.5)} · porte ${Fmt.int(Eco.capacityOf(s, v))} bouteilles</div></div>
        ${state}
      </div>`;
    }).join('');

    const K = CONFIG.couriers;
    const hire = s.couriers >= K.max ? '<span class="ok">Équipe complète</span>'
      : s.rep < K.rep ? `<span class="sub">⭐ ${K.rep} requis</span>`
      : `<button class="btn sm" data-act="courier" data-d="cantCourier">Embaucher · <span data-t="courierCost"></span></button>`;

    return `
    <div class="cols">
      <section class="card">
        <h3>Tes véhicules</h3>
        ${rows}
        <p class="hint">Tu peux aussi changer de véhicule dans le garage de ta maison 🏠. Un véhicule plus grand permet de livrer les grosses commandes (Supermarché, Train, Port) en un seul voyage. Sa capacité grandit avec la production de ton usine.</p>
      </section>
      <section class="card">
        <h3>Livreurs · <span data-t="courierTxt"></span></h3>
        <p class="sub" data-t="courierBusy"></p>
        <div class="auto-row">
          <div><b>Embaucher un livreur</b><div class="sub">Il charge les commandes prêtes au quai et les livre à pied, même quand le jeu est fermé.</div></div>
          ${hire}
        </div>
      </section>
    </div>`;
  },
};
