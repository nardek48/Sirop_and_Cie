/**
 * path.js — chemins directs : A* sur une grille, puis lissage en lignes droites.
 *
 * Le personnage (et le compagnon) va tout droit quand rien ne gêne, et contourne
 * les bâtiments, l'eau ou la fontaine sinon. Utilisé par World.route, dans le village
 * comme dans les salles (usine, maison).
 */

const CELL = 20;              // taille d'une case de la grille (px)
const MAX_NODES = 40000;      // garde-fou

/**
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {(x:number,y:number)=>boolean} blocked  true si le personnage ne peut pas se tenir là
 * @param {number} W largeur de la scène
 * @param {number} H hauteur de la scène
 * @returns {{x:number,y:number}[]} points à suivre (sans le départ), ou [to] si rien de mieux
 */
export function findPath(from, to, blocked, W, H) {
  // Ligne droite possible : on y va directement
  if (clear(from, to, blocked)) return [{ x: to.x, y: to.y }];

  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
  const cx = x => Math.max(0, Math.min(cols - 1, Math.floor(x / CELL)));
  const cy = y => Math.max(0, Math.min(rows - 1, Math.floor(y / CELL)));
  const center = (c, r) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });

  // Grille des cases libres, calculée à la demande
  const free = new Int8Array(cols * rows).fill(-1);
  const isFree = (c, r) => {
    const k = r * cols + c;
    if (free[k] < 0) { const p = center(c, r); free[k] = blocked(p.x, p.y) ? 0 : 1; }
    return free[k] === 1;
  };

  const sc = cx(from.x), sr = cy(from.y);
  let gc = cx(to.x), gr = cy(to.y);
  // Arrivée dans un obstacle (clic sur un toit…) : la case libre la plus proche
  if (!isFree(gc, gr)) {
    const near = nearestFree(gc, gr, cols, rows, isFree);
    if (!near) return [{ x: to.x, y: to.y }];
    [gc, gr] = near;
  }

  // A* (8 directions, pas de coupe de coin)
  const N = cols * rows, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1);
  const start = sr * cols + sc, goal = gr * cols + gc;
  const h = k => Math.hypot((k % cols) - gc, Math.floor(k / cols) - gr);
  const open = new Heap();
  g[start] = 0; open.push(start, h(start));
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  let seen = 0, found = false;
  while (open.size && seen++ < MAX_NODES) {
    const k = open.pop();
    if (k === goal) { found = true; break; }
    const c = k % cols, r = Math.floor(k / cols);
    for (const [dc, dr, cost] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || !isFree(nc, nr)) continue;
      if (dc && dr && (!isFree(c + dc, r) || !isFree(c, r + dr))) continue;
      const nk = nr * cols + nc, ng = g[k] + cost;
      if (ng < g[nk]) { g[nk] = ng; came[nk] = k; open.push(nk, ng + h(nk)); }
    }
  }
  if (!found) return [{ x: to.x, y: to.y }];

  // Reconstruction, puis lissage : on garde le point visible le plus loin
  const cells = [];
  for (let k = goal; k !== -1 && k !== start; k = came[k]) cells.push(center(k % cols, Math.floor(k / cols)));
  cells.reverse();
  const end = isFree(cx(to.x), cy(to.y)) ? { x: to.x, y: to.y } : cells.at(-1) || { x: to.x, y: to.y };
  if (cells.length) cells[cells.length - 1] = end; else cells.push(end);

  const out = [];
  let cur = from, i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !clear(cur, cells[j], blocked)) j--;
    out.push(cells[j]); cur = cells[j]; i = j + 1;
  }
  return out;
}

/** Le segment a→b est-il libre ? (échantillonné tous les 8 px) */
function clear(a, b, blocked) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / 8));
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    if (blocked(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)) return false;
  }
  return true;
}

function nearestFree(c, r, cols, rows, isFree) {
  for (let rad = 1; rad < 12; rad++)
    for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
      if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
      const nc = c + dc, nr = r + dr;
      if (nc >= 0 && nr >= 0 && nc < cols && nr < rows && isFree(nc, nr)) return [nc, nr];
    }
  return null;
}

/** File de priorité minimale (tas binaire) */
class Heap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const k = this.k, p = this.p;
    k.push(key); p.push(pri);
    let i = k.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (p[j] <= p[i]) break;
      [k[i], k[j]] = [k[j], k[i]]; [p[i], p[j]] = [p[j], p[i]]; i = j;
    }
  }
  pop() {
    const k = this.k, p = this.p, top = k[0], lk = k.pop(), lp = p.pop();
    if (k.length) {
      k[0] = lk; p[0] = lp;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [k[i], k[m]] = [k[m], k[i]]; [p[i], p[m]] = [p[m], p[i]]; i = m;
      }
    }
    return top;
  }
}
