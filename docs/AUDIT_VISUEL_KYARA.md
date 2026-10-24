# Audit visuel mesuré — Kyara

Observation publique du 24 octobre 2026, Chrome via Playwright, fenêtres **1440 × 1000** et **390 × 844**. La barre de défilement Windows retire 15 px de largeur utile. Les captures sont dans `docs/visual/reference` et ne sont jamais utilisées comme ressources de l'application. Aucun CSS, JavaScript, shader, texture, illustration ou logo du site n'est importé dans FREDOU.

## Méthode et limites

Mesures par `getBoundingClientRect()` et styles calculés sur les éléments rendus ; essais réels de survol, clic, filtres, menus, inspection de carte et retournement. Les données détaillées des six cartes publiques sont conservées dans `visual/reference/card-measurements.json`. Les nombres ci-dessous sont des observations de cette session, pas des constantes garanties pour toutes les résolutions ou tous les comptes.

Le site refuse la création d'un nouvel invité depuis la connexion disponible. Cette limitation est respectée. La scène `/ouvrir/daily` est accessible jusqu'au paquet flottant et à ses options, mais reste sur « Connexion… ». La déchirure, l'apparition et la révélation des récompenses ne sont **pas observées**. Leur nouvelle réalisation FREDOU est indépendante et sera signalée comme telle. Les interfaces de compte privé, échange accepté et administration restent non vérifiables sur Kyara.

## Géométrie, typographie et couleurs

| Élément | Mesure ordinateur | Mobile / comportement |
|---|---|---|
| Fond / texte | `#0e0d12` / `#edeae4` ; surface secondaire `#15141a` ; ligne sombre `#302d38` | Même palette. Accent principal `#ff4d2e`, accent booster gratuit `#f5c518`, monnaie cyan. |
| Corps | Zen Kaku Gothic New, 16 px, graisse 400 ; navigation 14 px / 700 | Navigation inférieure à cinq entrées. |
| Titres | Unbounded, 700 ou 900 ; hero 72 px, interligne 72 ; pages 64 px ; collection 56 px ; sections 32 px | Hero 30 px / 900 ; collection environ 36 px ; adaptation des longues lignes. |
| Métadonnées | JetBrains Mono ; 11–13 px ; labels espacés et en capitales | Identique, taille contenue. |
| En-tête | 69 px, fond noir à 97 % ; contenu 1216 px à x104,5, wrapper1280 padding32 ; navigation gap26 | 61 px ; emblème seul à gauche, solde et avatar à droite, navigation principale masquée. |
| Bande de connexion | Hauteur65, fond brun sombre, texte clair, bouton orange44px | Hauteur141 au contenu observé, padding16, bouton sur ligne séparée. FREDOU affiche une information locale réelle, pas une fausse erreur de connexion. |
| Conteneurs | Largeur maximale1280 incluant64px de padding, soit1216 de contenu | Padding16 de chaque côté ; contenu343 à largeur utile375. |
| Boutons | CTA principal pill999px, hauteur48–58, texte noir gras ; transitions transform/couleurs150ms | CTA plein large ; contrôles tactiles de44px. |
| Navigation inférieure | Masquée | Fixe, hauteur78, cinq colonnes ; bouton central60px débordant vers le haut ; volet Plus. |

Les polices sont sous licence libre et peuvent être intégrées depuis leurs sources officielles, avec leurs licences, indépendamment du site de référence.

## Cartes : observations confirmées

La page publique `/raretes` présente les six cartes complètes et permet leur inspection. C'est une source plus fiable que les cartes non possédées floutées dans le wiki.

- **Format 5:7** : 149,7 × 209,6 dans la grille des raretés, 340 × 476 dans l'inspecteur. Rayon14, padding7 (9 sur grande carte), gap6.
- Bandeau supérieur : nom Unbounded12/900 dans le petit format, badge de rareté rond22px. En grand format, titre18/900 et bandeau34px.
- Illustration dans une zone arrondie10px ; numéro en bas à gauche, monospace gras. Série sous l'image. Pied de statistiques à fond noir translucide. FREDOU utilise ses points/recyclage réels, sans inventer les statistiques POW/AURA de Kyara.
- Commune : fond `#34313b`, cadre intérieur2px `#5a5662`, ombre `0 6px 14px rgba(0,0,0,.45)`.
- Peu commune : fond `#1f3b2e`, cadre `#3fbf7f` ; Rare : fond `#1b2c4a`, cadre `#4d9bff`.
- Épique : fond `#2e1c47`, cadre `#b072ff`, premier reflet holographique animé.
- Légendaire : fond or brun brossé, cadre `#f5c518`, holographie et éclairage plus intense.
- Mythique : cadre multicolore conique animé, tour en **5 s linéaires**, intérieur sombre, holographie intégrale. La couleur de libellé est rouge-orangé.
- Inclinaison observée : perspective900px ; variables de curseur normalisées ; au point80%/19%, rotationY≈7,24° et rotationX≈5,57°. Retour400ms `cubic-bezier(.2,.8,.2,1)`, suivi80ms. Matrice3D réellement observée après déplacement.
- Holographie : couches de reflet spectral et de lumière au curseur, transition d'opacité300ms ; balayage **3,6 s linéaire alterné**. Le site utilise aussi ses propres textures foil/glitter : elles ne sont pas récupérées. FREDOU recrée ces effets par des motifs procéduraux originaux.
- Carte manquante : rectangle5:7 pointillé2px `#34313b`, fond `#111015`, symbole« ? », numéro et rareté, sans révélation de l'illustration.
- Inspecteur : overlay plein écran sombre, carte340×476 centrée, perspective1100px, fermeture44px en haut à droite ; déplacement du curseur et clic pour retourner vers les informations puis lien de fiche. Le mouvement suit une transition120ms ease-out ; la chronologie exacte du retournement n'a pas été isolée image par image.

## Boosters et scène d'ouverture

Choix ordinateur : section sombre avec halo radial coloré, padding vertical56 ; partie gauche≈820px, panneau droit≈340px, rayon18 et padding22. Onglets arrondis Gratuits / Du jour et limités / Boutique, sélection jaune hauteur36. Boutons de paquets200×347,7 comprenant l'illustration et les labels ; trois colonnes dans la scène observée. Panneau : nom22px/900, compteurs, probabilités et CTA294×56.

Sur mobile, cette grande scène n'est pas affichée dans l'accueil ; l'accès Ouvrir passe par la navigation inférieure. FREDOU conserve également une page de choix accessible, avec ses cinq boosters existants.

Ouverture publique : fond presque noir, navigation dédiée minimale, retour à gauche, nom au centre et options à droite. Zone du paquet300×461,5 à x570/y213,2 en1440×1000 ; mobile249,6×384 à x70,2/y231,8. Paquet flottant **4,5 s ease-in-out**, petit angle et déplacement vertical, halo radial doré468×648, ombre ovale168×22, particules clairsemées. Options réellement ouvertes : animations et confirmation avant booster payant. Le reste est bloqué par la connexion et sera une recréation non vérifiée.

## Pages et états interactifs

| Page | Structure observée et reprise ciblée | Limite |
|---|---|---|
| Accueil | Hero1216×428 à x104,5/y162, rayon18, padding56 ; texte à gauche et trois portraits170×238 inclinés en éventail à droite. Deux diapositives quotidien/événement. Bande pédagogique à y618, hauteur231 ; trois étapes numérotées ; scène de boosters puis tirages et marché/classement. | Les avis réels de Kyara ne sont pas copiés ni remplacés par des faux avis. |
| Accueil mobile | Éventail au-dessus du texte, hero x16/y230, largeur343, padding18/16/40, gap24, CTA empilés. | Hauteur du hero varie avec la diapositive et le texte. |
| Collection | Titre et compteurs en ligne sans trois grosses boîtes ; progression des albums à droite. Recherche420×44, bascule Cartes/Albums, chips de rareté, filtres compacts ; six cartes187,7×262,7 en largeur utile1216. | Inventaire privé inaccessible ; les cases manquantes publiques sont observées. |
| Collection mobile | Compteurs compacts, progression dessous, recherche pleine largeur, bascule, chips horizontalement défilantes, bouton Filtres ouvrant les sélecteurs. | Les contenus FREDOU restent ceux des trois albums existants. |
| Marché | Titre64, description, onglets soulignés rouge, recherche/chips/filtres, grille de trois annonces à gauche≈788 ; panneau de comptoir à droite400. Chaque annonce contient une vraie carte encadrée, pas une image de galerie seule. | Chat/enchères non implémentés dans le moteur existant ; le panneau FREDOU présente les activités réelles, sans faux chat. |
| Classement | Titre64, filtres pill, recherche, podium libre avec avatars et socles : deuxième à gauche, premier au centre plus haut, troisième à droite ; lignes denses dessous. | Les scores sont ceux des comptes FREDOU, jamais les valeurs de Kyara. |
| Wiki | Bandeau de titre pleine largeur avec motif diagonal discret, badges et grand nom ; contenu large à gauche, carte en colonne droite320px, données et prix en dessous. | La fiche Kyara détaillée est verrouillée ; FREDOU garde ses descriptions originales accessibles. |
| Menus / modales | Plus et événements déroulants ; volet mobile ; états actifs, hover, fermeture ; inspecteur de carte plein écran mesuré séparément. | Dialogues économiques privés non observés : adaptation indépendante à la palette et aux contrôles mesurés. |
| Autres pages existantes | Profils, succès, événements, actualités, échanges, paramètres et admin seront alignés sur ces mêmes conteneurs, titres, couleurs et contrôles. | Pas de revendication de reproduction exacte pour les pages privées inaccessibles. |

## Comparaison et traçabilité

- Référence : `visual/reference/*-desktop.png`, `*-mobile.png`, états de carte et filtres.
- Avant : captures de la première version dans `visual/before` ; sources et base sauvegardées dans `backups/avant-refonte-20261024-005453` avant modifications. Une sauvegarde SQLite cohérente via l'API backup a été vérifiée (`integrity_check=ok`).
- Après et compositions côte à côte : `visual/after`, `visual/comparisons`. Comparaisons aux mêmes dimensions ; géométrie et styles mesurés séparément des illustrations et contenus volontairement distincts.
- Aucun pourcentage global de fidélité ne sera déduit d'une impression visuelle. Les écarts de cadrage, données, illustrations, contenu privé et animations non accessibles resteront indiqués.
