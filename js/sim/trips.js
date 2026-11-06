/**
 * trips.js — voyages des mini-jeux (train « Ligne des Fraises », bateau « Route des Agrumes ») : récompenses et attente.
 *
 * Un voyage payé toutes les CONFIG[k].cooldownSec secondes (temps réel, même jeu fermé) ;
 * entre deux, on peut rouler pour le plaisir. Le gain vaut quelques minutes de production
 * de l'usine (selon les étoiles), pour rester intéressant à tous les stades de la partie.
 */
import { CONFIG } from '../config.js';
import { Bus } from '../core/bus.js';
import { Eco } from './eco.js';
import { Wallet } from './wallet.js';
import { Cities } from './cities.js';

const T = k => CONFIG[k];

/** k : 'train' (Ligne des Fraises) ou 'boat' (Route des Agrumes) ; chacun a son attente et son record */
export const Trips = {
  /** Valeur d'une minute de production (au prix de base du parfum en cours) */
  perMin: (s, k = 'train') => Math.max(T(k).minPerMin, Eco.prodRate(s) * 60 * Eco.sellPrice(s, s.flavor)),
  /** Gain d'un voyage payé selon les étoiles (0 à 3) */
  gain: (s, stars, k = 'train') => Math.round(Trips.perMin(s, k) * T(k).minutesByStars[stars]),
  /** Secondes avant le prochain voyage payé (0 = disponible) */
  wait: (s, k = 'train') => {
    // Horloge de l'appareil reculée : l'attente ne dépasse jamais un délai complet
    const max = Date.now() + T(k).cooldownSec * 1000;
    if (s[k].readyAt > max) s[k].readyAt = max;
    return Math.max(0, Math.ceil((s[k].readyAt - Date.now()) / 1000));
  },
  ready: (s, k = 'train') => Trips.wait(s, k) === 0,

  /**
   * Fin d'un voyage : crédite la récompense si elle est disponible.
   * @param {{stars:number}} r résultat du mini-jeu
   * @returns {{money:number, rep:number, wait:number, best:boolean}}
   */
  finish(s, r, k = 'train') {
    const stars = Math.max(0, Math.min(3, r.stars | 0)), V = s[k];
    if (stars) Cities.hurry(s, k);   // bonus : conduire soi-même fait partir le convoi de cette ville tout de suite
    const best = stars > V.best;
    V.trips++;
    V.best = Math.max(V.best, stars);
    if (!Trips.ready(s, k)) return { money: 0, rep: 0, wait: Trips.wait(s, k), best };
    const money = Trips.gain(s, stars, k), rep = stars * T(k).repPerStar;
    Wallet.earn(s, money);
    s.rep += rep;
    V.readyAt = Date.now() + T(k).cooldownSec * 1000;
    Bus.sfx('coin');
    return { money, rep, wait: 0, best };
  },
};
