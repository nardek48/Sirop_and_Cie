/**
 * tiled.js — import du décor depuis un fichier Tiled (https://www.mapeditor.org).
 *
 * Dans Tiled : carte orthogonale, calque d'objets nommé « decor ».
 * Chaque objet a un type (champ « Class » ou « Type ») parmi :
 *   lampadaire · banc · buisson · rocher · panneau (propriété texte « text »)
 * La position utilisée est le bas-centre de l'objet (ou le point pour un objet point).
 * Exporter en JSON sous assets/decor.tiled.json : le jeu le charge au démarrage.
 */
export const DECOR_KINDS = ['lampadaire', 'banc', 'buisson', 'rocher', 'panneau'];

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
