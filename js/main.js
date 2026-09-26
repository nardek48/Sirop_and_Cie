/**
 * main.js — démarrage : charge la partie, branche l'interface, le monde, le son
 * et lance les deux boucles (simulation à 10 Hz, rendu en requestAnimationFrame).
 */
import { CONFIG } from './config.js';
import { Game, rt } from './core/game.js';
import { Store } from './core/store.js';
import { Fmt } from './core/format.js';
import { Sim, Offline } from './sim/sim.js';
import { UI } from './ui/ui.js';
import { Actions } from './ui/actions.js';
import { World } from './world/world.js';
import { Art } from './world/art.js';
import { Sfx } from './audio/sfx.js';
import { Debug } from './debug.js';
import { PWA } from './pwa.js';

/* ------------------------------------------------------------------
 * Dessins personnalisés : décommenter après avoir exporté depuis Piskel.
 * Modèle 4 directions × 3 images : assets/modele-perso.png (48×64 par image)
 * ------------------------------------------------------------------ */
// Art.sheet('player', 'assets/perso.png', { fw: 48, fh: 64 });
// Art.sheet('livreur', 'assets/livreur.png', { fw: 48, fh: 64 });
// Art.load({ arbre: 'assets/arbre.png' });
window.Art = Art;   // pratique pour essayer depuis la console du navigateur

function showOffline(r) {
  if (!r) return;
  UI.modal(`
    <h2>Pendant ton absence…</h2>
    <p class="sub">${Fmt.time(r.t)} simulées${r.capped ? ` (plafond ${CONFIG.offline.capHours} h)` : ''}</p>
    <ul>
      <li>💰 ${Fmt.money(r.earned)} gagnés</li>
      <li>🍾 ${Fmt.int(r.bottles)} bouteilles produites</li>
      <li>🛎️ ${Fmt.int(r.sold)} vendues au comptoir</li>
      <li>📜 ${r.done} contrats livrés · ${r.fail} ratés</li>
    </ul>`);
}

const Loop = {
  last: 0, saveAcc: 0,
  start() {
    this.last = performance.now();
    setInterval(() => this.tick(), CONFIG.tickMs);
    window.addEventListener('beforeunload', () => Store.save(Game.s));
    window.addEventListener('pagehide', () => Store.save(Game.s));      // iOS et applications installées
    document.addEventListener('visibilitychange', () => { if (document.hidden) Store.save(Game.s); });
  },
  tick() {
    const now = performance.now(), dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 5) showOffline(Offline.catchUp(Game.s, dt));     // onglet en veille
    else Sim.advance(Game.s, dt * rt.timeScale);
    this.saveAcc += dt;
    if (this.saveAcc >= CONFIG.saveEverySec) { this.saveAcc = 0; Store.save(Game.s); }
    UI.render(Game.s);
  },
};

/** @param {{save?:object}} data état transmis par un rechargement à chaud (artifact) */
function start(data = {}) {
  const saved = data.save ? Store.migrate(data.save) : Store.load();
  Game.s = saved || Store.fresh();
  UI.init((name, arg) => Actions.run(name, arg));
  Sfx.init();
  Debug.init();
  PWA.init();
  if (saved && !data.save) showOffline(Offline.catchUp(Game.s, (Date.now() - saved.lastSeen) / 1000));
  if (!saved) {
    Sim.seed(Game.s);
    UI.modal(`
      <h2>Bienvenue à Sirop-sur-Mer !</h2>
      <p>Tu viens d’ouvrir ta fabrique de sirop. Le maire t’a laissé une liste de quêtes, en haut à gauche.</p>
      <ul>
        <li><b>Flèches</b> ou <b>ZQSD</b> pour marcher, <b>E</b> pour agir</li>
        <li>Ou clique sur un bâtiment : ton personnage y va tout seul</li>
        <li>Commence par le bureau des <b>Contrats</b> 📜, juste à côté</li>
      </ul>`, [{ label: 'C’est parti !', primary: true }]);
  }
  World.init();
  UI.render(Game.s);
  Loop.start();
}

// Rechargement à chaud dans un artifact : conserve la partie en cours
const hot = window.claude?.hot;
try { hot?.snapshot?.(() => ({ save: Game.s })); } catch (e) { /* hors artifact */ }
if (hot?.ready) hot.ready(start); else start(hot?.data ?? {});
