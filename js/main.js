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
// Village : arbres, plantes des champs, moulin, fontaine, véhicules (assets/village)
Art.load(Object.fromEntries(['arbre', 'sureau-arbre', 'canne', 'menthe', 'grenadier', 'citronnier', 'sureau', 'violette',
  'moulin', 'ailes', 'fontaine', 'velo', 'charrette', 'camionnette', 'lampadaire', 'banc', 'buisson', 'rocher', 'panneau',
  'locomotive', 'wagon'].map(k => ['v_' + k, `assets/village/${k}.png`])));
// Meubles et déco de ta maison (assets/maison) ; lit et tapis : magenta repeint selon la couleur choisie
Art.load(Object.fromEntries(['tableau', 'carte', 'horloge', 'arc-en-ciel', 'etoile', 'plante', 'aquarium', 'guitare', 'robot',
  'nounours', 'canape', 'tele', 'piano', 'ordinateur', 'lit', 'tapis'].map(k => ['m_' + k, `assets/maison/${k}.png`])));
// Ta maison et son garage : murs magenta, repeints dans la couleur du papier peint (Art.tinted)
// Personnages : planches 3 images × 4 directions en 64×96, affichées en ~44×65
// (player, villageois, villageoise : vêtement magenta repeint selon la couleur choisie)
for (const k of ['ouvrier', 'player', 'meme', 'livreur', 'villageois', 'villageoise'])
  Art.sheet(k, `assets/persos/${k}.png`, { fw: 64, fh: 96, scale: 0.68 });
// Compagnons : 3 images (immobile, deux pas) ; ligne 2 = vers la gauche, ligne 3 = vers la droite
for (const k of ['chien', 'chat']) Art.sheet(k, `assets/persos/${k}.png`, { fw: 96, fh: 80, scale: 0.55 });
// Intérieur de l'usine (repères : IMG dans world/interior.js)
Art.load(Object.fromEntries(['cagette-menthe', 'cagette-grenadine', 'cagette-citron', 'cagette-sureau', 'cagette-violette', 'sol', 'mur', 'sucre', 'marmite', 'cuve', 'embouteilleuse', 'etagere', 'comptoir', 'tableau']
  .map(k => ['usine_' + k, `assets/usine/${k}.png`])));
Art.load({ home_maison: 'assets/batiments/maison-sirotin.png', home_garage: 'assets/batiments/garage-maison.png' });
window.Art = Art;   // pratique pour essayer depuis la console du navigateur

function showOffline(r) {
  if (!r) return;
  // Une fenêtre est déjà ouverte (bienvenue, confirmation…) : on ne la remplace pas
  if (UI.modalOpen()) return UI.toast(`Pendant ton absence : +${Fmt.money(r.earned)} 💰`, 'ok');
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
  last: 0, wall: 0, saveAcc: 0,
  away: null,          // résumé cumulé des rattrapages pendant que la page est cachée
  start() {
    this.last = performance.now(); this.wall = Date.now();
    setInterval(() => this.tick(), CONFIG.tickMs);
    window.addEventListener('beforeunload', () => Store.save(Game.s));
    window.addEventListener('pagehide', () => Store.save(Game.s));      // iOS et applications installées
    document.addEventListener('visibilitychange', () => { if (document.hidden) Store.save(Game.s); else this.tick(); });
    // La partie a été écrite par une autre fenêtre : on arrête d'enregistrer pour ne pas l'écraser
    window.addEventListener('storage', e => {
      if (e.key !== Store.KEY || Store.stale) return;
      Store.stale = true;
      UI.modal(`<h2>Partie ouverte ailleurs</h2>
        <p>Sirop & Cie est ouvert dans une autre fenêtre. Recharge pour reprendre la partie la plus récente.</p>`,
      [{ label: 'Recharger', primary: true, run: () => location.reload() }]);
    });
  },
  tick() {
    // Horloge murale en plus : performance.now() peut s'arrêter pendant la veille de l'appareil
    const now = performance.now(), wall = Date.now();
    const dt = Math.max(now - this.last, wall - this.wall) / 1000;
    this.last = now; this.wall = wall;
    if (dt > 5) this.addAway(Offline.catchUp(Game.s, dt));    // onglet en veille
    else Sim.advance(Game.s, dt * rt.timeScale);
    if (this.away && !document.hidden) { showOffline(this.away); this.away = null; }
    this.saveAcc += dt;
    if (this.saveAcc >= CONFIG.saveEverySec) { this.saveAcc = 0; Store.save(Game.s); }
    UI.render(Game.s);
  },
  /** Additionne les rattrapages successifs (onglet caché réveillé une fois par minute) */
  addAway(r) {
    if (!r) return;
    const a = this.away;
    if (!a) { this.away = { ...r }; return; }
    for (const k of ['t', 'earned', 'bottles', 'sold', 'done', 'fail']) a[k] += r[k];
    a.capped = a.capped || r.capped;
  },
};

/** @param {{save?:object}} data état transmis par un rechargement à chaud (artifact) */
function start(data = {}) {
  let saved = null;
  try { saved = data.save ? Store.migrate(data.save) : Store.load(); } catch (e) { saved = Store.load(); }
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
    if (!Store.broken) Tuto.propose();  // proposé, jamais imposé
    else UI.modal(`<h2>Oups 😕</h2><p>Ta sauvegarde n’a pas pu être lue : une nouvelle partie commence.</p>
      <p class="sub">${Store.stale ? 'Elle n’est pas effacée : le jeu n’enregistre rien tant qu’elle est là.' : 'Une copie de l’ancienne sauvegarde est gardée sur cet appareil.'}</p>`,
    [{ label: 'Continuer', primary: true, run: () => Tuto.propose() }]);
  } else if (Game.s.tuto.active) Tuto.enter(Game.s);   // reprise à l'étape sauvegardée
  World.init();
  UI.render(Game.s);
  Loop.start();
}

// Rechargement à chaud dans un artifact : conserve la partie en cours
const hot = window.claude?.hot;
try { hot?.snapshot?.(() => ({ save: Game.s })); } catch (e) { /* hors artifact */ }
if (hot?.ready) hot.ready(start); else start(hot?.data ?? {});
