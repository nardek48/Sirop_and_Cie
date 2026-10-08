/**
 * index.js — lancement des mini-jeux depuis le village.
 * Fait le lien entre un mini-jeu (présentation) et ses récompenses (simulation).
 */
import { CONFIG } from '../config.js';
import { Game } from '../core/game.js';
import { Fmt } from '../core/format.js';
import { Trips } from '../sim/trips.js';
import { MiniGames } from './host.js';
import { TrainDrive } from './train.js';

export const Minis = {
  /** 🚂 Conduire le train de la gare de la Colline jusqu'à la Gare des Fraises */
  train() {
    MiniGames.run(TrainDrive, {
      // Avant le départ : ce que le voyage peut rapporter
      intro: () => {
        const s = Game.s;
        if (!Trips.ready(s)) return `🕑 Prochain voyage payé dans <b>${Fmt.time(Trips.wait(s))}</b>. Tu peux rouler pour le plaisir !`;
        return `💰 Jusqu’à <b>${Fmt.money(Trips.gain(s, 3))}</b> et ⭐ +${3 * CONFIG.train.repPerStar} avec 3 étoiles.`;
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
