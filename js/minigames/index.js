/**
 * index.js — lancement des mini-jeux depuis le village.
 * Fait le lien entre un mini-jeu (présentation) et ses récompenses (simulation).
 */
import { CONFIG } from '../config.js';
import { Game } from '../core/game.js';
import { Fmt } from '../core/format.js';
import { Trips } from '../sim/trips.js';
import { Cities } from '../sim/cities.js';
import { MiniGames } from './host.js';
import { TrainDrive } from './train.js';
import { BoatDrive } from './boat.js';

/** Le wagon automatique des villes ouvertes : prochain départ, et le bonus du mini-jeu */
function wagonInfo(s) {
  return Object.entries(CONFIG.cities).filter(([id]) => Cities.open(s, id)).map(([id, C]) => {
    const when = Cities.ready(s, id) ? `part dans <b>${Fmt.time(Cities.wait(s, id))}</b>`
      : `attend que l’entrepôt soit plein à ${Math.round(C.wagon.fullAt * 100)} %`;
    return `<br>${C.icon} Wagon pour la ${C.name} : ${when}. Avec au moins une étoile, il part dès ton arrivée.`;
  }).join('');
}

export const Minis = {
  /** 🚂 Conduire le train de la gare de la Colline jusqu'à la Gare des Fraises */
  train() {
    MiniGames.run(TrainDrive, {
      // Avant le départ : ce que le voyage peut rapporter
      intro: () => {
        const s = Game.s;
        const pay = !Trips.ready(s) ? `🕑 Prochain voyage payé dans <b>${Fmt.time(Trips.wait(s))}</b>. Tu peux rouler pour le plaisir !`
          : `💰 Jusqu’à <b>${Fmt.money(Trips.gain(s, 3))}</b> et ⭐ +${3 * CONFIG.train.repPerStar} avec 3 étoiles.`;
        return pay + wagonInfo(s);
      },
      // À l'arrivée : crédite et décrit la récompense
      onFinish: r => {
        const g = Trips.finish(Game.s, r);
        const best = g.best ? '<br>🏆 Nouveau record d’étoiles !' : '';
        if (!g.money) return `Voyage pour le plaisir 🙂 Prochain voyage payé dans <b>${Fmt.time(g.wait)}</b>.${best}`;
        return `💰 <b>+${Fmt.money(g.money)}</b>${g.rep ? ` · ⭐ +${g.rep}` : ''}${best}`;
      },
    });
  },

  /** ⛵ Piloter le bateau du Port de Sirop-sur-Mer jusqu'à Port-Agrumes (sa propre attente, mêmes gains que le train) */
  boat() {
    MiniGames.run(BoatDrive, {
      shirt: Game.s.look.shirt,
      intro: () => {
        const s = Game.s;
        return !Trips.ready(s, 'boat') ? `🕑 Prochaine traversée payée dans <b>${Fmt.time(Trips.wait(s, 'boat'))}</b>. Tu peux naviguer pour le plaisir !`
          : `💰 Jusqu’à <b>${Fmt.money(Trips.gain(s, 3, 'boat'))}</b> et ⭐ +${3 * CONFIG.boat.repPerStar} avec 3 étoiles.`;
      },
      onFinish: r => {
        const g = Trips.finish(Game.s, r, 'boat');
        const best = g.best ? '<br>🏆 Nouveau record d’étoiles !' : '';
        if (!g.money) return `Traversée pour le plaisir 🙂 Prochaine traversée payée dans <b>${Fmt.time(g.wait)}</b>.${best}`;
        return `💰 <b>+${Fmt.money(g.money)}</b>${g.rep ? ` · ⭐ +${g.rep}` : ''}${best}`;
      },
    });
  },
};
