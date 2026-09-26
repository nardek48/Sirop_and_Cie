/**
 * Garage : véhicules du joueur et livreurs.
 */
import { CONFIG } from '../../config.js';
import { Fmt } from '../../core/format.js';

export const garage = {
  title: '🚲 Garage',
  key: s => [s.vehicle, s.couriers, s.rep >= CONFIG.couriers.rep].join('|'),
  html(s) {
    const rows = CONFIG.vehicles.map((v, i) => {
      const state = i < s.vehicle ? '<span class="sub">Remplacé</span>'
        : i === s.vehicle ? '<span class="ok">✓ Le tien</span>'
        : i === s.vehicle + 1 ? `<button class="btn sm" data-act="vehicle" data-d="cantVehicle">Acheter · ${Fmt.money(v.cost)}</button>`
        : `<span class="sub">🔒 ${Fmt.money(v.cost)}</span>`;
      return `
      <div class="veh ${i === s.vehicle ? 'mine' : ''}">
        <span class="house-ico">${v.icon}</span>
        <div class="grow"><b>${v.name}</b>
          <div class="sub">Vitesse ${Math.round(v.speed / 2.5)} · porte ${Fmt.int(v.cap)} bouteilles</div></div>
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
        <p class="hint">Un véhicule plus grand permet de livrer les grosses commandes (Supermarché, Train, Port) en un seul voyage.</p>
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
