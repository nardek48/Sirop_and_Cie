/**
 * sw.js — service worker de Sirop & Cie.
 *
 * Versions :
 *  - VERSION : numéro de version du jeu (v0.0.1, v0.0.2…), affiché aux joueurs.
 *    On l'incrémente avant une publication : `node tools/build-sw.mjs patch` (ou minor, major).
 *  - BUILD : empreinte du contenu, automatique. Filet de sécurité : si un fichier
 *    change sans que VERSION ait bougé, les joueurs reçoivent quand même la mise à jour.
 *
 * Stratégie :
 *  - À l'installation, tous les fichiers du jeu sont mis en cache (PRECACHE) :
 *    le jeu démarre ensuite sans internet.
 *  - Fichiers du jeu : cache d'abord (rapide et hors ligne).
 *  - Polices Google : mises en cache au premier chargement.
 *  - Une nouvelle version (VERSION différente) s'installe en arrière-plan ;
 *    le jeu propose alors « Mettre à jour » (voir js/pwa.js).
 *
 * BUILD et PRECACHE sont régénérés par `node tools/build-sw.mjs`
 * (lancé automatiquement par le workflow GitHub Pages, sans changer VERSION).
 */

// <build>
const VERSION = 'v0.2.0';
const BUILD = '40ee0342bb';
const PRECACHE = [
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './css/style.css',
  './js/audio/sfx.js',
  './js/config.js',
  './js/core/bus.js',
  './js/core/format.js',
  './js/core/game.js',
  './js/core/store.js',
  './js/debug.js',
  './js/editor/editor.js',
  './js/main.js',
  './js/pwa.js',
  './js/sim/clock.js',
  './js/sim/contracts.js',
  './js/sim/couriers.js',
  './js/sim/eco.js',
  './js/sim/events.js',
  './js/sim/factory.js',
  './js/sim/flavors.js',
  './js/sim/market.js',
  './js/sim/openings.js',
  './js/sim/quests.js',
  './js/sim/sim.js',
  './js/sim/wallet.js',
  './js/sim/world-systems.js',
  './js/tutorial/overlay.js',
  './js/tutorial/steps.js',
  './js/tutorial/tips.js',
  './js/tutorial/tutorial.js',
  './js/ui/actions.js',
  './js/ui/bindings.js',
  './js/ui/form.js',
  './js/ui/panels/agence.js',
  './js/ui/panels/contrats.js',
  './js/ui/panels/garage.js',
  './js/ui/panels/index.js',
  './js/ui/panels/labo.js',
  './js/ui/panels/mairie.js',
  './js/ui/panels/usine.js',
  './js/ui/ui.js',
  './js/version.js',
  './js/world/art.js',
  './js/world/characters.js',
  './js/world/decor.js',
  './js/world/gfx.js',
  './js/world/map.js',
  './js/world/meme.js',
  './js/world/pet.js',
  './js/world/render.js',
  './js/world/tiled.js',
  './js/world/villagers.js',
  './js/world/world.js',
  './assets/decor.tiled.json',
  './assets/modele-perso.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/favicon-48.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/logo-64.png',
];
// </build>

const CACHE = `sirop-${VERSION}-${BUILD}`;
const FONTS = 'sirop-fonts';

/**
 * Copie « propre » d'une réponse. Certains serveurs (ex. `npx serve`) redirigent
 * /index.html vers / : une réponse marquée « redirigée » ne peut pas servir à afficher
 * une page (le navigateur répond ERR_FAILED). On la recopie donc sans cette marque.
 */
async function clean(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async url => {
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) throw new Error(`Précache impossible : ${url} (${res.status})`);
      await cache.put(url, await clean(res));
    }));
  })());
  // Pas de skipWaiting automatique : on attend que le joueur accepte la mise à jour,
  // pour ne jamais mélanger deux versions des modules pendant une partie.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('sirop-') && k !== CACHE && k !== FONTS).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  // Le jeu demande le numéro de la version qui attend, pour l'afficher
  if (event.data === 'GET_VERSION' && event.ports[0]) event.ports[0].postMessage(VERSION);
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Polices Google : cache d'abord, rempli au premier passage
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req, FONTS));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Navigation : la page du jeu, même hors ligne
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      // Toujours index.html, jamais « / » : selon le serveur, « / » peut être une liste de fichiers
      const cached = await caches.match('./index.html', { cacheName: CACHE });
      if (cached) return clean(cached);
      return clean(await fetch(req));
    })());
    return;
  }

  event.respondWith(cacheFirst(req, CACHE));
});

/** Cache d'abord ; sinon réseau, et on garde une copie */
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: cacheName === CACHE });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    const ok = await clean(res);
    if (ok.ok || ok.type === 'opaque') cache.put(req, ok.clone());
    return ok;
  } catch (e) {
    return new Response('', { status: 504, statusText: 'Hors ligne' });
  }
}
