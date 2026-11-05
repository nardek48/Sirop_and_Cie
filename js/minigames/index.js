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
};
