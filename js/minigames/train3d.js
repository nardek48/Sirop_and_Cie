/**
 * train3d.js — rendu 3D (Three.js) du mini-jeu « Ligne des Fraises ».
 *
 * Ne simule rien : il lit l'état du mini-jeu (train.js) et le dessine en 3D.
 * Three.js (js/vendor/three.min.js, r128, licence MIT) n'est chargé qu'à la première
 * ouverture du train ; sans WebGL, train.js garde son rendu 2D.
 * Rendu « illustré » : ombrage en aplats (toon), contours encrés, textures dessinées par le code.
 *
 * Vues : 'cab' (dans la cabine), 'chase' (poursuite), 'side' (de côté).
 */
const FONT = "'DM Sans', system-ui, sans-serif";
const THREE_URL = 'js/vendor/three.min.js';

let api = null;          // scène construite (une seule fois, réutilisée d'une partie à l'autre)
let loading = null;

/** Charge Three.js par une balise <script> classique (il s'expose en window.THREE) */
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

export const Train3D = {
  /** @returns {boolean} la scène 3D est prête */
  get ready() { return !!api; },

  /**
   * Prépare la 3D (une fois). Rejette sans WebGL ou si Three.js ne se charge pas.
   * @param {object} D  { CFG, LINE, limitAt, nextSegment, signAt, rnd } du mini-jeu
   */
  load(D) {
    if (api) return Promise.resolve();
    if (!loading) loading = loadThree().then(THREE => { api = build(THREE, D); }).catch(e => { loading = null; throw e; });
    return loading;
  },

  /** Place le canvas WebGL dans la zone de jeu (sous le canvas 2D, qui est alors caché) */
  attach(stage) { if (api) stage.prepend(api.canvas); },
  detach() { if (api) api.canvas.remove(); },
  /** Logique visuelle : fumée, bouteilles qui tombent, leviers (dt en secondes) */
  step(st, dt) { if (api) api.step(st, dt); },
  /** Dessine la vue demandée à la taille de la zone de jeu (pixels CSS) */
  draw(st, view, W, H) { if (api) api.draw(st, view, W, H); },
};

function build(THREE, D) {
  const { CFG, LINE, limitAt, signAt, rnd } = D;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'mg-3d';

  const scene = new THREE.Scene();
  const HORIZON = '#e3f1e6';
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

  // Trois tons de lumière : clair, mi-teinte, ombre (comme un dessin colorié)
  const TOON = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.LuminanceFormat);
  TOON.minFilter = TOON.magFilter = THREE.NearestFilter; TOON.generateMipmaps = false; TOON.needsUpdate = true;

  /** Matériaux mis en cache par couleur + texture */
  const mats = {};
  const mat = (color, o = {}) => {
    const k = color + (o.map ? o.map.uuid : '') + (o.opacity || '') + (o.emissive || '');
    return mats[k] || (mats[k] = new THREE.MeshToonMaterial({ color, gradientMap: TOON, ...o }));
  };
  /** Contour encré : copie un peu plus grande, vue de l'intérieur, en brun très foncé */
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

  /* ---------- Textures dessinées par le code (aucun fichier à télécharger) ---------- */
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  let seed = 1;
  const r01 = () => rnd(seed++);
  /** Taches semi-transparentes : herbe, gravier, enduit */
  function speckle(g, w, h, n, colors, rMin, rMax, alpha) {
    for (let i = 0; i < n; i++) {
      g.globalAlpha = alpha * (0.5 + r01() * 0.5); g.fillStyle = colors[Math.floor(r01() * colors.length)];
      g.beginPath(); g.arc(r01() * w, r01() * h, rMin + r01() * (rMax - rMin), 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }
  const TEX = {};
  function buildTextures() {
    // Herbe : nuances et petits brins
    TEX.grass = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 500, ['#d6e6c4', '#eef6e2', '#c7dbb2'], 3, 10, 0.55);
      g.strokeStyle = '#a9c58e'; g.lineWidth = 1.4;
      for (let i = 0; i < 260; i++) { const x = r01() * w, y = r01() * h; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r01() - .5) * 3, y - 3 - r01() * 4); g.stroke(); }
      g.globalAlpha = 1;
    }, [90, 45]);
    // Ballast : cailloux
    TEX.ballast = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#b5a68c'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 520, ['#8e8170', '#cfc2aa', '#a3957e', '#e2d7c2', '#6f6556'], 1.2, 3.4, 0.9);
    }, [1, 1]);
    // Bois : veines et nœuds (traverses, plancher, wagon)
    TEX.wood = canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#c9b49a'; g.lineWidth = 1.2;
      for (let y = 3; y < h; y += 4 + r01() * 4) { g.globalAlpha = 0.5 + r01() * 0.4; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 13 + y) * 1.4); g.stroke(); }
      g.globalAlpha = 0.7; g.fillStyle = '#b39a7c'; g.beginPath(); g.ellipse(w * 0.66, h * 0.45, 5, 3, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    });
    // Planches : bandes séparées par un joint sombre
    TEX.planks = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) {
        g.fillStyle = '#e9dccb'; g.globalAlpha = r01() * 0.5; g.fillRect(0, y, w, 32); g.globalAlpha = 1;
        g.strokeStyle = '#c9b49a'; for (let k = 0; k < 4; k++) { const yy = y + 5 + k * 7; g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy + (r01() - .5) * 3); g.stroke(); }
        g.fillStyle = '#7d6a55'; g.fillRect(0, y, w, 2);
      }
    }, [2, 1]);
    // Tôle rivetée (chaudière, cabine) : joints et rivets
    TEX.rivets = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#d8cfc8'; g.fillRect(0, 0, w, 3); g.fillRect(0, h / 2, w, 3); g.fillRect(w / 2, 0, 3, h);
      g.fillStyle = '#bdb2aa';
      for (let x = 6; x < w; x += 12) { g.beginPath(); g.arc(x, 9, 1.8, 0, 7); g.fill(); g.beginPath(); g.arc(x, h / 2 + 9, 1.8, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(0, h * 0.18, w, h * 0.08);
    });
    // Enduit de la gare, avec soubassement en pierre
    TEX.plaster = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 400, ['#efe4d2', '#f7efe2', '#e6d8c2'], 4, 14, 0.5);
      g.fillStyle = '#c9b79b'; g.fillRect(0, h * 0.82, w, h * 0.18);
      g.strokeStyle = '#a8957a'; g.lineWidth = 2;
      for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x + (Math.floor(x / 32) % 2) * 16, h * 0.82); g.lineTo(x + (Math.floor(x / 32) % 2) * 16, h); g.stroke(); }
      g.beginPath(); g.moveTo(0, h * 0.91); g.lineTo(w, h * 0.91); g.stroke();
    }, [3, 1]);
    // Tuiles en écailles
    TEX.tiles = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d9a59a'; g.lineWidth = 2.5;
      for (let row = 0; row < 9; row++) for (let i = -1; i < 9; i++) {
        const x = i * 16 + (row % 2) * 8, y = row * 16;
        g.beginPath(); g.arc(x + 8, y, 8, 0, Math.PI); g.stroke();
      }
    }, [6, 2]);
    // Pavés du quai
    TEX.paving = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) for (let x = -(y / 16 % 2) * 16; x < w; x += 32) {
        g.fillStyle = `hsl(36,25%,${86 + r01() * 10}%)`; g.fillRect(x + 1, y + 1, 30, 14);
      }
    }, [12, 1]);
    // Eau : vaguelettes (la texture glisse avec le temps)
    TEX.water = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d7eef6'; g.lineWidth = 2;
      for (let i = 0; i < 26; i++) { const x = r01() * w, y = r01() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 3, x + 12, y); g.stroke(); }
    }, [10, 60]);
  }

  /** Panneau sur poteau, tourné vers le train qui arrive (face vers −X) */
  function sign(x, text, kind, z = 2.7) {
    const tex = canvasTex(256, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
      if (kind === 'round') {
        g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, h / 2, 120, 0, 7); g.fill();
        g.strokeStyle = '#d63a4f'; g.lineWidth = 30; g.beginPath(); g.arc(w / 2, h / 2, 104, 0, 7); g.stroke();
        g.strokeStyle = '#2b1d12'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, 123, 0, 7); g.stroke();
        g.fillStyle = '#2a2433'; g.font = `700 100px ${FONT}`; g.fillText(text, w / 2, h / 2 + 6);
      } else if (kind === 'stop') {
        g.fillStyle = '#d63a4f'; g.beginPath();
        for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; g.lineTo(w / 2 + Math.cos(a) * 124, h / 2 + Math.sin(a) * 124); }
        g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 9; g.stroke();
        g.fillStyle = '#fff'; g.font = `800 76px ${FONT}`; g.fillText(text, w / 2, h / 2 + 4);
      } else {
        g.fillStyle = '#fffaf0'; g.fillRect(28, 64, 200, 128); g.strokeStyle = '#3b2a1a'; g.lineWidth = 10; g.strokeRect(28, 64, 200, 128);
        g.fillStyle = '#3b2a1a'; g.font = `700 92px ${FONT}`; g.fillText(text, w / 2, h / 2 + 6);
      }
    });
    const size = kind === 'mark' ? 1.1 : 1.5, top = kind === 'mark' ? 2.0 : 3.1;
    const base = z < -2.2 && x >= LINE.platform[0] && x <= LINE.platform[1] ? 1.0 : 0;   // posé sur le quai
    const post = cyl(0.06, 0.06, top + 0.2, '#5b5560', 8, undefined, 0.025); post.position.set(x + 0.05, base + (top + 0.2) / 2, z); scene.add(post);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4 }));
    face.rotation.y = -Math.PI / 2; face.position.set(x, base + top, z); scene.add(face);
    if (kind !== 'mark') {
      const back = new THREE.Mesh(new THREE.CircleGeometry(size * 0.47, 24), mat('#9aa0a8'));
      back.rotation.y = Math.PI / 2; back.position.set(x + 0.03, base + top, z); scene.add(back);
    }
  }

  function buildWorld() {
    const [b0, b1] = LINE.bridge;
    const riverA = b0 + 8, riverB = b1 - 8;
    const M = new THREE.Matrix4();

    // Sol : deux prairies, la rivière entre les deux
    for (const [a, b] of [[-320, riverA], [riverB, 1160]]) {
      const tex = TEX.grass.clone(); tex.needsUpdate = true; tex.repeat.set((b - a) / 9, 700 / 9);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 700), mat('#7fae58', { map: tex }));
      g.rotation.x = -Math.PI / 2; g.position.set((a + b) / 2, 0, 0); g.receiveShadow = true; scene.add(g);
    }
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(riverB - riverA + 4, 700), mat('#6b8a5a'));
    bed.rotation.x = -Math.PI / 2; bed.position.set((riverA + riverB) / 2, -3.2, 0); scene.add(bed);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(riverB - riverA, 700), mat('#4f9fc4', { map: TEX.water, transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2; water.position.set((riverA + riverB) / 2, -1.6, 0); water.receiveShadow = true; scene.add(water);
    for (const x of [riverA, riverB]) scene.add(box(2, 3.2, 700, '#8a7656', x, -1.6, 0, undefined, 0));   // berges

    // Bandes de couleur des zones de vitesse, le long de la voie (comme la frise du jeu)
    const addStrip = (a, b, z, color) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 0.9), mat(color));
      m.rotation.x = -Math.PI / 2; m.position.set((a + b) / 2, 0.02, z); m.receiveShadow = true; scene.add(m);
    };
    for (const s of LINE.segments) for (const z of [-2.35, 2.35]) {
      if (s.from < b1 && s.to > b0) { for (const [a, b] of [[s.from, Math.min(s.to, b0)], [Math.max(s.from, b1), s.to]]) if (b > a) addStrip(a, b, z, s.color); }
      else addStrip(s.from, s.to, z, s.color);
    }

    // Ballast, traverses (instanciées), rails
    const x0 = -60, x1 = LINE.end + 2;
    for (const [a, b] of [[x0, b0], [b1, x1]]) {
      const t = TEX.ballast.clone(); t.needsUpdate = true; t.repeat.set((b - a) / 2.5, 1.3);
      scene.add(box(b - a, 0.3, 3.2, '#ffffff', (a + b) / 2, 0.15, 0, { map: t }, 0));
    }
    const step = 0.7, n = Math.floor((x1 - x0) / step);
    const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.14, 2.5), mat('#8a6040', { map: TEX.wood }), n);
    for (let i = 0; i < n; i++) { M.makeTranslation(x0 + i * step, 0.37, 0); sleepers.setMatrixAt(i, M); }
    sleepers.receiveShadow = true; scene.add(sleepers);
    for (const z of [-0.72, 0.72]) {
      scene.add(box(x1 - x0, 0.16, 0.12, '#8d8f95', (x0 + x1) / 2, 0.52, z, undefined, 0));
      scene.add(box(x1 - x0, 0.03, 0.06, '#e6e8ec', (x0 + x1) / 2, 0.61, z, undefined, 0));   // champignon poli du rail
    }

    // Pont : tablier, piles, poutres latérales et croisillons
    scene.add(box(b1 - b0, 0.7, 4.6, '#9a8b78', (b0 + b1) / 2, -0.05, 0, { map: TEX.paving }, 0));
    for (let x = b0 + 10; x < b1; x += 22) { const p = cyl(1.1, 1.4, 3.6, '#a39380', 10, { map: TEX.plaster }); p.position.set(x, -2.0, 0); scene.add(p); }
    for (const z of [-2.5, 2.5]) {
      scene.add(box(b1 - b0, 0.25, 0.25, '#6a4c93', (b0 + b1) / 2, 2.0, z, undefined, 0.03));
      scene.add(box(b1 - b0, 0.3, 0.3, '#6a4c93', (b0 + b1) / 2, 0.4, z, undefined, 0.03));
      for (let x = b0; x <= b1; x += 6.5) {
        scene.add(box(0.22, 1.7, 0.22, '#6a4c93', x, 1.2, z, undefined, 0.03));
        const d = box(0.16, 2.3, 0.16, '#8a6cb5', x + 3.25, 1.2, z, undefined, 0.025); d.rotation.z = (Math.floor((x - b0) / 6.5) % 2 ? 1 : -1) * 0.95; scene.add(d);
      }
    }

    // Quais : départ et Gare des Fraises (à gauche du conducteur ; la vue « Côté » regarde depuis la droite)
    const [p0, p1] = LINE.platform;
    scene.add(box(p1 - p0, 1.0, 4.2, '#e2d2b4', (p0 + p1) / 2, 0.5, -4.0, { map: TEX.paving }, 0.04));
    scene.add(box(p1 - p0, 0.04, 0.3, '#f2c84b', (p0 + p1) / 2, 1.02, -2.15, undefined, 0));
    const t2 = TEX.paving.clone(); t2.needsUpdate = true; t2.repeat.set(6, 1);
    scene.add(box(30, 1.0, 3.6, '#e2d2b4', 12, 0.5, -3.7, { map: t2 }, 0.04));
    station(760, -11);
    depot(14, -9);

    // Panneaux de vitesse : au début réel de chaque limite ; STOP et repères 20, 10, 5 sur le quai
    for (const seg of LINE.segments) sign(signAt(seg), String(seg.limit), 'round');
    sign(LINE.stopAt, 'STOP', 'stop', -2.5);
    for (const r of [20, 10, 5]) sign(LINE.stopAt - r, String(r), 'mark', -2.5);

    // Butoir
    scene.add(box(0.8, 1.2, 2.6, '#c2453a', LINE.end + 1.4, 0.9, 0));
    scene.add(box(0.3, 0.5, 2.2, '#fffaf0', LINE.end + 0.9, 1.2, 0));

    // Champ de fraises en face de la gare : rangs de plants, fruits rouges, sillons de terre
    const rows = 9, perRow = 34, plants = rows * perRow;
    const bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.55, 0), mat('#3f8f5a'), plants);
    const fruit = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.2, 0), mat('#e0303f'), plants * 2);
    let k = 0, f = 0;
    for (let r = 0; r < rows; r++) for (let i = 0; i < perRow; i++) {
      const x = 690 + i * 3.4 + rnd(k) * 0.8, z = 10 + r * 2.6;
      M.makeTranslation(x, 0.35, z); bush.setMatrixAt(k++, M);
      for (let j = 0; j < 2; j++) { M.makeTranslation(x + (rnd(k * 3 + j) - .5) * 0.9, 0.55, z + (rnd(k * 7 + j) - .5) * 0.9); fruit.setMatrixAt(f++, M); }
    }
    bush.castShadow = true; scene.add(bush, fruit);
    for (let r = 0; r < rows; r++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(118, 1.4), mat('#a57a52'));
      m.rotation.x = -Math.PI / 2; m.position.set(746, 0.03, 10 + r * 2.6); scene.add(m);
    }

    // Arbres (troncs et feuillages instanciés, avec leur contour), à l'écart de la voie, de la rivière et des bâtiments
    const N = 460;
    const crownGeo = new THREE.IcosahedronGeometry(1.7, 0), trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 2.2, 6);
    const trunks = new THREE.InstancedMesh(trunkGeo, mat('#7b5536', { map: TEX.wood }), N);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshToonMaterial({ gradientMap: TOON }), N);
    const crownInk = new THREE.InstancedMesh(crownGeo, INK, N), trunkInk = new THREE.InstancedMesh(trunkGeo, INK, N);
    const greens = ['#4f9a4a', '#6aaf4f', '#3d8045', '#86bf5a'].map(c => new THREE.Color(c));
    const q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    let t = 0;
    for (let i = 0; t < N && i < N * 4; i++) {
      const x = -200 + rnd(i) * 1300, side = rnd(i + 999) < 0.5 ? -1 : 1, z = side * (9 + rnd(i + 77) ** 1.6 * 230);
      if (x > riverA - 6 && x < riverB + 6) continue;
      if (z > 0 && z < 26) continue;                             // couloir dégagé pour la vue « Côté »
      if (x > 680 && x < 812 && z > 6 && z < 36) continue;       // champ de fraises
      if (x > 735 && x < 790 && z < -6 && z > -20) continue;     // gare
      if (x > -4 && x < 30 && z < -4 && z > -16) continue;       // dépôt
      const s = 0.75 + rnd(i + 5) * 0.9, sy = s * (0.9 + rnd(i + 8) * 0.5);
      pos.set(x, 1.1 * s, z); sc.set(s, s, s); trunks.setMatrixAt(t, M.compose(pos, q, sc));
      sc.set(s * 1.25, s * 1.06, s * 1.25); trunkInk.setMatrixAt(t, M.compose(pos, q, sc));
      pos.set(x, 3.4 * s, z); sc.set(s, sy, s); crowns.setMatrixAt(t, M.compose(pos, q, sc));
      sc.set(s * 1.05, sy * 1.05, s * 1.05); crownInk.setMatrixAt(t, M.compose(pos, q, sc));
      crowns.setColorAt(t, greens[Math.floor(rnd(i + 3) * greens.length)]);
      t++;
    }
    for (const m of [trunks, crowns, crownInk, trunkInk]) m.count = t;
    trunks.castShadow = crowns.castShadow = true;
    scene.add(trunks, crowns, crownInk, trunkInk);

    // Collines au loin et nuages
    for (let i = 0; i < 9; i++) {
      const h = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(i % 2 ? '#9bc77a' : '#86b86a'));
      h.scale.set(120 + rnd(i) * 90, 26 + rnd(i + 2) * 30, 70 + rnd(i + 4) * 50);
      h.position.set(-150 + i * 150, -4, (i % 2 ? 1 : -1) * (300 + rnd(i + 6) * 60)); scene.add(h);
    }
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 4; j++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + rnd(i * 9 + j) * 4, 0), mat('#ffffff')); p.position.set(j * 5, rnd(i + j) * 2, rnd(j + i * 2) * 3); g.add(p); }
      g.position.set(-150 + rnd(i) * 1200, 55 + rnd(i + 1) * 25, (rnd(i + 2) - .5) * 400); g.scale.y = 0.55; scene.add(g);
    }
    return { water };
  }

  /** Gare des Fraises : bâtiment, toit de tuiles, fenêtres, auvent et enseigne côté voie */
  function station(x, z) {
    scene.add(box(26, 4.6, 7, '#f3e3c3', x, 3.3, z, { map: TEX.plaster }));
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 6.2, 3, 4, 1), mat('#c2453a', { map: TEX.tiles }));
    roof.rotation.y = Math.PI / 4; roof.scale.set(2.35, 1, 0.8); roof.position.set(x, 7.1, z); roof.castShadow = true; scene.add(ink(roof, 0.05));
    for (let i = -2; i <= 2; i++) {
      if (i === 2) continue;
      scene.add(box(1.8, 2.2, 0.12, '#fffaf0', x + i * 4.6, 3.6, z + 3.52, undefined, 0.03));
      scene.add(box(1.4, 1.8, 0.14, '#6c8fb3', x + i * 4.6, 3.6, z + 3.55, undefined, 0));
    }
    scene.add(box(2.2, 3, 0.14, '#7b5536', x + 9.6, 2.5, z + 3.55, { map: TEX.planks }));
    scene.add(box(30, 0.25, 4.6, '#d98a1c', x, 5.4, -4.6, { map: TEX.planks }, 0.04));
    for (const dx of [-13, -4.5, 4.5, 13]) { const p = cyl(0.12, 0.12, 4.4, '#5b5560', 8, undefined, 0.03); p.position.set(x + dx, 3.2, -3.0); scene.add(p); }
    const tex = canvasTex(1024, 192, (g, w, h) => {
      g.fillStyle = '#3b2a1a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fffaf0'; g.fillRect(10, 10, w - 20, h - 20);
      g.fillStyle = '#c2453a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 104px Fraunces, Georgia, serif`;
      g.fillText('Gare des Fraises', w / 2, h / 2 + 6);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.4), new THREE.MeshBasicMaterial({ map: tex }));
    board.position.set(x, 5.8, z + 3.6);               // tournée vers la voie (+Z)
    scene.add(board);
  }

  /** Dépôt de Sirop & Cie au départ */
  function depot(x, z) {
    scene.add(box(14, 5, 8, '#e8d2b0', x, 2.5, z, { map: TEX.plaster }));
    scene.add(box(15, 0.6, 9, '#6a4c93', x, 5.3, z));
    scene.add(box(4, 3.4, 0.14, '#7b5536', x, 1.7, z + 4.05, { map: TEX.planks }));
    const ch = cyl(0.6, 0.7, 4, '#a85a3a', 10, { map: TEX.plaster }); ch.position.set(x + 4, 7, z + 2); scene.add(ch);
  }

  /* ---------- Le train : l'avant de la loco est à st.x (comme dans le mini-jeu) ---------- */
  const train = new THREE.Group();
  const wheels = [];
  const bottleMeshes = [];
  const chimneyTop = new THREE.Object3D();
  const BOTTLE_COLORS = ['#c2453a', '#3f8f5a', '#e8b52a'];   // grenadine, menthe, citron
  const cab = {};                                            // pièces animées de la cabine

  /** Paroi percée (fenêtres, passage de la chaudière) : forme extrudée */
  function wall(outer, holes, depth, color, o) {
    const sh = new THREE.Shape(); sh.moveTo(outer[0], outer[1]); sh.lineTo(outer[2], outer[1]); sh.lineTo(outer[2], outer[3]); sh.lineTo(outer[0], outer[3]); sh.closePath();
    for (const h of holes) {
      const p = new THREE.Path();
      if (h.r) p.absarc(h.x, h.y, h.r, 0, Math.PI * 2, true);
      else { const r = 0.08; p.moveTo(h.x0 + r, h.y0); p.lineTo(h.x1 - r, h.y0); p.quadraticCurveTo(h.x1, h.y0, h.x1, h.y0 + r); p.lineTo(h.x1, h.y1 - r);
        p.quadraticCurveTo(h.x1, h.y1, h.x1 - r, h.y1); p.lineTo(h.x0 + r, h.y1); p.quadraticCurveTo(h.x0, h.y1, h.x0, h.y1 - r); p.lineTo(h.x0, h.y0 + r); p.quadraticCurveTo(h.x0, h.y0, h.x0 + r, h.y0); }
      sh.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 20 });
    const m = new THREE.Mesh(g, mat(color, o)); m.castShadow = m.receiveShadow = true; return m;
  }

  /** Cadran de la cabine : compteur (zone rouge au-dessus de la limite) ou manomètre */
  function dialCanvas() { const c = document.createElement('canvas'); c.width = c.height = 256; return c; }
  function drawSpeedDial(c, kmh, lim) {
    const g = c.getContext('2d'), x = 128, y = 128, r = 112, max = CFG.VMAX * 3.6;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, ang = v => a0 + (v / max) * (a1 - a0);
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#fbf3e6'; g.beginPath(); g.arc(x, y, r + 14, 0, 7); g.fill();
    g.strokeStyle = 'rgba(214,58,79,.8)'; g.lineWidth = 14; g.beginPath(); g.arc(x, y, r * 0.84, ang(lim), a1); g.stroke();
    g.strokeStyle = '#2a2433'; g.fillStyle = '#2a2433'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 20px ${FONT}`;
    for (let v = 0; v <= max; v += 10) {
      const a = ang(v), long = v % 20 === 0; g.lineWidth = long ? 4 : 2;
      g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.97, y + Math.sin(a) * r * 0.97); g.lineTo(x + Math.cos(a) * r * (long ? 0.78 : 0.86), y + Math.sin(a) * r * (long ? 0.78 : 0.86)); g.stroke();
      if (long) g.fillText(v, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62);
    }
    const over = kmh > lim + CFG.TOLERANCE_KMH, a = ang(Math.min(kmh, max));
    g.strokeStyle = over ? '#d63a4f' : '#2a2433'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86); g.stroke();
    g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill();
    g.fillStyle = over ? '#d63a4f' : '#2a2433'; g.font = `800 38px ${FONT}`; g.fillText(Math.round(kmh), x, y + r * 0.45);
    g.font = `600 15px ${FONT}`; g.fillStyle = '#8a735a'; g.fillText('km/h', x, y + r * 0.7);
  }

  function buildTrain() {
    const loco = new THREE.Group();
    const red = '#c2453a', dark = '#2f2a2e', brass = '#d9a23a';
    loco.add(box(9.2, 0.55, 2.4, dark, -4.6, 1.05, 0));                         // châssis
    const boiler = cyl(1.0, 1.0, 5.6, red, 20, { map: TEX.rivets }); boiler.rotation.z = Math.PI / 2; boiler.position.set(-3.1, 2.2, 0); loco.add(boiler);
    const front = cyl(1.04, 1.04, 0.5, dark, 20); front.rotation.z = Math.PI / 2; front.position.set(-0.3, 2.2, 0); loco.add(front);
    for (const x of [-1.6, -3.4, -5.0]) { const b = cyl(1.05, 1.05, 0.14, brass, 20, undefined, 0); b.rotation.z = Math.PI / 2; b.position.set(x, 2.2, 0); loco.add(b); }
    const chim = cyl(0.42, 0.3, 1.3, dark, 12); chim.position.set(-1.1, 3.6, 0); loco.add(chim);
    const flare = cyl(0.55, 0.42, 0.3, dark, 12); flare.position.set(-1.1, 4.35, 0); loco.add(flare);
    chimneyTop.position.set(-1.1, 4.6, 0); loco.add(chimneyTop);
    const dome = ink(new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(brass)), 0.04);
    dome.position.set(-3.4, 3.1, 0); loco.add(dome);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff2b0' }));
    lamp.position.set(-0.05, 3.05, 0); loco.add(ink(lamp, 0.03));
    const cow = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1.2, 1.1, 4), mat(dark)); cow.rotation.set(0, Math.PI / 4, -Math.PI / 2); cow.scale.set(1, 0.6, 1); cow.position.set(0.25, 0.85, 0); loco.add(ink(cow, 0.04));
    for (const x of [-1.6, -3.6, -5.6]) for (const z of [-1.25, 1.25]) loco.add(wheel(x, z, x === -1.6 ? 0.55 : 0.75));

    /* ----- Cabine : murs percés, toit, plancher et poste de conduite ----- */
    const CF = -5.95, CB = -8.9, FLOOR = 2.05, ROOF = 4.3;
    loco.add(box(CF - CB, 0.45, 2.5, '#9a7350', (CF + CB) / 2, FLOOR - 0.22, 0, { map: TEX.planks }));        // plancher
    // Façade avant : passage de la chaudière et deux grandes vitres de part et d'autre
    const fw = wall([-1.3, 1.6, 1.3, ROOF], [{ x: 0, y: 2.2, r: 1.02 }, { x0: 0.48, y0: 3.2, x1: 1.2, y1: 4.08 }, { x0: -1.2, y0: 3.2, x1: -0.48, y1: 4.08 }], 0.12, red, { map: TEX.rivets });
    fw.geometry.rotateY(Math.PI / 2); fw.position.x = CF - 0.06; loco.add(fw);
    // Côtés avec fenêtre
    for (const z of [1.19, -1.31]) {
      const sw = wall([CB, 1.6, CF, ROOF], [{ x0: -8.45, y0: 3.05, x1: -6.45, y1: 3.98 }], 0.12, red, { map: TEX.rivets });
      sw.position.z = z; loco.add(sw);
    }
    loco.add(box(3.6, 0.2, 3.0, '#3b2a1a', (CF + CB) / 2, ROOF + 0.1, 0, { map: TEX.planks }));            // toit
    loco.add(box(0.08, 0.12, 2.5, brass, CF - 0.1, 4.12, 0, undefined, 0));                                    // tringle laiton
    // Fond de chaudière (côté cabine) : tôle sombre, cadrans, porte du foyer, niveau d'eau, leviers
    const back = cyl(0.98, 0.98, 0.06, '#3a3236', 28, undefined, 0); back.rotation.z = Math.PI / 2; back.position.set(CF - 0.1, 2.2, 0); loco.add(back);
    const door = box(0.06, 0.5, 0.66, '#2a2427', CF - 0.15, 2.42, 0, undefined, 0.02); loco.add(door);
    cab.glow = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.5), new THREE.MeshBasicMaterial({ color: '#ff8a2a' }));
    cab.glow.position.set(CF - 0.19, 2.42, 0); loco.add(cab.glow);
    cab.fire = new THREE.PointLight('#ff9a3c', 0.9, 3.4, 2); cab.fire.position.set(CF - 0.6, 2.5, 0); loco.add(cab.fire);
    // Compteur (texture redessinée quand la vitesse change) et manomètre
    cab.speedCanvas = dialCanvas(); drawSpeedDial(cab.speedCanvas, 0, 60);
    cab.speedTex = new THREE.CanvasTexture(cab.speedCanvas);
    const dial = (zz, yy, r, map) => {
      const rim = cyl(r + 0.035, r + 0.035, 0.05, brass, 28, undefined, 0.012); rim.rotation.z = Math.PI / 2; rim.position.set(CF - 0.15, yy, zz); loco.add(rim);
      const face = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ map })); face.rotation.y = -Math.PI / 2; face.position.set(CF - 0.18, yy, zz); loco.add(face);
      return face;
    };
    dial(0.5, 2.96, 0.21, cab.speedTex);
    const pres = canvasTex(256, 256, (g) => {
      g.fillStyle = '#fbf3e6'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
      g.strokeStyle = '#2a2433'; g.lineWidth = 4;
      for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.75 + i * 0.15); g.beginPath(); g.moveTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); g.lineTo(128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90); g.stroke(); }
      g.strokeStyle = '#d63a4f'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 100, Math.PI * 2.0, Math.PI * 2.25); g.stroke();
      g.fillStyle = '#8a735a'; g.font = `600 22px ${FONT}`; g.textAlign = 'center'; g.fillText('VAPEUR', 128, 196);
    });
    dial(-0.3, 2.96, 0.17, pres);
    cab.needle = box(0.01, 0.15, 0.02, '#2a2433', 0, 0, 0, undefined, 0);
    cab.needle.geometry.translate(0, 0.07, 0);
    cab.needle.position.set(CF - 0.2, 2.96, -0.3); loco.add(cab.needle);
    const glass = cyl(0.03, 0.03, 0.38, '#bfe6f2', 8, undefined, 0.012); glass.position.set(CF - 0.16, 2.72, -0.68); loco.add(glass);
    // Régulateur (accélérer) : levier qui bascule vers le conducteur
    cab.reg = new THREE.Group(); cab.reg.position.set(CF - 0.16, 3.1, 0.82);
    const rod = box(0.05, 0.62, 0.05, '#8d8f95', 0, -0.28, 0, undefined, 0.012); rod.rotation.z = 0; cab.reg.add(rod);
    const knob = ink(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat('#c2453a')), 0.015); knob.position.y = -0.6; cab.reg.add(knob);
    loco.add(cab.reg);
    // Frein : levier au sol, à droite
    cab.brake = new THREE.Group(); cab.brake.position.set(CF - 0.55, FLOOR + 0.05, 0.85);
    const brod = box(0.05, 0.75, 0.05, '#2f2a2e', 0, 0.37, 0, undefined, 0.012); cab.brake.add(brod);
    const bknob = ink(new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), mat('#e8b52a')), 0.015); bknob.position.y = 0.76; cab.brake.add(bknob);
    loco.add(cab.brake);
    train.add(loco);

    // Wagon de sirop : plateau, ridelles en planches, 12 bouteilles en 2 rangs
    const wag = new THREE.Group(), wx = -10.4 - 4;
    wag.add(box(8, 0.5, 2.5, '#7b5536', wx, 1.15, 0, { map: TEX.planks }));
    wag.add(box(8, 0.5, 0.12, '#d98a1c', wx, 1.6, 1.2, { map: TEX.planks }, 0.03), box(8, 0.5, 0.12, '#d98a1c', wx, 1.6, -1.2, { map: TEX.planks }, 0.03));
    wag.add(box(0.12, 0.5, 2.5, '#d98a1c', wx + 4, 1.6, 0, undefined, 0.03), box(0.12, 0.5, 2.5, '#d98a1c', wx - 4, 1.6, 0, undefined, 0.03));
    wag.add(box(1.6, 0.18, 0.18, dark, -9.6, 1.0, 0));
    for (const x of [wx + 2.6, wx - 2.6]) for (const z of [-1.25, 1.25]) wag.add(wheel(x, z, 0.5));
    for (let i = 0; i < CFG.BOTTLES; i++) {
      const b = bottle(BOTTLE_COLORS[i % 3]);
      b.position.set(wx - 3.1 + (i % 6) * 1.24, 1.4, i < 6 ? -0.5 : 0.5);
      b.userData.home = b.position.clone();
      wag.add(b); bottleMeshes.push(b);
    }
    train.add(wag);
    scene.add(train);
  }
  function wheel(x, z, r) {
    const g = new THREE.CylinderGeometry(r, r, 0.22, 18); g.rotateX(Math.PI / 2);
    const w = ink(new THREE.Mesh(g, mat('#2f2a2e')), 0.035);
    const hub = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, 0.14, 0.26), mat('#d9a23a'));   // rayon visible : on voit la roue tourner
    w.add(hub); w.position.set(x, r + 0.3, z); w.castShadow = true; w.userData.r = r; wheels.push(w); return w;
  }
  function bottle(color) {
    const g = new THREE.Group();
    const glass = { transparent: true, opacity: 0.92 };
    const body = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 10), mat(color, glass)), 0.02);
    body.position.y = 0.31; body.castShadow = true;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.26, 8), mat(color, glass)); neck.position.y = 0.75;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 8), mat('#fffaf0')); cap.position.y = 0.91;
    g.add(body, neck, cap); return g;
  }

  /* ---------- Bouteilles qui tombent et fumée ---------- */
  const falling = [];
  let shown = CFG.BOTTLES, lastSt = null, prevV = 0, shake = 0;
  function dropBottle(st) {
    shown--;
    const b = bottleMeshes[shown];
    const p = new THREE.Vector3(); b.getWorldPosition(p);
    b.parent.remove(b); scene.add(b); b.position.copy(p);
    falling.push({ m: b, vx: st.v * 0.6 - 1 - Math.random() * 2, vy: 4, vz: (b.userData.home.z > 0 ? 1 : -1) * (1.5 + Math.random() * 2), vr: (Math.random() - .5) * 10, rest: false });
  }
  function resetBottles() {
    const wag = train.children[1];
    for (const f of falling) scene.remove(f.m);
    falling.length = 0;
    for (const b of bottleMeshes) { if (b.parent !== wag) wag.add(b); b.position.copy(b.userData.home); b.rotation.set(0, 0, 0); }
    shown = CFG.BOTTLES;
  }
  const smokeTex = canvasTex(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  const smoke = [];
  for (let i = 0; i < 60; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: '#eeeae4', transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; s.userData = { life: 0 }; scene.add(s); smoke.push(s);
  }
  let smokeAcc = 0;
  function puff(st) {
    const s = smoke.find(p => !p.visible); if (!s) return;
    chimneyTop.getWorldPosition(s.position);
    Object.assign(s.userData, { life: 1.8, max: 1.8, vx: -0.6 - st.v * 0.25, vy: 1.6 + Math.random() * 0.6, vz: (Math.random() - .5) * 0.6, r: 0.7 });
    s.visible = true;
  }

  /* ---------- Cabine : leviers, compteur, foyer ---------- */
  let lever = 0, brakeLv = 0, dialKey = '';
  function animateCab(st, dt) {
    const now = performance.now(), k = 1 - Math.exp(-dt * 10);
    lever += ((st.throttle > 0 ? 1 : 0) - lever) * k; brakeLv += ((st.throttle < 0 ? 1 : 0) - brakeLv) * k;
    cab.reg.rotation.z = -0.65 * lever;
    cab.brake.rotation.z = 0.55 * brakeLv;
    cab.needle.rotation.x = -1.2 + 0.25 * lever + Math.sin(now / 260) * 0.04;
    cab.fire.intensity = 0.7 + lever * 0.5 + Math.random() * 0.25;
    const lim = limitAt(st.x), key = Math.round(st.v * 3.6) + '|' + lim;
    if (key !== dialKey) { dialKey = key; drawSpeedDial(cab.speedCanvas, st.v * 3.6, lim); cab.speedTex.needsUpdate = true; }
  }

  /* ---------- Caméras ---------- */
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
  let lastView = '', lastW = 0, lastH = 0, lastT = performance.now();
  function cameraTarget(st, id) {
    const x = st.x, bob = st.v > 0.3 ? Math.sin(performance.now() / 85) * 0.05 * (st.v / CFG.VMAX) : 0;
    // Cabine : assis côté droit, la vitre avant, les cadrans et les leviers sous les yeux
    if (id === 'cab') { tmpP.set(x - 7.35, 3.72 + bob, 0.72); tmpL.set(x + 30, -7.4, 0.72); }
    else if (id === 'side') { tmpP.set(x - 8, 3.2, 21); tmpL.set(x - 8, 2.2, 0); }
    else { tmpP.set(x - 30, 10.5, 8); tmpL.set(x + 8, 1.8, 0); }
  }

  buildTextures(); const world = buildWorld(); buildTrain();

  return {
    canvas: renderer.domElement,
    step(st, dt) {
      if (st !== lastSt || st.bottles > shown) { resetBottles(); lastSt = st; }   // nouvelle partie
      while (shown > st.bottles) dropBottle(st);
      if (prevV > 2 && st.v === 0 && st.x >= LINE.end) shake = 1;               // butoir
      prevV = st.v;
      for (const f of falling) {                     // bouteilles tombées : chute, petit rebond, puis restent au sol
        if (f.rest) continue;
        f.vy -= 14 * dt; f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt;
        f.m.rotation.z += f.vr * dt; f.m.rotation.x += f.vr * 0.4 * dt;
        if (f.m.position.y < 0.12) {
          f.m.position.y = 0.12;
          if (Math.abs(f.vy) > 2) { f.vy *= -0.3; f.vx *= 0.5; f.vz *= 0.5; } else { f.rest = true; f.m.rotation.set(0, f.m.rotation.y, Math.PI / 2); }
        }
      }
      for (const s of smoke) {
        if (!s.visible) continue;
        const u = s.userData; u.life -= dt;
        if (u.life <= 0) { s.visible = false; continue; }
        s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt; u.r += dt * 1.6;
        s.scale.setScalar(u.r * 2); s.material.opacity = 0.75 * (u.life / u.max);
      }
      if (st.running) {
        smokeAcc += (st.throttle > 0 ? 14 : st.v > 0.5 ? 4 : 1.2) * dt;
        while (smokeAcc >= 1) { smokeAcc--; puff(st); }
      }
      train.position.x = st.x;
      for (const w of wheels) w.rotation.z = -(st.x - LINE.startX) / w.userData.r;
      animateCab(st, dt);
      world.water.material.map.offset.y -= dt * 0.03;
    },
    draw(st, view, W, H) {
      const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      if (W !== lastW || H !== lastH) { renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); lastW = W; lastH = H; }
      cameraTarget(st, view);
      const snap = view !== lastView || view === 'cab'; lastView = view;
      const k = snap ? 1 : 1 - Math.exp(-dt * 5);
      camPos.lerp(tmpP, k); camLook.lerp(tmpL, k);
      if (snap) { camPos.copy(tmpP); camLook.copy(tmpL); }
      camera.position.copy(camPos);
      if (shake) { camera.position.x += (Math.random() - .5) * 0.3 * shake; camera.position.y += (Math.random() - .5) * 0.3 * shake; shake = Math.max(0, shake - dt * 3); }
      camera.lookAt(camLook);
      const portrait = camera.aspect < 1, fov = view === 'cab' ? (portrait ? 74 : 60) : (portrait ? 68 : 52);
      if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      sun.position.set(st.x + 40, 70, -35); sun.target.position.set(st.x, 0, 0);
      sky.position.copy(camera.position);
      renderer.render(scene, camera);
    },
  };
}
