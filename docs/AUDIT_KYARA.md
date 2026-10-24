# Audit public de Kyara

Observation : 24 octobre 2026 (Europe/Paris), https://kyara.games/. Audit par navigateur Playwright après indisponibilité du navigateur intégré. Aucune connexion Discord, création de compte forcée, transaction ou collecte de données privées. Les identités des joueurs observés ne sont pas réutilisées.

## Limites et méthode

Le site affiche une limitation de création des invités pour la connexion utilisée. Cette protection est respectée. Les récompenses effectives, animations après tirage, inventaires privés, modales authentifiées et contrôles serveur sont donc **non vérifiés**. Les règles écrites publiquement sont distinguées des opérations réellement exécutées. Certaines pages passent par un chargement asynchrone ; un chargement ne prouve pas une absence de fonctionnalité.

## Inventaire des observations

| Système / rôle | Interface et comportement observés | Relations et règles publiques | Inaccessible ou inconnu |
|---|---|---|---|
| Accueil, découverte | Fond presque noir, en-tête fixe compact, accents orange et jaune, grand carrousel quotidien/saisonnier, cartes en éventail, trois étapes pédagogiques. Sélecteur de boosters et panneau de détails. | Liens directs vers ouverture, wiki, marché et classement. | Personnalisation d'un compte connecté. |
| Boosters | Catégories gratuits, quotidiens/limités, boutique. Plusieurs thèmes, prix affichés en chakra, cinq cartes, garantie et probabilités présentées. | La page raretés annonce emplacements 1–3 commun ou mieux, 4 peu commun ou mieux, 5 rare ou mieux. Pitié Mythique au 250e sans Mythique, remise à zéro sur Mythique. Quotidien annoncé avec Épique garantie. | Tirages, probabilités réellement appliquées, recharge exacte et transactions non exécutés. Les probabilités « par booster » ne constituent pas une distribution par carte. |
| Ouverture | `/ouvrir/daily` montre le paquet central daté, cinq cartes annoncées et un état de connexion. | Lien depuis le carrousel. | Animation et résultat bloqués par absence de session ; aucune reconstitution prétendue comme observée. |
| Collection | `/collection` : compteurs uniques, complétion, doublons ; recherche, raretés, univers, possédées/manquantes/doublons/envies ; tris numéro, rareté, nom, obtention, prix, série. État vide et réinitialisation visibles. | Catalogue annoncé à 6 736 cartes lors de l'observation. Recyclage accessible comme commande de l'interface. | Inventaire personnel et recyclage non exécutés. |
| Albums | Bascule Albums effectivement utilisée : grandes séries, nombre possédé/total, pourcentage et décompte par rareté, tris. | Une série correspond à un album ; journal public mentionne protection d'album et ajout des manquantes aux envies. | Verrouillage et préférences non testés. |
| Wiki | Fiche publique visitée : nom, rareté, série, numéro, statut non possédé, médiane du marché, probabilités par booster, liens associés, ordre d'achat et envies. | Biographie, apparitions et voix verrouillées jusqu'à obtention annoncée. | Contenu détaillé après obtention, provenance et calcul interne de cote. |
| Marché | `/marche` : Acheter, Vendre, Enchères, Échanges, Mon activité ; recherche, rareté, univers, prix min/max, tri, annonces à prix fixe, compte à rebours, pagination et comptoir. | Journal public annonce prix minimums, limites autour de la médiane, confirmations, délai de revente des cartes reçues et historique médian sur 30 jours. | Achats, ventes, enchères, leurs validations et écritures serveur non testés. Certaines tentatives d'interaction sur onglets ont expiré ; ne pas les déclarer validées. |
| Échanges | Onglet marché visible ; journal décrit sélection des deux côtés, contre-proposition, doublons, déséquilibre et offres publiques. | Règles publiques limitent les gros dons ; journal du 14 octobre décrit plafonds glissants et délai de retransfert. | Parcours complet et garde-fous effectifs non testés. |
| Classement | `/classement` chargé : podium, liste et onglets Collection, Prestige, Mythiques, Séries, Succès. | Page Infos : personnages différents comme critère principal, Mythiques pour départager. | Calcul interne, pagination et position personnelle non vérifiés. |
| Profils et auth | Un profil public consulté : vitrine, collection, univers, envies, cartes à échanger et annonces du joueur ; bouton de copie du lien. Avatars et badges dans accueil/classement ; invitation à Discord. | Infos annonce conservation du pseudonyme, avatar et collection ; suppression avec saisie du pseudo, gel sept jours et possibilité d'annulation. | Profil privé, OAuth, préférences et suppression non testés. Aucune donnée d'identité du profil de référence n'est utilisée dans FREDOU. |
| Raretés | `/raretes` présente six niveaux et effets : gris, vert, bleu, violet, or, arc-en-ciel. | Popularité AniList annoncée comme origine de rareté. Recyclage publié : 1, 1, 3, 10, 40, 150 ; conservation d'un exemplaire. | Statistiques de tirage non contrôlées. |
| Économie et récompenses | Chakra dans en-tête, coûts dans boosters et marché. Journal mentionne missions, compteurs gratuits, récompenses et booster doré. | Liens entre boosters, doublons, échanges et progression. | Soldes, registre, recharge, missions et succès privés non vérifiés. |
| Boutique et événements | Catégorie boutique ; carrousel saisonnier avec date de fin ; menu Événements ouvrant un lien Parrainage. | Boosters thématiques et temporaires annoncés. | Liste complète, stock personnel et activation d'événements non testés. |
| Parrainage | Lien découvert via menu Événements ; `/parrainage` reste en chargement à l'observation. | Journal évoque seuil de confiance des filleuls. | Récompenses exactes et conditions complètes inconnues. |
| Actualités / règles | Pages `/nouveautes`, `/regles`, `/infos` consultées ; journal daté, types nouveau/amélioré/corrigé. | Un compte par personne, interdiction des bots et de vente réelle, règles de respect et confiance. | Historique public décrit des fonctions, il n'est pas une preuve de leur exécution. |
| Navigation et responsive | Desktop examiné à 1440×1000 et mobile à 390×844. En mobile : logo compact, ressources/profil, carrousel empilé avec cartes au-dessus du titre ; navigation inférieure Accueil, Collection, Ouvrir, Marché, Plus. Menu Plus mobile effectivement ouvert : missions, parrainage, amis, classement, wiki, avis et proposition d'installation. | Liens d'évitement, onglets et contrôles nommés visibles. En large, menus Plus/Événements ouverts. | Parcours connectés mobiles et clavier complet non effectués sur référence. |

## Interactions réellement vérifiées

- Navigation des pages publiques mentionnées ; chargements et état vide observés.
- Ouverture des menus Plus (amis, wiki, classement, avis) et Événements (parrainage).
- Bascule collection vers Albums et affichage de la progression par série.
- Rotation du carrousel quotidien/saisonnier et changement de composition visible.
- Inspection visuelle desktop du contraste, des espacements, de la densité et de la hiérarchie.
- Inspection visuelle mobile 390×844 et ouverture du menu inférieur Plus. Le bouton de menu d'en-tête trouvé dans le DOM était masqué sur cette variante : le contrôle réellement visible se trouve en bas.

## Choix originaux FREDOU

FREDOU reprend la boucle ouvrir → collectionner → recycler/échanger et la lisibilité des raretés. Il ne réutilise ni marque, textes, portraits, données utilisateur ni code Kyara. Les paramètres de probabilité seront ceux de FREDOU, explicitement publiés. Catalogue fictif local, économie Éclats, marché à prix fixe et échanges directs. Les fonctions authentifiées de Kyara seront des conceptions propres, pas des comportements prétendument reproduits.

## Sources publiques examinées

https://kyara.games/ · /collection · /marche · /raretes · /regles · /infos · /nouveautes · /classement · /wiki/64769 · /parrainage · /ouvrir/daily
