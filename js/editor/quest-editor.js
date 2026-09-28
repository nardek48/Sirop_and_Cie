/**
 * quest-editor.js — l'éditeur de quêtes du maire (mairie → « Inventer les quêtes du maire »).
 *
 * On change, ajoute, déplace ou supprime les quêtes. Chaque quête = un type d'objectif
 * (liste GOALS de sim/quests.js), un nombre, une récompense et ce que dit le maire.
 * Les quêtes modifiées sont gardées dans la partie (s.quests) ; « Exporter » fabrique
 * assets/quests.json : mis dans le dépôt, il devient les quêtes de tout le monde.
 *
 * S'affiche dans la feuille des bâtiments (panneau « quetes »). Les champs sont
 * repérés par data-q="index:champ" et écoutés ici ; les boutons passent par data-act.
 */
import { Game } from '../core/game.js';
import { Fmt, esc } from '../core/format.js';
import { Files } from '../core/files.js';
import { GOALS, MAX_QUESTS, Quests, autoText, cleanQuest, questsToFile, questsFromFile } from '../sim/quests.js';
import { UI } from '../ui/ui.js';

const GOAL_IDS = Object.keys(GOALS);

/** Petite liste déroulante */
const select = (id, q, field, options, value) => `
  <select id="${id}" data-q="${q}:${field}">
    ${options.map(o => `<option value="${esc(o.id)}"${o.id === value ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}
  </select>`;

export const QuestEditor = {
  rev: 0,                 // signature du panneau : reconstruit quand elle change

  init() {
    const panel = UI.el.panel;
    panel.addEventListener('input', e => this.onField(e, false));
    panel.addEventListener('change', e => this.onField(e, true));
  },

  open() {
    if (Game.s.tuto.active) return UI.toast('Termine d’abord le tutoriel de Mémé 👵');
    UI.open('quetes');
  },

  /* ---------------- Données ---------------- */
  /** La liste modifiable : au premier changement, copie des quêtes du fichier */
  edit() {
    const s = Game.s;
    if (!s.quests) s.quests = Quests.base.map(q => ({ ...q }));
    return s.quests;
  },

  /**
   * Applique une modification de la liste en gardant la même quête « en cours »
   * (si on déplace ou supprime une quête déjà faite, le joueur ne saute pas de quête).
   */
  change(fn) {
    const s = Game.s, list = this.edit();
    const cur = list[s.quest.i];
    fn(list);
    const i = cur ? list.indexOf(cur) : -1;
    if (i >= 0) s.quest.i = i;
    s.quest.i = Math.min(s.quest.i, list.length);
    s.quest.ready = false;            // recalculé au prochain pas de simulation
    this.refresh();
  },

  refresh() { this.rev++; Quests.rev++; UI.key = null; UI.render(Game.s); },

  /* ---------------- Champs ---------------- */
  onField(e, commit) {
    const el = e.target;
    if (!el.dataset || !el.dataset.q) return;
    const [idx, field] = el.dataset.q.split(':');
    const i = Number(idx), list = this.edit(), q = list[i];
    if (!q) return;

    if (field === 'text') {
      q.text = el.value.replace(/[<>]/g, '').slice(0, 90);
      if (commit) { if (!q.text.trim()) q.text = autoText(q); this.refresh(); }
      return;
    }
    if (!commit) return;              // nombres et listes : appliqués à la validation

    const next = { ...q };
    if (field === 'goal') { next.goal = el.value; delete next.arg; if (GOALS[el.value].level) next.n = Math.max(2, q.n); }
    else if (field === 'arg') next.arg = el.value;
    else if (field === 'n') next.n = Number(el.value);
    else if (field === 'reward') next.reward = Number(el.value);
    const clean = cleanQuest(next);
    if (!clean) return;
    // Le texte suit l'objectif tant qu'on ne l'a pas écrit soi-même
    if (q.text === autoText(q)) clean.text = autoText(clean);
    this.change(L => { L[i] = clean; });
  },

  /* ---------------- Boutons ---------------- */
  add() {
    if (this.edit().length >= MAX_QUESTS) return UI.toast(`${MAX_QUESTS} quêtes au maximum`, 'bad');
    const q = cleanQuest({ goal: 'deliver', n: 10, reward: 500 });
    this.change(L => { L.push(q); });
    requestAnimationFrame(() => {
      const el = document.getElementById(`qe-${this.edit().length - 1}-goal`);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus({ preventScroll: true }); }
    });
  },
  remove(i) {
    const q = this.edit()[i];
    if (!q) return;
    UI.confirm(`Supprimer la quête ${i + 1} ?<br><small>« ${esc(q.text)} »</small>`,
      () => this.change(L => { L.splice(i, 1); }), 'Supprimer');
  },
  move(i, d) {
    const L = this.edit(), j = i + d;
    if (j < 0 || j >= L.length) return;
    this.change(list => { [list[i], list[j]] = [list[j], list[i]]; });
  },
  /** Faire de cette quête la quête en cours (pour l'essayer tout de suite) */
  go(i) {
    const s = Game.s;
    if (!this.edit()[i]) return;
    s.quest.i = i; s.quest.ready = false;
    this.refresh();
    UI.toast(`📍 Quête en cours : n° ${i + 1}`, 'ok');
  },
  reset() {
    UI.confirm('Remettre les quêtes du jeu ?<br><small>Tes quêtes inventées seront effacées (exporte-les d’abord pour les garder).</small>', () => {
      Game.s.quests = null;
      Game.s.quest.i = Math.min(Game.s.quest.i, Quests.base.length);
      Game.s.quest.ready = false;
      this.refresh();
    }, 'Remettre');
  },

  exportFile() {
    Files.download('quests.json', questsToFile(Quests.list(Game.s)) + '\n');
    UI.modal(`
      <h2>Quêtes exportées 💾</h2>
      <p>Pour que <b>tout le monde</b> ait ces quêtes :</p>
      <ol>
        <li>Remplace <code>assets/quests.json</code> dans le dossier du jeu par le fichier téléchargé.</li>
        <li>Lance <code>node tools/build-sw.mjs patch</code>, puis publie sur GitHub.</li>
      </ol>
      <p class="sub">Tes quêtes à toi restent enregistrées dans ta partie.</p>`);
  },
  async importFile() {
    const f = await Files.pick();
    if (!f) return;
    const list = questsFromFile(f.text);
    if (!list) return UI.modal('<h2>Oups 😕</h2><p>Ce fichier ne contient pas de quêtes.</p><p class="sub">Choisis un fichier <code>quests.json</code> créé avec « 💾 Exporter ».</p>');
    UI.confirm(`Remplacer les ${Quests.count(Game.s)} quêtes actuelles par les <b>${list.length}</b> quêtes du fichier ?`, () => {
      Game.s.quests = list;
      Game.s.quest.i = Math.min(Game.s.quest.i, list.length);
      Game.s.quest.ready = false;
      this.refresh();
    }, 'Remplacer');
  },

  /* ---------------- Panneau ---------------- */
  itemHtml(q, i, cur, n) {
    const g = GOALS[q.goal];
    const id = f => `qe-${i}-${f}`;
    const goals = GOAL_IDS.map(k => ({ id: k, name: `${GOALS[k].icon} ${GOALS[k].name}` }));
    const state = i < cur ? '<span class="qe-state done">✓ Faite</span>'
      : i === cur ? '<span class="qe-state cur">📍 En cours</span>'
      : `<button class="btn ghost sm" data-act="qeGo" data-arg="${i}" title="En faire la quête en cours">📍 Jouer</button>`;
    const nLabel = g.level ? 'Niveau' : g.money ? 'Somme' : 'Combien';
    return `
    <div class="qe-item ${i < cur ? 'is-done' : i === cur ? 'is-cur' : ''}">
      <div class="qe-num">${i + 1}</div>
      <div class="qe-body">
        <div class="qe-row">
          <label class="field qe-goal" for="${id('goal')}">Objectif${select(id('goal'), i, 'goal', goals, q.goal)}</label>
          ${g.args ? `<label class="field qe-arg" for="${id('arg')}">Lequel ?${select(id('arg'), i, 'arg', g.args(), q.arg)}</label>` : ''}
          ${g.once ? '' : `<label class="field qe-n" for="${id('n')}">${nLabel}
            <input id="${id('n')}" type="number" inputmode="numeric" min="1" step="1" data-q="${i}:n" value="${q.n}">
            ${g.money && q.n >= 1000 ? `<small>${Fmt.money(q.n)}</small>` : ''}</label>`}
        </div>
        <label class="field" for="${id('text')}">Ce que dit le maire
          <input id="${id('text')}" maxlength="90" data-q="${i}:text" value="${esc(q.text)}"></label>
        <div class="qe-row qe-foot">
          <label class="field qe-reward" for="${id('reward')}">🎁 Récompense ($)
            <input id="${id('reward')}" type="number" inputmode="numeric" min="0" step="1" data-q="${i}:reward" value="${q.reward}">
            ${q.reward >= 1000 ? `<small>${Fmt.money(q.reward)}</small>` : ''}</label>
          <div class="qe-tools">
            ${state}
            <button class="btn ghost sm" data-act="qeUp" data-arg="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Monter">▲</button>
            <button class="btn ghost sm" data-act="qeDown" data-arg="${i}" ${i === n - 1 ? 'disabled' : ''} aria-label="Descendre">▼</button>
            <button class="btn ghost sm" data-act="qeDel" data-arg="${i}" aria-label="Supprimer">🗑️</button>
          </div>
        </div>
      </div>
    </div>`;
  },
};

/** Panneau affiché dans la feuille (voir ui/panels/index.js) */
export const quetes = {
  title: '✏️ Quêtes du maire',
  key: s => [QuestEditor.rev, s.quest.i, !!s.quests].join('|'),
  html(s) {
    const list = Quests.list(s), cur = s.quest.i;
    return `
    <section class="card">
      <p class="sub" style="margin-top:0">Invente les missions du maire ! Choisis un objectif, combien, la récompense, et écris ce que dit le maire.
        Les quêtes se font dans l’ordre, de haut en bas.</p>
      <div class="row-btns">
        <button class="btn sm" data-act="qeAdd">➕ Ajouter une quête</button>
        <button class="btn ghost sm" data-act="qeExport">💾 Exporter le fichier</button>
        <button class="btn ghost sm" data-act="qeImport">📂 Ouvrir un fichier</button>
        ${s.quests ? '<button class="btn ghost sm" data-act="qeReset">↺ Remettre les quêtes du jeu</button>' : ''}
        <button class="btn ghost sm" data-act="openPanel" data-arg="mairie">🏛️ Retour à la mairie</button>
      </div>
    </section>
    <div class="qe-list">${list.map((q, i) => QuestEditor.itemHtml(q, i, cur, list.length)).join('')}</div>
    ${list.length ? '' : '<p class="hint">Aucune quête : le maire n’a rien à demander. Ajoute-en une !</p>'}
    <div class="row-btns" style="margin-top:12px"><button class="btn sm" data-act="qeAdd">➕ Ajouter une quête</button></div>`;
  },
};
