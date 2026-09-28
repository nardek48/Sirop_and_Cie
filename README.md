# Sirop & Cie

Jeu idle de fabrique de sirop, avec un personnage qui se promène dans le village de Sirop-sur-Mer.
HTML/CSS/JavaScript vanilla, modules ES, aucune dépendance.

## Lancer le jeu

Les modules ES ne fonctionnent pas en ouvrant `index.html` par double-clic (`file://`). Il faut un petit serveur local :

```bash
npx serve .            # ou : python3 -m http.server 8000
```

Puis ouvrir l’adresse affichée (par exemple http://localhost:3000).

## Mettre en ligne sur GitHub Pages

Le jeu est une **PWA** : on peut l’installer comme une application (icône sur l’écran d’accueil) et il marche sans internet.

1. Créer un dépôt sur GitHub et y pousser le dossier :
   ```bash
   git init && git add . && git commit -m "Sirop & Cie v3"
   git branch -M main
   git remote add origin https://github.com/<ton-compte>/<ton-depot>.git
   git push -u origin main
   ```
2. Sur GitHub, aller dans **Settings → Pages → Source**, et choisir **GitHub Actions**.
3. Le workflow `.github/workflows/pages.yml` publie le jeu à chaque `git push` sur `main`. L’adresse s’affiche dans l’onglet **Actions**, sous la forme `https://<ton-compte>.github.io/<ton-depot>/`.

Tous les chemins sont relatifs : le jeu marche quel que soit le nom du dépôt.

### Numéro de version

La version du jeu (`v0.0.1`, `v0.0.2`…) est définie dans `sw.js` (`VERSION`) et affichée à la mairie et dans la fenêtre de mise à jour. Pour publier une nouvelle version :

```bash
node tools/build-sw.mjs patch     # v0.0.1 → v0.0.2 : corrections, petits ajouts
node tools/build-sw.mjs minor     # v0.0.2 → v0.1.0 : nouvelle fonctionnalité
node tools/build-sw.mjs major     # v0.1.0 → v1.0.0 : grande étape
# décrire les changements dans CHANGELOG.md, puis :
git add . && git commit -m "v0.0.2" && git push
```

Le script met à jour `sw.js`, recopie le numéro dans `js/version.js` (ne pas modifier ce fichier à la main) et ajoute une section dans `CHANGELOG.md`.

À côté de `VERSION`, `BUILD` est une empreinte du contenu calculée automatiquement : si tu publies un changement en oubliant d’incrémenter la version, les joueurs reçoivent quand même la mise à jour.

### Service worker et mises à jour

- `sw.js` met en cache tous les fichiers du jeu. Sa liste (`PRECACHE`) et `BUILD` sont régénérés par `node tools/build-sw.mjs`. Le workflow le lance tout seul avant chaque publication, sans jamais changer le numéro de version.
- Quand une nouvelle version est publiée, le jeu la télécharge en arrière-plan, puis propose **« Mettre à jour »**. La partie est sauvegardée avant le rechargement.
- Pendant le développement, pour ne pas être gêné par le cache : dans Chrome, onglet **Application → Service workers**, cocher **Update on reload**.

### Installer le jeu

- **Chrome, Edge, Android** : un bouton vert **📲 Installer** apparaît dans la barre du haut (et à la mairie).
- **iPhone, iPad** : dans Safari, **Partager → Sur l’écran d’accueil**. La mairie affiche aussi la marche à suivre.

### Icônes

Toutes les icônes (`icons/`, `favicon.ico`) sont générées à partir du logo. Les versions « maskable » ont un fond orange plein, pour qu’Android puisse les découper en cercle ou en carré arrondi.

## Simulateur d’équilibrage

`tools/simulate.mjs` fait tourner les vraies règles du jeu (`js/sim/`) avec un joueur automatique assidu : il accepte les contrats, marche jusqu’au quai puis chez les clients, récolte, améliore l’usine, achète maisons, véhicules, livreurs, quartiers et recettes, et récupère les récompenses du maire. Il affiche l’heure de chaque étape, la provenance de l’argent et la courbe des gains. Dix heures de jeu se simulent en moins d’une seconde.

```bash
node tools/simulate.mjs                           # 10 h de jeu
node tools/simulate.mjs --hours=20 --runs=5       # 5 parties, médiane des étapes
node tools/simulate.mjs --set=houses.costGrowth=1.45 --set=flavors.violette.unlock=2000000
                                                  # tester un réglage sans modifier config.js
node tools/simulate.mjs --human=2                 # joueur plus lent
node tools/simulate.mjs --csv                     # courbe dans tools/sim-courbe.csv (à ouvrir dans un tableur)
```

Le joueur automatique est prudent : un humain qui connaît bien le jeu va plus vite. Il sert surtout à **comparer** deux réglages entre eux.

## Commandes

| Action | Clavier | Souris / tactile |
|---|---|---|
| Marcher | Flèches ou ZQSD (WASD aussi) | Clic ou toucher sur le sol |
| Agir (entrer, charger, livrer, récolter) | E, Espace ou Entrée | Clic sur un bâtiment, ou le bouton ✋ |
| Sortir d’un bâtiment | Échap ou E | Bouton « Sortir » |
| Mode debug | F2 (ou `#debug` à la fin de l’adresse) | |

## Structure

```
index.html              page + HUD
manifest.webmanifest    description de l’application installable
sw.js                   service worker (cache, hors ligne, mises à jour)
favicon.ico, icons/     logo décliné en toutes tailles
tools/build-sw.mjs      régénère la liste de cache et la version de sw.js
.github/workflows/      publication automatique sur GitHub Pages
css/style.css           styles de l’interface (thème clair/sombre)
js/
  main.js               démarrage, boucle de simulation, chargement des dessins
  pwa.js                installation, mises à jour, stockage persistant
  config.js             ⭐ TOUT l’équilibrage : prix, vitesses, quêtes de quartiers, clients…
  debug.js              outils de test (F2)
  core/                 état (game), bus d’événements, format des nombres, sauvegarde
  sim/                  règles du jeu, sans DOM ni canvas
    factory.js          chaîne de production
    market.js           comptoir
    contracts.js        contrats et livraisons
    couriers.js         livreurs
    world-systems.js    récoltes, quartiers, maisons, véhicules, recettes secrètes
    quests.js           ⭐ la liste des quêtes du maire (facile à modifier)
    events.js           pluie, canicule, fête
    clock.js            jour / nuit
    sim.js              ordre des systèmes, prestige, hors-ligne
  ui/                   HUD, panneaux (un fichier par bâtiment), actions, liaisons
  world/                le village en canvas
    map.js              ⭐ positions des bâtiments, arbres, terrains, décor
    render.js           dessin de la scène, nuit, météo
    characters.js       personnages 4 directions, véhicules, compagnons
    villagers.js        habitants (et leurs phrases)
    pet.js              le compagnon
    art.js              branchement des dessins (Piskel…)
    tiled.js            import du décor depuis Tiled
  audio/sfx.js          sons synthétisés
assets/
  modele-perso.png        modèle de feuille de sprites à repeindre
  modele-perso-guide.png  le même, agrandi avec les libellés
  decor.tiled.json        décor du village, modifiable dans Tiled
```

Règle d’or : les fichiers de `sim/` ne touchent jamais au DOM. Ils émettent des événements (`Bus.toast`, `Bus.float`, `Bus.sfx`) que l’interface et le monde écoutent.

## Dessiner le personnage (Piskel)

1. Ouvrir https://www.piskelapp.com, puis *Import* → `assets/modele-perso.png`, découpé en images de **48 × 64**.
2. Repeindre les 12 images. Chaque ligne est une direction (bas, gauche, droite, haut), chaque colonne une image (immobile, pas 1, pas 2). Voir `modele-perso-guide.png`.
3. *Export* → *PNG* → *Spritesheet*, sur **3 colonnes**, et enregistrer sous `assets/perso.png`.
4. Dans `js/main.js`, décommenter :
   ```js
   Art.sheet('player', 'assets/perso.png', { fw: 48, fh: 64 });
   ```

Même principe pour `livreur`, `villageois`, `chien` et `chat` (feuilles de sprites), et pour les images fixes `arbre`, `sureau`, `canne` et `maison_studio`… via `Art.load({ arbre: 'assets/arbre.png' })`.
Pour essayer sans rien modifier, taper dans la console du navigateur : `Art.sheet('player', 'assets/modele-perso.png', { fw: 48, fh: 64 })`.

## Modifier le village (Tiled)

1. Installer Tiled (https://www.mapeditor.org) et ouvrir `assets/decor.tiled.json`.
2. Dans le calque d’objets **decor**, ajouter, déplacer ou supprimer des objets. Leur *Class* (ou *Type*) doit être : `lampadaire`, `banc`, `buisson`, `rocher` ou `panneau` (propriété texte `text`).
3. Enregistrer au format JSON : le jeu recharge le décor au démarrage. Les lampadaires éclairent la nuit.

Les bâtiments, arbres et terrains se déplacent dans `js/world/map.js`. Les portes des bâtiments sont dans `CONFIG.places` (`config.js`).

## Idées faciles à ajouter

- Une quête : ajouter une ligne dans `QUESTS` (`sim/quests.js`).
- Un client : ajouter une entrée dans `CONFIG.contracts.clients`, un bâtiment dans `MAP.buildings` et sa porte dans `CONFIG.places`.
- Une phrase d’habitant : les listes `HELLO`, `NIGHT`, `HEAT`, `RAIN` dans `world/villagers.js`.
- Un son : une recette de notes dans `SOUNDS` (`audio/sfx.js`).

## Sauvegarde

Automatique toutes les 30 s dans le navigateur (`localStorage`, clé `siropcie_save_v3`). Le temps passé hors du jeu est rattrapé, jusqu’à 8 h.
