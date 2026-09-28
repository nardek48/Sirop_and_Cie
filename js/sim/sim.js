/**
 * sim.js — un pas de simulation, l'avance rapide, le prestige et le hors-ligne.
 * Ordre des systèmes : horloge → événements → revenus → récoltes → usine → comptoir → contrats → livreurs → quêtes → ouvertures.
 *
 * Pendant le tutoriel, le temps du village est en pause (horloge, événements, loyers, comptoir,
 * contrats, livreurs) : seules l'usine et les récoltes tournent, pour que le joueur apprenne sans stress.
 */
import { CONFIG } from '../config.js';
import { Game, rt } from '../core/game.js';
import { Store } from '../core/store.js';
import { Clock } from './clock.js';
import { Events } from './events.js';
import { Eco } from './eco.js';
import { Factory } from './factory.js';
import { Market } from './market.js';
import { Contracts } from './contracts.js';
import { Couriers } from './couriers.js';
import { Fields, RealEstate } from './world-systems.js';
import { Quests } from './quests.js';
import { Openings } from './openings.js';

export const Sim = {
  step(s, dt) {
    rt.earnedTick = 0;
    s.stats.playSec += dt;
    const tuto = s.tuto && s.tuto.active;
    if (!tuto) {
      Clock.step(s, dt);
      Events.step(s, dt);
      if (s.auto.restock) Factory.autoRestock(s);
      RealEstate.step(s, dt);
    }
    Fields.step(s, dt);
    Factory.step(s, dt);
    if (!tuto) {
      Market.step(s, dt);
      Contracts.step(s, dt);
      Couriers.step(s, dt);
    } else rt.flow.sell = 0;
    Quests.step(s);
    Openings.step(s);
    rt.rps += (rt.earnedTick / dt - rt.rps) * Math.min(1, dt / 4);   // moyenne mobile ~4 s
  },

  /** Avance de `seconds` par pas ≤ 1 s */
  advance(s, seconds) {
    while (seconds > 1e-6) { const d = Math.min(1, seconds); this.step(s, d); seconds -= d; }
  },

  seed(s) { Contracts.generate(s); },
};

export const Prestige = {
  can: s => s.run.earned >= CONFIG.prestige.minRunEarned && Eco.prestigeGain(s) > 0,
  /** Repart de zéro ; garde les étoiles, le personnage, les stats, les quêtes et les bâtiments ouverts */
  reset(s) {
    const n = Store.fresh();
    n.stars = s.stars + Eco.prestigeGain(s);
    n.stats = s.stats; n.look = s.look; n.quest = s.quest;
    n.tuto = s.tuto; n.opened = s.opened; n.seen = s.seen; n.tipsOn = s.tipsOn; n.decor = s.decor;
    Game.s = n;
    Sim.seed(n);
  },
};

export const Offline = {
  /**
   * Rattrape le temps passé hors du jeu (plafonné).
   * @returns {object|null} un résumé à afficher, ou null si l'absence était courte
   */
  catchUp(s, sec) {
    const t = Math.min(sec, CONFIG.offline.capHours * 3600);
    if (t < CONFIG.offline.minSec) { Sim.advance(s, t); return null; }
    const b = { ...s.stats };
    rt.silent = true;
    Sim.advance(s, t);
    rt.silent = false;
    return {
      t, capped: sec > t,
      earned: s.stats.earned - b.earned, bottles: s.stats.bottles - b.bottles,
      sold: s.stats.sold - b.sold, done: s.stats.cDone - b.cDone, fail: s.stats.cFail - b.cFail,
    };
  },
};
