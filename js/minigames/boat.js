/**
 * boat.js — mini-jeu « Route des Agrumes » : piloter le bateau de Sirop-sur-Mer jusqu'à Port-Agrumes.
 *
 * Même principe que le train : bouées de vitesse (sinon des caisses glissent à l'eau), puis on se
 * range le long du quai, pile au panneau QUAI. En plus : la barre (gauche / droite) pour éviter les
 * rochers des récifs. Jamais d'échec : on livre toujours.
 * Rendu 3D seulement (boat3d.js) ; sans WebGL, un message remplace la scène.
 *
 * Options reçues de l'hôte (voir js/minigames/index.js) :
 *   intro()      → texte HTML de la récompense, affiché avant le départ
 *   shirt        → couleur du t-shirt du joueur (le capitaine)
 *   onFinish(r)  → texte HTML de la récompense obtenue
 *
 * Résultat : { stars, criteria:{stop,cargo,time}, stopErrorM, crates, timeS }
 */

import { Boat3D } from './boat3d.js';

/* =========================================================
   RÉGLAGES (unités : mètres, secondes ; 1 m/s ≈ 1,94 nœud)
   ========================================================= */
const CFG = {
  ACCEL: 1.3, BRAKE: 1.9, DRAG: 0.22, VMAX: 13,   // m/s² et m/s (13 m/s ≈ 25 nœuds)
  STEER: 4.5,                                     // m/s de côté à pleine barre
  TOLERANCE: 2,                                   // nœuds tolérés au-dessus de la limite
  LOSS_INTERVAL: 1.2,                             // s d'excès de vitesse par caisse perdue
  CRATES: 12,
  TARGET_TIME: 125, STOP_PERFECT: 4, STOP_HOLD: 0.8,
};
const KN = 1.944;
/** Axe X = la route, Z = gauche (−) / droite (+) du capitaine */
const ROUTE = {
  segments: [
    { from: 0,   to: 100, limit: 10, color: '#d9efe6', label: 'Port' },
    { from: 100, to: 430, limit: 24, color: '#cfe8dc' },
    { from: 430, to: 630, limit: 14, color: '#f6e0b8', label: 'Récifs' },
    { from: 630, to: 820, limit: 8,  color: '#f5d0d4', label: 'Arrivée' },
  ],
  lane: 11,                                        // bouées rouges et vertes à ±11 m
  quay: [730, 800], stopAt: 765, quayZ: 9, end: 820, startX: 18,
};
const VIEW_KEY = 'siropcie_boat_view';
const VIEWS = ['chase', 'bridge', 'side'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Pseudo-aléatoire déterministe : le même parcours à chaque voyage */
const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const limitAt = m => (ROUTE.segments.find(s => m >= s.from && m < s.to) || ROUTE.segments.at(-1)).limit;
const nextSegment = m => ROUTE.segments.find(s => s.from > m);
/** Rochers des récifs, un côté puis l'autre, espacés pour laisser passer en slalom */
const ROCKS = [];
for (let x = 445, i = 0; x < 615; x += 27 + rnd(i) * 8, i++)
  ROCKS.push({ x, z: (i % 2 ? 1 : -1) * (1.5 + rnd(i + 30) * 6.5), r: 1.6 + rnd(i + 60) * 0.9 });

/* =========================================================
   ÉTAT
   ========================================================= */
let st = null;               // état de la partie en cours (lu par boat3d.js)
let host = null;             // { top, layer, bottom, opts, close, sfx }
let view = 'chase';
let use3d = false;
let flashT = 0;              // message d'incident affiché sur l'écran de bord
const held = { go: false, brake: false, left: false, right: false };
const ui = {};

function reset() {
  st = {
    x: ROUTE.startX, z: 0, v: 0, t: 0,
    throttle: 0, steer: 0, overRun: 0, hitCd: 0,
    crates: CFG.CRATES, hits: 0, lost: [],       // lost : 'rock' | 'speed', une entrée par caisse tombée
    stoppedFor: 0, running: false, done: false,
  };
  flashT = 0;
}

/* =========================================================
   SIMULATION
   ========================================================= */
function loseCrate(why) {
  if (st.crates <= 0) return;
  st.crates--; st.lost.push(why);
  host.sfx('clink');
  flash(why === 'rock' ? 'Aïe, un rocher ! Une caisse à l’eau' : 'Trop vite : une caisse glisse à l’eau');
}
function flash(msg) {
  ui.board.textContent = msg; ui.board.classList.add('hot'); flashT = 1.6;
}

function update(dt) {
  flashT -= dt;
  if (!st.running) return;
  let a = st.throttle > 0 ? CFG.ACCEL : st.throttle < 0 ? -CFG.BRAKE : 0;
  if (st.v > 0) a -= CFG.DRAG;
  st.v = clamp(st.v + a * dt, 0, CFG.VMAX);
  st.x += st.v * dt; st.t += dt;
  // La barre ne tourne que si le bateau avance ; on reste entre les bouées (et contre le quai à l'arrivée)
  const grip = Math.min(1, st.v / 3);
  st.z += st.steer * CFG.STEER * grip * dt;
  const maxZ = st.x > ROUTE.quay[0] - 25 ? ROUTE.quayZ - 2.1 : ROUTE.lane - 1.8;
  st.z = clamp(st.z, -ROUTE.lane + 1.8, maxZ);
  if (st.x >= ROUTE.end) { st.x = ROUTE.end; st.v = 0; }

  // Rocher touché : une caisse à l'eau et le bateau ralentit fort
  st.hitCd -= dt;
  for (const r of ROCKS) if (st.hitCd <= 0 && Math.abs(st.x - 1 - r.x) < 4.5 + r.r * 0.5 && Math.abs(st.z - r.z) < 1.1 + r.r) {
    st.hitCd = 1.5; st.v *= 0.35; st.hits++; host.sfx('bump'); loseCrate('rock'); break;
  }
  // Trop vite : une caisse glisse toutes les LOSS_INTERVAL secondes
  if (st.v * KN > limitAt(st.x) + CFG.TOLERANCE) { st.overRun += dt; if (st.overRun >= CFG.LOSS_INTERVAL) { st.overRun = 0; loseCrate('speed'); } }
  else st.overRun = Math.max(0, st.overRun - dt);

  // Amarré : arrêté le long du quai assez longtemps
  if (st.v < 0.05 && st.x > ROUTE.quay[0] - 30) {
    if (st.z > ROUTE.quayZ - 4.5) { st.stoppedFor += dt; if (st.stoppedFor >= CFG.STOP_HOLD) finish(); }
    else if (flashT <= 0) flash('Approche-toi du quai, à droite ▶');
  } else st.stoppedFor = 0;
}

function finish() {
  st.running = false; st.done = true;
  releaseAll();
  const err = st.x - ROUTE.stopAt;            // > 0 : dépassé, < 0 : trop tôt
  const criteria = { stop: Math.abs(err) <= CFG.STOP_PERFECT, cargo: st.crates >= CFG.CRATES - 2, time: st.t <= CFG.TARGET_TIME };
  const r = { stars: Object.values(criteria).filter(Boolean).length, criteria, stopErrorM: +err.toFixed(1), crates: st.crates, timeS: +st.t.toFixed(1) };
  host.sfx('horn');
  showResult(r, host.opts.onFinish ? host.opts.onFinish(r) : '');
}

/* =========================================================
   INTERFACE
   ========================================================= */
function boardText() {
  const d = ROUTE.stopAt - st.x, nx = nextSegment(st.x);
  if (d < -0.5) return `Quai dépassé de ${(-d).toFixed(1)} m`;
  if (d < 25) return `Quai dans ${d.toFixed(1)} m`;
  if (d < 160) return `Port-Agrumes dans ${Math.round(d)} m`;
  if (st.x > 400 && st.x < 630) return 'Récifs : tourne pour éviter les rochers !';
  if (nx && nx.from - st.x < 80) return `Bientôt ${nx.limit} nœuds`;
  return `Limite ${limitAt(st.x)} nœuds`;
}

function buildUI() {
  host.top.innerHTML = `
    <span class="tr-views" role="group" aria-label="Point de vue (V)">
      <button type="button" class="tr-view" data-view="chase">Poursuite</button>
      <button type="button" class="tr-view" data-view="bridge">Pont</button>
      <button type="button" class="tr-view" data-view="side">Côté</button>
    </span>`;
  host.top.querySelectorAll('.tr-view').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

  host.layer.innerHTML = `
    <div class="tr-hud">
      <span class="tr-speed"><b class="tr-kmh">0</b> nœuds</span>
      <span class="tr-limit">10</span>
      <span class="tr-bottles bt-crates"></span>
      <span class="tr-board"></span>
    </div>
    <div class="tr-panel tr-intro">
      <h2>Emmène le sirop à Port-Agrumes</h2>
      <p>Respecte les bouées jaunes de vitesse, sinon des caisses glissent à l’eau. Dans les récifs, tourne pour éviter les rochers. À l’arrivée, range-toi le long du quai, à droite, pile au panneau <b>QUAI</b>.</p>
      <p class="tr-reward"></p>
      <p class="tr-keys">Maintiens les boutons. Clavier : <kbd>↑</kbd> avancer, <kbd>↓</kbd> ralentir, <kbd>←</kbd> <kbd>→</kbd> tourner, <kbd>V</kbd> point de vue.</p>
      <button type="button" class="btn tr-go-btn">Larguer les amarres ! ⛵</button>
    </div>
    <div class="tr-panel tr-result" hidden>
      <h2 class="tr-res-title"></h2>
      <div class="tr-stars" aria-hidden="true"><span>★</span><span>★</span><span>★</span></div>
      <ul class="tr-crit"></ul>
      <p class="tr-gain"></p>
      <div class="tr-btns">
        <button type="button" class="btn ghost tr-quit">Retour au village</button>
        <button type="button" class="btn tr-again">Rejouer</button>
      </div>
    </div>
    <div class="tr-panel bt-no3d" hidden>
      <h2>Le bateau ne peut pas partir</h2>
      <p>Cet appareil n’affiche pas la 3D (WebGL), et le bateau en a besoin. Le train, lui, marche aussi sans 3D.</p>
      <div class="tr-btns"><button type="button" class="btn tr-quit">Retour au village</button></div>
    </div>
    <p class="bt-loading">Le bateau arrive au port…</p>`;
  host.bottom.innerHTML = `
    <div class="tr-strip" aria-hidden="true"></div>
    <div class="tr-ctrls bt-ctrls">
      <button type="button" class="tr-ctrl bt-turn bt-left" aria-label="Tourner à gauche">◀<small>gauche</small></button>
      <button type="button" class="tr-ctrl tr-brake">Ralentir<small>↓</small></button>
      <button type="button" class="tr-ctrl tr-gas">Avancer<small>↑</small></button>
      <button type="button" class="tr-ctrl bt-turn bt-right" aria-label="Tourner à droite">▶<small>droite</small></button>
    </div>`;

  const q = sel => host.layer.querySelector(sel) || host.bottom.querySelector(sel);
  Object.assign(ui, {
    hud: q('.tr-hud'), kn: q('.tr-kmh'), limit: q('.tr-limit'), crates: q('.bt-crates'), board: q('.tr-board'),
    intro: q('.tr-intro'), reward: q('.tr-reward'), result: q('.tr-result'), no3d: q('.bt-no3d'), loading: q('.bt-loading'),
    resTitle: q('.tr-res-title'), stars: q('.tr-stars'), crit: q('.tr-crit'), gain: q('.tr-gain'), strip: q('.tr-strip'),
    go: q('.tr-gas'), brake: q('.tr-brake'), left: q('.bt-left'), right: q('.bt-right'), goBtn: q('.tr-go-btn'),
  });
  ui.crates.innerHTML = '<i></i>'.repeat(CFG.CRATES);

  // Frise de la route : un bloc par zone, largeur proportionnelle
  for (const s of ROUTE.segments) {
    const d = document.createElement('div');
    d.className = 'tr-seg'; d.style.flex = `${s.to - s.from} 1 0`; d.style.background = s.color; d.textContent = s.limit;
    ui.strip.append(d);
  }
  const stop = document.createElement('div');
  stop.className = 'tr-stop'; stop.style.left = (ROUTE.stopAt / ROUTE.end * 100) + '%';
  ui.mark = document.createElement('div'); ui.mark.className = 'tr-mark';
  ui.strip.append(stop, ui.mark);

  ui.reward.innerHTML = host.opts.intro ? host.opts.intro() : '';
  ui.goBtn.disabled = true;                        // le départ attend la scène 3D
  ui.goBtn.addEventListener('click', start);
  q('.tr-again').addEventListener('click', again);
  host.layer.querySelectorAll('.tr-quit').forEach(b => b.addEventListener('click', () => host.close()));
  for (const k of ['go', 'brake', 'left', 'right']) bindHold(ui[k], k);
}

function setView(v) {
  view = VIEWS.includes(v) ? v : 'chase';
  host.top.querySelectorAll('.tr-view').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  Boat3D.snap();
  try { localStorage.setItem(VIEW_KEY, view); } catch (e) { /* stockage indisponible */ }
}
const nextView = () => setView(VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length]);

/** Charge la 3D ; sans WebGL, on explique pourquoi le bateau ne part pas */
function enable3d() {
  Boat3D.load({ CFG, ROUTE, ROCKS, rnd }).then(() => {
    if (!host) return;                             // mini-jeu déjà refermé
    const stage = host.layer.parentElement;
    Boat3D.attach(stage);
    stage.querySelector('canvas:not(.mg-3d)').style.visibility = 'hidden';
    use3d = true;
    Boat3D.reset(st, host.opts.shirt);
    ui.loading.hidden = true; ui.goBtn.disabled = false; ui.goBtn.focus();
  }).catch(() => {
    if (!host) return;
    ui.loading.hidden = true; ui.intro.hidden = true; ui.hud.hidden = true; ui.no3d.hidden = false;
  });
}

function start() {
  if (!use3d) return;
  releaseAll();
  ui.intro.hidden = true; ui.result.hidden = true;
  st.running = true;
  host.sfx('horn');
}
function again() {
  reset(); Boat3D.reset(st, host.opts.shirt);
  ui.result.hidden = true; ui.intro.hidden = false;
  ui.reward.innerHTML = host.opts.intro ? host.opts.intro() : '';
  ui.goBtn.focus();
}

function showResult(r, gainHtml) {
  const titles = ['Bienvenue à Port-Agrumes !', 'Bonne traversée !', 'Super capitaine !', 'Traversée parfaite !'];
  ui.resTitle.textContent = titles[r.stars];
  [...ui.stars.children].forEach((s, i) => s.classList.toggle('on', i < r.stars));
  const where = Math.abs(r.stopErrorM) < 0.5 ? 'pile au panneau' : `${Math.abs(r.stopErrorM).toFixed(1)} m ${r.stopErrorM > 0 ? 'après' : 'avant'}`;
  const rows = [
    [r.criteria.stop,  'Amarré au quai',  where],
    [r.criteria.cargo, 'Caisses livrées', `${r.crates}/${CFG.CRATES}`],
    [r.criteria.time,  'À l’heure',       `${r.timeS.toFixed(1)} s / ${CFG.TARGET_TIME} s`],
  ];
  ui.crit.innerHTML = rows.map(([ok, label, val]) =>
    `<li><span class="tr-dot ${ok ? 'ok' : ''}">${ok ? '✓' : ''}</span><span>${label}</span><b>${val}</b></li>`).join('');
  ui.gain.innerHTML = gainHtml || '';
  // Un court temps pour voir le bateau à quai et les habitants qui font coucou
  setTimeout(() => { if (st && st.done) { ui.result.hidden = false; ui.result.querySelector('.tr-again').focus(); } }, 700);
}

/** HUD (écrit seulement si la valeur change) */
function updateDOM() {
  const kn = Math.round(st.v * KN), lim = limitAt(st.x), over = st.v * KN > lim + CFG.TOLERANCE;
  if (ui.kn.textContent !== String(kn)) ui.kn.textContent = kn;
  if (ui.limit.textContent !== String(lim)) ui.limit.textContent = lim;
  if (flashT <= 0) {
    const txt = boardText(), d = ROUTE.stopAt - st.x;
    if (ui.board.textContent !== txt) ui.board.textContent = txt;
    ui.board.classList.toggle('hot', d >= -0.5 && Math.abs(d) <= CFG.STOP_PERFECT);
  }
  ui.hud.classList.toggle('over', over && st.running);
  [...ui.crates.children].forEach((b, i) => b.classList.toggle('lost', i >= st.crates));
  ui.mark.style.left = (st.x / ROUTE.end * 100) + '%';
}

/* ---- commandes : boutons maintenus + clavier ---- */
function applyInput() {
  st.throttle = st.running ? (held.brake ? -1 : held.go ? 1 : 0) : 0;   // ralentir a priorité
  st.steer = st.running ? (held.right ? 1 : 0) - (held.left ? 1 : 0) : 0;
  for (const k of ['go', 'brake', 'left', 'right']) ui[k].classList.toggle('held', held[k]);
}
function releaseAll() { for (const k in held) held[k] = false; if (st && ui.go) applyInput(); }
function bindHold(btn, key) {
  btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); held[key] = true; applyInput(); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(t, () => { held[key] = false; applyInput(); });
  btn.addEventListener('contextmenu', e => e.preventDefault());
}
const KEYS = { ArrowUp: 'go', KeyW: 'go', ArrowDown: 'brake', KeyS: 'brake', Space: 'brake', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
function onKey(e) {
  if (e.code === 'KeyV' && e.type === 'keydown' && !e.repeat) { e.preventDefault(); return nextView(); }
  const k = KEYS[e.code];
  if (!k) {
    if (e.type === 'keydown' && e.code === 'Enter' && !e.repeat && !st.running) {   // Entrée : partir / rejouer
      e.preventDefault();
      if (!ui.intro.hidden) start(); else if (!ui.result.hidden) again();
    }
    return;
  }
  e.preventDefault(); e.stopPropagation();
  held[k] = e.type === 'keydown';
  applyInput();
}

/* =========================================================
   MODULE (contrat de js/minigames/host.js)
   ========================================================= */
export const BoatDrive = {
  title: '⛵ Route des Agrumes',
  /** Lecture seule de la partie en cours et du parcours (tests automatiques) */
  get state() { return st; },
  route: { CFG, ROUTE, ROCKS, KN, limitAt, nextSegment },

  mount(h) {
    host = h;
    reset();
    buildUI();
    let saved = null;
    try { saved = localStorage.getItem(VIEW_KEY); } catch (e) { /* */ }
    setView(saved || 'chase');
    enable3d();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('blur', releaseAll);
  },
  frame(dt) { update(dt); updateDOM(); if (use3d) Boat3D.step(st, dt); },
  render(ctx, W, H) { if (use3d && st && W > 1) Boat3D.draw(st, view, W, H); },
  unmount() {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKey, true);
    window.removeEventListener('blur', releaseAll);
    for (const k in held) held[k] = false;
    Boat3D.detach(); use3d = false;
    st = null; host = null;
  },
};
