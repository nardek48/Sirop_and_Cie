/**
 * decor.js — le catalogue des objets de décor (ceux qu'on pose dans le Mode architecte
 * ou dans Tiled). Le dessin de chaque objet est dans Render.decor (render.js).
 *
 * box : taille de la zone cliquable, ancrée au bas-centre de l'objet (x, y = ses pieds).
 * text : l'objet porte un texte modifiable (panneau).
 * Pour ajouter un objet : une ligne ici + son dessin dans Render.decor.
 */
export const DECOR = {
  lampadaire: { name: 'Lampadaire', icon: '💡', box: { w: 22, h: 72 } },
  banc:       { name: 'Banc',       icon: '🪑', box: { w: 58, h: 34 } },
  buisson:    { name: 'Buisson',    icon: '🌿', box: { w: 56, h: 40 } },
  rocher:     { name: 'Rocher',     icon: '🪨', box: { w: 56, h: 30 } },
  panneau:    { name: 'Panneau',    icon: '🪧', box: { w: 90, h: 64 }, text: 'Bienvenue !' },
  fleurs:     { name: 'Fleurs',     icon: '🌷', box: { w: 48, h: 24 } },
  sapin:      { name: 'Sapin',      icon: '🌲', box: { w: 52, h: 92 } },
  cloture:    { name: 'Clôture',    icon: '🚧', box: { w: 66, h: 28 } },
  tonneau:    { name: 'Tonneau',    icon: '🛢️', box: { w: 32, h: 38 } },
  parasol:    { name: 'Parasol',    icon: '⛱️', box: { w: 64, h: 72 } },
};

export const DECOR_KINDS = Object.keys(DECOR);

/** Zone cliquable d'un objet posé */
export const decorBox = d => {
  const b = DECOR[d.kind].box;
  return { x: d.x - b.w / 2, y: d.y - b.h, w: b.w, h: b.h };
};
