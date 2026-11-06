/**
 * fishing3d.js — rendu 3D (Three.js) du mini-jeu « Pêche au ponton ».
 *
 * Ne simule rien : il lit l'état de la partie (fishing.js) et le dessine. Mêmes briques que boat3d.js :
 * aplats (toon), contours encrés, textures dessinées par le code. Repère : le ponton part du rivage (z < 0)
 * et finit en z = 0 ; la mer est devant (z > 0) ; on voit le phare de Port-Agrumes au loin.
 */
const FONT = "'DM Sans', system-ui, sans-serif";
const THREE_URL = 'js/vendor/three.min.js';
const CAST_SPEED = 0.9;                    // durée du vol du bouchon (s), comme fishing.js

let api = null, loading = null;

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

export const Fishing3D = {
  get ready() { return !!api; },
  /** Prépare la 3D (une fois). Rejette sans WebGL ou si Three.js ne se charge pas. */
  load() {
    if (api) return Promise.resolve();
    if (!loading) loading = loadThree().then(THREE => { api = build(THREE); }).catch(e => { loading = null; throw e; });
    return loading;
  },
  attach(stage) { if (api) stage.prepend(api.canvas); },
  detach() { if (api) { api.canvas.remove(); api.portraitTo(null); } },
  /** Nouvelle séance : le pêcheur prend la couleur de t-shirt du joueur */
  reset(shirt) { if (api) api.reset(shirt); },
  step(P, holding, dt) { if (api) api.step(P, holding, dt); },
  draw(P, holding, W, H) { if (api) api.draw(P, holding, W, H); },
  /** Dessine l'espèce `id` dans un canvas 2D (fiche de la prise), en la faisant tourner doucement */
  portrait(id, canvas) { if (api) api.portraitTo(canvas, id); },
};

function build(THREE) {
  const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'mg-3d';

  const scene = new THREE.Scene();
  const HORIZON = '#d8ecef';
  scene.fog = new THREE.Fog(HORIZON, 90, 420);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.08, 1400);
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
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 120 });
  sun.shadow.bias = -0.0008;
  sun.position.set(30, 60, -20); sun.target.position.set(0, 0, 5);
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
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  let seed = 1;
  const r01 = () => rnd(seed++);
  const TEX = {
    planks: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) {
        g.fillStyle = '#e9dccb'; g.globalAlpha = r01() * 0.5; g.fillRect(0, y, w, 32); g.globalAlpha = 1;
        g.strokeStyle = '#c9b49a'; for (let k = 0; k < 4; k++) { const yy = y + 5 + k * 7; g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy + (r01() - .5) * 3); g.stroke(); }
        g.fillStyle = '#7d6a55'; g.fillRect(0, y, w, 2);
      }
    }, [1, 9]),
    wood: canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#c9b49a'; g.lineWidth = 1.2;
      for (let y = 3; y < h; y += 4 + r01() * 4) { g.globalAlpha = 0.5 + r01() * 0.4; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 13 + y) * 1.4); g.stroke(); }
      g.globalAlpha = 1;
    }),
    water: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d7eef6'; g.lineWidth = 2;
      for (let i = 0; i < 26; i++) { const x = r01() * w, y = r01() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 3, x + 12, y); g.stroke(); }
    }, [120, 80]),
  };

  /* ---------- Le pêcheur (chibi), avec la couleur du joueur ---------- */
  const SKIN = '#f6cfaa', EYE = '#2b1d12';
  function chibi(shirt) {
    const g = new THREE.Group(), rig = {};
    for (const side of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(side * 0.17, 0.62, 0); g.add(hip);
      const leg = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.5, 10), mat('#4a6b9a')), 0.025); leg.position.y = -0.25; hip.add(leg);
      const shoe = ink(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.32), mat('#c2453a')), 0.025); shoe.position.set(0, -0.55, 0.05); hip.add(shoe);
    }
    const body = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.62, 14), mat(shirt)), 0.03); body.position.y = 0.92; g.add(body);
    for (const side of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(side * 0.38, 1.16, 0); g.add(sh);
      const sleeve = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.24, 8), mat(shirt)), 0.02); sleeve.position.y = -0.1; sh.add(sleeve);
      const arm = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.26, 8), mat(SKIN)), 0.02); arm.position.y = -0.32; sh.add(arm);
      const hand = ink(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(SKIN)), 0.02); hand.position.y = -0.47; sh.add(hand);
      sh.rotation.z = side * 0.12;
      rig[side < 0 ? 'armL' : 'armR'] = sh; if (side > 0) rig.hand = hand;
    }
    const head = new THREE.Group(); head.position.y = 1.62; g.add(head); rig.head = head;
    head.add(ink(new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 16), mat(SKIN)), 0.035));
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: EYE })); eye.scale.set(1, 1.35, 0.6); eye.position.set(side * 0.15, 0.02, 0.42); head.add(eye);
    }
    // Bob de pêcheur
    const hat = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.56, 0.32, 18), mat('#e8c22e')), 0.025); hat.position.y = 0.36; head.add(hat);
    const brim = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 20), mat('#e8c22e')), 0.02); brim.position.y = 0.22; head.add(brim);
    g.userData.rig = rig;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  /* ---------- Le décor : ponton, mer, îles, bouées, voilier, phare de Port-Agrumes ---------- */
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2000, 1400), mat('#3f93c4', { map: TEX.water }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0, 300); water.receiveShadow = true; scene.add(water);
  // Ponton : plancher, pieux, bittes d'amarrage, une caisse de Sirop & Cie et un seau
  scene.add(box(3.2, 0.3, 34, '#c99a6a', 0, 1.05, -17, { map: TEX.planks }, 0.04));
  for (let z = -33; z <= 0; z += 3.4) for (const x of [-1.5, 1.5]) { const p = cyl(0.16, 0.16, 2.8, '#7b5536', 8, undefined, 0.02); p.position.set(x, -0.3, z); scene.add(p); }
  for (const x of [-1.4, 1.4]) { const b = cyl(0.18, 0.22, 0.5, '#3b3236', 10); b.position.set(x, 1.45, -0.2); scene.add(b); }
  const crate = box(0.9, 0.7, 0.9, '#a57a52', -0.9, 1.55, -2.6, { map: TEX.wood }, 0.025); scene.add(crate);
  ['#d23c4f', '#4fb286', '#e8c22e', '#7b4fb0'].forEach((c, b) => { const bt = cyl(0.11, 0.11, 0.35, c, 8, undefined, 0.012); bt.position.set(-0.9 + (b % 2 ? 0.2 : -0.2), 2.08, -2.6 + (b < 2 ? -0.2 : 0.2)); scene.add(bt); });
  const bucket = cyl(0.3, 0.24, 0.5, '#6c8fb3', 14, undefined, 0.025); bucket.position.set(1.0, 1.45, -1.4); scene.add(bucket);
  const lamp = cyl(0.07, 0.07, 3.2, '#3b3236', 8, undefined, 0.02); lamp.position.set(-1.45, 2.8, -14); scene.add(lamp);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff2b0' })); bulb.position.set(-1.45, 4.5, -14); scene.add(bulb);
  // Îles au loin, bouées, phare-bouteille de Port-Agrumes à l'horizon
  for (let i = 0; i < 7; i++) {
    const isl = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(i % 2 ? '#86b86a' : '#9bc77a'));
    isl.scale.set(25 + rnd(i) * 35, 7 + rnd(i + 3) * 12, 18 + rnd(i + 5) * 18);
    isl.position.set(-240 + i * 80, -2, 190 + rnd(i + 7) * 120); scene.add(isl);
  }
  const buoys = [];
  [[-11, 16, '#d63a4f'], [12, 22, '#3f8f5a'], [-16, 34, '#d63a4f'], [18, 40, '#3f8f5a']].forEach(([x, z, c]) => {
    const b = new THREE.Group(); const body = cyl(0.45, 0.6, 1.4, c, 10); body.position.y = 0.5; b.add(body);
    const top = cyl(0.04, 0.35, 0.5, c, 10); top.position.y = 1.45; b.add(top); b.position.set(x, 0, z); scene.add(b); buoys.push(b);
  });
  const lighthouse = new THREE.Group();
  const lhB = ink(new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 12, 20), mat('#ff8a3d')), 0.08); lhB.position.y = 6; lighthouse.add(lhB);
  const lhN = ink(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 3, 3.5, 20), mat('#ff8a3d')), 0.06); lhN.position.y = 13.7; lighthouse.add(lhN);
  const lhC = cyl(0.2, 1.5, 1.2, '#c2453a', 16); lhC.position.y = 16.5; lighthouse.add(lhC);
  lighthouse.position.set(70, 0, 230); scene.add(lighthouse);
  // Voilier qui passe au large
  const sail = new THREE.Group();
  sail.add(box(5, 1, 1.8, '#fffaf0', 0, 0.5, 0, undefined, 0.04));
  const cloth = new THREE.Mesh(new THREE.ConeGeometry(2, 6, 3), mat('#ffffff')); cloth.scale.set(1, 1, 0.08); cloth.position.set(0, 4, 0); sail.add(cloth);
  scene.add(sail);
  const gulls = [];
  const wingMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.25), wingMat); w.position.x = s * 0.45; w.userData.side = s; g.add(w); }
    scene.add(g); gulls.push({ g, a: rnd(i) * 6, r: 6 + rnd(i + 2) * 6, h: 8 + rnd(i + 4) * 4, s: 0.4 + rnd(i + 6) * 0.4 });
  }

  /* ---------- Canne, fil, bouchon, ronds dans l'eau ---------- */
  let fisher = null, shirtNow = null;
  const rod = new THREE.Group();
  const stick = cyl(0.03, 0.06, 3.2, '#7b5536', 6, undefined, 0.012); stick.geometry.translate(0, 1.6, 0); rod.add(stick);
  const reel = cyl(0.12, 0.12, 0.1, '#3a6ea5', 10); reel.rotation.z = Math.PI / 2; reel.position.set(0.08, 0.5, 0); rod.add(reel);
  const tip = new THREE.Object3D(); tip.position.y = 3.2; rod.add(tip);
  scene.add(rod);
  const LINE_N = 24;
  const lineGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_N * 3), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f6f3ea' }));
  line.frustumCulled = false; scene.add(line);
  const bobber = new THREE.Group();
  bobber.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d63a4f')));
  bobber.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#fffaf0')));
  const bobStick = cyl(0.02, 0.02, 0.25, '#2b1d12', 6, undefined, 0); bobStick.position.y = 0.25; bobber.add(bobStick);
  scene.add(bobber);
  const ripples = [];
  for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.visible = false; scene.add(r); ripples.push(r); }
  function ripple(x, z, big) { const r = ripples.find(k => !k.visible); if (!r) return; r.visible = true; r.position.set(x, 0.05, z); r.userData = { life: 1.2, s: big ? 0.6 : 0.25, k: big ? 3 : 1.6 }; }

  /* ---------- Les poissons (et ce qu'on repêche) ---------- */
  const LOOK = {
    sardine:   { color: '#9fb8c8', belly: '#eef4f7', size: 0.35 },
    rouget:    { color: '#e0604a', belly: '#f6c1a8', size: 0.45 },
    maquereau: { color: '#3f7f8f', belly: '#dfeef0', size: 0.55, stripes: true },
    dorade:    { color: '#c9cbb8', belly: '#f4f1e2', size: 0.7, band: '#e8b52a' },
    bar:       { color: '#7f909c', belly: '#e8edf0', size: 0.95 },
    lune:      { color: '#f2c84b', belly: '#fff2b0', size: 1.3, moon: true },
    botte:     { kind: 'botte', size: 0.6 },
    caisse:    { kind: 'caisse', size: 0.7 },
  };
  function fishMesh(id) {
    const f = LOOK[id] || LOOK.sardine, g = new THREE.Group();
    if (f.kind === 'botte') {
      g.add(box(0.35, 0.7, 0.3, '#5b4636', 0, 0.35, 0, undefined, 0.03));
      g.add(box(0.35, 0.25, 0.6, '#5b4636', 0, 0.12, 0.2, undefined, 0.03));
      return g;
    }
    if (f.kind === 'caisse') {
      g.add(box(0.95, 0.7, 0.95, '#a57a52', 0, 0, 0, { map: TEX.wood }, 0.025));
      ['#d23c4f', '#4fb286', '#e8c22e', '#7b4fb0'].forEach((c, b) => { const bt = cyl(0.11, 0.11, 0.35, c, 8, undefined, 0.012); bt.position.set(b % 2 ? 0.2 : -0.2, 0.5, b < 2 ? -0.2 : 0.2); g.add(bt); });
      return g;
    }
    const body = ink(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat(f.color)), 0.02);
    body.scale.set(1, f.moon ? 0.95 : 0.42, f.moon ? 0.22 : 0.24); g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), mat(f.belly));
    belly.scale.set(0.96, f.moon ? 0.9 : 0.4, f.moon ? 0.21 : 0.23); g.add(belly);
    const tail = ink(new THREE.Mesh(new THREE.ConeGeometry(f.moon ? 0.5 : 0.4, 0.5, 4), mat(f.color)), 0.02);
    tail.rotation.z = Math.PI / 2; tail.scale.set(1, 1, 0.25); tail.position.x = f.moon ? -0.95 : -1.15; g.add(tail);
    const fin = ink(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 3), mat(f.color)), 0.02); fin.scale.set(1.4, 1, 0.2); fin.position.set(-0.1, f.moon ? 0.95 : 0.45, 0); g.add(fin);
    if (f.moon) { const fin2 = fin.clone(); fin2.rotation.z = Math.PI; fin2.position.y = -0.95; g.add(fin2); }
    if (f.stripes) for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.5), mat('#1f4a57')); s.position.set(-0.5 + i * 0.28, 0.18, 0); s.rotation.z = 0.4; g.add(s); }
    if (f.band) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 16, Math.PI), mat(f.band)); b.position.set(0.55, 0.05, 0); b.rotation.set(0, Math.PI / 2, Math.PI / 2); b.scale.set(1, 0.6, 1); g.add(b); }
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); eye.position.set(0.68, 0.12, s * 0.2); g.add(eye);
      const pup = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#2b1d12' })); pup.position.set(0.72, 0.12, s * 0.25); g.add(pup);
    }
    return g;
  }
  let jumper = null;                                 // le poisson qui saute sur le ponton à la prise

  /* ---------- Portrait de la prise : petit rendu à part, recopié dans le canvas de la fiche ---------- */
  let pRenderer = null, pScene = null, pCam = null, pFish = null, pTarget = null;
  function portraitTo(canvas, id) {
    pTarget = canvas;
    if (!canvas) return;
    if (!pRenderer) {
      pRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      pRenderer.setSize(192, 192, false);
      pScene = new THREE.Scene(); pCam = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
      pScene.add(new THREE.HemisphereLight('#ffffff', '#88aaaa', 0.8));
      const l = new THREE.DirectionalLight('#ffffff', 0.7); l.position.set(2, 3, 4); pScene.add(l);
    }
    if (pFish) pScene.remove(pFish);
    pFish = fishMesh(id); pScene.add(pFish);
    const L = LOOK[id] || {}, k = L.kind ? 1.8 : L.moon ? 2.4 : 2.6;
    pCam.position.set(0.3, 0.6, k * 1.6); pCam.lookAt(0, L.kind ? 0.2 : 0, 0);
  }
  function drawPortrait(tt) {
    if (!pTarget || !pFish || !pTarget.isConnected || !pTarget.offsetParent) return;
    pFish.rotation.y = Math.sin(tt * 1.2) * 0.45;
    pRenderer.render(pScene, pCam);
    const g = pTarget.getContext('2d'); g.clearRect(0, 0, pTarget.width, pTarget.height); g.drawImage(pRenderer.domElement, 0, 0, pTarget.width, pTarget.height);
  }

  /* ---------- Où tombe le bouchon pour un lancer de d mètres ---------- */
  const castTo = d => new THREE.Vector3(0.5 + d * 0.12, 0, 0.5 + d);
  const ROOT = new THREE.Vector3(0.6, 0, 0.6);      // le pied du ponton, côté mer
  const bob = new THREE.Vector3(), lastBob = new THREE.Vector3(), from = new THREE.Vector3(), a = new THREE.Vector3();
  let tt = 0, seenSplash = 0, lastPhase = '', camT = new THREE.Vector3(1, 0.8, 14), size = [0, 0], jumpFrom = new THREE.Vector3();

  function reset(shirt) {
    if (!fisher || shirtNow !== shirt) {
      if (fisher) scene.remove(fisher);
      shirtNow = shirt;
      fisher = chibi(shirt || '#e0703a');
      fisher.position.set(0.3, 1.2, -0.8); fisher.rotation.y = 0.12; scene.add(fisher);
    }
    if (jumper) { scene.remove(jumper); jumper = null; }
    seenSplash = 0; lastPhase = '';
  }

  /** Suit la partie : bouchon, ronds dans l'eau, poisson qui saute */
  function step(P, holding, dt) {
    tt += dt;
    for (const r of ripples) { if (!r.visible) continue; const u = r.userData; u.life -= dt; if (u.life <= 0) { r.visible = false; continue; } u.s += dt * u.k; r.scale.setScalar(u.s); r.material.opacity = 0.7 * u.life / 1.2; }
    if (P.phase !== lastPhase) {
      if (P.phase === 'fly') { tip.getWorldPosition(from); }
      if (P.phase === 'caught') {
        jumpFrom.copy(lastBob);
        if (jumper) scene.remove(jumper);
        jumper = fishMesh(P.fish.id); jumper.scale.setScalar((LOOK[P.fish.id] || {}).size || 0.5); scene.add(jumper);
      }
      if (P.phase === 'idle' && jumper) { scene.remove(jumper); jumper = null; }
      lastPhase = P.phase;
    }
    const to = castTo(P.castDist);
    if (P.phase === 'fly') {
      const k = Math.min(1, P.t / CAST_SPEED);
      bob.lerpVectors(from, to, k); bob.y = from.y * (1 - k) + Math.sin(k * Math.PI) * (2 + P.castDist * 0.25);
    } else if (P.phase === 'wait' || P.phase === 'bite') bob.copy(to);
    else if (P.phase === 'fight') {
      bob.lerpVectors(ROOT, to, Math.min(1, Math.max(0, P.dist) / Math.max(1, P.dist0)));
      bob.x += Math.sin(P.t * 3) * 0.5 * (P.surge > 0 ? 1.5 : 0.4);
    }
    if (P.phase === 'fly' || P.phase === 'wait' || P.phase === 'bite' || P.phase === 'fight') lastBob.copy(bob);
    if (P.splash > seenSplash) { seenSplash = P.splash; ripple(lastBob.x, lastBob.z, true); }
    if (P.phase === 'wait' && P.nib > 0.3) ripple(bob.x, bob.z, false);
    if (P.phase === 'caught' && jumper) {               // le poisson sort de l'eau et atterrit sur le ponton
      const k = Math.min(1, P.t / 1.1), land = new THREE.Vector3(0.9, 1.6, -0.6);
      jumper.position.lerpVectors(jumpFrom, land, k); jumper.position.y += Math.sin(k * Math.PI) * 3;
      jumper.rotation.set(0, Math.PI / 2, Math.sin(P.t * 12) * 0.5 * (1 - k));
    }
    // Canne : levée au repos, en arrière pendant la charge, pliée quand le poisson tire
    const r = fisher.userData.rig;
    r.hand.getWorldPosition(a); rod.position.copy(a);
    let pitch = 0.55, bend = 0;
    if (P.phase === 'charge') pitch = 0.55 - P.power * 1.1;
    else if (P.phase === 'fly') pitch = 0.55 + Math.min(1, P.t / 0.25) * 0.5;
    else if (P.phase === 'fight') bend = P.tension * 0.6;
    else if (P.phase === 'bite') bend = 0.2 + Math.sin(tt * 30) * 0.08;
    rod.rotation.set(pitch + bend, 0.25, 0);
    r.armR.rotation.x = -1.2 - (P.phase === 'charge' ? P.power * 0.8 : 0);
    if (P.phase === 'fight' && holding) reel.rotation.x += 0.3;
  }

  function drawLine(P) {
    const show = ['fly', 'wait', 'bite', 'fight', 'miss'].includes(P.phase);
    line.visible = bobber.visible = show;
    if (!show) return;
    tip.getWorldPosition(a);
    let by = bob.y;
    if (P.phase === 'wait') by = Math.sin(tt * 2.2) * 0.04 - (P.nib > 0 ? Math.sin(P.nib * 30) * 0.08 : 0);
    else if (P.phase === 'bite') by = -0.35;
    else if (P.phase === 'fight') by = -0.15 + Math.sin(tt * 9) * 0.06;
    else if (P.phase === 'miss') { bob.copy(lastBob); by = 0; }
    bobber.position.set(bob.x, by, bob.z);
    const p = lineGeo.attributes.position.array, sag = P.phase === 'fight' ? 0.1 + (1 - P.tension) * 0.3 : 0.5;
    for (let i = 0; i < LINE_N; i++) {
      const k = i / (LINE_N - 1);
      p[i * 3] = a.x + (bob.x - a.x) * k; p[i * 3 + 2] = a.z + (bob.z - a.z) * k;
      p[i * 3 + 1] = a.y + (by + 0.3 - a.y) * k - Math.sin(k * Math.PI) * sag;
    }
    lineGeo.attributes.position.needsUpdate = true;
  }

  let lastDraw = 0;
  function draw(P, holding, W, H) {
    if (W !== size[0] || H !== size[1]) {
      size = [W, H]; renderer.setSize(W, H, false);
      camera.aspect = W / Math.max(1, H); camera.updateProjectionMatrix();
      camera.fov = camera.aspect < 1 ? 62 : 48; camera.updateProjectionMatrix();
    }
    const now = performance.now(), dt = Math.min(0.05, Math.max(0, (now - (lastDraw || now)) / 1000)); lastDraw = now;
    drawLine(P);
    TEX.water.offset.x = tt * 0.01; TEX.water.offset.y = -tt * 0.006;
    for (const b of buoys) b.rotation.z = Math.sin(tt * 1.5 + b.position.x) * 0.06;
    sail.position.set(-120 + ((tt * 3) % 240), Math.sin(tt * 1.2) * 0.15, 95);
    for (const g of gulls) {
      g.a += dt * g.s;
      g.g.position.set(4 + Math.cos(g.a) * g.r * 1.5, g.h + Math.sin(tt * 2 + g.r) * 0.4, 14 + Math.sin(g.a) * g.r); g.g.rotation.y = -g.a;
      for (const w of g.g.children) w.rotation.z = w.userData.side * Math.sin(tt * 8 + g.r) * 0.5;
    }
    const rg = fisher.userData.rig;
    rg.head.position.y = 1.62 + Math.sin(tt * 0.6) * 0.015;
    // Caméra : derrière l'épaule du pêcheur ; elle suit le bouchon quand la ligne est à l'eau
    const follow = ['fly', 'wait', 'bite', 'fight'].includes(P.phase);
    const look = follow ? bob : new THREE.Vector3(1, 0.8, 14);
    camT.lerp(look, 1 - Math.exp(-dt * 2.5));
    camera.position.set(-1.6, 4.4, -7.2);
    camera.lookAt(camT.x, Math.max(0, camT.y), Math.max(6, camT.z));
    sky.position.copy(camera.position);
    renderer.render(scene, camera);
    drawPortrait(tt);
  }

  return { canvas: renderer.domElement, reset, step, draw, portraitTo };
}
