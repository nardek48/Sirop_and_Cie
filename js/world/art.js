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
 * canne, maison_studio, maison_village, maison_villa, maison_domaine.
 * Tant qu'une image n'est pas chargée, le jeu dessine sa forme de secours.
 * Ancre : pieds en bas au centre de l'image.
 */
const ROWS = { bas: 0, gauche: 1, droite: 2, haut: 3 };

export const Art = {
  img: {},
  sheets: {},

  load(map) {
    for (const [k, src] of Object.entries(map)) {
      const i = new Image();
      i.onload = () => { this.img[k] = i; };
      i.src = src;
    }
  },

  sheet(key, src, { fw = 48, fh = 64 } = {}) {
    const i = new Image();
    i.onload = () => { this.sheets[key] = { img: i, fw, fh }; };
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
   * Dessine une image de la feuille de sprites.
   * @param {'bas'|'gauche'|'droite'|'haut'} dir
   * @param {number} frame 0 = immobile, 1 et 2 = marche
   * @returns {boolean}
   */
  drawFrame(c, key, x, y, dir, frame) {
    const sh = this.sheets[key];
    if (!sh) return false;
    c.imageSmoothingEnabled = false;
    c.drawImage(sh.img, frame * sh.fw, (ROWS[dir] ?? 0) * sh.fh, sh.fw, sh.fh, x - sh.fw / 2, y - sh.fh, sh.fw, sh.fh);
    return true;
  },
};
