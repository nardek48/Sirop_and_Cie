# Journal des versions

Numérotation : `vMAJEUR.MINEUR.CORRECTIF`. Pour préparer une nouvelle version : `node tools/build-sw.mjs patch` (ou `minor`, `major`), puis décrire les changements ici.

## v0.3.0 · 2026-09-28

- 

## v0.3.0 · 2026-09-28

- **L’usine se visite** : la porte de l’usine fait entrer dans la salle de fabrication, où l’on marche. Tout bouge avec la vraie production : sacs de sucre et cagettes de fruits, marmite qui bout (feu, bulles, vapeur), cuve avec son niveau de sirop, bouteilles sur le tapis roulant, caisses dans l’entrepôt, clients et pièces au comptoir. Les fenêtres suivent l’heure du jeu.
- La machine la plus lente est marquée 🐢 ; un blocage (plus de matières, entrepôt plein, changement de parfum) est marqué ⚠️.
- Toucher une machine ouvre sa fiche : ce qu’elle fait, son niveau, son débit, « Améliorer ». ◀ ▶ passent d’une machine à l’autre. Le tableau noir (parfum du jour) ouvre toute la gestion de l’usine, comme avant. Sortie par la porte du bas (devant l’usine) ou par la porte de droite (au quai).
- Pendant le tutoriel, la porte ouvre toujours le tableau de l’usine, comme en v0.2.0.
- **Éditeur de quêtes** (mairie → « ✏️ Inventer les quêtes du maire ») : changer, ajouter, déplacer ou supprimer les quêtes du maire. 17 types d’objectifs (livrer, livrer un client, récolter, monter une machine à un niveau, débloquer un parfum, acheter un véhicule, construire, réputation, ouvrir un quartier, recettes, livreurs, bouteilles, ventes, argent en caisse, argent gagné, étoiles…), le nombre, la récompense et ce que dit le maire. « 📍 Jouer » en fait la quête en cours. Déplacer ou supprimer une quête déjà faite ne fait pas sauter de quête.
- Les quêtes modifiées sont gardées dans la partie (même après un prestige). « Exporter le fichier » télécharge `quests.json` : mis dans `assets/` et publié, il devient les quêtes de tout le monde. « Ouvrir un fichier » recharge un `quests.json`. Les 15 quêtes d’origine sont maintenant dans `assets/quests.json`, et le simulateur les lit aussi.
- **Sauvegarde dans un fichier** (mairie → 💾 Sauvegarde) : « Exporter la partie » télécharge la partie, « Importer un fichier » la recharge, par exemple sur un autre appareil. Un résumé (nom, argent, commandes, temps de jeu) est montré avant de charger. Un fichier qui n’est pas une sauvegarde est refusé avec un message.
- Avant un import ou « Tout effacer », la partie en cours est gardée de côté : « ↩️ Reprendre la partie d’avant » la ramène.
- Mairie : le compteur de quêtes suit le nombre de quêtes (au lieu de « / 15 »). Les boutons de version et de mise à jour sont dans une nouvelle carte « 🎮 Le jeu ».

## v0.2.0 · 2026-09-28

- **Mode architecte** (mairie → « Décorer le village ») : on pose, déplace et enlève le décor du village, au doigt ou à la souris. 10 objets, dont 5 nouveaux : fleurs, sapin, clôture, tonneau, parasol. Le texte des panneaux se modifie. Boutons Annuler (aussi Ctrl+Z), Tout remettre, et 300 objets au maximum. Les bâtiments, routes et récoltes ne bougent pas : le jeu ne peut pas être cassé.
- Le village décoré est gardé dans la partie (même après un prestige). « Exporter le fichier » télécharge `decor.tiled.json` : mis dans `assets/` et publié, il devient le village de tout le monde (il s'ouvre aussi dans Tiled).
- **Abandonner une commande** en cours (bouton sous la commande, avec confirmation) : même perte d'argent qu'un retard, mais seulement la moitié de la réputation. Les bouteilles chargées reviennent au stock, et un livreur en route est rappelé.
- Mises à jour plus faciles à voir : un bouton « 🔄 Mise à jour » reste dans la barre du haut tant qu'une nouvelle version attend. La fenêtre ne remplace plus une autre fenêtre ouverte. Mairie : « 🔄 Vérifier les mises à jour ». Si la mise à jour ne peut pas se télécharger (fichier manquant dans le dossier), le jeu le dit.
- Correction : une mise à jour acceptée pendant la toute première visite ne rechargeait pas la page.

## v0.1.0 · 2026-09-28

- **Tutoriel de Mémé Grenadine**, proposé au début d’une nouvelle partie (jamais imposé) : 9 étapes pour apprendre en jouant. On marche jusqu’à Mémé, on entre dans l’usine, on cueille le verger, on accepte sa commande, on charge au quai, on livre l’épicerie et on améliore la cuisson.
- Pendant le tutoriel, le temps du village est en pause (horloge, événements, comptoir, commandes). Seul le bon bâtiment réagit. Un repère, une flèche, un anneau jaune et une main 👆 montrent quoi faire. Mémé appelle si on ne bouge plus.
- Boutons « Je suis perdu » (emmène devant la bonne porte) et « Passer ». L’étape est sauvegardée : on reprend où on en était.
- Après le tutoriel, Mémé se repose sur le banc du parc : parle-lui pour un conseil. À la mairie : « Revoir le tutoriel » et « Conseils : oui / non ».
- Conseils de Mémé au bon moment, une seule fois : mission réussie, matières épuisées, entrepôt plein, première nuit, premier événement, commande trop lourde, première commande ratée, nouveau bâtiment.
- Bâtiments fermés au début (planches et panneau « Bientôt ! ») : le Garage ouvre à 1 000 $ gagnés, l’Agence après 3 commandes livrées, le Labo avec un 2e parfum. Les parties déjà commencées gardent tout ouvert et ne voient pas le tutoriel.
- Correction : à la toute première visite, la page se rechargeait toute seule au bout d’une seconde (installation du service worker) et la fenêtre de bienvenue disparaissait.
- Debug (F2) : recommencer le tutoriel, étape suivante, ouvrir les bâtiments, revoir les conseils.

## v0.0.5 · 2026-09-28

- Correction de la v0.0.4 : avec `serve.json` (`cleanUrls: false`), `npx serve` affichait la liste des fichiers à l'adresse `/`, et le service worker la gardait comme page d'accueil. `serve.json` est supprimé (à supprimer aussi du dépôt).
- Le service worker ne met plus en cache « / » : il garde `index.html` et le sert pour toutes les pages. Vérifié avec `serve` (avec ou sans redirection), Python et un serveur type GitHub Pages, en ligne et hors ligne.

## v0.0.4 · 2026-09-28

- Correction : avec `npx serve` en local, le jeu ne s'affichait plus au 2e chargement (ERR_FAILED). Le service worker gardait la redirection /index.html → / et la ressortait telle quelle ; il en garde maintenant une copie propre. GitHub Pages n'était pas touché.
- `lancer-sirop.bat` : lance le jeu en local d'un double-clic sous Windows (Node ou Python).
- Ouvert par double-clic (`file://`), le jeu explique comment le lancer au lieu d'afficher un écran vert.

## v0.0.3 · 2026-09-26

- **Rééquilibrage complet**, mesuré avec le simulateur (`tools/simulate.mjs`). Avant, tout était fini en 1 heure ; maintenant, avec un joueur assidu : Colline vers 2 h 30 – 3 h 30, prestige vers 6 h, Violette vers 8 – 18 h, quêtes du maire vers 12 – 14 h.
- Usine : chaque niveau ajoute de la production (au lieu de la multiplier), avec un bond ×2 tous les 20 niveaux ; les prix montent de ×1,16 par niveau. La production ne peut plus devenir de moins en moins chère.
- Contrats : les commandes grandissent avec la production de l'usine (15 s pour l'Épicerie, jusqu'à 160 s pour le Port). Ils redeviennent le cœur du jeu.
- Véhicules : leur capacité grandit aussi avec la production (30 s à pied, 60 s à vélo, 130 s en charrette, 400 s en camionnette).
- Recettes secrètes : 1,5 fois le prix moyen des deux parfums (au lieu de 1,3 fois leur somme) ; 8 000 $ la première.
- Prix du haut de gamme relevés : Citron 6 K $, Sureau 100 K $, Violette 5 M $, Colline 300 K $, charrette 40 K $, camionnette 1,5 M $, Villa 2 M $, Domaine 25 M $.
- Prestige : disponible à 20 M $ gagnés, 3 étoiles au seuil puis +4 à chaque ×10 (avant : jusqu'à plusieurs centaines d'étoiles).
- Dernière quête du maire : gagner 100 M $ (récompense 1 M $).
- Les parties commencées avant cette version gardent leurs niveaux et leur argent : pour profiter du nouvel équilibre, repartir de zéro (Mairie → Tout effacer).

## v0.0.2 · 2026-09-26

- Sur Android et iPhone : plus de sélection de texte, de menu d’appui long ni de zoom au double appui ou au pincement pendant le jeu. Les champs de saisie (noms, recettes) restent éditables.

## v0.0.1 · 2026-09-26

- Première version publiée sur GitHub Pages.
- Le village de Sirop-sur-Mer : personnage 4 directions, compagnon, habitants, jour/nuit, météo et fête.
- Usine, contrats livrés à pied, labo des recettes secrètes, garage (véhicules, livreurs), agence immobilière, mairie et ses 15 quêtes.
- Quartiers des Champs et de la Colline.
- Application installable (PWA), jouable hors ligne, avec proposition de mise à jour.
