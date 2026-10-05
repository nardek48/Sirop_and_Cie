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
import { Tuto } from './tutorial/tutorial.js';
import { Editor } from './editor/editor.js';
import { QuestEditor } from './editor/quest-editor.js';
import { Quests } from './sim/quests.js';

/* ------------------------------------------------------------------
 * Dessins personnalisés : décommenter après avoir exporté depuis Piskel.
 * Modèle 4 directions × 3 images : assets/modele-perso.png (48×64 par image)
 * ------------------------------------------------------------------ */
// Art.sheet('player', 'assets/perso.png', { fw: 48, fh: 64 });
// Art.sheet('livreur', 'assets/livreur.png', { fw: 48, fh: 64 });
// Art.load({ arbre: 'assets/arbre.png' });

// Maisons du village : toit magenta, repeint selon l'usage (Art.tinted)
Art.load(Object.fromEntries(['studio', 'village', 'villa', 'domaine'].map(k => ['maison_' + k, `assets/maisons/${k}.png`])));
// Bâtiments de la rue principale (repères de cheminée, mât, panneau : BAT_ART dans world/render.js)
Art.load(Object.fromEntries(['usine', 'labo', 'contrats', 'agence', 'mairie', 'garage', 'epicerie', 'cafe', 'supermarche', 'port', 'gare']
  .map(k => ['bat_' + k, `assets/batiments/${k}.png`])));
// Ta maison et son garage : murs magenta, repeints dans la couleur du papier peint (Art.tinted)
// Personnages : planches 3 images × 4 directions en 64×96, affichées en ~44×65
// (player, villageois, villageoise : vêtement magenta repeint selon la couleur choisie)
for (const k of ['ouvrier', 'player', 'meme', 'livreur', 'villageois', 'villageoise'])
  Art.sheet(k, `assets/persos/${k}.png`, { fw: 64, fh: 96, scale: 0.68 });
// Compagnons : 3 images (immobile, deux pas) ; ligne 2 = vers la gauche, ligne 3 = vers la droite
for (const k of ['chien', 'chat']) Art.sheet(k, `assets/persos/${k}.png`, { fw: 96, fh: 80, scale: 0.55 });
// Intérieur de l'usine (repères : IMG dans world/interior.js)
Art.load(Object.fromEntries(['sol', 'mur', 'sucre', 'marmite', 'cuve', 'embouteilleuse', 'etagere', 'comptoir', 'tableau']
  .map(k => ['usine_' + k, `assets/usine/${k}.png`])));
Art.load({ home_maison: 'assets/batiments/maison-sirotin.png', home_garage: 'assets/batiments/garage-maison.png' });
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
  QuestEditor.init();
  Quests.loadFile('assets/quests.json');   // quêtes publiées (sinon celles par défaut)
  Sfx.init();
  Debug.init();
  PWA.init();
  if (saved && !data.save) showOffline(Offline.catchUp(Game.s, (Date.now() - saved.lastSeen) / 1000));
  Editor.init();
  Tuto.init();                          // avant World.init : branche Mémé et les repères
  if (!saved) {
    Sim.seed(Game.s);
    Tuto.propose();                     // proposé, jamais imposé
  } else if (Game.s.tuto.active) Tuto.enter(Game.s);   // reprise à l'étape sauvegardée
  World.init();
  UI.render(Game.s);
  Loop.start();
}

// Rechargement à chaud dans un artifact : conserve la partie en cours
const hot = window.claude?.hot;
try { hot?.snapshot?.(() => ({ save: Game.s })); } catch (e) { /* hors artifact */ }
if (hot?.ready) hot.ready(start); else start(hot?.data ?? {});
