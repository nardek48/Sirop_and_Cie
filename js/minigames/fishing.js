/**
 * fishing.js — mini-jeu « Pêche au ponton » : lancer, ferrer, mouliner, depuis le ponton du Port.
 *
 * Un seul bouton (ou Espace) :
 *   Lancer   : maintenir pour charger la puissance, lâcher. Plus loin = plus gros et plus rare.
 *   Ferrer   : appuyer quand le bouchon plonge (pas sur une simple touche, ni trop tard).
 *   Mouliner : maintenir pour ramener le poisson, lâcher quand le fil rougit, sinon il casse.
 * Rendu 3D seulement (fishing3d.js) ; sans WebGL, un message remplace la scène.
 *
 * Options reçues de l'hôte (voir js/minigames/index.js) :
 *   shirt               couleur du t-shirt du joueur
 *   species             liste des espèces (CONFIG.fishing.species)
 *   pick(d)             espèce qui mord pour un lancer de d mètres
 *   weight(f)           poids d'une prise
 *   onCatch(f, kg)      enregistre la prise → { isNew, record, n, html }
 *   carnet()            { [id]: { n, best } }
 *   trophy()            nom du trophée si le carnet est complet, sinon ''
 */

import { Fishing3D } from './fishing3d.js';

const CAST = { min: 5, max: 22 };                 // portée du lancer (m)
const T = {
  POWER_SPEED: 0.75,      // aller-retour de la jauge de puissance (par seconde)
  FLY: 0.9,               // durée du vol du bouchon (s)
  BITE_MIN: 1.8, BITE_RANDOM: 3.2,                 // attente avant la vraie touche (s)
  BITE_WINDOW: 0.9,       // temps pour ferrer quand ça plonge (s)
  REEL: 2.6, REEL_SURGE: 1.4,                      // m/s ramenés en moulinant (calme / quand il tire)
  PULL_AWAY: 2.2,         // m/s × force : le poisson repart quand il tire
  TENSION_UP: 0.22, TENSION_SURGE: 0.75, TENSION_DOWN: 0.55,   // tension du fil par seconde
  CATCH_AT: 2,            // m : le poisson est au ponton
};

/* =========================================================
   ÉTAT
   ========================================================= */
let host = null, ui = {}, use3d = false, holding = false;
/** Phases : intro → idle → charge → fly → wait → bite → fight → caught | miss → idle */
let P = null;
function reset() {
  P = { phase: 'intro', t: 0, power: 0, powerDir: 1, dist: 0, castDist: 0, dist0: 0, fish: null, tension: 0,
    nibbles: 0, nextNib: 0, nib: 0, biteAt: 0, surge: 0, nextSurge: 0, msgT: 0, splash: 0, kg: 0 };
}

/* =========================================================
   LE BOUTON UNIQUE
   ========================================================= */
function setAct(label, sub, cls) {
  ui.act.innerHTML = `${label}<small>${sub}</small>`;
  ui.act.className = 'tr-ctrl fi-act' + (cls ? ' ' + cls : '') + (holding ? ' held' : '');
}
function say(msg, hot, hold = 0) {
  if (ui.board.textContent !== msg) ui.board.textContent = msg;
  ui.board.classList.toggle('hot', !!hot); P.msgT = hold;
}

function press() {
  if (holding) return;
  holding = true; ui.act.classList.add('held');
  if (P.phase === 'idle') { P.phase = 'charge'; P.t = 0; P.power = 0; P.powerDir = 1; ui.power.hidden = false; say('Lâche pour lancer !'); }
  else if (P.phase === 'wait') { P.phase = 'miss'; P.t = 0; P.splash++; say('Trop tôt ! Le poisson a eu peur', false, 1.6); setAct('…', 'on relance', 'fi-wait'); }
  else if (P.phase === 'bite') strike();
}
function release() {
  if (!holding) return;
  holding = false; ui.act.classList.remove('held');
  if (P.phase === 'charge') cast();
}

function cast() {
  ui.power.hidden = true;
  P.dist = P.castDist = CAST.min + (CAST.max - CAST.min) * P.power;
  P.phase = 'fly'; P.t = 0;
  setAct('…', 'le bouchon vole', 'fi-wait');
  say(`Lancer à ${Math.round(P.dist)} m`);
  host.sfx('click');
}
function startWait() {
  P.phase = 'wait'; P.t = 0; P.fish = host.opts.pick(P.dist);
  P.nibbles = Math.floor(Math.random() * 3);       // 0 à 2 fausses touches avant la vraie
  P.biteAt = T.BITE_MIN + Math.random() * T.BITE_RANDOM; P.nextNib = 0.9 + Math.random() * 0.8;
  P.splash++;
  setAct('Ferrer', 'quand le bouchon plonge', 'fi-wait');
  say('Chut… attends que ça morde');
}
function strike() {
  P.phase = 'fight'; P.t = 0; P.tension = 0.2; P.surge = 0; P.nextSurge = 0.6 + Math.random(); P.dist0 = P.dist;
  P.splash++;
  setAct('Mouliner', 'maintiens · lâche si le fil rougit', 'fi-reel');
  ui.gauge.hidden = false; ui.distChip.hidden = false;
  say('Ferré ! Mouline !', true);
  host.sfx('pick');
}
function lose(msg) {
  P.phase = 'miss'; P.t = 0; ui.gauge.hidden = true; ui.distChip.hidden = true;
  say(msg, false, 1.8); setAct('…', 'on relance', 'fi-wait');
  host.sfx('error');
}
function toIdle() {
  P.phase = 'idle'; P.t = 0;
  ui.gauge.hidden = true; ui.distChip.hidden = true; ui.power.hidden = true;
  setAct('Lancer', 'maintiens, puis lâche · Espace');
  say('Maintiens « Lancer » puis lâche');
}

/* ---------- Prise : le poisson saute sur le ponton, puis sa fiche ---------- */
function caught() {
  const f = P.fish, kg = host.opts.weight(f);
  const r = host.opts.onCatch(f, kg);
  P.phase = 'caught'; P.t = 0; P.kg = kg;
  ui.gauge.hidden = true; ui.distChip.hidden = true;
  say(f.id === 'botte' || f.id === 'caisse' ? 'Qu’est-ce que c’est ?' : 'Attrapé !', true, 2);
  setAct('…', 'regarde ta prise', 'fi-wait');
  host.sfx('quest');
  updateCount();
  setTimeout(() => { if (P && P.phase === 'caught') showCatch(f, kg, r); }, 1400);
}
function showCatch(f, kg, r) {
  ui.resEyebrow.textContent = r.isNew ? 'Nouvelle espèce dans le carnet !' : r.record ? 'Nouveau record !' : 'Belle prise';
  ui.resTitle.textContent = `${f.art} ${f.name.toLowerCase()} !`;
  const rows = [
    ['Poids', `${kg.toLocaleString('fr-FR')} kg`],
    ['Rareté', `<span class="fi-rar">${'★'.repeat(f.rar)}${'☆'.repeat(3 - f.rar)}</span>`],
    ['Lancer', `${Math.round(P.castDist)} m`],
    ['Déjà pris', `${r.n} fois`],
  ];
  if (f.id === 'caisse') rows.push(['D’où ?', 'tombée d’un bateau trop pressé 😉']);
  ui.dl.innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  ui.gain.innerHTML = r.html || '';
  Fishing3D.portrait(f.id, ui.portrait);
  ui.result.hidden = false; ui.again.focus();
}

/* ---------- Carnet ---------- */
function updateCount() {
  const c = host.opts.carnet();
  ui.count.textContent = `${host.opts.species.filter(f => c[f.id]).length}/${host.opts.species.length}`;
}
function openCarnet() {
  updateCount();
  const c = host.opts.carnet();
  ui.list.innerHTML = host.opts.species.map(f => {
    const k = c[f.id], stars = '★'.repeat(f.rar);
    if (k) return `<li><b>${f.name}</b><span>${stars} · record ${k.best.toLocaleString('fr-FR')} kg · ×${k.n}</span></li>`;
    const where = f.zone[0] >= 13 ? 'lance loin' : f.zone[1] <= 14 ? 'près du ponton' : 'à mi-distance';
    return `<li class="no"><b>???</b><span>${stars} · ${where}</span></li>`;
  }).join('');
  const t = host.opts.trophy ? host.opts.trophy() : '';
  ui.trophy.textContent = t ? `${t} : carnet complet !` : '';
  ui.trophy.hidden = !t;
  ui.carnet.hidden = false; ui.carnet.querySelector('.fi-close').focus();
}

/* =========================================================
   SIMULATION
   ========================================================= */
function update(dt) {
  P.t += dt; P.msgT -= dt;
  switch (P.phase) {
    case 'charge':                                   // la jauge va et vient : lâcher au bon moment
      P.power += P.powerDir * dt * T.POWER_SPEED;
      if (P.power >= 1) { P.power = 1; P.powerDir = -1; } else if (P.power <= 0) { P.power = 0; P.powerDir = 1; }
      ui.powerI.style.width = (P.power * 100) + '%';
      break;
    case 'fly':
      if (P.t >= T.FLY) startWait();
      break;
    case 'wait':                                     // fausses touches, puis le bouchon plonge
      if (P.nibbles > 0 && P.t > P.nextNib) {
        P.nibbles--; P.nextNib = P.t + 0.8 + Math.random() * 0.8; P.nib = 0.35;
        if (P.msgT <= 0) say('Ça goûte… pas encore !');
      }
      P.nib = Math.max(0, P.nib - dt);
      if (P.nibbles === 0 && P.t > Math.max(P.biteAt, P.nextNib - 0.4)) {
        P.phase = 'bite'; P.t = 0; P.splash++;
        setAct('Ferrer !', 'vite !', 'fi-strike'); say('Ça mord ! Ferre !', true);
      }
      break;
    case 'bite':
      if (P.t > T.BITE_WINDOW) lose('Trop tard, il s’est échappé');
      break;
    case 'fight': {                                  // tension du fil : moulinet contre le poisson
      const f = P.fish;
      P.nextSurge -= dt;
      if (P.nextSurge <= 0) { P.surge = 0.5 + Math.random() * 0.5; P.nextSurge = P.surge + 0.8 + Math.random() * (1.8 - f.pull * 0.5); P.splash++; }
      const surging = P.surge > 0;
      P.surge = Math.max(0, P.surge - dt);
      P.tension = Math.max(0, P.tension + (holding ? T.TENSION_UP + (surging ? f.pull * T.TENSION_SURGE : 0) : -T.TENSION_DOWN) * dt);
      P.dist = Math.min(CAST.max + 4, P.dist + ((surging ? f.pull * T.PULL_AWAY : 0) - (holding ? (surging ? T.REEL_SURGE : T.REEL) : 0)) * dt);
      if (P.tension >= 1) { lose('Crac ! Le fil a cassé'); break; }
      if (P.dist <= T.CATCH_AT) { caught(); break; }
      ui.gaugeI.style.height = Math.min(100, P.tension * 100) + '%';
      ui.gauge.classList.toggle('warn', P.tension > 0.55); ui.gauge.classList.toggle('danger', P.tension > 0.8);
      ui.dist.textContent = Math.max(0, P.dist).toFixed(1);
      if (P.msgT <= 0) say(P.tension > 0.8 ? 'Lâche ! Le fil va casser !' : surging ? 'Il tire fort !' : holding ? 'Mouline, mouline…' : 'Reprends quand le fil se détend', P.tension > 0.8);
      break;
    }
    case 'miss':
      if (P.t > 1.6) toIdle();
      break;
  }
}

/* =========================================================
   INTERFACE
   ========================================================= */
function buildUI() {
  host.layer.innerHTML = `
    <div class="tr-hud fi-hud">
      <span class="fi-chip fi-dist" hidden>🐟 <b class="fi-distv">0</b> m</span>
      <button type="button" class="fi-chip fi-carnet-btn">📖 Carnet <b class="fi-count">0/8</b></button>
      <span class="tr-board fi-board"></span>
    </div>
    <div class="fi-gauge" hidden aria-hidden="true"><b>Fil</b><i></i></div>
    <div class="fi-power" hidden aria-hidden="true"><i></i><em><span>près</span><span>loin</span></em></div>
    <div class="tr-panel tr-intro">
      <h2>Pêche au ponton</h2>
      <p><b>Lance</b> ta ligne : plus tu lances loin, plus les poissons sont gros (et rares). Quand le bouchon plonge, <b>ferre</b> vite ! S’il bouge juste un peu, le poisson goûte seulement.</p>
      <p>Ensuite, <b>mouline</b> pour ramener le poisson, mais lâche quand le fil devient rouge, sinon il casse.</p>
      <p class="tr-reward"></p>
      <p class="tr-keys">Un seul bouton, ou la barre <kbd>Espace</kbd>.</p>
      <button type="button" class="btn tr-go-btn">À la pêche ! 🎣</button>
    </div>
    <div class="tr-panel tr-result" hidden>
      <p class="fi-eyebrow"></p>
      <h2 class="tr-res-title"></h2>
      <div class="fi-catch"><canvas class="fi-portrait" width="192" height="192"></canvas><dl></dl></div>
      <p class="tr-gain"></p>
      <div class="tr-btns">
        <button type="button" class="btn ghost fi-open-carnet">Carnet</button>
        <button type="button" class="btn tr-again">Relancer</button>
      </div>
    </div>
    <div class="tr-panel fi-carnet" hidden>
      <h2>Carnet du pêcheur</h2>
      <p class="fi-trophy" hidden></p>
      <ul class="fi-list"></ul>
      <div class="tr-btns"><button type="button" class="btn fi-close">Retour à la pêche</button></div>
    </div>
    <div class="tr-panel bt-no3d" hidden>
      <h2>On ne peut pas pêcher ici</h2>
      <p>Cet appareil n’affiche pas la 3D (WebGL), et la pêche en a besoin. Le train, lui, marche aussi sans 3D.</p>
      <div class="tr-btns"><button type="button" class="btn tr-quit">Retour au village</button></div>
    </div>
    <p class="bt-loading">Tu t’installes au bout du ponton…</p>`;
  host.bottom.innerHTML = `<button type="button" class="tr-ctrl fi-act">Lancer<small>maintiens, puis lâche · Espace</small></button>`;

  const q = sel => host.layer.querySelector(sel) || host.bottom.querySelector(sel);
  ui = {
    hud: q('.fi-hud'), board: q('.fi-board'), distChip: q('.fi-dist'), dist: q('.fi-distv'), count: q('.fi-count'),
    gauge: q('.fi-gauge'), gaugeI: q('.fi-gauge i'), power: q('.fi-power'), powerI: q('.fi-power i'),
    intro: q('.tr-intro'), reward: q('.tr-reward'), go: q('.tr-go-btn'), result: q('.tr-result'), resEyebrow: q('.fi-eyebrow'),
    resTitle: q('.tr-res-title'), dl: q('.fi-catch dl'), portrait: q('.fi-portrait'), gain: q('.tr-gain'), again: q('.tr-again'),
    carnet: q('.fi-carnet'), list: q('.fi-list'), trophy: q('.fi-trophy'), no3d: q('.bt-no3d'), loading: q('.bt-loading'), act: q('.fi-act'),
  };
  ui.reward.innerHTML = host.opts.intro ? host.opts.intro() : '';
  ui.reward.hidden = !ui.reward.innerHTML;
  ui.go.disabled = true;                           // le départ attend la scène 3D
  ui.go.addEventListener('click', () => { ui.intro.hidden = true; toIdle(); });
  ui.again.addEventListener('click', () => { ui.result.hidden = true; toIdle(); });
  q('.fi-carnet-btn').addEventListener('click', openCarnet);
  q('.fi-open-carnet').addEventListener('click', () => { ui.result.hidden = true; openCarnet(); });
  q('.fi-close').addEventListener('click', () => { ui.carnet.hidden = true; if (P.phase === 'caught') toIdle(); });
  q('.tr-quit').addEventListener('click', () => host.close());
  // Le bouton unique : maintenir / lâcher
  const a = ui.act;
  a.addEventListener('pointerdown', e => { e.preventDefault(); a.setPointerCapture?.(e.pointerId); if (P.phase !== 'intro') press(); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) a.addEventListener(t, release);
  a.addEventListener('contextmenu', e => e.preventDefault());
  updateCount();
  say('Installe-toi au bout du ponton');
}

/** Espace / Entrée : le bouton de l'écran visible, sinon le bouton d'action */
function onKey(e) {
  if (e.code !== 'Space' && e.code !== 'Enter') return;
  e.preventDefault(); e.stopPropagation();
  if (e.type === 'keyup') { release(); return; }
  if (e.repeat) return;
  if (!ui.intro.hidden) { if (!ui.go.disabled) ui.go.click(); }
  else if (!ui.result.hidden) ui.again.click();
  else if (!ui.carnet.hidden) ui.carnet.querySelector('.fi-close').click();
  else if (P.phase !== 'intro') press();
}

function enable3d() {
  Fishing3D.load().then(() => {
    if (!host) return;
    const stage = host.layer.parentElement;
    Fishing3D.attach(stage);
    stage.querySelector('canvas:not(.mg-3d)').style.visibility = 'hidden';
    use3d = true;
    Fishing3D.reset(host.opts.shirt);
    ui.loading.hidden = true; ui.go.disabled = false; ui.go.focus();
  }).catch(() => {
    if (!host) return;
    ui.loading.hidden = true; ui.intro.hidden = true; ui.hud.hidden = true; ui.act.disabled = true; ui.no3d.hidden = false;
  });
}

/* =========================================================
   MODULE (contrat de js/minigames/host.js)
   ========================================================= */
export const FishingGame = {
  title: '🎣 Pêche au ponton',
  /** Lecture seule de la partie (tests automatiques) */
  get state() { return P; },
  get holding() { return holding; },
  press, release,

  mount(h) {
    host = h; holding = false;
    reset();
    buildUI();
    enable3d();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('blur', release);
  },
  frame(dt) { update(dt); if (use3d) Fishing3D.step(P, holding, dt); },
  render(ctx, W, H) { if (use3d && P && W > 1) Fishing3D.draw(P, holding, W, H); },
  unmount() {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKey, true);
    window.removeEventListener('blur', release);
    holding = false;
    Fishing3D.detach(); use3d = false;
    P = null; host = null;
  },
};
