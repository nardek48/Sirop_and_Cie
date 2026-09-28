/**
 * pwa.js — tout ce qui fait de Sirop & Cie une application installable :
 *  - enregistrement du service worker (jeu jouable hors ligne) ;
 *  - bouton « Installer » (Chrome, Edge, Android) ;
 *  - aide pour iPhone/iPad (Partager → Sur l'écran d'accueil) ;
 *  - proposition de mise à jour quand une nouvelle version est publiée
 *    (fenêtre + bouton « 🔄 Mise à jour » dans la barre du haut, qui ne se perd jamais) ;
 *  - vérification à la demande (bouton de la mairie) ;
 *  - demande de stockage persistant (la sauvegarde n'est pas effacée par le navigateur).
 *
 * Ne fait rien dans un artifact claude.ai ni en file:// (pas de service worker possible).
 */
import { Game } from './core/game.js';
import { Store } from './core/store.js';
import { UI } from './ui/ui.js';
import { VERSION } from './version.js';

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const PWA = {
  deferred: null,      // événement beforeinstallprompt mis de côté
  waiting: null,       // service worker de la nouvelle version, en attente
  reg: null,           // enregistrement du service worker
  nextVersion: null,   // numéro de la version en attente
  accepted: false,     // le joueur a demandé la mise à jour

  init() {
    const btn = document.getElementById('install-btn');
    if (btn) btn.addEventListener('click', () => this.install());
    document.getElementById('update-btn')?.addEventListener('click', () => this.showUpdate());

    // Bouton « Installer » : le navigateur signale que l'installation est possible
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.deferred = e;
      if (btn) btn.hidden = false;
    });
    window.addEventListener('appinstalled', () => {
      this.deferred = null;
      if (btn) btn.hidden = true;
      UI.toast('Sirop & Cie est installé ! Tu le retrouves sur ton écran d’accueil.', 'ok');
    });

    if (standalone()) this.persist();
    this.register();
  },

  /** Peut-on proposer l'installation ? (utilisé par la mairie) */
  status() {
    if (standalone()) return 'installed';
    if (this.deferred) return 'prompt';
    if (isIOS()) return 'ios';
    return 'none';
  },

  async install() {
    if (this.deferred) {
      this.deferred.prompt();
      const { outcome } = await this.deferred.userChoice;
      this.deferred = null;
      document.getElementById('install-btn').hidden = true;
      if (outcome === 'accepted') this.persist();
      return;
    }
    if (isIOS()) {
      UI.modal(`
        <h2>Installer sur iPhone ou iPad</h2>
        <ol>
          <li>Ouvre le jeu dans <b>Safari</b>.</li>
          <li>Touche le bouton <b>Partager</b> (le carré avec une flèche vers le haut).</li>
          <li>Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li>
        </ol>`);
    }
  },

  /** Demande au navigateur de ne pas effacer la sauvegarde en cas de manque de place */
  async persist() {
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* */ }
  },

  async register() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext || location.protocol === 'file:') return;
    // Dans un artifact (iframe sur un autre domaine), pas de service worker
    if (window.top !== window.self) return;
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      this.reg = reg;

      // Une nouvelle version attend déjà (ouverte dans un autre onglet par exemple)
      if (reg.waiting && navigator.serviceWorker.controller) this.offerUpdate(reg.waiting);

      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          // « installed » + un contrôleur existant = mise à jour (pas la toute première installation)
          if (sw.state === 'installed' && navigator.serviceWorker.controller) this.offerUpdate(sw);
          // Installation ratée (souvent un fichier de PRECACHE absent du dossier) : on le dit
          if (sw.state === 'redundant' && !reg.waiting && !reg.installing && !this.waiting) {
            console.warn('Mise à jour impossible : un fichier listé dans sw.js est introuvable (voir l’onglet Réseau).');
            UI.toast('La mise à jour n’a pas pu se télécharger. Un fichier manque peut-être dans le dossier du jeu.', 'bad');
          }
        });
      });

      // Quand la nouvelle version prend la main : on sauvegarde et on recharge une seule fois.
      // À la toute première visite, il n'y avait pas encore de service worker : sa prise en main
      // (clients.claim) ne doit pas recharger la page, sinon la fenêtre de bienvenue disparaît.
      const hadController = !!navigator.serviceWorker.controller;
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Recharge si c'est une mise à jour (contrôleur déjà là, ou le joueur a cliqué « Mettre à jour »)
        if (reloading || !(hadController || this.accepted)) return;
        reloading = true;
        Store.save(Game.s);
        location.reload();
      });

      // Vérifie les mises à jour quand on revient sur le jeu, et toutes les heures
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    } catch (e) {
      console.warn('Service worker non enregistré :', e);
    }
  },

  /** Demande son numéro de version au service worker en attente (ou null) */
  askVersion(sw) {
    return new Promise(resolve => {
      const ch = new MessageChannel();
      const t = setTimeout(() => resolve(null), 1500);
      ch.port1.onmessage = e => { clearTimeout(t); resolve(e.data); };
      sw.postMessage('GET_VERSION', [ch.port2]);
    });
  },

  /** Une nouvelle version attend : bouton dans la barre du haut, puis fenêtre dès que possible */
  async offerUpdate(sw) {
    if (this.waiting === sw) return;
    this.waiting = sw;
    this.nextVersion = await this.askVersion(sw);
    const btn = document.getElementById('update-btn');
    if (btn) btn.hidden = false;
    // Ne remplace pas une fenêtre déjà ouverte (bienvenue, absence…) : on attend qu'elle se ferme
    const tryShow = () => { if (UI.modalOpen()) setTimeout(tryShow, 1000); else this.showUpdate(); };
    tryShow();
  },

  /** Vérification demandée par le joueur (mairie) */
  async check() {
    if (!this.reg) return UI.toast('Les mises à jour automatiques ne marchent pas ici (ouvre le jeu avec un serveur ou depuis internet).', 'bad');
    if (this.waiting) return this.showUpdate();
    UI.toast('Recherche d’une nouvelle version…');
    try { await this.reg.update(); } catch (e) { return UI.toast('Pas de connexion : impossible de vérifier.', 'bad'); }
    // Une version trouvée s'installe en arrière-plan : on laisse quelques secondes
    const t0 = Date.now();
    while (this.reg.installing && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 300));
    if (this.reg.waiting) this.offerUpdate(this.reg.waiting);
    else UI.toast(`Tu as la dernière version (${VERSION}) ✓`, 'ok');
  },

  showUpdate() {
    const sw = this.waiting;
    if (!sw) return;
    const next = this.nextVersion;
    const what = next && next !== VERSION
      ? `La version <b>${next}</b> est prête (tu as la ${VERSION}).`
      : 'Une mise à jour de Sirop & Cie est prête.';
    UI.modal(`
      <h2>Nouvelle version !</h2>
      <p>${what} Ta partie est sauvegardée avant de recharger.</p>`, [
      { label: 'Plus tard' },
      { label: 'Mettre à jour', primary: true, run: () => { this.accepted = true; Store.save(Game.s); sw.postMessage('SKIP_WAITING'); } },
    ]);
  },
};
