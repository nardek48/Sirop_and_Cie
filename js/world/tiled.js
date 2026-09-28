/**
 * tiled.js — import du décor depuis un fichier Tiled (https://www.mapeditor.org).
 *
 * Dans Tiled : carte orthogonale, calque d'objets nommé « decor ».
 * Chaque objet a un type (champ « Class » ou « Type ») parmi ceux de decor.js :
 *   lampadaire · banc · buisson · rocher · panneau (propriété texte « text ») ·
 *   fleurs · sapin · cloture · tonneau · parasol
 * La position utilisée est le bas-centre de l'objet (ou le point pour un objet point).
 * Exporter en JSON sous assets/decor.tiled.json : le jeu le charge au démarrage.
 * Le Mode architecte du jeu (mairie) produit aussi ce fichier (toTiled).
 */
import { DECOR, DECOR_KINDS } from './decor.js';

/** @returns {Promise<object[]|null>} liste de décors, ou null si le fichier est absent/illisible */
export async function loadTiledDecor(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const layer = (json.layers || []).find(l => l.type === 'objectgroup' && l.name === 'decor');
    if (!layer) return null;
    return layer.objects.map(o => {
      const props = Object.fromEntries((o.properties || []).map(p => [p.name, p.value]));
      return {
        kind: o.type || o.class || o.name,
        x: o.point ? o.x : o.x + (o.width || 0) / 2,
        y: o.point ? o.y : o.y + (o.height || 0),
        ...props,
      };
    }).filter(d => DECOR_KINDS.includes(d.kind));
  } catch (e) {
    return null;   // file:// ou fichier absent : on garde le décor par défaut
  }
}

/**
 * Fabrique un fichier Tiled (JSON) à partir d'une liste de décors, lisible par loadTiledDecor
 * et par l'éditeur Tiled. Chaque objet devient un rectangle de la taille de sa zone cliquable.
 * @param {object[]} list décors {kind, x, y, text?}
 * @param {{w:number,h:number}} size taille de la carte en pixels
 */
export function toTiled(list, size) {
  const T = 32;
  const objects = list.map((d, i) => {
    const b = DECOR[d.kind].box;
    const o = {
      id: i + 1, name: '', type: d.kind,
      x: Math.round(d.x - b.w / 2), y: Math.round(d.y - b.h), width: b.w, height: b.h,
      rotation: 0, visible: true,
    };
    if (d.text != null) o.properties = [{ name: 'text', type: 'string', value: String(d.text) }];
    return o;
  });
  return {
    compressionlevel: -1, type: 'map', version: '1.10', tiledversion: '1.10.2',
    orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
    width: Math.ceil(size.w / T), height: Math.ceil(size.h / T), tilewidth: T, tileheight: T,
    nextlayerid: 2, nextobjectid: objects.length + 1, tilesets: [],
    layers: [{ id: 1, name: 'decor', type: 'objectgroup', draworder: 'topdown', opacity: 1, visible: true, x: 0, y: 0, objects }],
  };
}
