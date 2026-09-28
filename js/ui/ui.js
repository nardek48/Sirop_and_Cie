/**
 * ui.js — HUD, feuille d'intérieur (panneaux), toasts, modale et confirmations.
 * Le navigateur des artifacts ne montre pas confirm() : les confirmations sont faites ici.
 */
import { Game } from '../core/game.js';
import { Bus } from '../core/bus.js';
import { B } from './bindings.js';
import { Panels } from './panels/index.js';
import { Form } from './form.js';

/** Lit/écrit une valeur par chemin « a.b.c » */
const setPath = (obj, path, val) => {
  const keys = path.split('.'), last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = val;
};

export const UI = {
  active: null, key: null, nodes: [], fixed: [], el: {}, onAction: null,

  /** @param {(name:string,arg?:string)=>void} onAction répartiteur d'actions */
  init(onAction) {
    this.onAction = onAction;
    for (const id of ['panel', 'sheet', 'sheet-title', 'toasts', 'modal', 'modal-body', 'modal-btns', 'act-btn', 'help', 'quest'])
      this.el[id] = document.getElementById(id);
    this.fixed = [...this.collect(document.querySelector('header.top')), ...this.collect(this.el.quest)];

    document.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) onAction(b.dataset.act, b.dataset.arg);
    });
    this.el.sheet.addEventListener('click', e => { if (e.target === this.el.sheet) this.close(); });

    // Champs de saisie : data-field → état du jeu, data-form → état de formulaire
    const onInput = e => {
      const el = e.target;
      if (el.dataset.field) setPath(Game.s, el.dataset.field, el.value);
      else if (el.dataset.form) setPath(Form, el.dataset.form, el.value);
      else return;
      if (e.type === 'change' && 'rerender' in el.dataset) { this.key = null; this.render(Game.s); }
    };
    this.el.panel.addEventListener('input', onInput);
    this.el.panel.addEventListener('change', onInput);

    Bus.on('toast', (m, t) => this.toast(m, t));

    // Tactile (Android, iPhone) : ni sélection de texte, ni menu d'appui long, ni pincement pour zoomer.
    // Les champs de saisie gardent leur comportement normal.
    const editable = t => t instanceof Element && !!t.closest('input,textarea,select,[contenteditable="true"]');
    document.addEventListener('selectstart', e => { if (!editable(e.target)) e.preventDefault(); });
    document.addEventListener('contextmenu', e => { if (!editable(e.target)) e.preventDefault(); });
    document.addEventListener('dragstart', e => { if (!editable(e.target)) e.preventDefault(); });
    for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });   // iOS
    try { if (localStorage.getItem('siropcie_help') === '0') this.el.help.hidden = true; } catch (e) { /* stockage indisponible */ }
  },

  open(name) {
    this.active = name; this.key = null;
    this.el['sheet-title'].textContent = Panels[name].title;
    this.el.sheet.hidden = false;
    this.el.sheet.scrollTop = 0;
    this.render(Game.s);
    Bus.sfx('door');
  },
  close() {
    if (!this.active) return;
    this.active = null;
    this.el.sheet.hidden = true;
    this.el.panel.innerHTML = '';
    this.nodes = [];
  },

  parse(str) {
    if (!str) return null;
    let cls = null;
    if (str.includes('|')) [cls, str] = str.split('|');
    const i = str.indexOf(':');
    return i < 0 ? { n: str, cls } : { n: str.slice(0, i), a: str.slice(i + 1), cls };
  },
  collect(root) {
    return [...root.querySelectorAll('[data-t],[data-d],[data-w],[data-c]'), ...(root.matches('[data-c]') ? [root] : [])].map(el => ({
      el, t: this.parse(el.dataset.t), d: this.parse(el.dataset.d), w: this.parse(el.dataset.w), c: this.parse(el.dataset.c),
    }));
  },
  /** Applique les liaisons en ne touchant que ce qui change */
  apply(nodes, s) {
    for (const { el, t, d, w, c } of nodes) {
      if (t) { const v = String(B[t.n](s, t.a)); if (el.textContent !== v) el.textContent = v; }
      if (d) { const v = !!B[d.n](s, d.a); if (el.disabled !== v) el.disabled = v; }
      if (w) { const v = Math.max(0, Math.min(1, B[w.n](s, w.a) || 0)); el.style.width = (v * 100).toFixed(1) + '%'; }
      if (c) for (const part of c.cls.split(',')) el.classList.toggle(part, !!B[c.n](s, c.a));
    }
  },

  render(s) {
    this.apply(this.fixed, s);
    if (!this.active) return;
    const p = Panels[this.active];
    const k = this.active + '#' + p.key(s);
    if (k !== this.key) {
      const focus = document.activeElement && document.activeElement.id;
      this.el.panel.innerHTML = p.html(s);
      this.nodes = this.collect(this.el.panel);
      this.key = k;
      if (focus) document.getElementById(focus)?.focus();
    }
    this.apply(this.nodes, s);
  },

  /** Bouton d'action (tactile) : reflète l'interaction proche */
  setAction(label) {
    const b = this.el['act-btn'];
    const txt = label ? '✋ ' + label : '';
    if (b.textContent !== txt) b.textContent = txt;
    const hide = !label || !!this.active || this.modalOpen();
    if (b.hidden !== hide) b.hidden = hide;
  },

  toast(msg, type = '') {
    const d = document.createElement('div');
    d.className = 'toast ' + (type === 'ok' ? 'good' : type);   // « .ok » est déjà une classe de texte
    d.textContent = msg;
    this.el.toasts.append(d);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    requestAnimationFrame(() => d.classList.add('in'));
    setTimeout(() => { d.classList.remove('in'); setTimeout(() => d.remove(), 300); }, 3400);
  },

  /* ---------- Modale générique ---------- */
  modalOpen() { return !this.el.modal.hidden; },
  /**
   * @param {string} html contenu
   * @param {{label:string, primary?:boolean, danger?:boolean, run?:Function}[]} buttons
   */
  modal(html, buttons = [{ label: 'Continuer', primary: true }]) {
    this.el['modal-body'].innerHTML = html;
    this.el['modal-btns'].replaceChildren(...buttons.map(b => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'btn' + (b.primary ? '' : ' ghost') + (b.danger ? ' danger' : '');
      el.textContent = b.label;
      el.addEventListener('click', () => { this.closeModal(); if (b.run) { b.run(); this.key = null; this.render(Game.s); } });
      return el;
    }));
    this.el.modal.hidden = false;
    this.el['modal-btns'].lastChild?.focus();
  },
  closeModal() { this.el.modal.hidden = true; },
  confirm(msg, onYes, yesLabel = 'Oui') {
    this.modal(`<p class="confirm">${msg}</p>`, [{ label: 'Annuler' }, { label: yesLabel, primary: true, run: onYes }]);
  },
};
