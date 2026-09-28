/**
 * editor.js — le Mode architecte : décorer le village soi-même.
 *
 * Ouvert depuis la mairie. On choisit un objet dans la barre et on touche le village pour le poser ;
 * « Déplacer » pour le faire glisser, « Gomme » pour l'enlever. Seul le décor change :
 * bâtiments, routes et récoltes ne bougent pas, le jeu ne peut donc pas être cassé.
 *
 * Le décor modifié est gardé dans la partie (s.decor). « Exporter » fabrique le fichier
 * assets/decor.tiled.json : mis dans le dépôt, il devient le village de tout le monde.
 * Le jeu continue de tourner pendant l'édition.
 */
import { Game } from '../core/game.js';
import { Store } from '../core/store.js';
import { Bus } from '../core/bus.js';
import { UI } from '../ui/ui.js';
import { MAP } from '../world/map.js';
import { World } from '../world/world.js';
import { Render } from '../world/render.js';
import { DECOR, decorBox } from '../world/decor.js';
import { toTiled } from '../world/tiled.js';

const MAX = 300;       // objets au maximum
const SNAP = 5;        // grille d'aimantation (px)
const snap = v => Math.round(v / SNAP) * SNAP;
const clone = list => list.map(d => ({ ...d }));

export const Editor = {
  open: false,
  tool: 'move',        // 'move' | 'erase' | un type d'objet à poser
  sel: null,           // objet sélectionné
  drag: null,          // { obj, dx, dy, moved } ou { pan, x, y }
  hover: null,         // position du pointeur (fantôme de l'objet à poser)
  undo: [],
  el: null,

  init() {
    World.hooks.pointer = (type, p, e) => this.pointer(type, p, e);
    World.hooks.drawEdit = c => this.draw(c);
    window.addEventListener('keydown', e => this.key(e));
  },

  /* ---------------- Ouvrir / fermer ---------------- */
  start() {
    if (Game.s.tuto.active) return UI.toast('Termine d’abord le tutoriel de Mémé 👵');
    UI.close(); UI.closeModal();
    if (!this.el) this.build();
    this.open = true; this.tool = 'move'; this.sel = null; this.undo = [];
    World.mode = 'edit';
    World.keys.clear();
    document.body.classList.add('arch-on');
    this.el.hidden = false;
    this.refresh();
    Bus.sfx('door');
  },

  stop() {
    this.open = false; this.sel = null; this.drag = null; this.hover = null;
    World.mode = 'play';
    document.body.classList.remove('arch-on');
    this.el.hidden = true;
    Store.save(Game.s);
    UI.toast('Village enregistré 🏡', 'ok');
  },

  /* ---------------- Liste d'objets ---------------- */
  /** Le décor du joueur ; au premier changement, on part d'une copie de celui du fichier */
  list(write = false) {
    const s = Game.s;
    if (!s.decor && write) s.decor = clone(World.baseDecor);
    return s.decor || World.baseDecor;
  },
  /** Mémorise l'état pour « Annuler », puis rend la liste modifiable */
  edit() {
    this.undo.push(Game.s.decor ? clone(Game.s.decor) : null);
    if (this.undo.length > 60) this.undo.shift();
    return this.list(true);
  },
  hit(p) {
    const L = this.list();
    // Du plus au premier plan (y le plus grand) au plus lointain : on attrape celui qu'on voit
    return [...L].sort((a, b) => b.y - a.y).find(d => {
      const r = decorBox(d);
      return p.x >= r.x - 6 && p.x <= r.x + r.w + 6 && p.y >= r.y - 6 && p.y <= r.y + r.h + 6;
    }) || null;
  },
  inMap: p => ({ x: Math.max(20, Math.min(MAP.w - 20, snap(p.x))), y: Math.max(20, Math.min(MAP.h - 4, snap(p.y))) }),

  /* ---------------- Pointeur (souris et doigt) ---------------- */
  pointer(type, p, e) {
    if (type === 'down') {
      if (UI.modalOpen()) return;
      if (this.tool === 'erase') {
        const d = this.hit(p);
        if (d) this.remove(d);
        else this.drag = { pan: true, x: e.clientX, y: e.clientY };
        return;
      }
      if (this.tool !== 'move') {
        const L = this.list();
        if (L.length >= MAX) return UI.toast(`Le village est plein : ${MAX} objets au maximum`, 'bad');
        const at = this.inMap(p), d = { kind: this.tool, ...at };
        if (DECOR[this.tool].text) d.text = DECOR[this.tool].text;
        this.edit().push(d);
        this.sel = d;
        this.drag = { obj: d, dx: 0, dy: 0, moved: true, fresh: true };   // on peut ajuster en glissant
        Bus.sfx('pick');
        this.refresh();
        return;
      }
      const d = this.hit(p);
      if (d) {
        // Déplacer : la copie modifiable est créée au premier vrai mouvement
        this.sel = d;
        this.drag = { obj: d, dx: d.x - p.x, dy: d.y - p.y, moved: false };
      } else {
        this.sel = null;
        this.drag = { pan: true, x: e.clientX, y: e.clientY };
      }
      this.refresh();
    } else if (type === 'move') {
      this.hover = p;
      const g = this.drag;
      if (!g) return;
      if (g.pan) {
        World.cam.x -= (e.clientX - g.x) / World.zoom;
        World.cam.y -= (e.clientY - g.y) / World.zoom;
        g.x = e.clientX; g.y = e.clientY;
        World.clampCamera();
        return;
      }
      const at = this.inMap({ x: p.x + g.dx, y: p.y + g.dy });
      if (at.x === g.obj.x && at.y === g.obj.y) return;
      if (!g.moved) {
        // Premier mouvement : on passe sur la copie modifiable et on retrouve l'objet dedans
        const i = this.list().indexOf(g.obj);
        const L = this.edit();
        g.obj = L[i]; this.sel = g.obj; g.moved = true;
      }
      Object.assign(g.obj, at);
    } else if (type === 'up') {
      if (this.drag && this.drag.moved && !this.drag.fresh) Bus.sfx('click');
      this.drag = null;
    }
  },

  remove(d) {
    const i = this.list().indexOf(d);
    if (i < 0) return;
    this.edit().splice(i, 1);
    if (this.sel === d) this.sel = null;
    Bus.sfx('click');
    this.refresh();
  },

  undoLast() {
    if (!this.undo.length) return;
    Game.s.decor = this.undo.pop();
    this.sel = null;
    this.refresh();
  },

  resetAll() {
    UI.confirm('Remettre le village comme au début ? Tous tes objets seront enlevés ou replacés.', () => {
      this.undo.push(Game.s.decor ? clone(Game.s.decor) : null);
      Game.s.decor = null; this.sel = null; this.refresh();
    }, 'Tout remettre');
  },

  /** Télécharge assets/decor.tiled.json pour le mettre dans le dépôt */
  exportFile() {
    const json = JSON.stringify(toTiled(this.list(), MAP), null, 1);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'decor.tiled.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    UI.modal(`
      <h2>Fichier du village exporté 💾</h2>
      <p>Pour que <b>tout le monde</b> ait ce village :</p>
      <ol>
        <li>Remplace <code>assets/decor.tiled.json</code> dans le dossier du jeu par le fichier téléchargé.</li>
        <li>Lance <code>node tools/build-sw.mjs patch</code>, puis publie sur GitHub.</li>
      </ol>
      <p class="sub">Le fichier s’ouvre aussi dans Tiled. Ton village à toi reste enregistré dans ta partie.</p>`);
  },

  /* ---------------- Clavier ---------------- */
  key(e) {
    if (!this.open || (e.target.closest && e.target.closest('input,textarea'))) return;
    if ((e.code === 'Delete' || e.code === 'Backspace') && this.sel) { e.preventDefault(); this.remove(this.sel); }
    else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.undoLast(); }
    else if (e.code === 'Escape' && !UI.modalOpen()) {
      if (this.tool !== 'move' || this.sel) { this.tool = 'move'; this.sel = null; this.refresh(); }
      else this.stop();
    }
  },

  /* ---------------- Dessin dans le village ---------------- */
  draw(c) {
    const L = this.list();
    c.save();
    c.setLineDash([4, 4]); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.55)';
    for (const d of L) { const r = decorBox(d); c.strokeRect(r.x, r.y, r.w, r.h); }
    if (this.sel && L.includes(this.sel)) {
      const r = decorBox(this.sel);
      c.setLineDash([]); c.lineWidth = 3; c.strokeStyle = '#f3c93a';
      c.beginPath(); c.roundRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10, 8); c.stroke();
    }
    // Fantôme de l'objet à poser sous le pointeur (souris)
    if (this.hover && DECOR[this.tool] && !this.drag) {
      c.globalAlpha = 0.5;
      const at = this.inMap(this.hover);
      Render.decor(c, { kind: this.tool, ...at, text: DECOR[this.tool].text }, 0);
    }
    if (this.tool === 'erase' && this.hover) {
      const d = this.hit(this.hover);
      if (d) {
        const r = decorBox(d);
        c.globalAlpha = 1; c.setLineDash([]); c.lineWidth = 3; c.strokeStyle = '#c2453a';
        c.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
      }
    }
    c.restore();
  },

  /* ---------------- Barre d'outils ---------------- */
  build() {
    const el = document.createElement('div');
    el.className = 'arch';
    el.hidden = true;
    const kinds = Object.entries(DECOR).map(([k, d]) =>
      `<button type="button" class="arch-tool" data-ed="tool" data-arg="${k}" title="${d.name}"><span>${d.icon}</span><small>${d.name}</small></button>`).join('');
    el.innerHTML = `
      <div class="arch-head">
        <b>🏗️ Mode architecte</b>
        <span class="arch-hint"></span>
        <button type="button" class="btn sm" data-ed="done">Terminer</button>
      </div>
      <div class="arch-tools">
        <button type="button" class="arch-tool" data-ed="tool" data-arg="move"><span>✋</span><small>Déplacer</small></button>
        <button type="button" class="arch-tool" data-ed="tool" data-arg="erase"><span>🧽</span><small>Gomme</small></button>
        <span class="arch-sep" aria-hidden="true"></span>
        ${kinds}
      </div>
      <div class="arch-sel" hidden>
        <span class="arch-sel-name"></span>
        <label class="arch-text" hidden>Texte <input maxlength="22" data-ed-text></label>
        <button type="button" class="btn ghost sm danger-t" data-ed="del">🗑️ Enlever</button>
      </div>
      <div class="arch-foot">
        <button type="button" class="btn ghost sm" data-ed="undo">↩️ Annuler</button>
        <button type="button" class="btn ghost sm" data-ed="reset">Tout remettre</button>
        <button type="button" class="btn ghost sm" data-ed="export">💾 Exporter le fichier</button>
        <span class="arch-count"></span>
      </div>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-ed]');
      if (!b) return;
      const a = b.dataset.ed;
      if (a === 'tool') { this.tool = b.dataset.arg; if (this.tool !== 'move') this.sel = null; }
      else if (a === 'done') return this.stop();
      else if (a === 'del' && this.sel) this.remove(this.sel);
      else if (a === 'undo') this.undoLast();
      else if (a === 'reset') this.resetAll();
      else if (a === 'export') this.exportFile();
      this.refresh();
    });
    // Texte du panneau : modifié en direct (une seule étape d'annulation par sélection)
    el.querySelector('[data-ed-text]').addEventListener('input', e => {
      if (!this.sel) return;
      if (!this.textEdit) {
        const i = this.list().indexOf(this.sel);
        this.sel = this.edit()[i];
        this.textEdit = this.sel;
      }
      this.sel.text = e.target.value;
    });
    document.querySelector('.world-wrap').append(el);
    this.el = el;
  },

  refresh() {
    if (!this.el) return;
    const q = s => this.el.querySelector(s);
    for (const b of this.el.querySelectorAll('[data-ed="tool"]')) b.classList.toggle('on', b.dataset.arg === this.tool);
    q('.arch-hint').textContent =
      this.tool === 'move' ? 'Fais glisser un objet pour le déplacer, ou le sol pour voir plus loin.'
      : this.tool === 'erase' ? 'Touche un objet pour l’enlever.'
      : `Touche le village pour poser : ${DECOR[this.tool].name.toLowerCase()}.`;
    const sel = this.sel && this.list().includes(this.sel) ? this.sel : null;
    q('.arch-sel').hidden = !sel;
    if (sel) {
      const D = DECOR[sel.kind];
      q('.arch-sel-name').textContent = `${D.icon} ${D.name}`;
      q('.arch-text').hidden = !D.text;
      const inp = q('[data-ed-text]');
      if (D.text && document.activeElement !== inp) inp.value = sel.text || '';
    }
    if (sel !== this.textEdit) this.textEdit = null;
    q('.arch-count').textContent = `${this.list().length} / ${MAX} objets${Game.s.decor ? '' : ' · village d’origine'}`;
    q('[data-ed="undo"]').disabled = !this.undo.length;
  },
};
