/**
 * Mairie : quêtes du maire, personnage et compagnon, quartiers, statistiques, prestige, sauvegarde.
 */
import { CONFIG, SHIRTS, PETS } from '../../config.js';
import { Fmt, esc } from '../../core/format.js';
import { Quests } from '../../sim/quests.js';
import { PWA } from '../../pwa.js';
import { VERSION } from '../../version.js';
import { Store } from '../../core/store.js';

/** Encart « installer le jeu » selon ce que permet l'appareil */
function installBlock() {
  const st = PWA.status();
  if (st === 'installed') return '<p class="hint">📲 Le jeu est installé sur cet appareil et marche sans internet.</p>';
  if (st === 'prompt') return '<div class="row-btns" style="margin-top:12px"><button class="btn sm" data-act="install">📲 Installer le jeu</button></div>';
  if (st === 'ios') return '<div class="row-btns" style="margin-top:12px"><button class="btn ghost sm" data-act="install">📲 Installer sur iPhone / iPad</button></div>';
  return '';
}

/** « le 28/09 à 11:40 » */
function backupDate() {
  const b = Store.getBackup();
  if (!b || !b.date) return '';
  const d = new Date(b.date);
  return `le ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export const mairie = {
  title: '🏛️ Mairie',
  key: s => [s.stars, s.look.shirt, s.look.pet, s.quest.i, s.quest.ready, s.districts.colline, s.tipsOn, Store.hasBackup(), Quests.rev].join('|'),
  html(s) {
    const q = Quests.current(s);
    const row = (label, k) => `<tr><td>${label}</td><td data-t="stat:${k}"></td></tr>`;
    const P = CONFIG.prestige;
    const swatches = SHIRTS.map(c =>
      `<button class="sw ${c === s.look.shirt ? 'on' : ''}" style="--c:${c}" data-act="shirt" data-arg="${c}" aria-label="Couleur ${c}"></button>`).join('');
    const pets = Object.entries(PETS).map(([k, p]) =>
      `<button class="btn ${s.look.pet === k ? '' : 'ghost'} sm" data-act="pet" data-arg="${k}">${p.icon} ${p.name}</button>`).join('');
    const districts = Object.entries(CONFIG.districts).map(([k, d]) => `
      <div class="auto-row">
        <div><b>${d.icon} ${d.name}</b><div class="sub">${d.desc}${d.rep ? ` · ⭐ ${d.rep} requis` : ''}</div></div>
        ${s.districts[k] ? '<span class="ok">✓ Ouvert</span>'
          : `<button class="btn sm" data-act="district" data-arg="${k}" data-d="cantDistrict:${k}">${Fmt.money(d.cost)}</button>`}
      </div>`).join('');

    return `
    <section class="card quest-card">
      <div class="split"><h3>📜 La quête du maire</h3><span class="sub">${Math.min(s.quest.i + 1, Quests.count(s))} / ${Quests.count(s)}</span></div>
      ${q ? `<p class="quest-text">${esc(q.text)}</p>
        <div class="bar"><i data-w="questPct"></i></div>
        <p class="sub" data-t="questProg"></p>
        <button class="btn" data-act="claim" data-d="cantClaim">🎁 Récupérer ${Fmt.money(q.reward)}</button>`
        : '<p>Tu as terminé toutes les quêtes du maire. Le village est fier de toi !</p>'}
      <div class="row-btns" style="margin-top:10px"><button class="btn ghost sm" data-act="questEditor">✏️ Inventer les quêtes du maire</button></div>
    </section>
    <div class="cols">
      <section class="card">
        <h3>Ton personnage</h3>
        <label class="field" for="look-name">Nom<input id="look-name" data-field="look.name" maxlength="14" value="${esc(s.look.name)}"></label>
        <div class="sub">Couleur du t-shirt</div>
        <div class="swatches">${swatches}</div>
        <div class="sub" style="margin-top:14px">Compagnon</div>
        <div class="row-btns">${pets}</div>
        ${s.look.pet !== 'aucun' ? `<label class="field" for="pet-name" style="margin-top:10px">Nom du compagnon
          <input id="pet-name" data-field="look.petName" maxlength="14" value="${esc(s.look.petName)}"></label>
          <p class="hint">Ton compagnon te suit partout et va cueillir tout seul un arbre mûr de temps en temps.</p>` : ''}
      </section>
      <div class="stack">
        <section class="card"><h3>Urbanisme</h3>${districts}</section>
        <section class="card">
          <h3>🏗️ Mode architecte</h3>
          <p class="sub">Décore le village : bancs, fleurs, sapins, panneaux, parasols… Pose, déplace ou enlève ce que tu veux.</p>
          <button class="btn sm" data-act="architect">Décorer le village</button>
        </section>
        <section class="card">
          <h3>👵 Mémé Grenadine</h3>
          <p class="sub">Elle se repose sur le banc du parc. Va lui parler pour un conseil !</p>
          <div class="row-btns">
            <button class="btn sm" data-act="tutoReplay">Revoir le tutoriel</button>
            <button class="btn ghost sm" data-act="tipsToggle">Conseils : ${s.tipsOn ? 'oui ✓' : 'non'}</button>
          </div>
        </section>
      </div>
    </div>
    <div class="cols">
      <section class="card">
        <h3>Statistiques</h3>
        <table class="tbl"><tbody>
          ${row('Gains totaux', 'earned')}${row('Gains de cette entreprise', 'run')}
          ${row('Bouteilles produites', 'bottles')}${row('Vendues au comptoir', 'sold')}
          ${row('Contrats livrés', 'done')}${row('Contrats ratés', 'fail')}
          ${row('Récoltes', 'picked')}${row('Temps de jeu', 'play')}
        </tbody></table>
      </section>
      <section class="card">
        <h3>✨ Revendre l’entreprise</h3>
        <p class="sub">Repars de zéro contre des étoiles permanentes : +${P.bonusPerStar * 100} % de production, de prix et de loyers par étoile.
          Ton personnage et tes quêtes sont conservés. Disponible à partir de ${Fmt.money(P.minRunEarned)} gagnés.</p>
        <div class="bar"><i data-w="pPct"></i></div>
        <p>Étoiles obtenues : <b data-t="pGain"></b></p>
        <button class="btn block" data-act="prestige" data-d="cantPrestige">Revendre</button>
      </section>
    </div>
    <div class="cols">
      <section class="card">
        <h3>💾 Sauvegarde</h3>
        <p class="sub">Garde ta partie dans un fichier, pour la ranger ou la continuer sur un autre appareil (tablette, ordinateur…).</p>
        <div class="row-btns">
          <button class="btn sm" data-act="saveExport">📤 Exporter la partie</button>
          <button class="btn ghost sm" data-act="saveImport">📥 Importer un fichier</button>
        </div>
        ${Store.hasBackup() ? `<div class="row-btns" style="margin-top:10px">
          <button class="btn ghost sm" data-act="saveRestore">↩️ Reprendre la partie d’avant</button></div>
          <p class="hint">Gardée de côté ${backupDate()}, avant le dernier import ou « Tout effacer ».</p>` : ''}
        <div class="row-btns" style="margin-top:14px">
          <button class="btn ghost sm" data-act="save">Sauvegarder</button>
          <button class="btn danger sm" data-act="reset">Tout effacer</button>
        </div>
        <p class="hint">Sauvegarde auto toutes les ${CONFIG.saveEverySec} s. Hors ligne : jusqu’à ${CONFIG.offline.capHours} h rattrapées.</p>
      </section>
      <section class="card">
        <h3>🎮 Le jeu</h3>
        <div class="row-btns" style="align-items:center">
          <span class="hint" style="margin:0">Sirop & Cie ${VERSION}</span>
          <button class="btn ghost sm" data-act="checkUpdate">🔄 Vérifier les mises à jour</button>
        </div>
        ${installBlock()}
      </section>
    </div>`;
  },
};
