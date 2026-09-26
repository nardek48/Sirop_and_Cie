/**
 * config.js — toutes les constantes d'équilibrage et les lieux partagés.
 *
 * Formules :
 *  - valeur d'un niveau      = base * growth^(niv-1)
 *  - coût du niveau suivant  = cost * costGrowth^(niv-1)
 *  - maison n°k              = base * 1.3^k
 *  - recette n°k             = 2 500 * 4^k
 *  - livreur n°k             = 6 000 * 4^k
 *  - prestige : étoiles      = floor(sqrt(gains du run / 250 000))
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
    grenadine: { name: 'Grenadine', price: 6,  sugar: 1.2, fruit: 1,   time: 1.3, unlock: 400,    color: '#d23c4f' },
    citron:    { name: 'Citron',    price: 13, sugar: 1.2, fruit: 2,   time: 1.6, unlock: 3000,   color: '#e8c22e' },
    sureau:    { name: 'Sureau',    price: 32, sugar: 1.5, fruit: 3,   time: 2,   unlock: 25000,  color: '#c9b8e0' },
    violette:  { name: 'Violette',  price: 85, sugar: 2,   fruit: 4,   time: 2.6, unlock: 200000, color: '#7b4fb0' },
  },

  // Rééquilibrage v3 : comptoir plus rapide et entrepôt plus grand au départ
  levels: {
    cook:    { name: 'Cuisson',       icon: '🔥', base: 0.5,  growth: 1.3, cost: 30, costGrowth: 1.17 },
    tank:    { name: 'Cuve tampon',   icon: '🛢️', base: 20,   growth: 1.5, cost: 40, costGrowth: 1.22 },
    bottle:  { name: 'Embouteillage', icon: '🍾', base: 0.45, growth: 1.3, cost: 35, costGrowth: 1.17 },
    ware:    { name: 'Entrepôt',      icon: '📦', base: 80,   growth: 1.5, cost: 50, costGrowth: 1.22 },
    counter: { name: 'Comptoir',      icon: '🛎️', base: 0.55, growth: 1.3, cost: 45, costGrowth: 1.2  },
  },

  counter: { priceFactor: 0.7, nightFactor: 0.6 },
  restock: { cost: 800, minBatch: 50, secondsOfStock: 60, trigger: 0.3 },

  contracts: {
    maxOffers: 4, offerEverySec: 20, offerTtlSec: 90,
    slotBase: 1, slotMax: 6, slotCost: 600, slotCostGrowth: 5,
    penaltyRatio: 0.25, repScale: 150,
    nightCafeBonus: 1.25,
    clients: [
      { place: 'epicerie',    name: 'Épicerie du coin',   icon: '🏪', rep: 0,   qty: 12,  mult: 1.5, repGain: 1, time: [100, 180] },
      { place: 'cafe',        name: 'Café des Arts',      icon: '☕', rep: 8,   qty: 30,  mult: 1.8, repGain: 2, time: [140, 260] },
      { place: 'supermarche', name: 'Supermarché Frais+', icon: '🛒', rep: 35,  qty: 90,  mult: 2.2, repGain: 4, time: [200, 380] },
      { place: 'gare',        name: 'Train Express',      icon: '🚂', rep: 60,  qty: 160, mult: 2.5, repGain: 6, time: [240, 440], district: 'colline' },
      { place: 'port',        name: 'Export Riviera',     icon: '🚢', rep: 100, qty: 260, mult: 2.8, repGain: 8, time: [280, 520] },
    ],
  },

  // Véhicules du joueur : vitesse (px/s) et capacité (bouteilles portées)
  vehicles: [
    { id: 'pied',        name: 'À pied',      icon: '👟', speed: 250, cap: 40,   cost: 0 },
    { id: 'velo',        name: 'Vélo',        icon: '🚲', speed: 340, cap: 80,   cost: 1200 },
    { id: 'charrette',   name: 'Charrette',   icon: '🛞', speed: 300, cap: 300,  cost: 15000 },
    { id: 'camionnette', name: 'Camionnette', icon: '🚐', speed: 460, cap: 1500, cost: 150000 },
  ],

  couriers: { max: 4, cost: 6000, costGrowth: 4, rep: 20, speed: 150 },

  recipes: { max: 4, cost: 2500, costGrowth: 4, priceBonus: 1.3 },

  districts: {
    champs:  { name: 'Les Champs', icon: '🌾', cost: 2500,  rep: 0,  desc: '8 parcelles de canne à sucre : du sucre gratuit à récolter.' },
    colline: { name: 'La Colline', icon: '⛰️', cost: 40000, rep: 25, desc: 'La gare du Train Express, 4 terrains et un bois de sureau.' },
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
      { id: 'villa',   name: 'Villa',             icon: '🏘️', cost: 100000, mult: 50,  scale: .85 },
      { id: 'domaine', name: 'Domaine',           icon: '🏰', cost: 900000, mult: 380, scale: 1 },
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
  offline: { capHours: 8, minSec: 30 },
  prestige: { minRunEarned: 1e6, divisor: 2.5e5, bonusPerStar: 0.1 },

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
