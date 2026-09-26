/**
 * game.js — l'état courant et les valeurs transitoires partagées.
 * Game.s est remplacé au prestige ou à l'effacement : toujours lire Game.s au moment voulu.
 */
export const Game = { s: null };

/** Valeurs de runtime, jamais sauvegardées */
export const rt = {
  rps: 0,                 // revenus/s (moyenne mobile)
  earnedTick: 0,
  counterAcc: 0,          // ventes comptoir cumulées pour le texte flottant
  flow: { cook: 0, bottle: 0, sell: 0 },
  bneck: '',              // étape limitante de la chaîne
  silent: false,          // coupe toasts/sons pendant le rattrapage hors ligne
  timeScale: 1,           // accéléré par le mode debug
};
