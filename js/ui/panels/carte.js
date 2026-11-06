/**
 * Carte : raccourcis vers les lieux du village (on y est tout de suite) et voyages vers les autres villes.
 * Onglet « Le village » : plan dessiné d'après map.js + liste des lieux ; « Le monde » : carte dessinée + villes.
 * Le voyage vers une ville, c'est son mini-jeu (train ou bateau).
 */
import { CONFIG } from '../../config.js';
import { Openings } from '../../sim/openings.js';
import { Cities } from '../../sim/cities.js';
import { Eco } from '../../sim/eco.js';
import { Fishing } from '../../sim/fishing.js';
import { fruitById } from '../../sim/research.js';
import { Fmt } from '../../core/format.js';
import { MAP } from '../../world/map.js';
import { HOUSE, HOUSE_GARAGE } from '../../world/home.js';

/** Onglet ouvert et lieu choisi (gardés entre deux ouvertures) */
export const MapSel = { tab: 'village', sel: null };

const door = id => ({ x: CONFIG.places[id].x, y: CONFIG.places[id].y + 14 });
/** Lieux du raccourci, regroupés par usage. at : où le joueur arrive ; lock(s) : raison si fermé */
export const SPOTS = [
  { g: 'Travailler', id: 'usine', icon: '🏭', name: 'Usine', sub: 'Entrer dans l’usine', at: () => door('usine') },
  { g: 'Travailler', id: 'quai', icon: '📦', name: 'Quai de chargement', sub: 'Charger les commandes', at: () => door('quai') },
  { g: 'Travailler', id: 'contrats', icon: '📜', name: 'Contrats', sub: 'Choisir des commandes', at: () => door('contrats'), open: 'contrats' },
  { g: 'Travailler', id: 'labo', icon: '🧪', name: 'Labo', sub: 'L’arbre des recherches', at: () => door('labo'), open: 'labo' },
  { g: 'Livrer', id: 'epicerie', icon: '🛒', name: 'Épicerie', sub: 'Client', at: () => door('epicerie') },
  { g: 'Livrer', id: 'cafe', icon: '☕', name: 'Café', sub: 'Client', at: () => door('cafe') },
  { g: 'Livrer', id: 'supermarche', icon: '🏬', name: 'Supermarché', sub: 'Client', at: () => door('supermarche') },
  { g: 'Livrer', id: 'port', icon: '🚢', name: 'Port', sub: 'Export Riviera et le bateau', at: () => door('port') },
  { g: 'Livrer', id: 'gare', icon: '🚂', name: 'Gare de la Colline', sub: 'Train Express et le train', at: () => door('gare'),
    lock: s => !s.districts.colline && `Quartier de la Colline (${Fmt.money(CONFIG.districts.colline.cost)})` },
  { g: 'Se promener', id: 'maison', icon: '🏠', name: 'Ma maison', sub: 'Dormir, décorer', at: () => door('maison') },
  { g: 'Se promener', id: 'mairie', icon: '🏛️', name: 'Mairie', sub: 'Le maire et ses quêtes', at: () => door('mairie') },
  { g: 'Se promener', id: 'ponton', icon: '🎣', name: 'Ponton de pêche', sub: 'Pêcher, remplir le carnet', at: () => ({ x: MAP.pier.x + MAP.pier.w / 2, y: MAP.pier.y + 22 }) },
  { g: 'Se promener', id: 'verger', icon: '🌳', name: 'Verger communal', sub: 'Cueillir les fruits', at: () => ({ x: 295, y: 645 }) },
  { g: 'Se promener', id: 'champs', icon: '🌱', name: 'Champs', sub: 'Planter, récolter', at: () => ({ x: MAP.farm[1].x, y: MAP.farm[1].y - 120 }) },
  { g: 'Se promener', id: 'parc', icon: '⛲', name: 'Parc et fontaine', sub: 'Le banc des conseils', at: () => ({ x: MAP.fountain.x, y: MAP.fountain.y + 80 }) },
  { g: 'Se promener', id: 'agence', icon: '🏡', name: 'Agence', sub: 'Acheter des maisons', at: () => door('agence'), open: 'agence' },
  { g: 'Se promener', id: 'garage', icon: '🚲', name: 'Garage', sub: 'Vélos et camionnettes', at: () => door('garage'), open: 'garage' },
];
/** Raison de la fermeture d'un lieu (texte), ou '' s'il est ouvert */
export function spotLock(s, sp) {
  if (sp.lock) return sp.lock(s) || '';
  if (sp.open && !Openings.isOpen(s, sp.open)) return `Ouvre ${Openings.hint(s, sp.open)}`;
  return '';
}

/* ---------- Le plan du village (dessiné dans un canvas après l'affichage) ---------- */
function drawPlan(cv, s) {
  const w = cv.getBoundingClientRect().width;
  if (w < 2) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), k = w / MAP.w, h = Math.round(MAP.h * k);
  cv.style.height = h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d');
  g.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
  g.fillStyle = '#cfe0a6'; g.fillRect(0, 0, MAP.w, MAP.h);
  const C = MAP.districts.colline;
  if (!s.districts.colline) { g.fillStyle = 'rgba(90,65,40,.18)'; g.fillRect(C.area.x, 0, C.area.w, MAP.h); }
  const W = MAP.water; g.fillStyle = '#9fd0e6'; g.fillRect(W.x, W.y, W.w, W.h);
  g.fillStyle = '#e9dcb4'; g.fillRect(W.x - 8, W.h, W.w + 8, 12);
  const P = MAP.pier; g.fillStyle = '#a07048'; g.fillRect(P.x, P.y, P.w, P.h);
  const R = MAP.road; g.fillStyle = '#ddd2bf'; g.fillRect(0, R.y - 18, MAP.w, R.h + 36); g.fillStyle = '#9a958e'; g.fillRect(0, R.y, MAP.w, R.h);
  g.fillStyle = '#79ad58'; g.fillRect(80, 660, 430, 410);
  g.fillStyle = '#b08c5a'; for (const f of MAP.farm) g.fillRect(f.x - 90, f.y - 100, 180, 110);
  g.fillStyle = '#9fd0e6'; g.beginPath(); g.arc(MAP.fountain.x, MAP.fountain.y, 46, 0, 7); g.fill();
  const blocks = [{ ...HOUSE, wall: '#f2d3a0', roof: '#c2453a' }, { ...HOUSE_GARAGE, wall: '#d9cbb3', roof: '#7a5a3a' }, ...MAP.buildings];
  for (const b of blocks) {
    g.fillStyle = b.wall; g.fillRect(b.x, b.y + b.h * 0.35, b.w, b.h * 0.65);
    g.fillStyle = b.roof; g.fillRect(b.x - 6, b.y, b.w + 12, b.h * 0.4);
    g.strokeStyle = 'rgba(59,42,26,.55)'; g.lineWidth = 3 / k; g.strokeRect(b.x - 6, b.y, b.w + 12, b.h);
  }
  if (!s.districts.colline) {
    g.strokeStyle = '#7a5230'; g.lineWidth = 3 / k; g.setLineDash([12 / k, 8 / k]);
    g.beginPath(); g.moveTo(C.barrier.x, 0); g.lineTo(C.barrier.x, MAP.h); g.stroke(); g.setLineDash([]);
  }
  // Épingles (la choisie est grande, avec son icône), puis « Tu es ici »
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const sp of SPOTS) {
    const a = sp.at(), x = a.x * k, y = a.y * k, sel = MapSel.sel === sp.id, lock = spotLock(s, sp);
    g.fillStyle = sel ? '#d98a1c' : lock ? 'rgba(90,65,40,.45)' : '#fffaf0';
    g.strokeStyle = '#5a4128'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, y, sel ? 13 : 5, 0, 7); g.fill(); g.stroke();
    if (sel) { g.font = '15px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sp.icon, x, y + 1); }
  }
  const me = s.player, mx = me.x * k, my = me.y * k;
  g.fillStyle = '#e0703a'; g.strokeStyle = '#fff'; g.lineWidth = 2.5;
  g.beginPath(); g.arc(mx, my, 6, 0, 7); g.fill(); g.stroke();
  g.font = '700 10px "DM Sans", system-ui'; g.textAlign = 'left'; g.textBaseline = 'middle';
  const label = 'Tu es ici', lx = Math.min(mx + 9, w - g.measureText(label).width - 6);
  g.lineWidth = 3; g.strokeStyle = '#fffaf0'; g.strokeText(label, lx, my - 12);
  g.fillStyle = '#3b2a1a'; g.fillText(label, lx, my - 12);
  cv.dataset.k = k;
}

/* ---------- La carte du monde (SVG) ---------- */
const CITIES = [
  { id: 'sirop', icon: '🏘️', name: 'Sirop-sur-Mer', x: 182, y: 176 },
  { id: 'fraises', icon: '🍓', name: 'Gare des Fraises', x: 70, y: 58 },
  { id: 'agrumes', icon: '🍊', name: 'Port-Agrumes', x: 296, y: 74 },
];
function worldSvg(s) {
  const sel = id => MapSel.sel === id;
  const city = c => `<g class="map-city" tabindex="0" role="button" data-act="mapPick" data-arg="${c.id}" aria-label="${c.name}">
      <circle cx="${c.x}" cy="${c.y}" r="${sel(c.id) ? 21 : 18}" fill="${sel(c.id) ? '#d98a1c' : '#fffaf0'}" stroke="#5a4128" stroke-width="2.5"/>
      <text x="${c.x}" y="${c.y + 1}" text-anchor="middle" dominant-baseline="middle" font-size="18">${c.icon}</text>
      <text x="${c.x}" y="${c.y + 34}" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="800" font-size="13" fill="#5a4128" stroke="#f7ecd4" stroke-width="4" paint-order="stroke">${c.name}</text>
    </g>`;
  const berries = Array.from({ length: 12 }, (_, i) => `<circle cx="${30 + (i % 4) * 9}" cy="${86 + Math.floor(i / 4) * 7}" r="2.2"/>`).join('');
  return `<svg viewBox="0 0 360 260" role="img" aria-label="Carte du monde de Sirop & Cie">
    <rect width="360" height="260" fill="#9fd0e6"/>
    <g stroke="#ffffff" stroke-opacity=".6" stroke-width="1.5" fill="none" stroke-linecap="round">
      <path d="M250 150 q6 -4 12 0 q6 4 12 0"/><path d="M300 190 q6 -4 12 0 q6 4 12 0"/><path d="M230 230 q6 -4 12 0 q6 4 12 0"/><path d="M320 140 q6 -4 12 0"/>
    </g>
    <path d="M0 0 H200 C215 40 190 70 214 110 C232 140 210 170 226 200 C240 230 212 250 220 260 H0 Z" fill="#cfe0a6" stroke="#5a4128" stroke-width="2"/>
    <path d="M268 50 C285 34 322 38 334 58 C346 80 326 102 300 100 C276 98 256 72 268 50 Z" fill="#f2dc9e" stroke="#5a4128" stroke-width="2"/>
    <circle cx="322" cy="56" r="5" fill="#ff8a3d" stroke="#5a4128" stroke-width="1.5"/>
    <g fill="#b9d58a" stroke="#5a4128" stroke-width="1.5"><path d="M96 130 q22 -34 44 0 Z"/><path d="M124 132 q18 -26 36 0 Z"/></g>
    <text x="112" y="150" text-anchor="middle" font-family="DM Sans, system-ui" font-size="9" font-weight="700" fill="#5a4128" letter-spacing="1">LA COLLINE</text>
    <g fill="#e0303f">${berries}</g>
    <path d="M182 176 C150 160 140 120 112 100 C96 88 84 74 70 58" fill="none" stroke="#5a4128" stroke-width="5" stroke-linecap="round"/>
    <path d="M182 176 C150 160 140 120 112 100 C96 88 84 74 70 58" fill="none" stroke="#f7ecd4" stroke-width="2.5" stroke-dasharray="3 5"/>
    ${s.districts.colline ? '' : '<g transform="translate(158 150)"><circle r="9" fill="#fffaf0" stroke="#5a4128" stroke-width="1.5"/><text y="1" text-anchor="middle" dominant-baseline="middle" font-size="10">🔒</text></g>'}
    <path d="M204 168 C240 150 250 110 282 86" fill="none" stroke="#3a6ea5" stroke-width="2.5" stroke-dasharray="6 6" stroke-linecap="round"/>
    <text x="236" y="132" font-size="16" text-anchor="middle">⛵</text>
    <g transform="translate(330 225)" fill="#5a4128"><path d="M0 -16 L4 0 L0 16 L-4 0 Z"/><text y="-20" text-anchor="middle" font-size="9" font-weight="700" font-family="DM Sans, system-ui">N</text></g>
    ${CITIES.map(city).join('')}
  </svg><span class="map-legend">Le monde de Sirop &amp; Cie</span>`;
}

function cityCards(s) {
  const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  const fr = CONFIG.cities.fraises, fp = Fishing.progress(s);
  const wagon = Cities.open(s, 'fraises') ? '<span class="pill" data-t="mapWagon"></span>' : `<span class="pill lock">🔒 Wagon : ${fruitName(fr.research)}, au Labo</span>`;
  const cards = [
    { id: 'sirop', icon: '🏘️', name: 'Sirop-sur-Mer', lines: ['Ton village : l’usine, les clients, ta maison.', `<span class="pill">🎣 Carnet ${fp.got}/${fp.total}</span>`], here: true },
    { id: 'fraises', icon: '🍓', name: 'Gare des Fraises',
      lines: s.districts.colline
        ? ['🚂 Le train y va depuis la gare de la Colline.', `<span class="pill" data-t="mapTrip:train" data-c="ok|mapTripReady:train"></span><span class="pill">Record ${stars(s.train.best)}</span>`, wagon]
        : ['🚂 Le train part de la gare de la Colline.', `<span class="pill lock">🔒 Achète le quartier de la Colline à la mairie : ${Fmt.money(CONFIG.districts.colline.cost)}, ⭐ ${CONFIG.districts.colline.rep}</span>`],
      go: s.districts.colline ? ['train', 'Y aller en train 🚂'] : null },
    { id: 'agrumes', icon: '🍊', name: 'Port-Agrumes',
      lines: ['⛵ Le bateau part du Port de Sirop-sur-Mer.', `<span class="pill" data-t="mapTrip:boat" data-c="ok|mapTripReady:boat"></span><span class="pill">Record ${stars(s.boat.best)}</span>`],
      go: ['boat', 'Y aller en bateau ⛵'] },
  ];
  return '<h3 class="map-h">Les villes</h3>' + cards.map(c => `<div class="map-town${MapSel.sel === c.id ? ' sel' : ''}">
      <span class="map-ico" aria-hidden="true">${c.icon}</span><b>${c.name}</b>
      ${c.lines.map(l => `<p class="${l.startsWith('<span') ? 'map-pills' : ''}">${l}</p>`).join('')}
      ${c.here ? '<span class="pill">📍 Tu es ici</span>'
        : c.go ? `<button type="button" class="btn" data-act="mapTrip" data-arg="${c.go[0]}">${c.go[1]}</button>`
        : '<button type="button" class="btn" disabled>🔒 Pas encore</button>'}
    </div>`).join('');
}
const fruitName = id => (fruitById(id) || { name: id }).name;

export const carte = {
  title: '🗺️ Carte',
  key: s => [MapSel.tab, MapSel.sel, s.districts.colline, Cities.open(s, 'fraises'), s.train.best, s.boat.best,
    Fishing.progress(s).got, SPOTS.map(sp => spotLock(s, sp) ? 1 : 0).join(''), Math.round(s.player.x / 40), Math.round(s.player.y / 40)].join('|'),
  html(s) {
    const tabs = `<div class="map-tabs" role="tablist">
      <button type="button" role="tab" aria-selected="${MapSel.tab === 'village'}" data-act="mapTab" data-arg="village">🏘️ Le village</button>
      <button type="button" role="tab" aria-selected="${MapSel.tab === 'monde'}" data-act="mapTab" data-arg="monde">🌍 Le monde</button>
    </div>`;
    if (MapSel.tab === 'monde') {
      return `${tabs}<div class="map-paper">${worldSvg(s)}</div>${cityCards(s)}
        <p class="hint">Le voyage, c’est le mini-jeu : « Y aller » lance le train ou le bateau.</p>`;
    }
    const groups = [...new Set(SPOTS.map(sp => sp.g))].map(g => `<h3 class="map-h">${g}</h3><div class="map-spots">${
      SPOTS.filter(sp => sp.g === g).map(sp => {
        const lock = spotLock(s, sp);
        return `<button type="button" class="map-spot${MapSel.sel === sp.id ? ' sel' : ''}${lock ? ' lock' : ''}" data-act="mapPick" data-arg="${sp.id}">
          <span class="map-ico" aria-hidden="true">${lock ? '🔒' : sp.icon}</span><b>${sp.name}</b><span>${lock || sp.sub}</span></button>`;
      }).join('')}</div>`).join('');
    const sp = SPOTS.find(x => x.id === MapSel.sel), lock = sp && spotLock(s, sp);
    let bar = '';
    if (sp) {
      const a = sp.at(), d = Math.hypot(a.x - s.player.x, a.y - s.player.y);
      const how = lock ? `🔒 ${lock}` : d < 60 ? 'Tu y es déjà' : `à ${Math.max(1, Math.round(d / Eco.speed(s)))} s à pied`;
      bar = `<div class="map-bar"><p>${sp.icon} <b>${sp.name}</b><small>${how}</small></p>
        <button type="button" class="btn" data-act="mapGo" data-arg="${sp.id}" ${lock ? 'disabled' : ''}>${lock ? 'Fermé' : 'On y va !'}</button></div>`;
    }
    return `${tabs}<div class="map-paper"><canvas class="map-plan" aria-label="Plan de Sirop-sur-Mer : touche un lieu"></canvas><span class="map-legend">Sirop-sur-Mer · plan</span></div>
      ${groups}${bar}`;
  },
  /** Après l'affichage : dessine le plan, et un toucher sur le plan choisit le lieu le plus proche */
  mounted(el, s, act) {
    const cv = el.querySelector('.map-plan');
    if (!cv) return;
    drawPlan(cv, s);
    cv.addEventListener('click', e => {
      const r = cv.getBoundingClientRect(), k = Number(cv.dataset.k) || 1, x = e.clientX - r.left, y = e.clientY - r.top;
      let best = null, bd = 24;
      for (const sp of SPOTS) { const a = sp.at(), d = Math.hypot(a.x * k - x, a.y * k - y); if (d < bd) { bd = d; best = sp; } }
      if (best) act('mapPick', best.id);
    });
  },
};
