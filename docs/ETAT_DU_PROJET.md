# État du projet et vérifications

Livraison locale du 24 octobre 2026. Projet : `C:\Users\Nitropc\Desktop\fredou`. Aucun déploiement, push GitHub, contenu Dofus ou asset Kyara. L'application est une réalisation originale inspirée des parcours publics audités, pas une copie certifiée de ses mécanismes privés.

## Fonctionnalités implémentées

| Domaine | Réalisation utilisable |
|---|---|
| Navigation et identité | FREDOU COLLECTION, thème sombre or, accueil illustré, navigation ordinateur/mobile, menus de profil et d'activité, modales au clavier, notifications, chargements et états vides. |
| Catalogue | 72 cartes vectorielles originales, trois séries de 24 cartes, six raretés, identités uniques, recherche, filtres, tris, pagination, favoris, albums et fiches détaillées. |
| Boosters | Cinq catégories : gratuit rechargeable, quotidien, premium, série spéciale et événement. Stocks persistants, achats en Éclats, vérifications serveur, cinq cartes, probabilités centralisées, garanties de slots, pitié et journal des ouvertures. |
| Animation | Paquet interactif, ouverture, flash, particules, cinq révélations progressives ou simultanées, effets de rareté, distinction nouvelles/doublons, bilan et nouvelle ouverture. Réduction de mouvement système et préférence persistante. |
| Collection | Quantités, exemplaires manquants, progression globale et par série, acquisition personnelle, fiches et informations de marché. La progression mesure la possession actuelle ; vendre le dernier exemplaire peut la réduire. |
| Économie | Registre des Éclats, achats de boosters, récompenses de tirage, succès, parrainage, recyclage des doublons conservant un exemplaire de chaque carte. Écritures atomiques et soldes non négatifs. |
| Marché | Publication d'un lot au prix unitaire choisi, cartes mises en réserve, achat confirmé entre comptes, retrait, filtres, tris, historiques personnels et prix de ventes réellement conclues. |
| Échanges | Recherche de destinataire, proposition bilatérale, acceptation/refus/annulation, limites de quantité et de déséquilibre, revalidation des deux inventaires puis transfert atomique. Lien depuis un profil avec destinataire présélectionné. |
| Comptes | Trois comptes locaux fictifs persistants, changement de compte, sessions opaques HttpOnly, profils, statistiques, déconnexion, préférences, suppression avec confirmation du pseudonyme. |
| Progression | Neuf succès automatiques, dates et récompenses uniques, six classements calculés depuis la base, recherche, top 10/100, pagination et position personnelle. |
| Communauté | Parrainage avec récompense après trois ouvertures du filleul, refus d'auto-parrainage et de cycles, actualités locales, guide et règles. |
| Événements | Calendrier actif/inactif, booster de convergence soumis aux dates, prime unique, administration locale des événements et informations de démonstration. |
| Persistance | SQLite, 25 tables, clés étrangères, contraintes, index, journal WAL, transactions immédiates, initialisation non destructive. Installation, migration et lancement Windows. |
| API | Contrat OpenAPI, entrées Zod strictes, contrôle de session/rôle/origine, limitation de requêtes, identifiants d'idempotence et rejouabilité des réponses. Le navigateur ne choisit jamais les récompenses. |

Les règles et limites détaillées figurent dans [FONCTIONNALITES.md](FONCTIONNALITES.md), les tables dans [BASE_DE_DONNEES.md](BASE_DE_DONNEES.md).

## Partielles, non validées ou absentes

- **Discord OAuth2 : code réel présent, connexion de bout en bout non testée.** Aucun identifiant n'a été demandé. Les tests couvrent l'indisponibilité sans configuration, les sessions et le nonce OAuth ; l'échange réel avec Discord devra être validé avec une application autorisée. Le mode local est explicitement nommé et limité aux origines loopback.
- **Production : non livrée et non déployée.** PostgreSQL/Prisma, migrations de production, supervision, sauvegardes automatiques, tests de charge et limitation distribuée ne sont pas implémentés. SQLite et la limite de requêtes en mémoire conviennent à cette installation locale mono-instance ; un service public nécessite le travail décrit dans l'architecture.
- **Administration : volontairement restreinte.** Elle crée et modifie des événements. Un nouvel événement sans booster associé est informatif et ne promet aucune récompense d'ouverture. Créer une nouvelle famille de boosters, relier son événement, modifier catalogue/probabilités, comptes de démonstration ou actualités passe encore par les fichiers de configuration, les données et les scripts. Il n'existe pas de CMS complet ni d'importateur de cartes dans l'interface.
- **Marché et échanges : périmètre local à prix fixe.** Pas d'enchères, ordres d'achat, contre-propositions, messagerie, modération ou marché externe. Le contrôle de déséquilibre est configurable ; il ne reproduit pas les plafonds privés non vérifiés de Kyara. Les annonces sont vendues par lot complet, sans achat partiel du lot.
- **Historique : fenêtres bornées.** L'état transmis limite les historiques pour contenir sa taille ; les écritures restent en base. Il n'existe pas encore d'export complet ni de pagination serveur des journaux anciens. Le catalogue et les classements sont adaptés à cette démonstration, sans validation à très grande échelle.
- **Contenu : démonstration originale.** Trois joueurs fictifs et 72 illustrations stylisées constituent les données initiales, pas une communauté ni un catalogue commercial. La montée en niveau est représentée par la progression, les points et les succès ; aucun arbre de compétences distinct n'est ajouté.
- **Accessibilité et appareils : contrôles ciblés.** Navigation clavier, fermeture et confinement du focus des modales, mouvement réduit et largeur mobile ont été vérifiés. Pas d'audit WCAG exhaustif ni de certification lecteurs d'écran/Safari/Firefox.
- **Suppression du compte : immédiate après confirmation explicite**, sans délai de récupération de sept jours. Les transactions publiques utiles aux autres joueurs peuvent conserver des agrégats anonymisés ; les données personnelles associées sont supprimées par les cascades prévues.

## Vérifications réellement exécutées

Environnement : Windows, Node.js 26.7.0, Next.js 16.4.3, TypeScript strict, Chrome installé. Python 3.14.7 est disponible mais n'est pas requis pour le projet.

| Commande / contrôle | Résultat |
|---|---|
| `npm.cmd run typecheck` | Réussi, aucune erreur TypeScript. |
| `npm.cmd test` | **40 tests réussis**, zéro échec : moteur, authentification, contrat HTTP, sécurité et concurrence. |
| `npm.cmd run build` | Réussi, routes compilées, aucun avertissement dans la compilation finale. |
| `npm.cmd run test:e2e` | **9 tests Chrome réussis** sur le serveur compilé et une base jetable séparée. |
| `cmd /c MIGRER.bat` | Réussi : schéma à jour, seed non destructif, 72 cartes, trois joueurs et trois albums. |
| `cmd /c LANCER.bat` | Réussi : démarrage en 380 ms, `/api/state` répond HTTP 200, mode local, 72 cartes et trois joueurs. |
| Intégrité SQLite finale | `integrity_check` : `ok` ; `foreign_key_check` : aucune violation. |
| Console du navigateur après navigation finale | Zéro erreur, zéro avertissement. |
| Contrôle responsive | 1440 × 1000 et 390 × 844 ; 16 routes mobiles sans débordement horizontal ni erreur JavaScript. |

Les 40 tests incluent deux essais multi-processus réels : six processus réessayant une même ouverture ne reçoivent qu'un tirage de cinq cartes ; deux acheteurs d'une même annonce ne peuvent pas dupliquer les cartes réservées. Les tests contrôlent également les rollbacks, soldes, droits, expirations, suppressions, pitié, recharges et récompenses uniques.

Les neuf scénarios navigateur couvrent : catalogue/filtres/fiches/clavier ; achat et ouverture animée d'un booster avec rechargement de page ; publication et retrait d'une annonce ; navigation mobile ; achat entre comptes ; proposition puis acceptation d'échange ; recyclage et préférence persistante ; création d'événement informatif ; toutes les principales routes sur mobile.

La confirmation du recyclage dans la base de démonstration persistante a été refusée par le contrôle automatique d'approbation. Elle a été annulée. Le même parcours a ensuite été exécuté et validé dans une **nouvelle base jetable**, avec vérification de conservation de chaque identité de carte. Le script E2E crée désormais systématiquement sa propre base, son serveur sur le port 3100 et nettoie cette base à la fin. Les premiers essais d'ouverture, de marché et d'échange ont laissé quelques activités de démonstration dans la base locale, sans réinitialisation des collections.

Captures du rendu compilé : [accueil ordinateur](accueil-desktop.png), [collection ordinateur](collection-desktop.png), [accueil mobile](accueil-mobile.png). La comparaison avec Kyara porte sur la navigation dense, les albums, les raretés, les boosters et la hiérarchie des informations publiques ; son animation authentifiée ne pouvait pas être comparée.

## Reprendre le projet

Double-cliquer `LANCER.bat`, puis ouvrir **http://localhost:3000**. Choisir **Se connecter → Démonstration locale → Fredou**, Iris ou Noam. Fredou possède l'accès administratif. Les autres comptes permettent de tester les transferts avec de vrais inventaires distincts.

Le serveur de vérification est arrêté après les essais ; aucun service Windows permanent n'est installé. Les extensions futures sont décrites dans [ROADMAP_DOFUS.md](ROADMAP_DOFUS.md), sans adaptation actuelle à cet univers.
