/**
 * config.js — toutes les constantes d'équilibrage et les lieux partagés.
 *
 * Formules :
 *  - valeur d'un niveau      = base × (1 + step × (niv-1)) × 2^plancher((niv-1)/20)
 *  - coût du niveau suivant  = cost * costGrowth^(niv-1)
 *  - maison n°k              = base * 1.3^k
 *  - recette n°k             = 8 000 * 4^k
 *  - livreur n°k             = 6 000 * 4^k
 *  - prestige : étoiles      = 3 + 4 × log10(gains du run / 20 M)
 *  - trajet d'un livreur     = distance "par la route" / vitesse
 */
export const CONFIG = {
  version: 3,
  currency: '$',
  tickMs: 100,
  saveEverySec: 30,
  startMoney: 80,
  startMaterials: { sugar: 30, fruit: 20 },

  materials: {
    sugar: { name: 'Sucre',            icon: '🧂', price: 0.2 },
    fruit: { name: 'Fruits & plantes', icon: '🍓', price: 0.3 },
  },

  // Parfums de base. Les recettes secrètes (labo) s'y ajoutent dans l'état.
  flavors: {
    menthe:    { name: 'Menthe',    price: 3,  sugar: 1,   fruit: 0.5, time: 1,   unlock: 0,      color: '#4fb286' },
    grenadine: { name: 'Grenadine', price: 6,  sugar: 1.2, fruit: 1,   time: 1.3, unlock: 400,     color: '#d23c4f' },
    citron:    { name: 'Citron',    price: 13, sugar: 1.2, fruit: 2,   time: 1.6, unlock: 6000,    color: '#e8c22e' },
    sureau:    { name: 'Sureau',    price: 32, sugar: 1.5, fruit: 3,   time: 2,   unlock: 100000,  color: '#c9b8e0' },
    violette:  { name: 'Violette',  price: 85, sugar: 2,   fruit: 4,   time: 2.6, unlock: 5000000, color: '#7b4fb0' },
  },

  // Niveaux de l'usine. Deux modèles :
  //  - step = 0 : valeur = base × growth^(niv−1)  (exponentiel, modèle d'origine)
  //  - step > 0 : valeur = base × (1 + step × (niv−1)) × palier   (linéaire + paliers)
  //    palier = milestone.mult ^ plancher((niv−1) / milestone.every)
  // Règle d'or : la valeur doit croître MOINS vite que le coût (costGrowth), sinon la
  // production devient de moins en moins chère et le jeu s'emballe (constaté en v0.0.2).
  milestone: { every: 20, mult: 2 },
  levels: {
    // v0.0.3 : modèle linéaire + paliers (l'ancien exponentiel faisait s'emballer le jeu)
    cook:    { name: 'Cuisson',       icon: '🔥', base: 0.5,  growth: 1.3, step: 0.5, cost: 30, costGrowth: 1.16 },
    tank:    { name: 'Cuve tampon',   icon: '🛢️', base: 20,   growth: 1.5, step: 0.8, cost: 40, costGrowth: 1.16 },
    bottle:  { name: 'Embouteillage', icon: '🍾', base: 0.45, growth: 1.3, step: 0.5, cost: 35, costGrowth: 1.16 },
    ware:    { name: 'Entrepôt',      icon: '📦', base: 80,   growth: 1.5, step: 0.8, cost: 50, costGrowth: 1.16 },
    counter: { name: 'Comptoir',      icon: '🛎️', base: 0.55, growth: 1.3, step: 0.5, cost: 45, costGrowth: 1.16 },
  },

  counter: { priceFactor: 0.7, nightFactor: 0.6 },
  restock: { cost: 800, minBatch: 50, secondsOfStock: 60, trigger: 0.3 },

  contracts: {
    maxOffers: 4, offerEverySec: 20, offerTtlSec: 90,
    slotBase: 1, slotMax: 6, slotCost: 600, slotCostGrowth: 5,
    penaltyRatio: 0.25, repScale: 150,
    abandonRepLoss: 1,     // abandonner : même pénalité en argent, mais ⭐ −repGain×1 (au lieu de ×2 pour un retard)
    // prodSec : la commande contient en plus « prodSec secondes de production » de l'usine,
    // pour que les contrats restent intéressants quand l'usine grandit.
    nightCafeBonus: 1.25,
    clients: [
      { place: 'epicerie',    name: 'Épicerie du coin',   icon: '🏪', rep: 0,   qty: 12,  mult: 1.2, repGain: 1, time: [100, 180], prodSec: 15 },
      { place: 'cafe',        name: 'Café des Arts',      icon: '☕', rep: 8,   qty: 30,  mult: 1.35, repGain: 2, time: [140, 260], prodSec: 30 },
      { place: 'supermarche', name: 'Supermarché Frais+', icon: '🛒', rep: 35,  qty: 90,  mult: 1.5, repGain: 4, time: [200, 380], prodSec: 60 },
      { place: 'gare',        name: 'Train Express',      icon: '🚂', rep: 60,  qty: 160, mult: 1.7, repGain: 6, time: [240, 440], district: 'colline', prodSec: 100 },
      { place: 'port',        name: 'Export Riviera',     icon: '🚢', rep: 100, qty: 260, mult: 1.9, repGain: 8, time: [280, 520], prodSec: 160 },
    ],
  },

  // Véhicules du joueur : vitesse (px/s) et capacité = le plus grand de cap et capSec secondes de production
  vehicles: [
    { id: 'pied',        name: 'À pied',      icon: '👟', speed: 250, cap: 40,   capSec: 30,  cost: 0 },
    { id: 'velo',        name: 'Vélo',        icon: '🚲', speed: 340, cap: 80,   capSec: 60,  cost: 1200 },
    { id: 'charrette',   name: 'Charrette',   icon: '🛞', speed: 300, cap: 300,  capSec: 130, cost: 40000 },
    { id: 'camionnette', name: 'Camionnette', icon: '🚐', speed: 460, cap: 1500, capSec: 400, cost: 1500000 },
  ],

  couriers: { max: 4, cost: 6000, costGrowth: 4, rep: 20, speed: 150 },

  // Prix d'une recette = (prix A + prix B) × priceBonus, soit 1,5 × le prix moyen des deux parfums
  recipes: { max: 4, cost: 8000, costGrowth: 4, priceBonus: 0.75 },

  districts: {
    champs:  { name: 'Les Champs', icon: '🌾', cost: 2500,  rep: 0,  desc: '8 parcelles de canne à sucre : du sucre gratuit à récolter.' },
    colline: { name: 'La Colline', icon: '⛰️', cost: 300000, rep: 25, desc: 'La gare du Train Express, 4 terrains et un bois de sureau.' },
  },

  // Récoltes à la main (joueur ou compagnon)
  fields: {
    verger: { name: 'Verger',        mat: 'fruit', icon: '🍓', yield: 12, regrow: 30, count: 9 },
    sureau: { name: 'Bois de sureau', mat: 'fruit', icon: '🫐', yield: 25, regrow: 45, count: 6, district: 'colline' },
    canne:  { name: 'Canne à sucre', mat: 'sugar', icon: '🌾', yield: 18, regrow: 35, count: 8, district: 'champs' },
  },

  houses: {
    types: [
      { id: 'studio',  name: 'Studio',            icon: '🏠', cost: 1500,   mult: 1,   scale: .55 },
      { id: 'village', name: 'Maison de village', icon: '🏡', cost: 12000,  mult: 7,   scale: .7 },
      { id: 'villa',   name: 'Villa',             icon: '🏘️', cost: 2000000,  mult: 50,  scale: .85 },
      { id: 'domaine', name: 'Domaine',           icon: '🏰', cost: 25000000, mult: 380, scale: 1 },
    ],
    uses: {
      rent:    { name: 'Location', icon: '💶', base: 1.2,  unit: '$/s',      desc: 'Revenu passif',       roof: '#4a78b5' },
      storage: { name: 'Stockage', icon: '📦', base: 40,   unit: 'bt',       desc: 'Capacité d’entrepôt', roof: '#8a6a3c' },
      shop:    { name: 'Boutique', icon: '🛍️', base: 0.25, unit: 'ventes/s', desc: 'Ventes au comptoir',  roof: '#c2453a' },
      orchard: { name: 'Verger',   icon: '🌳', base: 0.4,  unit: 'kg/s',     desc: 'Fruits gratuits',     roof: '#3f8f5a' },
    },
    plots: 6, collinePlots: 4,
    costGrowth: 1.3, sellRatio: 0.5, renoRatio: 0.6, renoGrowth: 2, renoBonus: 0.5, maxLevel: 5,
  },

  // Une journée complète dure 8 minutes. La partie commence à 9 h.
  clock: { daySec: 480, startHour: 6, startSec: 60, maxDark: 0.58 },

  events: {
    firstIn: 180, every: [300, 480],
    list: {
      pluie:    { name: 'Pluie',           icon: '🌧️', dur: 120, desc: 'le verger et les champs repoussent 3× plus vite' },
      canicule: { name: 'Canicule',        icon: '🥵', dur: 120, desc: 'tout le monde a soif : comptoir ×1,5 et contrats +30 %' },
      fete:     { name: 'Fête du village', icon: '🎉', dur: 180, desc: 'une commande géante à livrer à la mairie' },
    },
  },

  player: { reach: 62 },

  // Tutoriel de Mémé Grenadine (voir js/tutorial/)
  tuto: {
    qty: 5, reward: 50,          // la commande d'entraînement pour l'épicerie
    handAfter: 15,               // la main 👆 revient après 15 s sans rien faire
    callAfter: 20,               // Mémé appelle le joueur après 20 s
    // Où se tient Mémé (coordonnées monde)
    spots: {
      usine: { x: 300, y: 592 }, verger: { x: 505, y: 690 }, contrats: { x: 870, y: 592 },
      quai: { x: 470, y: 592 }, epicerie: { x: 1790, y: 592 }, banc: { x: 1880, y: 816 },
    },
  },
  // Bâtiments fermés au début, et ce qu'il faut pour les ouvrir
  openings: {
    garage: { name: 'Garage', icon: '🚲', need: 'quand tu auras gagné 1 000 $', stat: 'earned', goal: 1000 },
    agence: { name: 'Agence', icon: '🏡', need: 'après 3 commandes livrées',     stat: 'cDone',  goal: 3 },
    labo:   { name: 'Labo', icon: '🧪', need: 'quand tu auras débloqué un 2e parfum (Grenadine)', stat: 'flavors', goal: 2 },
  },
  offline: { capHours: 8, minSec: 30 },
  // Étoiles = base + perDecade × log10(gains / minRunEarned) : 3 au seuil (20 M $), +4 à chaque ×10
  prestige: { minRunEarned: 2e7, base: 3, perDecade: 4, bonusPerStar: 0.1 },

  // Portes des bâtiments (coordonnées monde), partagées par la simulation
  // (temps de trajet des livreurs) et par le rendu.
  roadY: 565,
  places: {
    usine:       { x: 200,  y: 512 },
    quai:        { x: 400,  y: 512 },
    labo:        { x: 595,  y: 512 },
    contrats:    { x: 800,  y: 512 },
    agence:      { x: 1025, y: 512 },
    mairie:      { x: 1255, y: 512 },
    garage:      { x: 1495, y: 512 },
    epicerie:    { x: 1720, y: 512 },
    cafe:        { x: 1935, y: 512 },
    supermarche: { x: 2175, y: 512 },
    port:        { x: 2445, y: 512 },
    gare:        { x: 2930, y: 512 },
  },
};

export const SHIRTS = ['#e0703a', '#d23c4f', '#3a6ea5', '#3f8f5a', '#7b4fb0', '#e8c22e', '#2b2b2b', '#f07fb0'];
export const RECIPE_COLORS = ['#f07fb0', '#ff8a3d', '#5cc8e0', '#9b5de5', '#2ec4b6', '#f4a259', '#e63946', '#8ac926'];
export const PETS = {
  chien: { name: 'Chien', icon: '🐶' },
  chat:  { name: 'Chat',  icon: '🐱' },
  aucun: { name: 'Aucun', icon: '—' },
};

export const clientByPlace = place => CONFIG.contracts.clients.find(c => c.place === place);
export const typeById = id => CONFIG.houses.types.find(t => t.id === id);
