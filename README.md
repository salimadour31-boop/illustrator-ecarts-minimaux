# Contrôle des écarts minimaux et des parties fines — script Adobe Illustrator

**ControleEcartsMinimaux.jsx** v1.0.0 — repère les endroits où deux contours sont plus proches qu'un écart minimal : espaces trop étroits entre objets, et parties trop fines (ou encoches trop étroites) d'une même forme.
*Flags every place where two outlines are closer than a minimum gap: narrow gaps between objects, and thin parts or narrow notches within one shape (FR/EN dialog).*

## Ce que fait le script

Vous donnez un écart minimal (par exemple 1 mm pour une découpe laser, 0,3 mm pour une dorure ou un gaufrage, 0,5 mm pour un pochoir ou du vinyle). Le script mesure la géométrie réelle des tracés, courbes de Bézier comprises, et signale :

- **les écarts trop étroits entre objets ou contours** : deux formes trop rapprochées, deux traits de découpe trop proches, un trou trop près du bord d'un tracé composé ;
- **les parties trop fines d'une même forme** : barres, empattements, pointes d'étoile, anneaux, liaisons de lettres vectorisées, et aussi les encoches trop étroites ;
- **les îlots et les trous plus petits que l'écart** (points, petits trous de perçage).

Les angles normaux d'une forme (angle droit, hexagone) ne sont pas signalés : deux points d'un même contour ne comptent que s'ils sont éloignés le long du contour. Les pointes plus aiguës qu'environ 60° sont signalées là où elles deviennent plus fines que l'écart.

Chaque zone fautive est entourée en rouge sur un calque **« Contrôle écarts minimaux »** non imprimable, avec un trait à l'endroit le plus étroit et, en option, la distance mesurée. Les zones sont triées de la plus critique à la moins critique. **L'illustration n'est jamais modifiée.**

Options :

- portée : sélection, plan de travail actif ou document entier ;
- écart en mm, cm, pt, px ou pouces ;
- tenir compte de l'épaisseur des traits (l'écart est alors mesuré entre les bords des traits) ;
- ignorer les objets qui se touchent ou se chevauchent (pour ne pas signaler chaque croisement) ;
- ignorer les tracés de masque d'écrêtage ;
- après marquage, sélectionner les objets concernés plutôt que les repères.

Le bouton **Analyser** affiche le nombre de zones et l'écart le plus petit sans rien créer. **Effacer les repères** supprime le calque de repères. Les objets verrouillés ou masqués, et ceux des calques verrouillés ou masqués, sont ignorés. Les textes, images, symboles et maillages sont comptés comme « non analysés » : vectorisez une copie pour les contrôler. Les réglages sont mémorisés dans un petit fichier local (dossier des données utilisateur).

## Pourquoi c'est nouveau

Vérifié le 16 octobre 2026 :

- **Illustrator** n'a aucune fonction qui mesure l'écart entre des tracés ou l'épaisseur d'une forme. La méthode habituelle consiste à décaler le tracé (Objet > Tracé > Décalage) et à chercher les intersections à l'œil.
- **Adobe Community** : la question « Detect vectors where the Distance to neighboring vectors is less than 1mm » est restée sans outil ; les réponses décrivent l'algorithme à écrire et renvoient au module payant ColliderScribe (Astute Graphics), qui empêche les collisions pendant qu'on déplace un objet mais ne contrôle pas un document existant.
- **Graphic Design Stack Exchange** (« How to set a minimum width of 1mm for my shape in illustrator (Laser cut) ») et **Reddit r/AdobeIllustrator** (« Is there a way to write a script the check that every object in an image is at least .02" ? ») : uniquement des contournements manuels.
- **Forum RUDTP** : la même demande, avec une piste par décalage et intersection, sans script publié.
- **GitHub** : aucune recherche de code (« pathPoints "minimum distance" ») ne donne de script de ce type ; la bibliothèque vexy-illustrator-scripts (209 scripts) n'a qu'une mesure de distance entre deux objets.
- Les catalogues connus (creold, Hiroyuki Sato, John Wundes, Alexander Ladygin, wckdtall, Kelso Cartography) et les boutiques de scripts consultées ne proposent rien d'équivalent. Le contrôle des **traits fins** existe ailleurs (et dans [ControlePreflight](https://github.com/salimadour31-boop/illustrator-controle-preflight)), mais pas celui des **écarts et des formes fines**.

## Installation

- **Ponctuelle** : Fichier > Scripts > Autre script…, puis choisir `ControleEcartsMinimaux.jsx`.
- **Permanente** : copier le fichier dans le dossier `Presets/<langue>/Scripts` d'Illustrator (par exemple `Adobe Illustrator 2026/Presets/fr_FR/Scripts`), puis redémarrer Illustrator. Le script apparaît dans Fichier > Scripts.

## Utilisation

1. Ouvrez une **copie** de votre document (conseillé, même si le script ne modifie pas l'illustration).
2. Sélectionnez des objets, ou rien pour contrôler le plan de travail actif ou tout le document.
3. Lancez le script, réglez l'écart minimal et les options, puis cliquez sur **Analyser**.
4. Cliquez sur **Marquer les zones** pour créer les repères. Ctrl+Z / Cmd+Z ou **Effacer les repères** les retire.

Sur des documents très chargés, l'analyse peut prendre du temps : commencez par une sélection ou un plan de travail.

## Version cible et statut des tests

- Cible : Adobe Illustrator CC 2018 et plus récent (ExtendScript, Windows et macOS).
- **Non testé dans Illustrator.**
- Syntaxe vérifiée avec acorn en mode ES3.
- Géométrie vérifiée sur données simulées (`tests/test-geometrie.js`, 31 tests : rectangles proches, barre fine, carré et hexagone sans faux positif, cercle de Bézier, étoile pointue, anneau composé, épingle ouverte, contacts, épaisseur des traits, petits trous, tri des zones, 400 cercles).
- Collecte et marquage vérifiés sur objets Illustrator simulés (`tests/test-simulation.js`, 13 tests). Ces simulations ne remplacent pas un essai réel.

Limites : la précision dépend de l'aplatissement des courbes (environ 1/25 de l'écart) ; une forme posée sur une autre sans la toucher est comparée à elle comme deux contours ; les effets dynamiques (décalage, contour variable) ne sont pas pris en compte tant qu'ils ne sont pas développés.

Aucun appel réseau, aucune collecte de données.

## Licence

MIT © 2026 Amirouche Amwanes — voir [LICENSE](LICENSE).
