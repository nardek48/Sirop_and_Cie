/**
 * boat3d.js — rendu 3D (Three.js) du mini-jeu « Route des Agrumes ».
 *
 * Ne simule rien : il lit l'état du mini-jeu (boat.js) et le dessine. Mêmes briques que train3d.js :
 * ombrage en aplats (toon), contours encrés, textures dessinées par le code, et les images du jeu
 * (port, maisons, citronniers) posées en façades ou en panneaux tournés vers la caméra.
 * Vues : 'chase' (poursuite), 'bridge' (sur le pont), 'side' (de côté).
 */
const FONT = "'DM Sans', system-ui, sans-serif";
const THREE_URL = 'js/vendor/three.min.js';
/** Images du jeu utilisées par la scène (assets/<clé>.png) */
const IMAGES = ['batiments/port', 'maisons/studio', 'maisons/village', 'maisons/villa', 'village/citronnier', 'village/lampadaire', 'village/banc'];

let api = null;          // scène construite (une seule fois, réutilisée d'une partie à l'autre)
let loading = null;

function loadThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = THREE_URL; s.async = true;
    s.onload = () => (window.THREE ? res(window.THREE) : rej(new Error('three')));
    s.onerror = () => rej(new Error('three'));
    document.head.append(s);
  });
}
/** Images manquantes : la scène se construit sans elles (décor plus simple) */
function loadImages() {
  const IMG = {};
  return Promise.all(IMAGES.map(k => new Promise(res => {
    const im = new Image();
    im.onload = () => { IMG[k] = im; res(); };
    im.onerror = () => res();
    im.src = `assets/${k}.png`;
  }))).then(() => IMG);
}

export const Boat3D = {
  get ready() { return !!api; },
  /** Prépare la 3D (une fois). Rejette sans WebGL ou si Three.js ne se charge pas. D = { CFG, ROUTE, ROCKS, rnd } */
  load(D) {
    if (api) return Promise.resolve();
    if (!loading) loading = Promise.all([loadThree(), loadImages()]).then(([THREE, IMG]) => { api = build(THREE, D, IMG); })
      .catch(e => { loading = null; throw e; });
    return loading;
  },
  attach(stage) { if (api) stage.prepend(api.canvas); },
  detach() { if (api) api.canvas.remove(); },
  /** Nouvelle traversée : caisses remises sur le pont, capitaine à la couleur du joueur */
  reset(st, shirt) { if (api) api.reset(st, shirt); },
  /** Caméra placée tout de suite (changement de vue) */
  snap() { if (api) api.snapNext = true; },
  step(st, dt) { if (api) api.step(st, dt); },
  draw(st, view, W, H) { if (api) api.draw(st, view, W, H); },
};

function build(THREE, D, IMG) {
  const { CFG, ROUTE, ROCKS, rnd } = D;
  // Sans WebGL, Three.js lève une erreur ici : boat.js affiche alors son message
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'mg-3d';

  const scene = new THREE.Scene();
  const HORIZON = '#d8ecef';
  scene.fog = new THREE.Fog(HORIZON, 120, 460);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.08, 1400);

  // Ciel en dégradé (dôme qui suit la caméra)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#79bfe0') }, mid: { value: new THREE.Color('#bfe3ef') }, bot: { value: new THREE.Color(HORIZON) } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying float h; void main(){ vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.6, h)) : mix(bot, mid, smoothstep(-0.02, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
  }));
  sky.renderOrder = -1;
  scene.add(sky);

  scene.add(new THREE.HemisphereLight('#fff6e0', '#7d9a5a', 0.55));
  const sun = new THREE.DirectionalLight('#fff1d6', 0.95);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 160 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  /* ---------- Matériaux : trois tons de lumière + contours encrés ---------- */
  const TOON = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.LuminanceFormat);
  TOON.minFilter = TOON.magFilter = THREE.NearestFilter; TOON.generateMipmaps = false; TOON.needsUpdate = true;
  const mats = {};
  const mat = (color, o = {}) => {
    const k = color + (o.map ? o.map.uuid : '') + (o.opacity || '');
    return mats[k] || (mats[k] = new THREE.MeshToonMaterial({ color, gradientMap: TOON, ...o }));
  };
  const INK = new THREE.MeshBasicMaterial({ color: '#2b1d12', side: THREE.BackSide });
  const bb = new THREE.Vector3(), bc = new THREE.Vector3();
  /** Contour : copie un peu plus grande, vue de l'intérieur */
  function ink(m, t = 0.045) {
    const g = m.geometry; g.computeBoundingBox(); g.boundingBox.getSize(bb); g.boundingBox.getCenter(bc);
    const k = v => (v + 2 * t) / Math.max(v, 1e-3);
    const o = new THREE.Mesh(g, INK);
    o.scale.set(k(bb.x), k(bb.y), k(bb.z));
    o.position.set(bc.x * (1 - o.scale.x), bc.y * (1 - o.scale.y), bc.z * (1 - o.scale.z));
    m.add(o); return m;
  }
  const box = (w, h, d, color, x, y, z, o, t) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o));
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
    return t === 0 ? m : ink(m, t);
  };
  const cyl = (rt, rb, h, color, seg = 16, o, t) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, o)); m.castShadow = true;
    return t === 0 ? m : ink(m, t);
  };

  /* ---------- Textures dessinées par le code ---------- */
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  let seed = 1;
  const r01 = () => rnd(seed++);
  function speckle(g, w, h, n, colors, rMin, rMax, alpha) {
    for (let i = 0; i < n; i++) {
      g.globalAlpha = alpha * (0.5 + r01() * 0.5); g.fillStyle = colors[Math.floor(r01() * colors.length)];
      g.beginPath(); g.arc(r01() * w, r01() * h, rMin + r01() * (rMax - rMin), 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }
  const TEX = {
    wood: canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#c9b49a'; g.lineWidth = 1.2;
      for (let y = 3; y < h; y += 4 + r01() * 4) { g.globalAlpha = 0.5 + r01() * 0.4; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 13 + y) * 1.4); g.stroke(); }
      g.globalAlpha = 0.7; g.fillStyle = '#b39a7c'; g.beginPath(); g.ellipse(w * 0.66, h * 0.45, 5, 3, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    }),
    planks: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) {
        g.fillStyle = '#e9dccb'; g.globalAlpha = r01() * 0.5; g.fillRect(0, y, w, 32); g.globalAlpha = 1;
        g.strokeStyle = '#c9b49a'; for (let k = 0; k < 4; k++) { const yy = y + 5 + k * 7; g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy + (r01() - .5) * 3); g.stroke(); }
        g.fillStyle = '#7d6a55'; g.fillRect(0, y, w, 2);
      }
    }, [2, 1]),
    plaster: canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 400, ['#efe4d2', '#f7efe2', '#e6d8c2'], 4, 14, 0.5);
    }, [1, 1]),
    paving: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) for (let x = -(y / 16 % 2) * 16; x < w; x += 32) {
        g.fillStyle = `hsl(36,25%,${86 + r01() * 10}%)`; g.fillRect(x + 1, y + 1, 30, 14);
      }
    }, [12, 1]),
    // Vaguelettes : la texture glisse avec le temps
    water: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d7eef6'; g.lineWidth = 2;
      for (let i = 0; i < 26; i++) { const x = r01() * w, y = r01() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 3, x + 12, y); g.stroke(); }
    }, [120, 80]),
  };
  /** Panneau dessiné sur poteau (nom de port) */
  function signTex(text, sub) {
    return canvasTex(256, 160, (g, W, H) => {
      g.fillStyle = '#7b5536'; g.fillRect(124, 70, 10, 90);
      g.fillStyle = '#fffaf0'; g.strokeStyle = '#3b2a1a'; g.lineWidth = 6; g.beginPath(); g.roundRect(8, 8, W - 16, 74, 10); g.fill(); g.stroke();
      g.fillStyle = '#3b2a1a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 30px ${FONT}`; g.fillText(text, W / 2, sub ? 36 : 46);
      if (sub) { g.font = `600 20px ${FONT}`; g.fillStyle = '#8a735a'; g.fillText(sub, W / 2, 64); }
    });
  }

  /* ---------- Personnages « chibi » : grosse tête, petit corps, contours bruns ---------- */
  const SKIN = '#f6cfaa', CHEEK = '#f29a9a', EYE = '#2b1d12';
  const HAIRS = { brun: '#7a4a2a', noir: '#2b2420', roux: '#c0582a', blond: '#e2b65a' };
  function chibi(spec) {
    const g = new THREE.Group(), rig = {};
    const part = (geo, color, x, y, z, t = 0.03) => { const m = ink(new THREE.Mesh(geo, mat(color)), t); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    for (const side of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(side * 0.17, 0.62, 0); g.add(hip);
      const leg = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.5, 10), mat(spec.pants)), 0.025); leg.position.y = -0.25; hip.add(leg);
      const shoe = ink(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.32), mat(spec.shoes || '#5a3a2a')), 0.025); shoe.position.set(0, -0.55, 0.05); hip.add(shoe);
      rig[side < 0 ? 'legL' : 'legR'] = hip;
    }
    part(new THREE.CylinderGeometry(0.3, 0.36, 0.62, 14), spec.shirt, 0, 0.92, 0);
    if (spec.skirt) part(new THREE.CylinderGeometry(0.34, 0.5, 0.42, 14), spec.shirt, 0, 0.6, 0);
    for (const side of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(side * 0.38, 1.16, 0); g.add(sh);
      const sleeve = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.24, 8), mat(spec.shirt)), 0.02); sleeve.position.y = -0.1; sh.add(sleeve);
      const arm = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.26, 8), mat(SKIN)), 0.02); arm.position.y = -0.32; sh.add(arm);
      const hand = ink(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(SKIN)), 0.02); hand.position.y = -0.47; sh.add(hand);
      sh.rotation.z = side * 0.12;
      rig[side < 0 ? 'armL' : 'armR'] = sh;
    }
    const head = new THREE.Group(); head.position.y = 1.62; g.add(head); rig.head = head;
    head.add(ink(new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 16), mat(SKIN)), 0.035));
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: EYE })); eye.scale.set(1, 1.35, 0.6); eye.position.set(side * 0.15, 0.02, 0.42); head.add(eye);
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.07, 14), new THREE.MeshBasicMaterial({ color: CHEEK, transparent: true, opacity: 0.6 }));
      cheek.position.set(side * 0.26, -0.1, 0.38); cheek.rotation.y = side * 0.55; head.add(cheek);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: EYE }));
    mouth.position.set(0, -0.13, 0.44); mouth.rotation.z = Math.PI; head.add(mouth);
    // Coiffure : casquette, courte ou queue de cheval
    const add = (geo, c, x, y, z, t = 0.025) => { const m = ink(new THREE.Mesh(geo, mat(c)), t); m.position.set(x, y, z); head.add(m); return m; };
    if (spec.hair === 'casquette') {
      add(new THREE.SphereGeometry(0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), spec.cap, 0, 0.06, 0).scale.set(1, 0.85, 1);
      add(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 16, 1, false, -Math.PI / 2, Math.PI), spec.cap, 0, 0.12, 0.32, 0.02).scale.set(1, 1, 0.7);
      add(new THREE.SphereGeometry(0.46, 14, 10, 0, Math.PI * 2, Math.PI / 2.3, Math.PI / 3), spec.hairColor, 0, 0.02, -0.04, 0.02);
    } else {
      add(new THREE.SphereGeometry(0.5, 18, 12, 0, Math.PI * 2, 0, Math.PI / 1.9), spec.hairColor, 0, 0.03, -0.04).rotation.x = -0.25;
      add(new THREE.BoxGeometry(0.7, 0.14, 0.2), spec.hairColor, 0, 0.3, 0.32).rotation.x = 0.5;
      if (spec.hair === 'queue') { const tail = add(new THREE.SphereGeometry(0.2, 12, 10), spec.hairColor, 0.18, 0.15, -0.52); tail.scale.set(0.8, 1.9, 0.8); tail.rotation.x = 0.5; }
    }
    g.userData.rig = rig;
    return g;
  }
  /** Immobile : respiration légère ; le bras droit peut faire coucou */
  function idle(g, phase, wave) {
    const r = g.userData.rig;
    r.head.position.y = 1.62 + Math.sin(phase * 0.3) * 0.015;
    r.armR.rotation.z = wave ? -2.4 + Math.sin(phase * 5) * 0.4 : 0.12;
  }

  /* ---------- Images du jeu : façades et panneaux tournés vers la caméra ---------- */
  const FACADES = {
    'batiments/port':  { wx: [0.05, 0.95], eave: 0.33, top: 0.05, wall: [0.1, 0.45, 0.12, 0.2], roof: [0.1, 0.12, 0.3, 0.15] },
    'maisons/studio':  { wx: [0.06, 0.94], eave: 0.42, top: 0.12, wall: [0.5, 0.5, 0.08, 0.1], roof: [0.3, 0.18, 0.2, 0.1] },
    'maisons/village': { wx: [0.06, 0.94], eave: 0.33, top: 0.1, wall: [0.4, 0.5, 0.08, 0.06], roof: [0.3, 0.12, 0.25, 0.1] },
    'maisons/villa':   { wx: [0.06, 0.94], eave: 0.32, top: 0.1, wall: [0.55, 0.6, 0.06, 0.08], roof: [0.3, 0.12, 0.2, 0.08] },
  };
  /** Magenta de l'image repeint dans `hex`, ombres et reflets gardés (même calcul que Art.tinted) */
  function tinted(im, hex) {
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height), p = d.data, T = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const r = p[i], gr = p[i + 1], b = p[i + 2], mx = Math.max(r, gr, b), mn = Math.min(r, gr, b);
      if (mx < 50 || (mx - mn) / mx < 0.3 || gr !== mn) continue;
      const hue = mx === r ? 360 - 60 * (b - gr) / (mx - mn) : 240 + 60 * (r - gr) / (mx - mn);
      if (hue < 280 || hue > 328) continue;
      const L = mx / 240, W = (mn / mx) * 0.85;
      for (let k = 0; k < 3; k++) p[i + k] = Math.min(255, T[k] * L * (1 - W) + 255 * W);
    }
    g.putImageData(d, 0, 0); return cv;
  }
  function cropTex(im, [fx, fy, fw, fh], rx, ry) {
    const c = document.createElement('canvas'), sw = Math.max(2, Math.round(fw * im.width)), sh = Math.max(2, Math.round(fh * im.height));
    c.width = sw; c.height = sh; c.getContext('2d').drawImage(im, fx * im.width, fy * im.height, sw, sh, 0, 0, sw, sh);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t;
  }
  function gable(w, d, h, map) {
    const s = new THREE.Shape(); s.moveTo(-d / 2 - 0.4, 0); s.lineTo(d / 2 + 0.4, 0); s.lineTo(0, Math.max(0.2, h)); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: w + 0.8, bevelEnabled: false });
    g.translate(0, 0, -(w + 0.8) / 2); g.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(g, mat('#ffffff', { map })); m.castShadow = true; return ink(m, 0.06);
  }
  /** Bâtiment : la façade du jeu devant, murs et toit découpés dans la même image (null sans image) */
  function facadeBuilding(key, FW, depth, tint) {
    const F = FACADES[key], src = IMG[key];
    if (!src) return null;
    const im = tint ? tinted(src, tint) : src, g = new THREE.Group();
    const FH = FW * im.height / im.width;
    const BW = FW * (F.wx[1] - F.wx[0]), cx = FW * ((F.wx[0] + F.wx[1]) / 2 - 0.5);
    const WH = FH * (1 - F.eave), RH = FH * (F.eave - F.top);
    const wm = [F.wall[2] * FW, F.wall[3] * FH], rm = [F.roof[2] * FW, F.roof[3] * FH];
    const side = mat('#ffffff', { map: cropTex(im, F.wall, depth / wm[0], WH / wm[1]) });
    const back = mat('#ffffff', { map: cropTex(im, F.wall, BW / wm[0], WH / wm[1]) });
    const body = new THREE.Mesh(new THREE.BoxGeometry(BW, WH, depth), [side, side, back, back, back, back]);
    body.position.set(cx, WH / 2, 0); body.castShadow = body.receiveShadow = true; g.add(ink(body, 0.05));
    const roof = gable(BW + 0.6, depth - 0.6, RH, cropTex(im, F.roof, 1 / rm[0], 1 / rm[1])); roof.position.set(cx, WH, -0.45); g.add(roof);
    const tex = new THREE.Texture(im); tex.needsUpdate = true; tex.anisotropy = 4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
    face.position.set(0, FH / 2, depth / 2 + 0.05); g.add(face);
    return g;
  }
  const billboards = [];
  function billboard(key, x, z, h, opts = {}) {
    const im = IMG[key];
    if (!im) return null;
    const tex = new THREE.Texture(im); tex.needsUpdate = true; tex.anisotropy = 4;
    const w = h * im.width / im.height;
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    m.position.set(x, opts.y || 0, z); m.castShadow = true;
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
    scene.add(m); billboards.push(m);
    return m;
  }

  /* =========================================================
     LE BATEAU : coque rouge, cabine, cheminée, mât, 12 caisses de sirop
     ========================================================= */
  const boat = new THREE.Group(), hull = new THREE.Group();
  boat.add(hull);
  const crateMeshes = [], smokePoint = new THREE.Object3D();
  const SIROPS = ['#d23c4f', '#4fb286', '#e8c22e', '#7b4fb0', '#ff8a3d', '#c9b8e0'];
  let flag = null, captain = null, captainShirt = null;
  (function buildBoat() {
    // Coque : un profil de bateau extrudé (proue pointue vers +X)
    const sh = new THREE.Shape();
    sh.moveTo(-6, -1.6); sh.lineTo(3.2, -1.6); sh.quadraticCurveTo(6.4, -1.4, 7.4, 0); sh.quadraticCurveTo(6.4, 1.4, 3.2, 1.6); sh.lineTo(-6, 1.6); sh.closePath();
    const hg = new THREE.ExtrudeGeometry(sh, { depth: 1.8, bevelEnabled: false }); hg.rotateX(-Math.PI / 2); hg.translate(0, -0.6, 0);
    hull.add(ink(new THREE.Mesh(hg, mat('#c2453a', { map: TEX.planks })), 0.06));
    const deckG = new THREE.ShapeGeometry(sh); deckG.rotateX(-Math.PI / 2); deckG.translate(0, 1.22, 0);
    hull.add(new THREE.Mesh(deckG, mat('#c99a6a', { map: TEX.planks })));
    const stripe = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: false }), mat('#fffaf0'));
    stripe.geometry.rotateX(-Math.PI / 2); stripe.scale.set(1.01, 1, 1.03); stripe.position.y = 0.55; hull.add(stripe);
    // Cabine du capitaine, fenêtres, cheminée
    hull.add(box(3.2, 2.4, 2.6, '#fffaf0', -3.8, 2.4, 0, { map: TEX.plaster }));
    hull.add(box(3.6, 0.25, 3.0, '#3a6ea5', -3.8, 3.7, 0));
    for (const z of [-1.31, 1.31]) hull.add(box(1.8, 0.8, 0.06, '#6c8fb3', -3.8, 2.8, z, undefined, 0.02));
    hull.add(box(0.06, 0.8, 1.8, '#6c8fb3', -2.18, 2.8, 0, undefined, 0.02));
    const chim = cyl(0.35, 0.45, 1.6, '#2f2a2e', 12); chim.position.set(-4.6, 4.5, 0); hull.add(chim);
    const band = cyl(0.37, 0.37, 0.3, '#d98a1c', 12, undefined, 0); band.position.set(-4.6, 4.9, 0); hull.add(band);
    smokePoint.position.set(-4.6, 5.4, 0); hull.add(smokePoint);
    // Mât et fanion « S&C » : deux faces dos à dos, lisible des deux côtés
    const mast = cyl(0.08, 0.08, 4, '#7b5536', 8, undefined, 0.02); mast.position.set(4.2, 3.2, 0); hull.add(mast);
    flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshBasicMaterial({ map: canvasTex(128, 72, (g, w, h) => {
      g.fillStyle = '#d98a1c'; g.fillRect(0, 0, w, h); g.fillStyle = '#fffaf0'; g.font = `800 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('S&C', w / 2, h / 2 + 2);
    }) }));
    const back = flag.clone(); back.rotation.y = Math.PI; flag.add(back);
    flag.position.set(3.5, 4.8, 0); hull.add(flag);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.1, 8, 16), mat('#e0303f')); ring.position.set(-2.15, 2.0, 0.8); ring.rotation.y = Math.PI / 2; hull.add(ring);
    // Caisses de sirop sur le pont (3 rangées de 4)
    for (let i = 0; i < CFG.CRATES; i++) {
      const c = new THREE.Group();
      c.add(box(0.95, 0.7, 0.95, '#a57a52', 0, 0.35, 0, { map: TEX.wood }, 0.025));
      for (let b = 0; b < 4; b++) {
        const bt = cyl(0.11, 0.11, 0.35, SIROPS[(i + b) % SIROPS.length], 8, { transparent: true, opacity: 0.95 }, 0.012);
        bt.position.set(b % 2 ? 0.2 : -0.2, 0.82, b < 2 ? -0.2 : 0.2); c.add(bt);
      }
      c.position.set(-0.6 + (i % 4) * 1.15, 1.25, -1.15 + Math.floor(i / 4) * 1.15);
      c.userData.home = c.position.clone();
      hull.add(c); crateMeshes.push(c);
    }
    hull.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(boat);
  })();
  /** Le capitaine : ton personnage, avec la couleur de t-shirt choisie */
  function setCaptain(shirt) {
    if (captain && captainShirt === shirt) return;
    if (captain) hull.remove(captain);
    captainShirt = shirt;
    captain = chibi({ shirt, pants: '#4a6b9a', shoes: '#c2453a', hair: 'casquette', cap: '#3a6ea5', hairColor: HAIRS.brun });
    captain.position.set(-1.6, 1.25, -1.2); captain.rotation.y = Math.PI / 2; captain.scale.setScalar(0.8); hull.add(captain);
  }
  setCaptain('#e0703a');

  /* =========================================================
     LA MER : port de départ, bouées, récifs, Port-Agrumes
     ========================================================= */
  const buoys = [], waiting = [], gulls = [];
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1600), mat('#3f93c4', { map: TEX.water }));
  water.rotation.x = -Math.PI / 2; water.position.set(400, 0, 0); water.receiveShadow = true; scene.add(water);
  let beamPivot = null;
  (function buildSea() {
    // Sirop-sur-Mer : le bâtiment Export Riviera du jeu, son quai, des caisses
    scene.add(box(70, 2, 26, '#cfc2aa', -10, 0.6, -24, { map: TEX.paving }, 0.05));
    scene.add(box(46, 1.4, 6, '#a08a6a', 10, 0.5, -13, { map: TEX.planks }, 0.04));
    const port = facadeBuilding('batiments/port', 16, 9); if (port) { port.position.set(4, 1.6, -26); scene.add(port); }
    const pn = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.5), new THREE.MeshBasicMaterial({ map: signTex('Sirop-sur-Mer', 'Export Riviera'), transparent: true, alphaTest: 0.4 }));
    pn.position.set(22, 1.6, -15); scene.add(pn);
    for (let i = 0; i < 6; i++) scene.add(box(1.2, 1, 1.2, '#a57a52', -6 + (i % 3) * 1.4, 1.7 + Math.floor(i / 3), -15, { map: TEX.wood }, 0.025));
    for (const x of [-14, 0, 14]) billboard('village/lampadaire', x, -14.5, 4.6, { y: 1.6 });

    // Bouées de chenal (rouges à gauche, vertes à droite) et bouées jaunes de vitesse
    for (let x = 40; x < ROUTE.quay[0] - 20; x += 30) for (const side of [-1, 1]) {
      const b = new THREE.Group(), c = side < 0 ? '#d63a4f' : '#3f8f5a';
      const body = cyl(0.5, 0.7, 1.6, c, 10); body.position.y = 0.6; b.add(body);
      const top = cyl(0.05, 0.4, 0.6, c, 10); top.position.y = 1.7; b.add(top);
      b.position.set(x, 0, side * ROUTE.lane); scene.add(b); buoys.push(b);
    }
    for (const seg of ROUTE.segments) {
      const tex = canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, h / 2, 120, 0, 7); g.fill();
        g.strokeStyle = '#d63a4f'; g.lineWidth = 28; g.beginPath(); g.arc(w / 2, h / 2, 104, 0, 7); g.stroke();
        g.fillStyle = '#2a2433'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 92px ${FONT}`; g.fillText(seg.limit, w / 2, h / 2 - 8);
        g.font = `700 30px ${FONT}`; g.fillText('nœuds', w / 2, h / 2 + 56);
      });
      const b = new THREE.Group();
      const body = cyl(0.8, 1.0, 2.2, '#f2c84b', 12); body.position.y = 0.9; b.add(body);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4 }));
      face.rotation.y = -Math.PI / 2; face.position.set(-0.85, 3.4, 0); b.add(face);
      b.position.set(Math.max(seg.from, 8), 0, ROUTE.lane + 2.5); scene.add(b); buoys.push(b);
    }
    // Récifs : rochers et écume
    for (const r of ROCKS) {
      const g = new THREE.Group();
      const rock = ink(new THREE.Mesh(new THREE.DodecahedronGeometry(r.r, 0), mat('#8a8576')), 0.05);
      rock.scale.set(1, 0.75, 1); rock.position.y = 0.3; rock.castShadow = true; g.add(rock);
      const foam = new THREE.Mesh(new THREE.RingGeometry(r.r * 0.9, r.r * 1.35, 20), new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.8 }));
      foam.rotation.x = -Math.PI / 2; foam.position.y = 0.08; g.add(foam);
      g.position.set(r.x, 0, r.z); scene.add(g);
    }

    // Port-Agrumes : quai, panneaux d'amarrage, maisons aux toits orange, citronniers, phare-bouteille
    const [q0, q1] = ROUTE.quay, qz = ROUTE.quayZ;
    scene.add(box(q1 - q0 + 30, 1.4, 8, '#a08a6a', (q0 + q1) / 2, 0.5, qz + 4.5, { map: TEX.planks }, 0.04));
    scene.add(box(160, 2, 60, '#e2d2b4', 790, 0.6, 50, { map: TEX.paving }, 0.05));
    for (const x of [q0, ROUTE.stopAt, q1]) { const bol = cyl(0.3, 0.35, 0.8, '#3b3236', 8); bol.position.set(x, 1.6, qz + 1); scene.add(bol); }
    const mk = (txt, x, color) => {
      const t = canvasTex(256, 160, (g, w, h) => { g.fillStyle = color; g.fillRect(16, 16, w - 32, h - 32); g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(16, 16, w - 32, h - 32); g.fillStyle = '#fff'; g.font = `800 64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 4); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({ map: t })); m.rotation.y = -Math.PI / 2; m.position.set(x, 3.4, qz + 2); scene.add(m);
      const p = cyl(0.07, 0.07, 2.4, '#5b5560', 8, undefined, 0.02); p.position.set(x + 0.05, 2.4, qz + 2); scene.add(p);
    };
    mk('QUAI', ROUTE.stopAt, '#d63a4f'); for (const r of [20, 10, 5]) mk(String(r), ROUTE.stopAt - r, '#3a6ea5');
    [['maisons/studio', 765, 34], ['maisons/village', 790, 36], ['maisons/villa', 815, 34], ['maisons/village', 740, 35]].forEach(([k, x, z], i) => {
      const h = facadeBuilding(k, 13, 8, i % 2 ? '#ff8a3d' : '#e8b52a'); if (h) { h.position.set(x, 1.6, z); scene.add(h); }
    });
    const sn = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.1), new THREE.MeshBasicMaterial({ map: signTex('Port-Agrumes', 'village de sirop'), transparent: true, alphaTest: 0.4 }));
    sn.position.set(735, 1.6, 21); scene.add(sn);
    for (let i = 0; i < 9; i++) billboard('village/citronnier', 700 + i * 13 + rnd(i) * 4, 26 + rnd(i + 9) * 4, 3, { y: 1.6 });
    for (const x of [740, 770, 800]) billboard('village/lampadaire', x, qz + 7.5, 4.6, { y: 1.6 });
    billboard('village/banc', 780, 22, 1.4, { y: 1.6 });
    // Le phare : une grande bouteille de sirop d'orange, son faisceau tourne
    const orange = '#ff8a3d', ph = new THREE.Group();
    const bottle = ink(new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 12, 20), mat(orange, { transparent: true, opacity: 0.92 })), 0.08); bottle.position.y = 6; ph.add(bottle);
    const label = cyl(3.25, 3.25, 3.5, '#fffaf0', 20, { map: canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h); g.fillStyle = '#c2453a'; g.font = `800 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SIROP', w / 2, h / 2 + 2); }) }, 0.04);
    label.position.y = 6; ph.add(label);
    const neck = ink(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 3, 3.5, 20), mat(orange, { transparent: true, opacity: 0.92 })), 0.06); neck.position.y = 13.7; ph.add(neck);
    const lampRoom = cyl(1.3, 1.3, 1.6, '#fff2b0', 16); lampRoom.position.y = 16.2; ph.add(lampRoom);
    const capT = cyl(0.2, 1.5, 1.2, '#c2453a', 16); capT.position.y = 17.6; ph.add(capT);
    ph.position.set(840, 1.6, 18); scene.add(ph);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.5, 26, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    beam.geometry.translate(0, -13, 0); beam.rotation.z = Math.PI / 2;
    beamPivot = new THREE.Group(); beamPivot.position.set(840, 17.8, 18); beamPivot.add(beam); scene.add(beamPivot);
    // Habitants qui attendent le bateau sur le quai
    [['#e8c22e', 'queue', HAIRS.roux, true], ['#3f8f5a', 'courte', HAIRS.noir, false], ['#f07fb0', 'queue', HAIRS.blond, true]].forEach(([c, hs, hc, skirt], i) => {
      const p = chibi({ shirt: c, skirt, pants: skirt ? SKIN : '#8a8f99', shoes: '#7a4a2a', hair: hs, hairColor: hc });
      p.position.set(752 + i * 9, 1.25, qz + 5); p.rotation.y = Math.PI; scene.add(p); waiting.push(p);
    });
    // Îles au loin et mouettes
    for (let i = 0; i < 9; i++) {
      const isl = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(i % 2 ? '#86b86a' : '#9bc77a'));
      isl.scale.set(30 + rnd(i) * 40, 8 + rnd(i + 3) * 14, 20 + rnd(i + 5) * 20);
      isl.position.set(-50 + i * 110, -2, (i % 2 ? -1 : 1) * (140 + rnd(i + 7) * 80)); scene.add(isl);
    }
    const wingMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.25), wingMat); w.position.x = s * 0.45; w.userData.side = s; g.add(w); }
      scene.add(g); gulls.push({ g, a: rnd(i) * 6, r: 6 + rnd(i + 2) * 6, h: 8 + rnd(i + 4) * 4, s: 0.6 + rnd(i + 6) * 0.5 });
    }
  })();

  /* ---------- Effets : caisses qui tombent à l'eau, fumée, sillage ---------- */
  const falling = [], puffs = [], wake = [];
  const smokeTex = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: '#e8e4de', transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); puffs.push(s); }
  const wakeGeo = new THREE.CircleGeometry(1, 16);
  for (let i = 0; i < 50; i++) { const s = new THREE.Mesh(wakeGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); s.rotation.x = -Math.PI / 2; s.visible = false; scene.add(s); wake.push(s); }
  const spawn = (pool, setup) => { const s = pool.find(p => !p.visible); if (s) { s.visible = true; setup(s); } };
  let puffAcc = 0, wakeAcc = 0, shake = 0, seenCrates = CFG.CRATES, seenHits = 0, lastSt = null, tt = 0, arrivedT = 99, roll = 0;

  function reset(st, shirt) {
    for (const f of falling) scene.remove(f.m);
    falling.length = 0;
    for (const c of crateMeshes) { if (c.parent !== hull) hull.add(c); c.position.copy(c.userData.home); c.rotation.set(0, 0, 0); }
    seenCrates = st.crates; seenHits = st.hits; lastSt = st; shake = 0; arrivedT = 99; roll = 0;
    if (shirt) setCaptain(shirt);
    api.snapNext = true;
  }

  function step(st, dt) {
    if (st !== lastSt) reset(st);                // nouvelle partie (Rejouer)
    tt += dt;
    // Caisses perdues depuis la dernière image : elles sautent à l'eau puis flottent
    while (seenCrates > st.crates) {
      seenCrates--;
      const c = crateMeshes[seenCrates], p = new THREE.Vector3(); c.getWorldPosition(p);
      hull.remove(c); scene.add(c); c.position.copy(p);
      falling.push({ m: c, vx: st.v * 0.5 - 1, vy: 3, vz: (st.steer || (Math.random() < 0.5 ? -1 : 1)) * 2.5, rest: false, t: 0 });
    }
    if (st.hits > seenHits) { seenHits = st.hits; shake = 1; }
    for (const f of falling) {
      if (f.rest) { f.t += dt; f.m.position.y = -0.2 + Math.sin(f.t * 2) * 0.1; f.m.position.x -= dt * 0.5; continue; }
      f.vy -= 12 * dt; f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt; f.m.rotation.z += dt * 3;
      if (f.m.position.y < 0) { f.rest = true; f.m.rotation.set(0.3, 0, 0.2); }
    }
    for (const s of puffs) { if (!s.visible) continue; const u = s.userData; u.life -= dt; if (u.life <= 0) { s.visible = false; continue; } s.position.y += dt * 1.6; s.position.x -= dt * (1 + st.v * 0.3); u.r += dt * 1.2; s.scale.setScalar(u.r * 2); s.material.opacity = 0.7 * u.life / 2; }
    for (const s of wake) { if (!s.visible) continue; const u = s.userData; u.life -= dt; if (u.life <= 0) { s.visible = false; continue; } u.r += dt * 1.5; s.scale.setScalar(u.r); s.material.opacity = 0.5 * u.life / 2.5; }
    if (st.running) {
      puffAcc += (st.throttle > 0 ? 10 : 3) * dt;
      while (puffAcc >= 1) { puffAcc--; spawn(puffs, s => { smokePoint.getWorldPosition(s.position); s.userData = { life: 2, r: 0.6 }; }); }
      wakeAcc += st.v * dt * 0.8;
      while (wakeAcc >= 1) { wakeAcc--; spawn(wake, s => { s.position.set(st.x - 6, 0.06, st.z + (Math.random() - 0.5) * 2); s.userData = { life: 2.5, r: 1 }; }); }
    }
    if (st.done && arrivedT > 50) arrivedT = 0;
    arrivedT += dt;
    shake = Math.max(0, shake - dt * 3);
    roll += ((st.steer * Math.min(1, st.v / 3) * 0.12) - roll) * Math.min(1, dt * 4);
  }

  /* ---------- Caméras ---------- */
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tP = new THREE.Vector3(), tL = new THREE.Vector3();
  function placeCamera(st, view, dt) {
    const x = st.x, z = st.z;
    if (view === 'bridge') { tP.set(x - 3.4, 4.5, z - 1.0); tL.set(x + 40, 0.5, z * 0.6 - 0.6); }   // à côté du mât, comme à la barre
    else if (view === 'side') { tP.set(x - 2, 4, z - 24); tL.set(x - 1, 2, z); }
    else { tP.set(x - 26, 11, z - 7); tL.set(x + 10, 1.5, z * 0.7); }
    const k = api.snapNext || view === 'bridge' ? 1 : 1 - Math.exp(-dt * 4);
    api.snapNext = false;
    camPos.lerp(tP, k); camLook.lerp(tL, k);
    camera.position.copy(camPos);
    if (shake) { camera.position.x += (Math.random() - .5) * 0.4 * shake; camera.position.y += (Math.random() - .5) * 0.4 * shake; }
    camera.lookAt(camLook);
    const fov = camera.aspect < 1 ? (view === 'bridge' ? 74 : 66) : (view === 'bridge' ? 60 : 50);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  let size = [0, 0], lastDraw = 0;
  function draw(st, view, W, H) {
    if (W !== size[0] || H !== size[1]) {
      size = [W, H]; renderer.setSize(W, H, false);
      camera.aspect = W / Math.max(1, H); camera.updateProjectionMatrix();
    }
    const now = performance.now(), dt = Math.min(0.05, Math.max(0, (now - (lastDraw || now)) / 1000)); lastDraw = now;
    // Le bateau suit la houle : il monte, descend et roule un peu
    boat.position.set(st.x, Math.sin(tt * 1.6) * 0.12, st.z);
    hull.rotation.x = Math.sin(tt * 1.3) * 0.03 + roll; hull.rotation.z = Math.sin(tt * 1.1) * 0.02 - st.v * 0.002;
    flag.rotation.y = Math.sin(tt * 6) * 0.25;
    TEX.water.offset.x = tt * 0.02; TEX.water.offset.y = -tt * 0.01;
    for (const b of buoys) b.rotation.z = Math.sin(tt * 1.5 + b.position.x) * 0.06;
    beamPivot.rotation.y = tt * 0.8;
    for (const g of gulls) {
      g.a += dt * g.s;
      g.g.position.set(st.x + 8 + Math.cos(g.a) * g.r, g.h + Math.sin(tt * 2 + g.r) * 0.4, st.z + Math.sin(g.a) * g.r); g.g.rotation.y = -g.a;
      for (const w of g.g.children) w.rotation.z = w.userData.side * Math.sin(tt * 8 + g.r) * 0.5;
    }
    // À l'arrivée, les habitants font coucou pendant quelques secondes
    waiting.forEach((p, i) => idle(p, tt * 2 + i, arrivedT < 6));
    idle(captain, tt * 2, false);
    sun.position.set(st.x + 40, 70, -35); sun.target.position.set(st.x, 0, 0);
    placeCamera(st, view, dt);
    for (const m of billboards) m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
    sky.position.copy(camera.position);
    renderer.render(scene, camera);
  }

  return { canvas: renderer.domElement, reset, step, draw, snapNext: true };
}
