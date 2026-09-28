/**
 * steps.js — les 9 étapes du tutoriel de Mémé Grenadine.
 *
 * Chaque étape :
 *  text     ce que dit Mémé (carte en haut de l'écran)
 *  say      petite phrase dans sa bulle, dans le village
 *  meme     où elle se tient (CONFIG.tuto.spots)
 *  world    cible dans le village : 'meme', 'tree' ou un lieu de CONFIG.places.
 *           Seule cette interaction (et Mémé) est possible pendant l'étape.
 *  panel    menu dans lequel se trouve la cible (usine, contrats…)
 *  sel      élément à entourer quand ce menu est ouvert
 *  hud      élément de l'interface à entourer (hors menu)
 *  btn      bouton « Suivant » affiché sur la carte
 *  enter(s, T)  préparation (doit pouvoir être rejouée : reprise après rechargement)
 *  done(s, T)   l'étape est réussie
 *  canSkip(s)   affiche quand même le bouton (le joueur ne peut pas faire l'action)
 *
 * T = le moteur (tutorial.js) : T.mark (valeurs notées au début de l'étape), T.panel (menu ouvert),
 * T.stepT (secondes passées sur l'étape), T.contract(s) (la commande d'entraînement).
 */
import { Eco } from '../sim/eco.js';
import { Meme } from '../world/meme.js';

export const STEPS = [
  {
    id: 'bonjour', meme: 'usine', world: 'meme', say: 'Coucou ! Par ici !',
    text: 'Bonjour, je suis <b>Mémé Grenadine</b> ! Viens me voir, je suis devant l’usine. Clique sur moi, ou marche avec les flèches ⬅️➡️.',
    // Mémé doit être arrivée à sa place (au replay, elle revient du banc)
    done: s => Meme.near(s.player, 90) && !(Meme.path && Meme.path.length),
  },
  {
    id: 'entrer', meme: 'usine', world: 'usine', panel: 'usine', say: 'Entre donc !',
    text: 'Voici ta fabrique de sirop ! Entre dans l’<b>usine 🏭</b> : clique sur la porte, ou appuie sur <b>E</b> devant.',
    done: (s, T) => T.panel === 'usine',
  },
  {
    id: 'regarder', meme: 'usine', world: 'usine', panel: 'usine', sel: '.pipeline', btn: 'Compris !',
    text: 'Ici, le sucre 🧂 et les fruits 🍓 deviennent du sirop <b>tout seuls</b> : cuisson 🔥, puis bouteilles 🍾, puis entrepôt 📦. Magique !',
    // Réussie avec le bouton, ou en sortant de l'usine après avoir regardé un peu
    done: (s, T) => T.stepT > 3 && T.panel !== 'usine',
  },
  {
    id: 'cueillir', meme: 'verger', world: 'tree', say: 'Cueille un arbre !',
    text: 'Les fruits, on peut les acheter… mais au <b>verger 🌳</b> ils sont gratuits ! Sors et va cueillir l’arbre qui a des fruits.',
    enter: (s, T) => T.pickTree(s),
    done: (s, T) => s.stats.picked > T.mark.picked,
  },
  {
    id: 'accepter', meme: 'contrats', world: 'contrats', panel: 'contrats', sel: '.contract.special [data-act="accept"]', say: 'Au bureau des contrats !',
    text: 'Bravo ! L’épicière voudrait <b>5 bouteilles</b>. Va au bureau des <b>Contrats 📜</b> et accepte sa commande.',
    enter: (s, T) => T.ensureOffer(s),
    done: (s, T) => !!T.contract(s),
  },
  {
    id: 'charger', meme: 'quai', world: 'quai', say: 'Charge au quai !',
    text: 'Tes bouteilles sont prêtes. Charge-les au <b>quai 📦</b>, la grande porte à droite de l’usine.',
    done: (s, T) => T.contract(s)?.loaded === 'player',
  },
  {
    id: 'livrer', meme: 'epicerie', world: 'epicerie', say: 'Je t’attends ici !',
    text: 'En route ! Suis la <b>flèche</b> jusqu’à l’<b>épicerie 🏪</b> et livre la commande.',
    done: (s, T) => !T.contract(s),
  },
  {
    id: 'ameliorer', meme: 'usine', world: 'usine', panel: 'usine', sel: '[data-act="up"][data-arg="cook"]', say: 'Retour à l’usine !',
    text: 'Tu as gagné de l’argent 💰 ! Retourne à l’usine et <b>améliore la cuisson 🔥</b> : ton sirop cuira plus vite.',
    done: (s, T) => s.lv.cook > T.mark.cook,
    canSkip: s => s.money < Eco.lvCost(s, 'cook'),
    btn: 'Suivant',
  },
  {
    id: 'fin', meme: 'usine', hud: '#quest', btn: 'À toi de jouer !', say: 'Bravo !',
    text: 'Tu es prêt ! Le maire te donne des <b>missions</b>, là en haut 📜. Si tu as une question, je serai sur le <b>banc du parc</b> 🪑.',
    done: () => false,
  },
];
