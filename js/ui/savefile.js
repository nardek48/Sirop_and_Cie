/**
 * savefile.js — exporter la partie dans un fichier, l'importer, revenir à la partie d'avant.
 *
 * Avant d'importer, la partie en cours est gardée de côté (Store.backup) :
 * « Reprendre la partie d'avant » échange les deux. Une partie chargée relance la page,
 * ce qui remet le village, Mémé et les livreurs dans un état propre.
 */
import { Game } from '../core/game.js';
import { Store } from '../core/store.js';
import { Files } from '../core/files.js';
import { Fmt, esc } from '../core/format.js';
import { VERSION } from '../version.js';
import { UI } from './ui.js';

/** Petit résumé lisible d'une partie, pour la confirmation */
const summary = s => `
  <ul class="save-sum">
    <li>🧑 <b>${esc(s.look.name)}</b>${s.stars ? ` · ✨ ${Fmt.int(s.stars)} étoile(s)` : ''}</li>
    <li>💰 ${Fmt.money(s.money)} en caisse · ⭐ ${Fmt.int(s.rep)}</li>
    <li>📜 ${Fmt.int(s.stats.cDone)} commandes livrées · ⏱️ ${Fmt.time(s.stats.playSec)} de jeu</li>
  </ul>`;

const when = iso => {
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

export const SaveFile = {
  export(s) {
    Store.save(s);
    const name = `sirop-et-cie_${Files.slug(s.look.name)}_${Files.today()}.json`;
    Files.download(name, Store.toFile(s, VERSION));
    UI.modal(`
      <h2>Partie exportée 📤</h2>
      <p>Le fichier <b>${esc(name)}</b> est dans tes téléchargements.</p>
      <p class="sub">Pour continuer ailleurs : ouvre le jeu sur l’autre appareil, va à la mairie, puis « 📥 Importer un fichier ».</p>`);
  },

  async import() {
    const f = await Files.pick();
    if (!f) return;
    const r = Store.fromFile(f.text);
    if (!r.ok) {
      UI.modal(`<h2>Oups 😕</h2><p>${r.error}</p><p class="sub">Choisis un fichier créé avec « 📤 Exporter la partie ».</p>`);
      return;
    }
    const meta = [r.date && `exportée le ${when(r.date)}`, r.gameVersion && `version ${esc(r.gameVersion)}`].filter(Boolean).join(' · ');
    UI.modal(`
      <h2>Charger cette partie ?</h2>
      ${meta ? `<p class="sub">${meta}</p>` : ''}
      ${summary(r.save)}
      <p class="sub">Ta partie actuelle est gardée de côté : « ↩️ Reprendre la partie d’avant » (mairie) la ramène.</p>`,
    [{ label: 'Annuler' }, { label: 'Charger cette partie', primary: true, run: () => {
      Store.backup({ ...Game.s, lastSeen: Date.now() });
      this.apply(r.save);
    } }]);
  },

  restore() {
    const b = Store.getBackup();
    const r = b && Store.fromFile(JSON.stringify(b.save));
    if (!r || !r.ok) { Store.dropBackup(); UI.toast('La partie d’avant n’est plus disponible', 'bad'); return; }
    UI.modal(`
      <h2>Reprendre la partie d’avant ?</h2>
      ${summary(r.save)}
      <p class="sub">Ta partie actuelle prend sa place de côté : tu pourras encore revenir en arrière.</p>`,
    [{ label: 'Annuler' }, { label: 'Reprendre', primary: true, run: () => {
      Store.backup({ ...Game.s, lastSeen: Date.now() });
      this.apply(r.save);
    } }]);
  },

  /** Remplace la partie et relance le jeu dessus */
  apply(save) {
    Game.s = save;                       // l'enregistrement de sortie de page écrira bien celle-ci
    Store.save(save);
    UI.toast('Chargement de la partie…', 'ok');
    setTimeout(() => location.reload(), 300);
  },
};
