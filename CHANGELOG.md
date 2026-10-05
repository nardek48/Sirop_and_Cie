# Journal des versions

Numérotation : `vMAJEUR.MINEUR.CORRECTIF`. Pour préparer une nouvelle version : `node tools/build-sw.mjs patch` (ou `minor`, `major`), puis décrire les changements ici.

## v0.8.10 · 2026-10-05

- **Compagnons animés** 🐶🐱 : Caramel le chien et le chat ont leur planche de marche (immobile et deux pas), dans `assets/persos/`. La marche vers la gauche est le miroir de la marche vers la droite.
- Avec l’image, le compagnon garde son ombre et son nom au-dessus de lui.

## v0.8.9 · 2026-10-05

- **Personnages animés** 🚶 : Sirotin, Mémé Grenadine, le livreur et les villageois (un homme et une femme) ont leur planche de marche (4 directions × 3 images), dans `assets/persos/`. Les clients du comptoir de l’usine aussi.
- Le **t-shirt de Sirotin** garde la couleur choisie dans le jeu, et chaque villageois a sa couleur de vêtement : les planches ont un vêtement magenta repeint par le jeu (`Art.sheetTint`).
- Villageois : un sur deux est une villageoise.
- Pour chaque planche, les poses où le corps est tourné de trois quarts sont écartées ; une direction de côté réussie sert aussi, en miroir, pour l’autre côté.

## v0.8.8 · 2026-10-05

- **Ouvrier** : nouvelle planche, avec des pas plus grands, les jambes bougent bien. De côté : la marche vers la droite (immobile, grande enjambée, jambes qui se croisent) et son miroir pour la gauche. De face et de dos : un pas avec le corps droit et son miroir pour l’autre pied. Les poses où le corps était tourné de trois quarts sont écartées.

## v0.8.7 · 2026-10-05

- **Ouvrier** : nouvelle découpe de la planche, l’ouvrier ne « pivote » plus à chaque pas. De face et de dos, le pas a le corps bien droit et l’autre pied est son miroir ; de côté, les deux pas sont de profil (la 4e colonne du générateur, avec le corps de trois quarts, n’est plus utilisée).

## v0.8.6 · 2026-10-05

- **Ouvrier** : la marche vers la droite est maintenant le miroir exact de la marche vers la gauche (une des images regardait à droite avec les jambes qui marchaient vers la gauche).

## v0.8.5 · 2026-10-05

- **Ouvriers animés** 👷 : les ouvriers de l’usine ont une vraie planche de marche (4 directions × 3 images : immobile et deux pas), générée puis découpée et recalée (pieds alignés, centrés sur la tête). Fichier `assets/persos/ouvrier.png`.
- Les planches de personnages peuvent maintenant être en haute définition : `Art.sheet(clé, fichier, { fw, fh, scale })` les affiche réduites et lissées (l’ouvrier : cases de 64×96 affichées à 0,68).

## v0.8.4 · 2026-10-05

- **Intérieur de l’usine en images** 🏭 : parquet et mur de briques (motifs répétés sans raccord visible), sacs de sucre, marmite sur son foyer en briques, cuve tampon en inox, embouteilleuse avec son tapis, étagères de l’entrepôt, comptoir avec sa caisse enregistreuse et tableaux noirs. Images dans `assets/usine/`.
- Tout ce qui bouge reste animé par le jeu : le **sirop de la marmite prend la couleur du parfum** de sa ligne, les flammes dansent dans le foyer, les bulles et la vapeur montent, le **niveau de la cuve** se voit dans sa fenêtre, les **bouteilles avancent sur le tapis** et se remplissent sous la buse (l’écran de la machine clignote vert), les caisses s’empilent sur les étagères, les bouteilles et les pièces sur le comptoir, le parfum s’écrit sur le tableau noir.
- La pile de sacs de sucre grossit avec le stock ; les cagettes montrent toujours les fruits de la ligne.
- Tant qu’une image n’est pas chargée, l’ancien dessin sert de secours.

## v0.8.3 · 2026-10-05

- **Clients en images** : l’Épicerie, le Café, le Supermarché, le Port et la Gare ont leur image (dans `assets/batiments/`). Un client pas encore ouvert est assombri avec « 🔒 ⭐ réputation ».
- **Horloge de la gare** : ses aiguilles donnent l’heure du jeu (la même qu’en haut de l’écran).
- **Ta maison et son garage** en images. Leurs murs prennent la couleur du papier peint choisi dans la maison 🖌️ (crème, menthe, rose…). La cheminée fume toujours le soir.
- La porte de l’Épicerie est à gauche sur l’image : on y entre un peu plus à gauche.

## v0.8.2 · 2026-10-05

- **Rue principale en images** 🏘️ : l’Usine, le Labo, les Contrats, l’Agence, la Mairie et le Garage sont maintenant de vraies images (dans `assets/batiments/`), chacun avec ses couleurs.
- Le jeu garde par-dessus ce qui bouge : la fumée de l’usine et les bulles du labo sortent de leur cheminée, le drapeau flotte en haut du mât de la mairie, les caisses s’empilent devant le quai, la pastille des offres reste sur les Contrats.
- Un bâtiment pas encore ouvert est assombri, avec les planches en croix et « 🔒 Bientôt ! ».
- Les portes de l’Usine et de l’Agence sont calées sur les nouvelles images (un peu plus à gauche).
- Code : les morceaux communs (fumée, drapeau, caisses, planches, pastille) sont partagés entre l’image et l’ancien dessin, qui sert toujours de secours.

## v0.8.1 · 2026-10-05

- **Nouvelles maisons** 🏡 : le Studio, la Maison de village, la Villa et le Domaine sont maintenant de vraies images (dans `assets/maisons/`), à la place des formes dessinées. Leur taille grandit avec le type.
- La **couleur du toit** suit toujours l’usage : bleu pour la location, brun pour le stockage, rouge pour la boutique, vert pour le verger. Les images ont un toit magenta que le jeu repeint au chargement (`Art.tinted`), en gardant les ombres.
- Un petit objet devant chaque maison montre aussi son usage : caisses (stockage), étal rayé (boutique), pommier (verger).
- Tant qu’une image n’est pas chargée, l’ancien dessin sert de secours.

## v0.8.0 · 2026-10-05

- **Nouvel habillage** (inspiré de l’image d’idée, pas copié). En haut, les compteurs ont une icône ronde et un petit titre : Caisse 💰, Revenus 📈, Réputation ⭐, Stock 📦. Sur téléphone, les titres sont masqués pour que tout tienne sur une ligne.
- **Quête du maire** : carte avec parchemin 📜, barre de progression et flèche.
- **Bureau des contrats** : chaque offre a l’icône de son client et des pastilles (bouteilles, gain, temps, réputation). Sans contrat en cours, les 3 étapes sont rappelées : ✅ Accepter → 📦 Charger au quai → 📍 Livrer. Les places et la prochaine offre sont dans les en-têtes.
- **Labo** en mixeur : deux grosses bouteilles + la bouteille du résultat qui brille. On choisit chaque parfum en touchant sa bouteille. Les recettes découvertes s’affichent en cartes avec « Produire ».
- **Agence** : « Nouveaux projets » en cartes (icône, usage, prix, Construire) et « Tes propriétés » avec badge de niveau, Rénover et Vendre.
- **Usine visitable** : 2 ouvriers par ligne, qui s’activent quand la ligne produit. Un bandeau rouge en haut de la salle prévient quand l’entrepôt est presque plein ou qu’une ligne manque de matières.
- Les véhicules ne changent pas : on va toujours les chercher au garage.

## v0.7.2 · 2026-10-05

- **Bureau des contrats : stock de sirop** en haut de l’écran. Chaque parfum débloqué (et chaque recette secrète) avec sa couleur, ses bouteilles en entrepôt (en direct), celles déjà réservées par les contrats acceptés, et 🔥 la ligne qui le fabrique. Le remplissage de l’entrepôt est rappelé à droite.
- Chaque **offre** indique les bouteilles libres face à la quantité demandée (« En stock : 119 / 16 bt »). En vert avec « ✓ prêt à livrer » quand il y en a assez.

## v0.7.1 · 2026-10-05

- **Tableau de l’usine** : une carte par ligne de production, côte à côte. Chaque carte montre l’état de la ligne (parfum, débit, cuve), **ses matières premières** (sucre et fruit(s) de son parfum, avec les boutons d’achat), puis **juste en dessous le panneau des parfums** de cette ligne. Plus besoin d’onglets. La ligne suivante s’achète dans une carte en pointillés.
- La **chaîne de production** ne garde que les machines communes (cuisson, cuve, embouteillage, entrepôt, comptoir) : elle tient sur une ligne et les cases ne s’étirent plus en hauteur. La cuve affiche sa capacité par ligne.
- **Usine visitable** : chaque ligne a ses propres sacs et cagettes (les matières de son parfum), et son tableau noir est juste en dessous. Toucher les matières d’une ligne ouvre la fiche « Matières · ligne 2 » avec ses achats.
- Le stock de sucre et de fruits reste commun à toute l’usine : chaque ligne y prend ce qu’il lui faut.

## v0.7.0 · 2026-10-05

- **Lignes de production** 🏭 : jusqu’à 3 lignes dans l’usine. Chaque ligne cuit **son propre parfum**, avec **sa propre cuve** : on fait par exemple de la menthe et du citron en même temps, sans attendre que la cuve se vide. Ligne 2 : 750 K $, ligne 3 : 15 M $.
- Les **machines sont communes** : améliorer la cuisson, la cuve ou l’embouteillage améliore toutes les lignes. L’entrepôt, le comptoir, les matières et le réapprovisionnement automatique (qui rachète les fruits de tous les parfums en cours) sont partagés.
- **Tableau de l’usine** : « Lignes de production » montre chaque ligne (parfum, débit, cuve, ou ce qui la bloque), des onglets Ligne 1 / 2 / 3 pour choisir le parfum de chacune, et l’achat de la ligne suivante. Les boutons de parfum indiquent si un parfum est déjà fait par une autre ligne.
- **Usine visitable** : la salle s’agrandit vers le bas, une rangée de machines par ligne, chacune animée par sa propre production. Chaque ligne a son tableau noir (« Ligne 2 · Grenadine ») pour changer son parfum. Une ligne pas encore achetée apparaît en pointillés avec son prix : la toucher propose de l’acheter. 🐢 et ⚠️ s’affichent ligne par ligne. Le comptoir est maintenant à droite, sous la porte du quai.
- Les **commandes** et la capacité des véhicules suivent la production d’**une** ligne : plus de lignes, c’est plus de commandes livrées en même temps.
- Au **prestige**, on repart avec 1 ligne. Équilibrage au simulateur : ligne 2 vers 3 h 45, prestige toujours vers 5 h 50, ligne 3 vers 10 h 45 (objectif de fin de partie).
- Éditeur de quêtes : objectif « 🏭 Lignes de production ». Mémé : conseil à l’ouverture de la 2e ligne. Debug (F2) : « +1 ligne ».

## v0.6.0 · 2026-10-05

- **Un fruit par parfum** : « Fruits & plantes » disparaît. Le sirop de menthe demande des feuilles de menthe 🌿, la grenadine des grenades 🍎, le citron des citrons 🍋, le sureau des baies de sureau 🫐, la violette des violettes 💜. Le sucre 🧂 reste commun. Les quantités et les prix ne changent pas (0,30 $ le kg de fruit).
- Les **recettes secrètes** demandent la moitié des fruits de chacun de leurs deux parfums (le Labo l’affiche).
- **Champs** : on y plante aussi grenadier, citronnier, sureau et violettes, chacun débloqué avec son parfum (les autres apparaissent avec un cadenas). Chaque plante a son dessin, aux couleurs du parfum.
- **Rien ne bloque** : l’usine vend chaque fruit (boutons pour le sucre et le(s) fruit(s) du parfum en production), et le réapprovisionnement automatique rachète tout seul ceux du parfum en cours.
- Le **verger** donne le fruit du parfum en production (ses fruits en prennent la couleur) ; le bois de sureau donne des baies de sureau ; les maisons-vergers de l’Agence, le fruit du parfum en production.
- Panneau Matières (usine et usine visitable) : le sucre, le(s) fruit(s) du parfum en cours, et les autres fruits en réserve. Dans la salle, les cagettes ont la couleur des fruits.
- Débloquer un parfum annonce son fruit. Mémé : conseils mis à jour, et un nouveau (« pour faire du sirop de citron, il faut des citrons »).
- Parties en cours : les anciens « fruits » deviennent le fruit du parfum en production.
- Simulateur : achète et plante le bon fruit. Progression quasi identique (prestige vers 5 h 50).

## v0.5.1 · 2026-10-05

- **Déplacements directs** : quand on clique quelque part, le personnage y va tout droit si rien ne gêne, et contourne les bâtiments, l’eau ou la fontaine sinon. Il ne remonte plus jusqu’à la route avant de repartir (par exemple de la maison vers un champ, ou d’un champ à l’autre). Pareil dans l’usine et dans la maison, et pour le compagnon quand il va cueillir.
- Nouveau fichier `js/world/path.js` : recherche de chemin (A* sur une grille de 20 px, puis lignes droites). `World.route` l’utilise partout.

## v0.5.0 · 2026-10-05

- **Champs à cultiver** 🌱 : les 8 parcelles des Champs (en bas du village) deviennent tes champs. **2 sont offerts dès le début**, les autres s’achètent un par un : 500 $, 2 K, 8 K, 30 K, 120 K, 500 K. Le champ à acheter porte un panneau « À vendre ».
- Dans chaque champ, on choisit ce qu’on plante : **🌿 Menthe** (fruits & plantes) ou **🌾 Canne à sucre** (sucre). Toucher un champ qui pousse ouvre sa fiche (avancement, choix de la plante, rappel des règles). Changer de plante fait tout repousser.
- Les champs **ne bloquent jamais rien** : mûr, un champ brille (✨ ×2) et attend. **Récolté à la main, il donne le double** (le compagnon aussi récolte à la main). Sinon, il est ramassé tout seul au bout d’une minute (récolte normale) et se replante, même quand le jeu est fermé.
- La récolte grandit avec l’usine (au moins 15 kg de menthe ou 18 kg de canne, sinon environ 4 s de ce que consomme l’usine) : les champs restent un petit bonus utile toute la partie. L’achat des matières et le réapprovisionnement automatique ne changent pas.
- L’achat « Ouvrir les Champs » (2,5 K) disparaît : plus de barrière, juste un panneau « 🌾 Les Champs » au bout du chemin. Les parties qui avaient ouvert les Champs ont leurs 8 champs (en canne, comme avant).
- Quête du maire n° 9 : « Ouvre les Champs » devient « Achète ton 3e champ » (aussi dans les quêtes inventées et les fichiers `quests.json` déjà exportés). Éditeur de quêtes : nouvel objectif « 🌱 Avoir des champs ».
- Mémé : conseil la première fois qu’un champ est mûr, et un nouveau conseil sur son banc.
- On marche d’un champ à l’autre par le chemin des Champs (avant, le personnage remontait jusqu’à la route).
- Simulateur : le joueur automatique achète et plante des champs, et les récolte quand le détour vaut le coup. Progression quasi identique (prestige vers 5 h 45 au lieu de 5 h 36).
- Debug (F2) : « Tout ouvrir » donne les 8 champs, « Tout est mûr » fait aussi mûrir les champs.

## v0.4.0 · 2026-10-05

- **Ta maison** 🏠, sous les terrains à vendre, avec ton nom sur le panneau (« Chez Sirotin »). On y entre à pied, comme dans l’usine. La fenêtre suit l’heure du jeu et, le soir, la cheminée fume et les fenêtres s’allument.
- **Dormir** : la nuit (20 h → 5 h 30), le lit propose « 😴 Dormir jusqu’au matin ». L’écran s’endort, on se réveille à 6 h 30 **Bien reposé : production de l’usine +25 % pendant 30 min** (affiché en vert en haut, avec le temps restant). Le jour, le lit dit dans combien de minutes il fera nuit.
- **Décorer** (gratuit) : toucher le pot de peinture 🎨, le cadre, le coin, le salon ou le tapis ouvre « Décorer ma maison ». Papier peint (6 couleurs, aussi visible de dehors), sol (4), couette et rideaux (5), cadre au mur, objet du coin (plante, aquarium, guitare, robot, nounours), salon (canapé, télé, piano, ordinateur), tapis (dont un arc-en-ciel). Le compagnon a son panier au pied du lit.
- **Choisir son véhicule** : derrière la cloison, le petit garage montre les véhicules achetés (et en silhouette ceux qui restent à acheter). Toucher un véhicule pour le prendre, ou les baskets pour partir à pied. Le vélo est plus rapide que la charrette, mais porte moins. On entre aussi directement par la porte du garage, dehors.
- Le Garage du village propose aussi « Prendre » pour chaque véhicule déjà acheté. Acheter un nouveau véhicule le choisit automatiquement.
- La maison et sa décoration sont gardées après un prestige.
- Éditeur de quêtes : nouvel objectif « 😴 Dormir dans sa maison ».
- Mémé : le conseil de la première nuit parle de la maison, et trois nouveaux conseils sur son banc (dormir, le vélo, la décoration).
- Les salles où l’on entre (usine, maison) partagent le même fonctionnement dans `world.js` (`ROOMS`) : une nouvelle salle = un module avec `spawn`, `solids`, `build` et `draw`.
- Journal : les titres vides en double de v0.3.0 et v0.3.1 sont retirés.

## v0.3.1 · 2026-09-28

- Usine visitable : le tableau noir « Parfum du jour » ouvre maintenant **« 🍬 Changer de parfum »**, avec les parfums en grands boutons (et ceux à débloquer). Une ligne dit si la cuve se vide encore de l’ancien parfum avant de passer au nouveau. « 📋 Tableau de l’usine » ouvre toujours toute la gestion.
- On se tient maintenant à droite du tableau noir pour l’utiliser : en cliquant dessus, le personnage y va sans rester coincé derrière.

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
