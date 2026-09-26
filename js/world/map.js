/**
 * map.js — la carte du village (coordonnées monde, en pixels).
 * Tout est ici en données : bâtiments, récoltes, terrains, quartiers, décor.
 * Le décor peut être remplacé par un fichier Tiled (voir tiled.js).
 */
export const MAP = {
  w: 3400, h: 1560,
  road: { y: 520, h: 90 },
  water: { x: 2290, y: 0, w: 370, h: 290 },
  fountain: { x: 1980, y: 880, r: 46 },
  windmill: { x: 2350, y: 1330 },
  rails: { y: 215, x0: 2672 },

  buildings: [
    { id: 'usine',       panel: 'usine',    name: 'Usine',    icon: '🏭', x: 100,  y: 190, w: 360, h: 310, wall: '#c9745a', roof: '#8a3f2e' },
    { id: 'labo',        panel: 'labo',     name: 'Labo',     icon: '🧪', x: 520,  y: 340, w: 150, h: 160, wall: '#cdb8e6', roof: '#6a4c93' },
    { id: 'contrats',    panel: 'contrats', name: 'Contrats', icon: '📜', x: 710,  y: 330, w: 180, h: 170, wall: '#ecd29a', roof: '#9b6a2f' },
    { id: 'agence',      panel: 'agence',   name: 'Agence',   icon: '🏡', x: 940,  y: 340, w: 170, h: 160, wall: '#a9d0ad', roof: '#3f7a55' },
    { id: 'mairie',      panel: 'mairie',   name: 'Mairie',   icon: '🏛️', x: 1160, y: 300, w: 190, h: 200, wall: '#ece6d6', roof: '#5b6b8c' },
    { id: 'garage',      panel: 'garage',   name: 'Garage',   icon: '🚲', x: 1400, y: 330, w: 190, h: 170, wall: '#b9c2c9', roof: '#4b5563' },
    { id: 'epicerie',    client: true, x: 1640, y: 350, w: 160, h: 150, wall: '#f2bd78', roof: '#b0552f' },
    { id: 'cafe',        client: true, x: 1850, y: 350, w: 170, h: 150, wall: '#c9a080', roof: '#5a3a2a' },
    { id: 'supermarche', client: true, x: 2070, y: 310, w: 210, h: 190, wall: '#dfe4ea', roof: '#c2453a' },
    { id: 'port',        client: true, x: 2330, y: 320, w: 230, h: 180, wall: '#8fb4d3', roof: '#34506e' },
    { id: 'gare',        client: true, district: 'colline', x: 2780, y: 300, w: 300, h: 200, wall: '#e3c9a8', roof: '#7a2e2e' },
  ],

  // Emplacements des récoltes : l'index correspond à s.fields[groupe][i]
  fields: {
    verger: [150, 290, 430].flatMap(x => [730, 860, 990].map(y => ({ x, y }))),
    sureau: [2800, 3000, 3200].flatMap(x => [940, 1070].map(y => ({ x, y }))),
    canne:  Array.from({ length: 8 }, (_, i) => ({ x: 200 + i * 280, y: 1300 })),
  },

  plots: [
    ...[580, 760, 940, 1120, 1300, 1480].map(x => ({ x, y: 660, w: 160, h: 170 })),
    ...[2700, 2870, 3040, 3210].map(x => ({ x, y: 660, w: 150, h: 170, district: 'colline' })),
  ],

  districts: {
    champs:  { area: { x: 0, y: 1110, w: 2650, h: 450 }, barrier: { x: 0, y: 1092, w: 2650, h: 16 }, sign: { x: 545, y: 1074 } },
    colline: { area: { x: 2672, y: 0, w: 728, h: 1560 }, barrier: { x: 2650, y: 0, w: 22, h: 1560 }, sign: { x: 2612, y: 565 } },
  },

  // Décor par défaut (remplacé par assets/decor.tiled.json s'il est présent)
  decor: [
    ...[570, 750, 930, 1110, 1290, 1470, 1660, 1820, 2140, 2440, 2600, 2860, 3030, 3200, 3380].map(x => ({ kind: 'lampadaire', x, y: 650 })),
    ...[490, 690, 915, 1135, 1375, 1615, 1825, 2045, 2305, 2720, 3130, 3330].map(x => ({ kind: 'lampadaire', x, y: 506 })),
    { kind: 'banc', x: 1850, y: 800 }, { kind: 'banc', x: 2110, y: 800 }, { kind: 'banc', x: 1850, y: 990 }, { kind: 'banc', x: 2110, y: 990 },
    ...[1720, 2250, 1760, 2230, 2480, 2560].map((x, i) => ({ kind: 'buisson', x, y: [720, 720, 1050, 1050, 900, 1000][i] })),
    ...[2760, 3320, 2950].map((x, i) => ({ kind: 'rocher', x, y: [1250, 1180, 1400][i] })),
    { kind: 'panneau', x: 60, y: 650, text: 'Sirop-sur-Mer' },
  ],
};
