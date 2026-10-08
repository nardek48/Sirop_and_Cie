/**
 * host.js — hôte des mini-jeux : une fenêtre plein écran au-dessus du village,
 * avec son canvas, sa boucle d'animation et un bouton « Quitter ».
 *
 * Le jeu idle continue de tourner derrière (la simulation n'est jamais mise en pause) ;
 * seul le village arrête de se dessiner et d'écouter le clavier (événement Bus 'minigame').
 *
 * Un mini-jeu est un objet :
 *   title                 titre affiché en haut
 *   mount(h)              construit son interface ; h = { top, layer, bottom, opts, close, sfx }
 *   frame(dt)             logique (dt en secondes, plafonné)
 *   render(ctx, W, H)     dessin (W, H en pixels CSS ; le zoom écran est déjà appliqué)
 *   unmount()             nettoyage (écouteurs clavier…)
 */
import { Bus } from '../core/bus.js';

export const MiniGames = {
  cur: null,

  /**
   * Ouvre un mini-jeu. Se résout quand le joueur le quitte.
   * @param {object} game  module de mini-jeu (voir plus haut)
   * @param {object} opts  options transmises au jeu (récompenses, rappels…)
   * @returns {Promise<void>}
   */
  run(game, opts = {}) {
    if (this.cur) return Promise.resolve();
    const el = document.createElement('div');
    el.className = 'mg';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', game.title);
    el.innerHTML = `
      <div class="mg-top">
        <b class="mg-title"></b>
        <span class="mg-extra"></span>
        <button type="button" class="btn ghost sm mg-close">Quitter</button>
      </div>
      <div class="mg-stage"><canvas></canvas><div class="mg-layer"></div></div>
      <div class="mg-bottom"></div>`;
    el.querySelector('.mg-title').textContent = game.title;
    document.body.append(el);

    const canvas = el.querySelector('canvas'), ctx = canvas.getContext('2d'), stage = el.querySelector('.mg-stage');
    const cur = this.cur = { game, el, canvas, ctx, W: 0, H: 0, raf: 0, last: performance.now(), done: null };

    // Taille du canvas = taille de la zone de jeu × densité de l'écran
    const resize = () => {
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      cur.W = Math.max(1, r.width); cur.H = Math.max(1, r.height);
      canvas.width = Math.round(cur.W * dpr); canvas.height = Math.round(cur.H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (cur.W > 1) game.render(ctx, cur.W, cur.H);     // redessine tout de suite (un canvas redimensionné est effacé)
    };
    cur.ro = new ResizeObserver(resize);
    cur.ro.observe(stage);

    // Échap ferme, comme les panneaux du jeu
    cur.onKey = e => { if (e.code === 'Escape') { e.preventDefault(); this.close(); } };
    window.addEventListener('keydown', cur.onKey);
    el.querySelector('.mg-close').addEventListener('click', () => this.close());

    Bus.emit('minigame', true);
    game.mount({
      top: el.querySelector('.mg-extra'), layer: el.querySelector('.mg-layer'), bottom: el.querySelector('.mg-bottom'),
      opts, close: () => this.close(), sfx: name => Bus.sfx(name),
    });
    resize();

    const loop = now => {
      if (this.cur !== cur) return;
      const dt = Math.min(0.05, (now - cur.last) / 1000);
      cur.last = now;
      game.frame(dt);
      game.render(ctx, cur.W, cur.H);
      cur.raf = requestAnimationFrame(loop);
    };
    cur.raf = requestAnimationFrame(loop);
    return new Promise(res => { cur.done = res; });
  },

  close() {
    const cur = this.cur;
    if (!cur) return;
    this.cur = null;
    cancelAnimationFrame(cur.raf);
    cur.ro.disconnect();
    window.removeEventListener('keydown', cur.onKey);
    cur.game.unmount?.();
    cur.el.remove();
    Bus.emit('minigame', false);
    Bus.sfx('door');
    cur.done?.();
  },
};
