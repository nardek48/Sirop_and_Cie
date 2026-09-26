/**
 * quests.js — le fil de quêtes du maire. Une quête à la fois ;
 * la récompense se récupère en allant voir le maire (porte de la mairie).
 */
import { Bus } from '../core/bus.js';
import { Fmt } from '../core/format.js';
import { Wallet } from './wallet.js';

/** val(s) donne la progression ; la quête est réussie quand val ≥ goal */
export const QUESTS = [
  { text: 'Accepte un contrat au bureau des contrats', goal: 1, reward: 30, val: s => (s.active.length || s.stats.cDone ? 1 : 0) },
  { text: 'Livre ta première commande', goal: 1, reward: 50, val: s => s.stats.cDone },
  { text: 'Récolte 3 fois au verger', goal: 3, reward: 40, val: s => s.stats.picked },
  { text: 'Améliore la cuisson de l’usine', goal: 1, reward: 60, val: s => s.lv.cook - 1 },
  { text: 'Débloque la Grenadine', goal: 1, reward: 120, val: s => (s.unlocked.includes('grenadine') ? 1 : 0) },
  { text: 'Achète un vélo au garage', goal: 1, reward: 200, val: s => s.vehicle },
  { text: 'Construis ta première maison', goal: 1, reward: 300, val: s => s.houses.length },
  { text: 'Atteins 10 étoiles de réputation', goal: 10, reward: 400, val: s => s.rep },
  { text: 'Ouvre les Champs', goal: 1, reward: 600, val: s => (s.districts.champs ? 1 : 0) },
  { text: 'Invente une recette secrète au labo', goal: 1, reward: 1000, val: s => s.recipes.length },
  { text: 'Embauche un livreur', goal: 1, reward: 1500, val: s => s.couriers },
  { text: 'Livre 25 commandes', goal: 25, reward: 3000, val: s => s.stats.cDone },
  { text: 'Ouvre la Colline', goal: 1, reward: 8000, val: s => (s.districts.colline ? 1 : 0) },
  { text: 'Livre 3 commandes au Train Express', goal: 3, reward: 20000, val: s => s.stats.byClient.gare || 0 },
  { text: 'Gagne 1 M $ avec ton entreprise', goal: 1e6, reward: 50000, val: s => s.run.earned },
];

export const Quests = {
  current: s => QUESTS[s.quest.i] || null,

  progress(s) {
    const q = this.current(s);
    if (!q) return { cur: 1, goal: 1 };
    return { cur: Math.min(q.goal, Math.max(0, q.val(s))), goal: q.goal };
  },

  step(s) {
    const q = this.current(s);
    if (!q || s.quest.ready || q.val(s) < q.goal) return;
    s.quest.ready = true;
    Bus.toast(`🎁 Quête réussie : ${q.text}. Va voir le maire !`, 'ok');
    Bus.sfx('quest');
  },

  /** @returns {boolean} true si une récompense a été donnée */
  claim(s) {
    const q = this.current(s);
    if (!q || !s.quest.ready) return false;
    Wallet.earn(s, q.reward);
    Bus.float(`+${Fmt.money(q.reward)} 🎁`, 'mairie', '#ffe28a');
    Bus.toast(`Le maire te remercie : +${Fmt.money(q.reward)}`, 'ok');
    Bus.sfx('coin');
    s.quest.i++;
    s.quest.ready = false;
    return true;
  },
};
