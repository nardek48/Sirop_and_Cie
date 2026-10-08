/**
 * train.js — mini-jeu « Ligne des Fraises » : conduire le train jusqu'à la Gare des Fraises.
 *
 * Maintenir Accélérer / Freiner, respecter les panneaux de vitesse (sinon des bouteilles
 * tombent du wagon) et arrêter la loco pile au panneau STOP. Deux points de vue :
 * la cabine (perspective) et l'extérieur (vue de côté). Jamais d'échec : on livre toujours.
 *
 * Options reçues de l'hôte (voir js/minigames/index.js) :
 *   intro()      → texte HTML de la récompense, affiché avant le départ
 *   onFinish(r)  → texte HTML de la récompense obtenue (r = résultat ci-dessous)
 *
 * Résultat : { stars, criteria:{stop,cargo,time}, stopErrorM, bottles, timeS, overSpeedS }
 */

/* =========================================================
   RÉGLAGES (unités : mètres, secondes)
   ========================================================= */
const CFG = {
  PX_PER_M: 8,          // échelle de la vue de côté
  ACCEL: 1.9,           // m/s² en accélération
  BRAKE: 3.8,           // m/s² au freinage
  DRAG: 0.15,           // m/s² de frottement naturel
  VMAX: 25,             // m/s (90 km/h)
  TOLERANCE_KMH: 3,     // marge avant de compter un excès
  LOSS_INTERVAL: 1.2,   // s d'excès continu par bouteille perdue
  BOTTLES: 12,
  TARGET_TIME: 65,      // s pour l'étoile « Horaire »
  STOP_PERFECT_M: 3,    // m pour l'étoile « Arrêt »
  STOP_HOLD: 0.8,       // s à l'arrêt avant de valider l'arrivée
};

/** Tracé de la ligne : tronçons à vitesse limitée + décor */
const LINE = {
  name: 'Gare des Fraises',
  segments: [
    { from: 0,   to: 180, limit: 60, color: '#d9efe6' },
    { from: 180, to: 360, limit: 40, color: '#f6e0b8', label: 'Pont' },
    { from: 360, to: 620, limit: 80, color: '#cfe8dc' },
    { from: 620, to: 830, limit: 30, color: '#f5d0d4', label: 'Approche' },
  ],
  bridge:   [205, 335],   // rivière sous la voie
  platform: [728, 792],   // quai
  stopAt:   760,          // panneau STOP
  end:      830,          // butoir
  startX:   24,           // position de départ de l'avant de la loco
};

const FONT = "'DM Sans', system-ui, sans-serif";
const VIEW_KEY = 'siropcie_train_view';

/* =========================================================
   OUTILS
   ========================================================= */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Pseudo-aléatoire déterministe : le décor est le même à chaque voyage */
const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const limitAt = m => (LINE.segments.find(s => m >= s.from && m < s.to) || LINE.segments.at(-1)).limit;
const nextSegment = m => LINE.segments.find(s => s.from > m);

/* =========================================================
   ÉTAT
   ========================================================= */
let st = null;               // état de la partie en cours
let host = null;             // { top, layer, bottom, opts, close, sfx }
let ctx = null, W = 0, H = 0;
let view = 'cab';            // 'cab' (cabine) ou 'side' (extérieur)
let shake = 0, leverPos = 0;
const particles = [];        // fumée + bouteilles qui tombent (coordonnées monde)
const held = { go: false, brake: false };
const ui = {};               // éléments du DOM

function reset() {
  st = {
    x: LINE.startX, v: 0, t: 0,
    throttle: 0,             // −1 frein, 0 neutre, +1 accélérateur
    overTotal: 0, overRun: 0,
    bottles: CFG.BOTTLES,
    stoppedFor: 0,
    running: false, done: false,
  };
  particles.length = 0;
  shake = 0;
}

/* =========================================================
   SIMULATION
   ========================================================= */
function loseBottle() {
  st.bottles--;
  host.sfx('clink');
  particles.push({ kind: 'bottle', x: st.x - 19 + (Math.random() * 4 - 2), y: 4.2, vx: -1 - Math.random() * 2, vy: 4, rot: 0, vr: (Math.random() - .5) * 10, life: 1.6 });
}

function update(dt) {
  // Particules : vivent même à l'arrêt (le décor reste animé)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.kind === 'smoke') { p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 1.4; }
    else { p.vy -= 14 * dt; p.x += p.vx * dt; p.y = Math.max(-1.2, p.y + p.vy * dt); p.rot += p.vr * dt; }
    if (p.life <= 0) particles.splice(i, 1);
  }
  shake = Math.max(0, shake - dt * 3);
  if (!st.running) return;

  // Physique simple
  let a = st.throttle > 0 ? CFG.ACCEL : st.throttle < 0 ? -CFG.BRAKE : 0;
  if (st.v > 0) a -= CFG.DRAG;
  st.v = clamp(st.v + a * dt, 0, CFG.VMAX);
  st.x += st.v * dt;
  st.t += dt;

  // Butoir : arrêt net (pas d'échec, juste une secousse)
  if (st.x >= LINE.end) { st.x = LINE.end; if (st.v > 2) { shake = 1; host.sfx('bump'); } st.v = 0; }

  // Excès de vitesse → une bouteille tombe toutes les LOSS_INTERVAL secondes
  if (st.v * 3.6 > limitAt(st.x) + CFG.TOLERANCE_KMH) {
    st.overTotal += dt; st.overRun += dt;
    if (st.overRun >= CFG.LOSS_INTERVAL && st.bottles > 0) { st.overRun = 0; loseBottle(); }
  } else st.overRun = Math.max(0, st.overRun - dt);

  // Fumée : plus dense quand on accélère
  const rate = st.throttle > 0 ? 14 : st.v > 0.5 ? 4 : 1.2;
  if (Math.random() < rate * dt) particles.push({ kind: 'smoke', x: st.x - 2.6, y: 6.4, vx: -0.6 - st.v * 0.25, vy: 1.4, r: 0.6, life: 1.8 });

  // Arrivée : arrêté assez longtemps près du quai
  if (st.v === 0 && st.x > LINE.platform[0] - 40) {
    st.stoppedFor += dt;
    if (st.stoppedFor >= CFG.STOP_HOLD) finish();
  } else st.stoppedFor = 0;
}

function finish() {
  st.running = false; st.done = true; st.throttle = 0;
  const err = st.x - LINE.stopAt;            // > 0 : dépassé, < 0 : trop tôt
  const criteria = {
    stop:  Math.abs(err) <= CFG.STOP_PERFECT_M,
    cargo: st.bottles >= CFG.BOTTLES - 2,
    time:  st.t <= CFG.TARGET_TIME,
  };
  const r = {
    stars: Object.values(criteria).filter(Boolean).length, criteria,
    stopErrorM: +err.toFixed(1), bottles: st.bottles, timeS: +st.t.toFixed(1), overSpeedS: +st.overTotal.toFixed(1),
  };
  host.sfx('whistle');
  showResult(r, host.opts.onFinish ? host.opts.onFinish(r) : '');
}

/* =========================================================
   RENDU — dispatch selon le point de vue
   ========================================================= */
function render(c, w, h) {
  ctx = c; W = w; H = h;
  if (!st || W < 2) return;
  if (view === 'cab') renderCab(); else renderSide();
}

/* ---------------------------------------------------------
   VUE CABINE — perspective simple : un point à d mètres devant,
   décalé de `side` m et à `h` m de haut, se projette en
   (cx + side·f/d, horizon + (œil − h)·f/d)
   --------------------------------------------------------- */
function renderCab() {
  const s = st;
  const DMIN = 2.5, DMAX = 240, EYE = 3.0;   // m
  const f = Math.min(W, H * 1.9) * 0.8;      // focale (px) ; bornée sur écran en hauteur
  const dashTop = Math.round(H * 0.76);       // haut du tableau de bord
  const bob = s.v > 0.3 ? Math.sin(performance.now() / 85) * 1.8 * (s.v / CFG.VMAX) : 0;
  const jolt = shake ? (Math.random() - .5) * 14 * shake : 0;
  const hz = Math.round(H * 0.38) + bob + jolt;
  const cx = W / 2;
  // Courbe douce : décalage latéral du centre de la voie à d mètres
  const bend = d => 0.0011 * Math.sin((s.x + d * 0.5) / 75) * d * d;
  const P3 = (d, side, h = 0) => { const k = f / d; return [cx + (bend(d) + side) * k, hz + (EYE - h) * k]; };
  const poly = (pts, color) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
  };
  // Bande au sol entre d0 et d1, de la position latérale a à b
  const band = (d0, d1, a, b, color, h = 0) => {
    d0 = Math.max(d0, DMIN); if (d1 <= d0 || d0 > DMAX) return;
    poly([P3(d1, a, h), P3(d1, b, h), P3(d0, b, h), P3(d0, a, h)], color);
  };
  const [b0, b1] = LINE.bridge, [p0, p1] = LINE.platform;

  // Ciel, soleil, nuages
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#8fcbe6'); sky.addColorStop(1, '#e4f3ea');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 2);
  ctx.fillStyle = '#ffe9a3'; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.12, H * 0.06, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  const span = W + 240;
  for (let i = 0; i < 5; i++) {
    const x = (((i * W / 2.6 + rnd(i) * 120 - s.x * 0.5) % span) + span) % span - 120;
    cloud(x, H * (0.07 + rnd(i + 4) * 0.16), 0.6 + rnd(i + 7) * 0.5);
  }

  // Collines à l'horizon (elles glissent avec la courbe)
  const hShift = bend(DMAX) * f / DMAX;
  const hillLayer = (amp, freq, color, par, lift) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, hz + 2);
    for (let x = 0; x <= W + 8; x += 8) {
      const w = x - hShift + s.x * par;
      ctx.lineTo(x, hz - lift - Math.sin(w * freq) * amp - Math.sin(w * freq * 2.3 + 1) * amp * 0.45);
    }
    ctx.lineTo(W, hz + 2); ctx.closePath(); ctx.fill();
  };
  hillLayer(H * 0.03, 0.007, '#b9dcc4', 0.2, H * 0.05);
  hillLayer(H * 0.018, 0.016, '#9ccfab', 0.5, H * 0.015);

  // Sol en tranches : bandes alternées = sensation de vitesse
  ctx.fillStyle = '#8cc58f'; ctx.fillRect(0, hz, W, H - hz);
  const ds = []; for (let d = DMIN; d < DMAX; d *= 1.06) ds.push(d); ds.push(DMAX);
  for (let i = ds.length - 2; i >= 0; i--) {
    const d0 = ds[i], d1 = ds[i + 1], m = s.x + (d0 + d1) / 2, alt = Math.floor(m / 5) % 2;
    const onBridge = m > b0 && m < b1;
    band(d0, d1, -90, 90, onBridge ? (alt ? '#6fb4d6' : '#79bddc') : (alt ? '#8cc58f' : '#83bc86'));
    band(d0, d1, -1.8, 1.8, onBridge ? '#8a6a52' : (alt ? '#b9a48c' : '#ae9880'));
  }

  // Traverses (de loin vers près)
  for (let m = Math.floor((s.x + 90) / 1.5) * 1.5; m > s.x + DMIN; m -= 1.5) band(m - s.x, m - s.x + 0.3, -1.3, 1.3, '#6b4a35');
  // Zone d'arrêt parfait + ligne jaune du STOP
  band(LINE.stopAt - CFG.STOP_PERFECT_M - s.x, LINE.stopAt + CFG.STOP_PERFECT_M - s.x, -1.8, 1.8, 'rgba(47,158,122,.5)');
  band(LINE.stopAt - s.x - 0.25, LINE.stopAt - s.x + 0.25, -1.8, 1.8, '#f2c84b');

  // Rails
  ctx.strokeStyle = '#7b828e'; ctx.lineCap = 'round';
  for (const side of [-0.75, 0.75]) {
    for (let i = 0; i < ds.length - 1; i++) {
      const a = P3(ds[i], side), b = P3(ds[i + 1], side);
      ctx.lineWidth = Math.max(1, 0.09 * f / ds[i]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }

  // Quai (côté droit)
  const q0 = p0 - s.x, q1 = p1 - s.x;
  if (q1 > DMIN && q0 < DMAX) {
    const d0 = Math.max(q0, DMIN);
    poly([P3(q1, 1.9, 1), P3(d0, 1.9, 1), P3(d0, 1.9, 0), P3(q1, 1.9, 0)], '#a8977f');   // bord du quai
    band(q0, q1, 1.9, 6.5, '#c9b8a3', 1);
    band(q0, q1, 1.9, 2.2, '#f2c84b', 1);
  }

  // Objets en relief, triés du plus loin au plus près
  const objs = [];
  for (let k = Math.floor(s.x / 7); k <= Math.floor((s.x + DMAX) / 7); k++) {     // arbres et fraisiers
    const m = k * 7 + rnd(k) * 5, d = m - s.x;
    if (d < DMIN || d > DMAX) continue;
    const side = (rnd(k + 1) < 0.5 ? -1 : 1) * (4.5 + rnd(k + 2) * 16);
    if (m > b0 - 4 && m < b1 + 4) continue;                       // rien sur la rivière
    if (side > 0 && m > p0 - 10 && m < p1 + 45) continue;          // place pour la gare
    const isTree = rnd(k + 3) < 0.4;
    objs.push({ d, draw: () => (isTree ? cabTree(P3, d, side, f) : cabBush(P3, d, side, f, k)) });
  }
  for (let m = Math.ceil(b0 / 3) * 3; m <= b1; m += 3) {          // garde-corps du pont
    const d = m - s.x; if (d < DMIN || d > DMAX) continue;
    for (const side of [-2.3, 2.3]) objs.push({ d, draw: () => {
      const a = P3(d, side, 0), t = P3(d, side, 1.1), n = P3(Math.max(DMIN, d - 3), side, 1.1);
      ctx.strokeStyle = '#6b4a35'; ctx.lineWidth = Math.max(1, 0.12 * f / d);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(t[0], t[1]); ctx.stroke();
      if (m > b0) { ctx.lineWidth = Math.max(1, 0.08 * f / d); ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(n[0], n[1]); ctx.stroke(); }
    } });
  }
  for (const seg of LINE.segments) {                               // panneaux de limite
    const d = seg.from + 6 - s.x; if (d < DMIN || d > DMAX) continue;
    objs.push({ d, draw: () => cabSign(P3, d, 2.6, f, String(seg.limit), 'round') });
  }
  for (const r of [20, 10, 5]) {                                   // repères avant le STOP
    const d = LINE.stopAt - r - s.x; if (d < DMIN || d > DMAX) continue;
    objs.push({ d, draw: () => cabSign(P3, d, 2.6, f, String(r), 'square') });
  }
  { const d = LINE.stopAt - s.x; if (d >= DMIN && d < DMAX) objs.push({ d, draw: () => cabSign(P3, d, 2.6, f, 'STOP', 'stop') }); }
  { const g0 = p0 + 12 - s.x, g1 = p0 + 42 - s.x;                  // bâtiment de la gare
    if (g1 > DMIN && g0 < DMAX) objs.push({ d: g1, draw: () => {
      const d0 = Math.max(g0, DMIN), X = 8.5, Hh = 4.5;
      poly([P3(g1, X, Hh), P3(d0, X, Hh), P3(d0, X, 0), P3(g1, X, 0)], '#f6e3c9');
      poly([P3(g1, X - 0.6, Hh), P3(d0, X - 0.6, Hh), P3(d0, X + 2, Hh + 2), P3(g1, X + 2, Hh + 2)], '#d63a4f');
      for (let w = 0; w < 4; w++) {
        const wa = g0 + 3 + w * 7, wb = wa + 3;
        if (wa > DMIN) poly([P3(wb, X, 3.4), P3(wa, X, 3.4), P3(wa, X, 1.6), P3(wb, X, 1.6)], '#9fd3ea');
      }
      const dm = Math.max((d0 + g1) / 2, DMIN + 2), [tx, ty] = P3(dm, X, 4.0), fs = Math.max(6, 0.55 * f / dm);
      ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(LINE.name).width;
      ctx.fillStyle = '#fffaf2'; ctx.fillRect(tx - tw / 2 - fs * .4, ty - fs * .7, tw + fs * .8, fs * 1.4);
      ctx.fillStyle = '#2a2433'; ctx.fillText(LINE.name, tx, ty);
    } });
  }
  { const d = LINE.end + 0.6 - s.x; if (d >= DMIN && d < DMAX) objs.push({ d, draw: () => {   // butoir
      poly([P3(d, -1.3, 1.1), P3(d, 1.3, 1.1), P3(d, 1.3, 0), P3(d, -1.3, 0)], '#d63a4f');
      poly([P3(d, -1.3, 0.7), P3(d, 1.3, 0.7), P3(d, 1.3, 0.5), P3(d, -1.3, 0.5)], '#ffffff');
    } }); }
  objs.sort((a, b) => b.d - a.d).forEach(o => o.draw());

  // Chaudière vue depuis la cabine
  const bw0 = W * 0.38, bw1 = W * 0.2, bTop = dashTop - H * 0.1;
  ctx.fillStyle = '#d63a4f'; ctx.beginPath();
  ctx.moveTo(cx - bw0 / 2, dashTop + 2); ctx.lineTo(cx - bw1 / 2, bTop);
  ctx.quadraticCurveTo(cx, bTop - H * 0.035, cx + bw1 / 2, bTop); ctx.lineTo(cx + bw0 / 2, dashTop + 2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2f9e7a'; ctx.fillRect(cx - bw0 * 0.36, dashTop - H * 0.04, bw0 * 0.72, H * 0.012);
  ctx.fillStyle = '#c99a17'; ctx.beginPath(); ctx.ellipse(cx, bTop + H * 0.035, W * 0.03, H * 0.022, 0, 0, 7); ctx.fill();   // dôme
  ctx.fillStyle = '#2a2433';
  ctx.fillRect(cx - W * 0.022, bTop - H * 0.075, W * 0.044, H * 0.07);                // cheminée
  ctx.fillRect(cx - W * 0.032, bTop - H * 0.09, W * 0.064, H * 0.02);
  for (const p of particles) if (p.kind === 'smoke') {                                // fumée
    const age = 1.8 - p.life;
    ctx.fillStyle = `rgba(255,255,255,${clamp(p.life / 1.8, 0, 1) * 0.7})`;
    ctx.beginPath(); ctx.arc(cx + Math.sin(age * 3 + p.x) * W * 0.01, bTop - H * 0.09 - age * H * 0.2, (0.025 + age * 0.035) * H, 0, 7); ctx.fill();
  }

  // Cadre de la cabine + reflet sur la vitre
  poly([[0, 0], [W * 0.065, 0], [W * 0.095, dashTop], [0, dashTop]], '#7a2232');
  poly([[W, 0], [W * 0.935, 0], [W * 0.905, dashTop], [W, dashTop]], '#7a2232');
  ctx.fillStyle = '#7a2232'; ctx.fillRect(0, 0, W, H * 0.045);
  poly([[W * 0.2, H * 0.045], [W * 0.32, H * 0.045], [W * 0.18, dashTop], [W * 0.1, dashTop]], 'rgba(255,255,255,.07)');

  // Tableau de bord
  const dash = ctx.createLinearGradient(0, dashTop, 0, H);
  dash.addColorStop(0, '#7b5a43'); dash.addColorStop(1, '#4f382a');
  ctx.fillStyle = dash; ctx.fillRect(0, dashTop, W, H - dashTop);
  ctx.fillStyle = '#9b7656'; ctx.fillRect(0, dashTop, W, 4);
  const dh = H - dashTop;
  cabDial(W * 0.2, dashTop + dh * 0.53, Math.min(dh * 0.42, W * 0.11));        // le cadran tient dans le tableau de bord
  cabScreen(cx, dashTop + dh * 0.52, Math.min(W * 0.36, 280), dh * 0.62);
  cabLever(W * 0.82, dashTop, dh);

  // Alerte : bouteille perdue (le wagon n'est pas visible depuis la cabine)
  if (particles.some(p => p.kind === 'bottle' && p.life > 0.5)) {
    const msg = 'Oups ! Une bouteille est tombée du wagon';
    ctx.font = `700 ${Math.max(13, Math.min(22, H * 0.04))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = Math.min(ctx.measureText(msg).width, W - 60);
    ctx.fillStyle = 'rgba(214,58,79,.92)'; ctx.beginPath(); ctx.roundRect(cx - tw / 2 - 14, H * 0.08, tw + 28, H * 0.075, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(msg, cx, H * 0.08 + H * 0.0375, W - 60);
  }
}

/* ---- éléments de la vue cabine ---- */
function cloud(x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 16 * s, 0, 7); ctx.arc(x + 18 * s, y - 8 * s, 20 * s, 0, 7); ctx.arc(x + 40 * s, y, 15 * s, 0, 7);
  ctx.fill();
}
function cabTree(P3, d, side, f) {
  const k = f / d, [x, y] = P3(d, side, 0);
  if (x < -4 * k || x > W + 4 * k) return;
  ctx.fillStyle = '#7b5a43'; ctx.fillRect(x - 0.25 * k, y - 3 * k, 0.5 * k, 3 * k);
  ctx.fillStyle = '#5aa86d'; ctx.beginPath();
  ctx.arc(x, y - 4.6 * k, 2 * k, 0, 7); ctx.arc(x - 1.3 * k, y - 3.5 * k, 1.4 * k, 0, 7); ctx.arc(x + 1.3 * k, y - 3.5 * k, 1.4 * k, 0, 7);
  ctx.fill();
}
function cabBush(P3, d, side, f, seed) {
  const k = f / d, [x, y] = P3(d, side, 0);
  if (x < -3 * k || x > W + 3 * k) return;
  ctx.fillStyle = '#4f9a62'; ctx.beginPath();
  ctx.arc(x - 0.8 * k, y - 0.6 * k, 0.8 * k, 0, 7); ctx.arc(x, y - 0.9 * k, 0.9 * k, 0, 7); ctx.arc(x + 0.8 * k, y - 0.6 * k, 0.75 * k, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#d63a4f';                                   // fraises
  for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(x + (rnd(seed * 7 + j) - .5) * 1.8 * k, y - (0.4 + rnd(seed * 3 + j) * 0.9) * k, Math.max(1, 0.13 * k), 0, 7); ctx.fill(); }
}
/** Panneau au bord de la voie : 'round' (limite), 'square' (repère de distance), 'stop' */
function cabSign(P3, d, side, f, label, kind) {
  const k = f / d, [x, y] = P3(d, side, 0), top = P3(d, side, 2.3)[1];
  if (x > W + 2 * k) return;
  ctx.fillStyle = '#5b5560'; ctx.fillRect(x - Math.max(1, 0.06 * k), top, Math.max(2, 0.12 * k), y - top);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (kind === 'round') {
    const cy = P3(d, side, 2.75)[1], r = 0.5 * k;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d63a4f'; ctx.lineWidth = Math.max(1.5, 0.14 * k);
    ctx.beginPath(); ctx.arc(x, cy, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a2433'; ctx.font = `700 ${Math.max(5, 0.48 * k)}px ${FONT}`; ctx.fillText(label, x, cy + 0.03 * k);
  } else if (kind === 'square') {
    const cy = P3(d, side, 2.6)[1], s2 = 0.36 * k;
    ctx.fillStyle = '#fffaf2'; ctx.fillRect(x - s2, cy - s2, s2 * 2, s2 * 2);
    ctx.strokeStyle = '#2a2433'; ctx.lineWidth = Math.max(1, 0.05 * k); ctx.strokeRect(x - s2, cy - s2, s2 * 2, s2 * 2);
    ctx.fillStyle = '#2a2433'; ctx.font = `700 ${Math.max(5, 0.38 * k)}px ${FONT}`; ctx.fillText(label, x, cy + 0.02 * k);
  } else {
    const cy = P3(d, side, 2.7)[1];
    ctx.fillStyle = '#d63a4f'; ctx.fillRect(x - 0.6 * k, cy - 0.3 * k, 1.2 * k, 0.6 * k);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.max(5, 0.4 * k)}px ${FONT}`; ctx.fillText(label, x, cy + 0.02 * k);
  }
}
/** Compteur à aiguille : la zone au-dessus de la limite est en rouge */
function cabDial(x, y, r) {
  const max = CFG.VMAX * 3.6, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, ang = v => a0 + (v / max) * (a1 - a0);
  const kmh = st.v * 3.6, lim = limitAt(st.x);
  ctx.fillStyle = '#3a2a20'; ctx.beginPath(); ctx.arc(x, y, r + 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#fbf3e6'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(214,58,79,.75)'; ctx.lineWidth = r * 0.12;
  ctx.beginPath(); ctx.arc(x, y, r * 0.84, ang(lim), a1); ctx.stroke();
  ctx.strokeStyle = '#2a2433'; ctx.fillStyle = '#2a2433'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.max(8, r * 0.16)}px ${FONT}`;
  for (let v = 0; v <= max; v += 10) {
    const a = ang(v), long = v % 20 === 0;
    ctx.lineWidth = long ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
    ctx.lineTo(x + Math.cos(a) * r * (long ? 0.74 : 0.8), y + Math.sin(a) * r * (long ? 0.74 : 0.8)); ctx.stroke();
    if (long) ctx.fillText(v, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
  }
  const a = ang(kmh), over = kmh > lim + CFG.TOLERANCE_KMH;
  ctx.strokeStyle = over ? '#d63a4f' : '#2a2433'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82); ctx.stroke();
  ctx.fillStyle = '#2a2433'; ctx.beginPath(); ctx.arc(x, y, r * 0.08, 0, 7); ctx.fill();
  ctx.fillStyle = over ? '#d63a4f' : '#2a2433';
  ctx.font = `700 ${Math.max(10, r * 0.26)}px ${FONT}`; ctx.fillText(Math.round(kmh), x, y + r * 0.45);
}
/** Écran de bord : distance au STOP, prochaine limite, cargaison */
function cabScreen(x, y, w, h) {
  const dStop = LINE.stopAt - st.x, nx = nextSegment(st.x);
  let line1;
  if (dStop < -0.5) line1 = `STOP dépassé de ${(-dStop).toFixed(1)} m`;
  else if (dStop < 25) line1 = `STOP dans ${dStop.toFixed(1)} m`;
  else if (dStop < 160) line1 = `Gare dans ${Math.round(dStop)} m`;
  else if (nx && nx.from - st.x < 80) line1 = `Bientôt limite ${nx.limit}`;
  else line1 = `Limite ${limitAt(st.x)} km/h`;
  ctx.fillStyle = '#3a2a20'; ctx.beginPath(); ctx.roundRect(x - w / 2 - 5, y - h / 2 - 5, w + 10, h + 10, 10); ctx.fill();
  ctx.fillStyle = '#17332a'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 7); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const near = dStop >= -0.5 && dStop < 25;
  ctx.fillStyle = near && Math.abs(dStop) <= CFG.STOP_PERFECT_M ? '#f2c84b' : '#9ef0c4';
  ctx.font = `700 ${Math.max(11, Math.min(24, h * 0.24))}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillText(line1, x, y - h * 0.16, w - 12);
  ctx.fillStyle = '#6fc79c'; ctx.font = `600 ${Math.max(10, Math.min(18, h * 0.17))}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillText(`Sirop ${st.bottles}/${CFG.BOTTLES}  ·  ${st.t.toFixed(0)} s`, x, y + h * 0.22, w - 12);
}
/** Levier de traction : haut = avance, milieu = neutre, bas = frein */
function cabLever(x, top, h) {
  leverPos += (st.throttle - leverPos) * 0.25;
  const slotH = h * 0.66, sy0 = top + (h - slotH) / 2, cy = sy0 + slotH / 2 - leverPos * slotH * 0.4;
  ctx.fillStyle = '#2a2433'; ctx.beginPath(); ctx.roundRect(x - 5, sy0, 10, slotH, 5); ctx.fill();
  ctx.fillStyle = st.throttle < 0 ? '#4b5a72' : st.throttle > 0 ? '#2f9e7a' : '#d63a4f';
  ctx.beginPath(); ctx.arc(x, cy, Math.max(9, h * 0.11), 0, 7); ctx.fill();
  ctx.fillStyle = '#f1e6d6'; ctx.font = `700 ${Math.max(9, Math.min(14, h * 0.1))}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('AVANCE', x + 18, sy0 + 6, W - x - 22); ctx.fillText('FREIN', x + 18, sy0 + slotH - 6, W - x - 22);
}

/* ---------------------------------------------------------
   VUE EXTÉRIEURE — de côté, la caméra suit le train
   --------------------------------------------------------- */
function renderSide() {
  const P = CFG.PX_PER_M;
  const groundY = Math.round(H * 0.74);
  const camX = st.x * P - W * 0.64 + (shake ? (Math.random() - .5) * 8 * shake : 0);
  const sx = m => m * P - camX;          // monde → écran
  const sy = m => groundY - m * P;

  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, '#9fd3ea'); sky.addColorStop(1, '#e7f4ec');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffe9a3'; ctx.beginPath(); ctx.arc(W * 0.12, H * 0.16, 26, 0, 7); ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,.9)';                      // nuages (parallaxe 0.1)
  for (let i = -1; i < 6; i++) {
    const span = W / 3 + 120, k = Math.floor(camX * 0.1 / span) + i;
    cloud(k * span - camX * 0.1 + rnd(k) * 80, 30 + rnd(k + 9) * H * 0.18, 0.7 + rnd(k + 3) * 0.6);
  }
  sideHills(0.25, groundY - 40, 36, '#b9dcc4', 0.004);
  sideHills(0.45, groundY - 14, 22, '#9ccfab', 0.009);
  for (let i = -2; i < W / 70 + 3; i++) {                      // fraisiers et arbres (parallaxe 0.7)
    const k = Math.floor(camX * 0.7 / 70) + i, x = k * 70 - camX * 0.7 + rnd(k) * 40;
    if (rnd(k + 5) < 0.35) sideTree(x, groundY - 10, 0.8 + rnd(k + 2) * 0.5); else sideBush(x, groundY - 6, k);
  }

  // Sol + rivière sous le pont
  ctx.fillStyle = '#8cc58f'; ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = '#7ab37d'; ctx.fillRect(0, groundY + 16, W, H - groundY);
  const [b0, b1] = LINE.bridge;
  if (sx(b1) > 0 && sx(b0) < W) {
    ctx.fillStyle = '#6fb4d6'; ctx.fillRect(sx(b0), groundY + 6, (b1 - b0) * P, H);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    for (let m = b0 + 4; m < b1; m += 9) ctx.fillRect(sx(m) + (performance.now() / 60) % 30, groundY + 30 + (m % 3) * 14, 22, 3);
    ctx.strokeStyle = '#8a6a52'; ctx.lineWidth = 3;
    for (let m = b0; m < b1; m += 10) { ctx.beginPath(); ctx.moveTo(sx(m), groundY + 6); ctx.lineTo(sx(m + 5), groundY + 26); ctx.lineTo(sx(m + 10), groundY + 6); ctx.stroke(); }
    ctx.fillStyle = '#8a6a52'; ctx.fillRect(sx(b0), groundY + 4, (b1 - b0) * P, 4);
  }

  sideStation(sx, groundY);

  for (const seg of LINE.segments) {                            // panneaux de limite
    const x = sx(seg.from + 6);
    if (x < -40 || x > W + 40) continue;
    ctx.fillStyle = '#5b5560'; ctx.fillRect(x - 1.5, groundY - 46, 3, 46);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d63a4f'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, groundY - 56, 14, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a2433'; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(seg.limit, x, groundY - 55.5);
  }

  ctx.fillStyle = '#6b4a35';                                    // traverses + rail
  for (let m = Math.floor(camX / P / 1.5) * 1.5; m * P - camX < W; m += 1.5) ctx.fillRect(sx(m), groundY + 1, 7, 5);
  ctx.fillStyle = '#5d6470'; ctx.fillRect(0, groundY - 2, W, 3);
  const be = sx(LINE.end + 1);                                  // butoir
  ctx.fillStyle = '#d63a4f'; ctx.fillRect(be, groundY - 20, 10, 20);
  ctx.fillStyle = '#fff'; ctx.fillRect(be, groundY - 14, 10, 4);

  for (const p of particles) if (p.kind === 'smoke') {
    ctx.fillStyle = `rgba(255,255,255,${clamp(p.life / 1.8, 0, 1) * 0.85})`;
    ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), p.r * P, 0, 7); ctx.fill();
  }
  sideTrain(sx, groundY);
  for (const p of particles) if (p.kind === 'bottle') {
    ctx.save(); ctx.translate(sx(p.x), sy(p.y)); ctx.rotate(p.rot);
    ctx.globalAlpha = clamp(p.life, 0, 1); bottle(0, 0, 1.1); ctx.restore();
  }
}

/* ---- éléments de la vue extérieure ---- */
function sideHills(par, base, amp, color, freq) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) {
    const w = x + st.x * CFG.PX_PER_M * par;
    ctx.lineTo(x, base - (Math.sin(w * freq) * amp + Math.sin(w * freq * 2.7 + 1) * amp * 0.4 + amp));
  }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}
function sideBush(x, y, k) {
  ctx.fillStyle = '#4f9a62';
  ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.arc(x + 12, y - 4, 13, 0, 7); ctx.arc(x + 24, y, 11, 0, 7); ctx.fill();
  ctx.fillStyle = '#d63a4f';
  for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(x + 2 + rnd(k * 7 + j) * 22, y - 6 + rnd(k * 3 + j) * 10, 2.4, 0, 7); ctx.fill(); }
}
function sideTree(x, y, s) {
  ctx.fillStyle = '#7b5a43'; ctx.fillRect(x - 3 * s, y - 34 * s, 6 * s, 34 * s);
  ctx.fillStyle = '#5aa86d'; ctx.beginPath(); ctx.arc(x, y - 44 * s, 20 * s, 0, 7); ctx.arc(x - 12 * s, y - 34 * s, 13 * s, 0, 7); ctx.arc(x + 12 * s, y - 34 * s, 13 * s, 0, 7); ctx.fill();
}
function bottle(x, y, s) {
  ctx.fillStyle = '#d63a4f';
  ctx.fillRect(x - 3 * s, y - 6 * s, 6 * s, 10 * s);
  ctx.fillRect(x - 1.5 * s, y - 10 * s, 3 * s, 4 * s);
  ctx.fillStyle = '#fbf3e6'; ctx.fillRect(x - 3 * s, y - 2 * s, 6 * s, 3 * s);   // étiquette
}
function sideStation(sx, gy) {
  const [p0, p1] = LINE.platform, P = CFG.PX_PER_M;
  if (sx(p1 + 10) < 0 || sx(p0 - 10) > W) return;
  const bx = sx(p0 + 18), bw = 26 * P;
  ctx.fillStyle = '#f6e3c9'; ctx.fillRect(bx, gy - 92, bw, 80);
  ctx.fillStyle = '#d63a4f'; ctx.beginPath(); ctx.moveTo(bx - 10, gy - 92); ctx.lineTo(bx + bw / 2, gy - 124); ctx.lineTo(bx + bw + 10, gy - 92); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9fd3ea'; for (let i = 0; i < 3; i++) ctx.fillRect(bx + 18 + i * (bw - 36) / 2.4, gy - 76, 22, 22);
  ctx.fillStyle = '#6b4a35'; ctx.fillRect(bx + bw / 2 - 12, gy - 50, 24, 38);
  ctx.fillStyle = '#fffaf2'; ctx.fillRect(bx + bw / 2 - 70, gy - 112, 140, 20);
  ctx.fillStyle = '#2a2433'; ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(LINE.name, bx + bw / 2, gy - 101.5);
  ctx.fillStyle = '#c9b8a3'; ctx.fillRect(sx(p0), gy - 12, (p1 - p0) * P, 12);                       // quai
  ctx.fillStyle = '#f2c84b'; ctx.fillRect(sx(p0), gy - 12, (p1 - p0) * P, 2);
  ctx.fillStyle = 'rgba(47,158,122,.55)';                                                              // zone parfaite
  ctx.fillRect(sx(LINE.stopAt - CFG.STOP_PERFECT_M), gy - 12, CFG.STOP_PERFECT_M * 2 * P, 12);
  const s0 = sx(LINE.stopAt);                                                                          // panneau STOP
  ctx.fillStyle = '#5b5560'; ctx.fillRect(s0 - 1.5, gy - 64, 3, 52);
  ctx.fillStyle = '#d63a4f'; ctx.fillRect(s0 - 18, gy - 80, 36, 18);
  ctx.fillStyle = '#fff'; ctx.font = `700 11px ${FONT}`; ctx.fillText('STOP', s0, gy - 70.5);
}
function sideTrain(sx, gy) {
  const P = CFG.PX_PER_M, front = sx(st.x);
  const bob = st.v > 0.3 ? Math.sin(performance.now() / 70) * 0.8 : 0;
  const wheelA = st.x * P / 7;
  // Wagon de sirop
  const wEnd = front - 13 * P - 1.2 * P, wLen = 11 * P, wx = wEnd - wLen;
  ctx.fillStyle = '#5d6470'; ctx.fillRect(wEnd, gy - 16, 1.2 * P, 3);                      // attelage
  ctx.fillStyle = '#7b5a43'; ctx.fillRect(wx, gy - 26 + bob, wLen, 14);
  ctx.fillStyle = '#6b4a35'; for (let i = 0; i < 5; i++) ctx.fillRect(wx + 4 + i * (wLen - 8) / 4.6, gy - 26 + bob, 2, 14);
  for (let i = 0; i < st.bottles; i++) bottle(wx + 10 + (i % 6) * (wLen - 20) / 5, gy - 32 - (i < 6 ? 0 : 12) + bob, 1);
  wheel(wx + 14, gy - 8, 7, wheelA); wheel(wx + wLen - 14, gy - 8, 7, wheelA);
  // Locomotive (avant à droite)
  const L = 13 * P, lx = front - L, b = bob;
  ctx.fillStyle = '#2a2433'; ctx.fillRect(lx, gy - 16, L, 6);
  ctx.fillStyle = '#d63a4f'; ctx.fillRect(lx, gy - 58 + b, 34, 44);                         // cabine
  ctx.fillStyle = '#9e2536'; ctx.fillRect(lx - 4, gy - 64 + b, 42, 8);
  ctx.fillStyle = '#bfe3f2'; ctx.fillRect(lx + 8, gy - 50 + b, 18, 14);
  ctx.fillStyle = '#d63a4f'; ctx.beginPath(); ctx.roundRect(lx + 30, gy - 44 + b, L - 34, 28, 12); ctx.fill();   // chaudière
  ctx.fillStyle = '#2f9e7a'; ctx.fillRect(lx + 34, gy - 34 + b, L - 42, 4);
  ctx.fillStyle = '#2a2433'; ctx.fillRect(front - 26, gy - 62 + b, 10, 18); ctx.fillRect(front - 29, gy - 66 + b, 16, 5);
  ctx.fillStyle = '#f2c84b'; ctx.beginPath(); ctx.arc(front - 4, gy - 32 + b, 4, 0, 7); ctx.fill();
  ctx.fillStyle = '#5d6470'; ctx.beginPath(); ctx.moveTo(front - 2, gy - 16); ctx.lineTo(front + 8, gy - 4); ctx.lineTo(front - 2, gy - 4); ctx.fill();
  wheel(lx + 16, gy - 9, 9, wheelA); wheel(lx + 44, gy - 9, 9, wheelA); wheel(front - 22, gy - 7, 7, wheelA);
  ctx.strokeStyle = '#c9ccd2'; ctx.lineWidth = 2.5; ctx.beginPath();                         // bielle
  ctx.moveTo(lx + 16 + Math.cos(wheelA) * 5, gy - 9 + Math.sin(wheelA) * 5);
  ctx.lineTo(lx + 44 + Math.cos(wheelA) * 5, gy - 9 + Math.sin(wheelA) * 5); ctx.stroke();
}
function wheel(x, y, r, a) {
  ctx.fillStyle = '#2a2433'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8b8f99'; ctx.lineWidth = 1.5; ctx.beginPath();
  ctx.moveTo(x - Math.cos(a) * r * .7, y - Math.sin(a) * r * .7); ctx.lineTo(x + Math.cos(a) * r * .7, y + Math.sin(a) * r * .7); ctx.stroke();
}

/* =========================================================
   INTERFACE (DOM) : HUD de la vue extérieure, frise, boutons,
   écrans de départ et d'arrivée
   ========================================================= */
function buildUI() {
  // Bascule Cabine / Extérieur, dans la barre du haut
  host.top.innerHTML = `
    <span class="tr-views" role="group" aria-label="Point de vue">
      <button type="button" class="tr-view" data-view="cab">Cabine</button>
      <button type="button" class="tr-view" data-view="side">Extérieur</button>
    </span>`;
  host.top.querySelectorAll('.tr-view').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

  host.layer.innerHTML = `
    <div class="tr-hud" hidden>
      <span class="tr-speed"><b class="tr-kmh">0</b> km/h</span>
      <span class="tr-limit">60</span>
      <span class="tr-bottles"></span>
    </div>
    <div class="tr-panel tr-intro">
      <h2>Livre le sirop à la Gare des Fraises</h2>
      <p>Respecte les panneaux de vitesse, sinon des bouteilles tombent du wagon. Arrête la loco pile au panneau <b>STOP</b> du quai : les repères 20, 10 et 5 et l’écran de bord t’aident pour les derniers mètres.</p>
      <p class="tr-reward"></p>
      <p class="tr-keys">Maintiens <b>Accélérer</b> ou <b>Freiner</b>. Clavier : <kbd>→</kbd> accélérer, <kbd>←</kbd> ou <kbd>Espace</kbd> freiner.</p>
      <button type="button" class="btn tr-go-btn">Partir ! 🚂</button>
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
    </div>`;
  host.bottom.innerHTML = `
    <div class="tr-strip" aria-hidden="true"></div>
    <div class="tr-ctrls">
      <button type="button" class="tr-ctrl tr-brake">Freiner<small>← · Espace</small></button>
      <button type="button" class="tr-ctrl tr-gas">Accélérer<small>→</small></button>
    </div>`;

  const q = sel => host.layer.querySelector(sel) || host.bottom.querySelector(sel);
  Object.assign(ui, {
    hud: q('.tr-hud'), kmh: q('.tr-kmh'), limit: q('.tr-limit'), bottles: q('.tr-bottles'),
    intro: q('.tr-intro'), reward: q('.tr-reward'), result: q('.tr-result'),
    resTitle: q('.tr-res-title'), stars: q('.tr-stars'), crit: q('.tr-crit'), gain: q('.tr-gain'),
    strip: q('.tr-strip'), gas: q('.tr-gas'), brake: q('.tr-brake'),
  });
  ui.bottles.innerHTML = '<i></i>'.repeat(CFG.BOTTLES);

  // Frise de la ligne : un bloc par tronçon, largeur proportionnelle
  for (const s of LINE.segments) {
    const d = document.createElement('div');
    d.className = 'tr-seg'; d.style.flex = `${s.to - s.from} 1 0`; d.style.background = s.color; d.textContent = s.limit;
    ui.strip.append(d);
  }
  const stop = document.createElement('div');
  stop.className = 'tr-stop'; stop.style.left = (LINE.stopAt / LINE.end * 100) + '%';
  ui.mark = document.createElement('div'); ui.mark.className = 'tr-mark';
  ui.strip.append(stop, ui.mark);

  ui.reward.innerHTML = host.opts.intro ? host.opts.intro() : '';
  q('.tr-go-btn').addEventListener('click', start);
  q('.tr-again').addEventListener('click', () => { reset(); ui.result.hidden = true; ui.intro.hidden = false; ui.reward.innerHTML = host.opts.intro ? host.opts.intro() : ''; });
  q('.tr-quit').addEventListener('click', () => host.close());
  bindHold(ui.gas, 'go');
  bindHold(ui.brake, 'brake');
}

function setView(v) {
  view = v === 'side' ? 'side' : 'cab';
  host.top.querySelectorAll('.tr-view').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  ui.hud.hidden = view === 'cab';                  // en cabine, le tableau de bord suffit
  try { localStorage.setItem(VIEW_KEY, view); } catch (e) { /* stockage indisponible */ }
}

function start() {
  reset();
  releaseAll();
  ui.intro.hidden = true; ui.result.hidden = true;
  st.running = true;
  host.sfx('whistle');
}

function showResult(r, gainHtml) {
  const titles = ['Livraison faite !', 'Pas mal du tout !', 'Super conducteur !', 'Conduite parfaite !'];
  ui.resTitle.textContent = titles[r.stars];
  [...ui.stars.children].forEach((s, i) => s.classList.toggle('on', i < r.stars));
  const where = Math.abs(r.stopErrorM) < 0.5 ? 'pile dessus' : `${Math.abs(r.stopErrorM).toFixed(1)} m ${r.stopErrorM > 0 ? 'après' : 'avant'}`;
  const rows = [
    [r.criteria.stop,  'Arrêt au STOP',        where],
    [r.criteria.cargo, 'Bouteilles livrées',   `${r.bottles}/${CFG.BOTTLES}`],
    [r.criteria.time,  'À l’heure',            `${r.timeS.toFixed(1)} s / ${CFG.TARGET_TIME} s`],
  ];
  ui.crit.innerHTML = rows.map(([ok, label, val]) =>
    `<li><span class="tr-dot ${ok ? 'ok' : ''}">${ok ? '✓' : ''}</span><span>${label}</span><b>${val}</b></li>`).join('');
  ui.gain.innerHTML = gainHtml || '';
  ui.result.hidden = false;
  ui.result.querySelector('.tr-again').focus();
}

/** HUD de la vue extérieure + frise (écrits seulement si la valeur change) */
function updateDOM() {
  const kmh = Math.round(st.v * 3.6), lim = limitAt(st.x), over = kmh > lim + CFG.TOLERANCE_KMH;
  if (ui.kmh.textContent !== String(kmh)) ui.kmh.textContent = kmh;
  if (ui.limit.textContent !== String(lim)) ui.limit.textContent = lim;
  ui.hud.classList.toggle('over', over && st.running);
  [...ui.bottles.children].forEach((b, i) => b.classList.toggle('lost', i >= st.bottles));
  ui.mark.style.left = (st.x / LINE.end * 100) + '%';
}

/* ---- commandes : boutons maintenus + clavier ---- */
function applyInput() {
  st.throttle = st.running ? (held.brake ? -1 : held.go ? 1 : 0) : 0;   // le frein a priorité
  ui.gas.classList.toggle('held', held.go);
  ui.brake.classList.toggle('held', held.brake);
}
function releaseAll() { held.go = held.brake = false; if (st && ui.gas) applyInput(); }
function bindHold(btn, key) {
  btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); held[key] = true; applyInput(); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(t, () => { held[key] = false; applyInput(); });
  btn.addEventListener('contextmenu', e => e.preventDefault());
}
const KEYS = { ArrowRight: 'go', ArrowUp: 'go', KeyD: 'go', KeyW: 'go', ArrowLeft: 'brake', ArrowDown: 'brake', KeyA: 'brake', KeyS: 'brake', Space: 'brake' };
function onKey(e) {
  const k = KEYS[e.code];
  if (!k) {
    if (e.type === 'keydown' && e.code === 'Enter' && !st.running) {   // Entrée : partir / rejouer
      e.preventDefault();
      if (!ui.intro.hidden) start(); else if (!ui.result.hidden) ui.result.querySelector('.tr-again').click();
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
export const TrainDrive = {
  title: '🚂 Ligne des Fraises',

  mount(h) {
    host = h;
    reset();
    buildUI();
    let saved = null;
    try { saved = localStorage.getItem(VIEW_KEY); } catch (e) { /* */ }
    setView(saved || 'cab');
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('blur', releaseAll);
    ui.intro.querySelector('.tr-go-btn').focus();
  },
  frame(dt) { update(dt); updateDOM(); },
  render,
  unmount() {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKey, true);
    window.removeEventListener('blur', releaseAll);
    held.go = held.brake = false;
    st = null; host = null;
  },
};
