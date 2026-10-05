/**
 * art.js — point d'entrée pour les dessins (Piskel, Aseprite…).
 *
 * Image fixe (arbre, maison…) :
 *   Art.load({ arbre: 'assets/arbre.png', maison_studio: 'assets/studio.png' });
 *
 * Personnage animé (feuille de sprites 4 directions × 3 images) :
 *   Art.sheet('player', 'assets/perso.png', { fw: 48, fh: 64 });
 *   Lignes : 1 = vers le bas, 2 = vers la gauche, 3 = vers la droite, 4 = vers le haut
 *   Colonnes : 1 = immobile, 2 et 3 = pas de marche
 *   Modèle prêt à repeindre : assets/modele-perso.png
 *
 * Clés utilisées par le jeu : player, livreur, villageois, chien, chat, arbre, sureau,
 * canne, menthe, maison_studio, maison_village, maison_villa, maison_domaine,
 * bat_usine, bat_labo, bat_contrats, bat_agence, bat_mairie, bat_garage (bat_<id du bâtiment>).
 * Tant qu'une image n'est pas chargée, le jeu dessine sa forme de secours.
 * Ancre : pieds en bas au centre de l'image.
 */
const ROWS = { bas: 0, gauche: 1, droite: 2, haut: 3 };

/**
 * Copie une image chargée dans un canvas. Sur téléphone (surtout iPhone), le navigateur peut jeter
 * une image décodée pour libérer de la mémoire : elle n'est alors pas dessinée pendant qu'il la
 * redécode, et l'écran « clignote » (il ne reste que l'herbe). Un canvas, lui, est toujours gardé.
 */
function keep(img) {
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  cv.getContext('2d').drawImage(img, 0, 0);
  return cv;
}

export const Art = {
  img: {},
  sheets: {},

  load(map) {
    for (const [k, src] of Object.entries(map)) {
      const i = new Image();
      i.onload = () => { this.img[k] = keep(i); };
      i.src = src;
    }
  },

  /**
   * Feuille de sprites dont le magenta (vêtement) est repeint dans `hex` : renvoie la clé
   * d'une copie gardée en cache (ou la clé d'origine si l'image n'est pas encore là).
   */
  sheetTint(key, hex) {
    const sh = this.sheets[key], id = key + hex;
    if (!sh || !hex) return key;
    if (!this.sheets[id]) {
      this.img['__' + key] = sh.img;                       // Art.tinted travaille sur this.img
      this.sheets[id] = { ...sh, img: this.tinted('__' + key, hex) };
    }
    return id;
  },

  /** scale : taille d'affichage (une planche en haute définition, ex. 64×96 affichée à 0,68, est lissée) */
  sheet(key, src, { fw = 48, fh = 64, scale = 1 } = {}) {
    const i = new Image();
    i.onload = () => { this.sheets[key] = { img: keep(i), fw, fh, scale }; };
    i.src = src;
  },

  /** @returns {boolean} true si une image fixe a été dessinée */
  draw(c, key, x, y, w, h) {
    const i = this.img[key];
    if (!i) return false;
    c.imageSmoothingEnabled = false;
    c.drawImage(i, x - w / 2, y - h, w, h);
    return true;
  },

  /**
   * Copie d'une image dont le magenta (toit des maisons, teinte 280°–328°) est repeint dans `hex`,
   * en gardant ombres et reflets. Calculée une fois puis gardée en cache.
   * @returns {HTMLCanvasElement|HTMLImageElement|null} null tant que l'image n'est pas chargée
   */
  tinted(key, hex) {
    const id = key + hex;
    if (this.img[id]) return this.img[id];
    const src = this.img[key];
    if (!src) return null;
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return src;                // couleur inattendue : image d'origine
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const g = cv.getContext('2d');
    g.drawImage(src, 0, 0);
    try {
      const d = g.getImageData(0, 0, cv.width, cv.height), p = d.data;
      const T = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      for (let i = 0; i < p.length; i += 4) {
        if (!p[i + 3]) continue;
        const r = p[i], gr = p[i + 1], b = p[i + 2], mx = Math.max(r, gr, b), mn = Math.min(r, gr, b);
        if (mx < 50 || (mx - mn) / mx < 0.3 || gr !== mn) continue;     // magenta : vert = canal le plus faible
        const hue = mx === r ? 360 - 60 * (b - gr) / (mx - mn) : 240 + 60 * (r - gr) / (mx - mn);
        if (hue < 280 || hue > 328) continue;
        const L = mx / 240, W = (mn / mx) * 0.85;                     // L : ombre, W : reflet clair
        for (let k = 0; k < 3; k++) p[i + k] = Math.min(255, T[k] * L * (1 - W) + 255 * W);
      }
      g.putImageData(d, 0, 0);
    } catch { return src; }                                          // image d'une autre origine : pas de recoloration
    return (this.img[id] = cv);
  },

  /**
   * Motif répété (sol, mur) : l'image réduite à `scale`, prête pour fillStyle.
   * Un motif appartient au contexte qui l'a créé : on le refait si le contexte change.
   * @returns {CanvasPattern|null} null tant que l'image n'est pas chargée
   */
  pattern(c, key, scale) {
    const src = this.img[key];
    if (!src) return null;
    const id = key + '@' + scale, P = (this.patterns ||= {});
    if (P[id] && P[id].c === c) return P[id].p;
    const cv = document.createElement('canvas');
    cv.width = Math.round(src.width * scale); cv.height = Math.round(src.height * scale);
    const g = cv.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, cv.width, cv.height);
    P[id] = { c, p: c.createPattern(cv, 'repeat') };
    return P[id].p;
  },

  /**
   * Pose une image (ou un canvas) centrée sur cx, le bas sur `bottom`, de largeur w (proportions gardées).
   * flip : retournée en miroir. @returns {number} hauteur dessinée (0 si rien)
   */
  put(c, img, cx, bottom, w, flip = false) {
    if (!img) return 0;
    const h = w * img.height / img.width;
    c.save();
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.translate(cx, bottom);
    if (flip) c.scale(-1, 1);
    c.drawImage(img, -w / 2, -h, w, h);
    c.restore();
    return h;
  },

  /** Copie assombrie d'une image (bâtiment pas encore ouvert), gardée en cache */
  shaded(key) {
    const id = key + '#ombre';
    if (this.img[id]) return this.img[id];
    const src = this.img[key];
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const g = cv.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';               // n'assombrit que le bâtiment, pas le fond transparent
    g.fillStyle = 'rgba(60,50,40,.35)'; g.fillRect(0, 0, cv.width, cv.height);
    return (this.img[id] = cv);
  },

  /**
   * Dessine une image de la feuille de sprites.
   * @param {'bas'|'gauche'|'droite'|'haut'} dir
   * @param {number} frame 0 = immobile, 1 et 2 = marche
   * @returns {boolean}
   */
  drawFrame(c, key, x, y, dir, frame) {
    const sh = this.sheets[key];
    if (!sh) return false;
    const k = sh.scale, w = sh.fw * k, h = sh.fh * k;
    c.imageSmoothingEnabled = k !== 1;                       // pixel art net à l'échelle 1, sinon lissé
    c.imageSmoothingQuality = 'high';
    c.drawImage(sh.img, frame * sh.fw, (ROWS[dir] ?? 0) * sh.fh, sh.fw, sh.fh, x - w / 2, y - h, w, h);
    return true;
  },
};
