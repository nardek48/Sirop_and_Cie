# Journal des versions

Numérotation : `vMAJEUR.MINEUR.CORRECTIF`. Pour préparer une nouvelle version : `node tools/build-sw.mjs patch` (ou `minor`, `major`), puis décrire les changements ici.

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
