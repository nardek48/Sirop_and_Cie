/**
 * overlay.js — ce que le tutoriel affiche par-dessus le jeu :
 *  - la carte de Mémé (texte, points de progression, boutons) ;
 *  - l'anneau jaune autour de la cible (avec projecteur quand la cible est dans un menu) ;
 *  - la main 👆 qui montre où appuyer.
 * Les boutons utilisent data-act : ils passent par Actions, comme le reste du jeu.
 */
export const Overlay = {
  el: {}, shown: false, lastSel: null, key: '',

  init() {
    const wrap = document.querySelector('.world-wrap');
    const card = document.createElement('div');
    card.className = 'tuto-card';
    card.hidden = true;
    card.setAttribute('role', 'status');
    card.innerHTML = `
      <div class="tuto-face" aria-hidden="true">👵</div>
      <div class="tuto-body">
        <div class="tuto-who">Mémé Grenadine</div>
        <p class="tuto-text"></p>
        <div class="tuto-foot">
          <span class="tuto-dots" aria-hidden="true"></span>
          <button type="button" class="btn ghost sm tuto-lost" data-act="tutoLost">Je suis perdu</button>
          <button type="button" class="btn ghost sm tuto-skip" data-act="tutoSkip">Passer</button>
          <button type="button" class="btn sm tuto-next" data-act="tutoNext"></button>
        </div>
      </div>`;
    wrap.append(card);

    const ring = document.createElement('div');
    ring.className = 'tuto-ring';
    ring.hidden = true;
    const hand = document.createElement('div');
    hand.className = 'tuto-hand';
    hand.hidden = true;
    hand.textContent = '👆';
    document.body.append(ring, hand);

    this.el = {
      card, ring, hand,
      text: card.querySelector('.tuto-text'), dots: card.querySelector('.tuto-dots'),
      next: card.querySelector('.tuto-next'), lost: card.querySelector('.tuto-lost'), skip: card.querySelector('.tuto-skip'),
    };
  },

  /**
   * Remplit la carte.
   * @param {{html:string, step?:number, total?:number, next?:string, tuto?:boolean}} o
   *   tuto=false : simple conseil (pas de points, ni « perdu », ni « passer »)
   */
  card(o) {
    const E = this.el, key = [o.html, o.step, o.next, o.tuto].join('|');
    if (key === this.key && !E.card.hidden) return;        // appelé à chaque image : rien n'a changé
    this.key = key;
    E.card.classList.toggle('tip', o.tuto === false);
    if (E.text.dataset.html !== o.html) {
      E.text.innerHTML = E.text.dataset.html = o.html;
      E.card.classList.remove('pop'); void E.card.offsetWidth; E.card.classList.add('pop');   // relance l'animation
    }
    const tuto = o.tuto !== false;
    E.dots.hidden = E.lost.hidden = E.skip.hidden = !tuto;
    if (tuto) E.dots.innerHTML = Array.from({ length: o.total }, (_, i) =>
      `<i class="${i < o.step ? 'ok' : i === o.step ? 'on' : ''}"></i>`).join('');
    E.next.hidden = !o.next;
    if (o.next) E.next.textContent = o.next;
    E.next.dataset.act = tuto ? 'tutoNext' : 'tipClose';
    E.card.hidden = false;
    this.shown = true;
  },

  /** Carte en bas quand un menu est ouvert (le haut du menu reste visible) */
  low(on) {
    this.el.card.classList.toggle('low', on);
    document.body.classList.toggle('tuto-low', on && !this.el.card.hidden);
  },

  /**
   * Place l'anneau et la main.
   * @param {null|{sel:string}|{x:number,y:number,r?:number}} f
   *   sel : élément de l'interface (projecteur autour) · x,y : point de l'écran (village)
   * @param {boolean} hand afficher la main
   */
  focus(f, hand) {
    const { ring, hand: h } = this.el;
    let box = null, spot = false;
    if (f && f.sel) {
      const el = [...document.querySelectorAll(f.sel)].find(e => e.offsetParent !== null);
      if (el) {
        // Fait défiler le menu jusqu'à la cible, une fois par cible
        if (this.lastSel !== el) { this.lastSel = el; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        const r = el.getBoundingClientRect(), pad = 6;
        box = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2, round: 14 };
        spot = true;
      }
    } else if (f) {
      const r = f.r || 44;
      box = { x: f.x - r, y: f.y - r, w: r * 2, h: r * 2, round: r };
      // Hors de l'écran : c'est la flèche autour du joueur qui guide
      if (f.x < f.clip.left || f.x > f.clip.right || f.y < f.clip.top || f.y > f.clip.bottom) box = null;
    }
    ring.hidden = !box;
    // Grande cible (toute la chaîne de production) : le projecteur suffit, la main gênerait
    h.hidden = !box || !hand || box.h > 180;
    if (!box) return;
    Object.assign(ring.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px', borderRadius: box.round + 'px' });
    ring.classList.toggle('spot', spot);
    // La main sous la cible (au-dessus si la cible est en bas de l'écran)
    const up = box.y + box.h + 56 < window.innerHeight;
    h.textContent = up ? '👆' : '👇';
    h.classList.toggle('down', !up);
    Object.assign(h.style, { left: (box.x + box.w / 2 - 18) + 'px', top: (up ? box.y + box.h + 2 : box.y - 46) + 'px' });
  },

  hide() {
    const E = this.el;
    E.card.hidden = E.ring.hidden = E.hand.hidden = true;
    this.shown = false; this.lastSel = null; this.key = '';
    document.body.classList.remove('tuto-low');
  },
  hideFocus() { this.el.ring.hidden = this.el.hand.hidden = true; },
};
