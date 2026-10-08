/**
 * trips.js — voyages en train (mini-jeu « Ligne des Fraises ») : récompenses et attente.
 *
 * Un voyage payé toutes les CONFIG.train.cooldownSec secondes (temps réel, même jeu fermé) ;
 * entre deux, on peut rouler pour le plaisir. Le gain vaut quelques minutes de production
 * de l'usine (selon les étoiles), pour rester intéressant à tous les stades de la partie.
 */
import { CONFIG } from '../config.js';
import { Bus } from '../core/bus.js';
import { Eco } from './eco.js';
import { Wallet } from './wallet.js';

const T = () => CONFIG.train;

export const Trips = {
  /** Valeur d'une minute de production (au prix de base du parfum en cours) */
  perMin: s => Math.max(T().minPerMin, Eco.prodRate(s) * 60 * Eco.sellPrice(s, s.flavor)),
  /** Gain d'un voyage payé selon les étoiles (0 à 3) */
  gain: (s, stars) => Math.round(Trips.perMin(s) * T().minutesByStars[stars]),
  /** Secondes avant le prochain voyage payé (0 = disponible) */
  wait: s => Math.max(0, Math.ceil((s.train.readyAt - Date.now()) / 1000)),
  ready: s => Trips.wait(s) === 0,

  /**
   * Fin d'un voyage : crédite la récompense si elle est disponible.
   * @param {{stars:number}} r résultat du mini-jeu
   * @returns {{money:number, rep:number, wait:number, best:boolean}}
   */
  finish(s, r) {
    const stars = Math.max(0, Math.min(3, r.stars | 0));
    const best = stars > s.train.best;
    s.train.trips++;
    s.train.best = Math.max(s.train.best, stars);
    if (!Trips.ready(s)) return { money: 0, rep: 0, wait: Trips.wait(s), best };
    const money = Trips.gain(s, stars), rep = stars * T().repPerStar;
    Wallet.earn(s, money);
    s.rep += rep;
    s.train.readyAt = Date.now() + T().cooldownSec * 1000;
    Bus.sfx('coin');
    return { money, rep, wait: 0, best };
  },
};
