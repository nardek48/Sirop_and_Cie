/**
 * Un panneau = l'intérieur d'un bâtiment. Chaque module expose :
 *  title  : titre de la feuille
 *  key(s) : signature de structure ; le HTML n'est reconstruit que si elle change
 *  html(s): gabarit, les valeurs vivantes passent par les liaisons (bindings.js)
 */
import { usine } from './usine.js';
import { contrats } from './contrats.js';
import { agence } from './agence.js';
import { mairie } from './mairie.js';
import { labo } from './labo.js';
import { garage } from './garage.js';

export const Panels = { usine, contrats, agence, mairie, labo, garage };
