/**
 * Onglet « Arbre » du Labo : l'arbre de recherche dessiné en SVG (maquette validée).
 * Chaque branche a sa couleur ; toucher un fruit le choisit, la fiche dessous permet de le lancer.
 */
import { CONFIG } from '../../config.js';
import { Fmt } from '../../core/format.js';
import { Research, fruitById, prevFruit } from '../../sim/research.js';
import { Form } from '../form.js';

const R = CONFIG.research;
/** Position de chaque fruit dans l'arbre (viewBox 400 × 430) */
const POS = {
  u1: [150, 196], u2: [104, 136], u3: [72, 70],
  n1: [132, 282], n2: [80, 246],  n3: [36, 196],
  l1: [250, 196], l2: [296, 136], l3: [328, 70],
  r1: [268, 282], r2: [320, 246], r3: [364, 196],
};
const STATE_TXT = { done: 'mûr', growing: 'en train de mûrir', open: 'à lancer', locked: 'pas encore', soon: 'bientôt' };

function branchPath(b) {
  const fs = R.fruits.filter(f => f.b === b);
  let py = b === 'nature' || b === 'recettes' ? 318 : 240, px = 200, d = `M200 ${py}`;
  for (const f of fs) { const [x, y] = POS[f.id]; d += ` Q${(px + x) / 2} ${Math.min(py, y) - 6} ${x} ${y}`; px = x; py = y; }
  return d;
}

function fruitSVG(s, f) {
  const st = Research.state(s, f), c = R.branches[f.b].color, r = 24, [x, y] = POS[f.id];
  const off = st === 'locked' || st === 'soon';
  const fill = off ? 'var(--locked)' : st === 'done' ? c : 'var(--surface)';
  const circ = 2 * Math.PI * (r + 6), prog = st === 'growing' ? Research.progress(s) : 0;
  return `
  <g class="fruit ${st} ${Form.resSel === f.id ? 'sel' : ''}" data-act="resSel" data-arg="${f.id}" tabindex="0" role="button"
     aria-label="${f.name}, ${STATE_TXT[st]}">
    ${st === 'open' ? `<circle class="halo" cx="${x}" cy="${y}" r="${r + 9}" fill="${c}"/>` : ''}
    <g class="body">
      <path d="M${x} ${y - r + 2} q 2 -10 10 -12" stroke="var(--bark-d)" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="${x + 9}" cy="${y - r - 6}" rx="7" ry="4" fill="${off ? 'var(--locked-ink)' : '#3f8f5a'}" transform="rotate(-25 ${x + 9} ${y - r - 6})"/>
      <circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${off ? 'var(--locked-ink)' : c}" stroke-width="3" ${off ? 'stroke-dasharray="5 4"' : ''}/>
      ${st === 'done' ? `<circle cx="${x - 8}" cy="${y - 9}" r="6" fill="#fff" opacity=".35"/>` : ''}
      <text x="${x}" y="${y + 8}" text-anchor="middle" font-size="22" ${off ? 'opacity=".5"' : ''}>${st === 'locked' ? '🔒' : st === 'soon' ? '⏳' : f.icon}</text>
      ${st === 'growing' ? `<circle cx="${x}" cy="${y}" r="${r + 6}" fill="none" stroke="var(--amber)" stroke-width="5" stroke-linecap="round"
          stroke-dasharray="${(circ * prog).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${x} ${y})"/>` : ''}
      ${st === 'done' ? `<circle cx="${x + 17}" cy="${y + 16}" r="9" fill="#3f8f5a" stroke="var(--surface)" stroke-width="2"/>
          <path d="M${x + 13} ${y + 16} l3 3 l5 -6" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    </g>
  </g>`;
}

function treeSVG(s) {
  return `
  <svg class="tree" viewBox="0 0 400 430" role="group" aria-label="Arbre du Labo">
    <ellipse cx="200" cy="150" rx="190" ry="120" fill="var(--leaf)"/>
    <ellipse cx="110" cy="230" rx="100" ry="80" fill="var(--leaf)"/>
    <ellipse cx="290" cy="230" rx="100" ry="80" fill="var(--leaf)"/>
    <ellipse cx="200" cy="110" rx="120" ry="70" fill="var(--leaf-d)" opacity=".6"/>
    <path d="M176 430 C184 380 186 330 190 240 L210 240 C214 330 216 380 224 430 Z" fill="var(--bark)"/>
    ${Object.keys(R.branches).map(b => `<path d="${branchPath(b)}" stroke="var(--bark)" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
    <rect x="150" y="388" width="100" height="30" rx="8" fill="var(--surface)" stroke="var(--bark-d)" stroke-width="2"/>
    <text x="200" y="408" text-anchor="middle" font-weight="700" font-size="13" fill="var(--ink)">🧪 Labo</text>
    ${R.fruits.map(f => fruitSVG(s, f)).join('')}
  </svg>`;
}

function card(s) {
  const f = fruitById(Form.resSel) || R.fruits[0], st = Research.state(s, f), br = R.branches[f.b], p = prevFruit(f);
  let action;
  if (st === 'done') action = '<p class="sub">✓ Ce fruit est mûr : son effet marche pour toujours, même après avoir revendu l’entreprise.</p>';
  else if (st === 'growing') action = `
    <div class="bar"><i data-w="resPct" style="background:${br.color}"></i></div>
    <p class="sub">Le fruit mûrit… encore <b data-t="resLeft"></b>. Tu peux continuer à jouer, même fermer le jeu.</p>`;
  else if (st === 'soon') action = '<p class="sub">⏳ Ce fruit arrivera avec un prochain gros chantier du jeu.</p>';
  else action = `<button class="btn block" data-act="resGo" data-arg="${f.id}" data-d="cantRes:${f.id}" data-t="resGo:${f.id}"></button>
    ${p && st === 'locked' ? '' : ''}`;
  return `
  <section class="card res-card">
    <div class="res-head">
      <span class="res-badge" style="box-shadow:inset 0 0 0 3px ${br.color}">${f.icon}</span>
      <div><div class="res-branch" style="color:${br.color}">Branche ${br.name}</div><h3>${f.name}</h3></div>
    </div>
    <p>${f.what}</p>
    ${f.soon ? '' : `<div class="meta pills"><span>💰 ${Fmt.money(f.cost)}</span><span>⏱️ ${Fmt.time(f.sec)}</span></div>`}
    ${action}
  </section>`;
}

function gains(s) {
  const done = R.fruits.filter(f => s.research.done.includes(f.id));
  return `<section class="card"><h3>Ce que tu as gagné</h3>
    ${done.length ? `<ul class="res-gains">${done.map(f => `<li><i style="background:${R.branches[f.b].color}"></i>${f.icon} ${f.what}</li>`).join('')}</ul>`
      : '<p class="empty">Rien encore : fais pousser ton premier fruit !</p>'}</section>`;
}

/** Contenu de l'onglet ; la clé change quand il faut redessiner (état, choix, anneau de progression) */
export const tree = {
  key: s => [Form.resSel, s.research.cur, s.research.done.join(), Math.floor(Research.progress(s) * 40)].join('|'),
  html: s => `
    <div class="cols res">
      <section class="card tree-box">
        ${treeSVG(s)}
        <div class="res-legend">${Object.values(R.branches).map(b => `<span><i style="background:${b.color}"></i>${b.name}</span>`).join('')}</div>
        <p class="res-cur" data-t="resCur"></p>
      </section>
      <div class="res-side">${card(s)}${gains(s)}</div>
    </div>
    <p class="hint">Touche un fruit pour voir ce qu’il fait. Un seul fruit mûrit à la fois, et ce qui est mûr reste pour toujours.</p>`,
};
