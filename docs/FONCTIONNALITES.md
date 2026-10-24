# Fonctionnalités de FREDOU COLLECTION

Ce document décrit les comportements implémentés dans les composants et services de FREDOU. Il ne décrit pas les règles d’un autre jeu. La présence d’un écran dans le code ne constitue pas une validation visuelle : les résultats de navigation, de responsive et d’animation effectivement vérifiés figurent dans [ETAT_DU_PROJET.md](ETAT_DU_PROJET.md).

## Périmètre et navigation

L’application utilise l’identité originale **FREDOU COLLECTION** et un univers fictif. Aucune adaptation à Dofus n’est intégrée. Les illustrations de démonstration sont des fichiers SVG locaux générés pour le projet.

| Écran | Route | Contenu implémenté |
|---|---|---|
| Accueil | `/` | Présentation immersive, cartes mises en avant, boosters, progression des univers, activités récentes, accès aux classements et raretés |
| Boosters et boutique | `/boosters`, `/boutique` | Réserves, recharge, garanties, probabilités, achats, ouvertures et historique récent |
| Collection | `/collection` | Catalogue avec état personnel, quantités, filtres, recherche, tris, favoris et recyclage |
| Albums | `/albums`, `/albums/[id]` | Trois séries, progression par série et collection filtrée |
| Wiki | `/wiki`, `/wiki/[id]` | Catalogue public et fiche de chaque carte |
| Marché | `/marche` | Annonces publiques, ventes personnelles, achats et transactions personnelles |
| Échanges | `/echanges` | Proposition, réception, acceptation, refus, annulation et historique |
| Classements | `/classement` | Six classements réels, podium, Top 10/100, recherche, pagination et rang personnel |
| Profils | `/profil`, `/profil/[id]` | Identité, date d’inscription, statistiques, progression, activités et favoris personnels |
| Succès | `/succes` | Conditions, progression, récompenses et dates de déblocage |
| Événements | `/evenements` | Calendrier, état temporel, description et récompense annoncée |
| Actualités | `/actualites` | Articles, annonces et notes de mise à jour initialisés en base |
| Guide | `/regles` | Boosters, raretés, économie, marché et règles de jeu |
| Parrainage | `/parrainage` | Code personnel, copie et saisie du code d’un autre joueur |
| Préférences | `/parametres` | Animations réduites, registre des Éclats, déconnexion et suppression de compte |
| Administration | `/admin` | Création/modification d’événements, calendrier, activation et récompense |

La navigation inclut un menu de profil, les liens de pied de page, des menus mobiles, des notifications d’actions et des activités récentes. Les mutations désactivent temporairement les commandes concernées. Les vues vides et le chargement initial disposent de messages explicites. Un chargement initial échoué peut être relancé.

L’état est récupéré au chargement, après chaque action réussie et toutes les trente secondes lorsque l’onglet est visible. Il n’existe pas de flux WebSocket. Les compteurs reflètent les données ; ils n’ont pas de moteur distinct d’interpolation numérique.

## Catalogue, collection et albums

Le catalogue initial contient **72 identités de cartes**, réparties dans trois séries de vingt-quatre cartes : Citadelles astrales, Sylve des murmures et Forges du crépuscule. Chaque série contient huit Communes, quatre Peu communes, quatre Rares, quatre Épiques, deux Légendaires et deux Mythiques.

Une identité de catalogue correspond à une ligne d’inventaire par joueur, avec quantité, favori, première et dernière obtention. Plusieurs acquisitions de la même identité augmentent cette quantité. Les cartes réservées au marché sont retirées de la quantité disponible.

La grille propose une recherche immédiate par nom, les filtres de rareté/série et les états toutes, possédées, manquantes, doublons ou favoris. Les tris portent sur le numéro, la rareté décroissante, la dernière obtention et la valeur de recyclage. La pagination comporte dix-huit cartes par page.

La progression mesure les **identités actuellement possédées**, sans compter les doublons. Vendre ou échanger son dernier exemplaire peut donc réduire la progression et les points. Le compteur Mythique du classement compte les exemplaires Mythiques disponibles. Le badge « nouveau » d’une ouverture utilise l’historique d’acquisitions : une carte déjà obtenue puis cédée ne redevient pas une première découverte.

Les fiches comportent nom, numéro, illustration, rareté, série, description, quantité personnelle, points, recyclage, favoris, prix minimum des annonces disponibles, historique personnel d’obtention, historique des prix réalisés et cartes associées de la même série. Les favoris nécessitent de posséder la carte. L’inventaire détaillé d’un autre joueur n’est pas exposé par les profils publics.

## Raretés, valeurs et points

Les valeurs sont centralisées dans `src/server/config.ts`. Les points sont attribués **une fois par identité possédée**, indépendamment de son nombre d’exemplaires.

| Rareté | Identifiant | Éclats par exemplaire recyclé | Points par identité |
|---|---:|---:|---:|
| Commune | 0 | 1 | 1 |
| Peu commune | 1 | 1 | 3 |
| Rare | 2 | 3 | 10 |
| Épique | 3 | 10 | 30 |
| Légendaire | 4 | 40 | 100 |
| Mythique | 5 | 150 | 350 |

Au redémarrage du processus ou à l’exécution des scripts de base, les configurations de boosters et les valeurs de recyclage/points sont synchronisées vers SQLite. Cette synchronisation conserve les inventaires et les montants historiques du registre monétaire. Modifier les points peut changer les classements ; modifier le recyclage change les recyclages futurs et la valorisation des futurs échanges.

## Boosters et probabilités exactes

Chaque ouverture attribue **exactement cinq cartes**. Les récompenses sont choisies exclusivement par le serveur avec `crypto.randomInt`. La transaction consomme la réserve, calcule le tirage, met à jour les inventaires, conserve l’ouverture et inscrit les gains monétaires. L’animation commence après cette attribution : la fermer ne fait perdre aucune carte.

| Booster | Disponibilité | Prix d’achat | Minimum de la 5e carte | Pitié Mythique | Éclats d’ouverture |
|---|---|---:|---|---:|---:|
| Éclat originel | +1 toutes les 4 heures, réserve maximale 3 | Gratuit | Rare | 250 ouvertures | 5 |
| Rendez-vous astral | 1 par jour, renouvelé à minuit UTC | Gratuit | Épique | 250 ouvertures | 25 |
| Prisme céleste | Réserve achetée | 120 | Épique | 100 ouvertures | 5 |
| Échos de la sylve | Réserve achetée, série Sylve uniquement | 150 | Épique | 100 ouvertures | 5 |
| Convergence des astres | Réserve achetée, événement actif, Citadelles uniquement | 180 | Épique | 75 ouvertures | 5, plus prime unique d’événement |

Les achats sont limités à vingt boosters par requête. Les boosters achetés restent en réserve. Un booster d’événement ne peut être acheté ni ouvert en dehors de la période active, même s’il reste en réserve. L’événement initial commence un jour avant l’initialisation et se termine trente jours après ; l’administration peut modifier ces dates.

### Poids de base

Chaque ligne totalise 10 000 unités. Ces pourcentages s’appliquent directement aux **trois premières cartes**, hors restriction de série. Ce ne sont pas les probabilités moyennes des cinq cartes ni la probabilité d’obtenir au moins une carte de cette rareté dans un paquet.

| Booster | Commune | Peu commune | Rare | Épique | Légendaire | Mythique |
|---|---:|---:|---:|---:|---:|---:|
| Éclat originel | 52 % | 28 % | 14 % | 4,80 % | 1,10 % | 0,10 % |
| Rendez-vous astral | 47 % | 29 % | 17 % | 5,50 % | 1,35 % | 0,15 % |
| Prisme céleste | 34 % | 30 % | 23 % | 10 % | 2,70 % | 0,30 % |
| Échos de la sylve | 35 % | 27 % | 24 % | 11 % | 2,70 % | 0,30 % |
| Convergence des astres | 30 % | 28 % | 25 % | 13 % | 3,50 % | 0,50 % |

Pour les trois premiers emplacements, toutes les raretés sont admissibles. Pour le quatrième, les Communes sont exclues. Pour le cinquième, toutes les raretés inférieures à la garantie sont exclues. Cette garantie du cinquième emplacement s’applique même lorsqu’un emplacement précédent a déjà produit une carte rare.

La probabilité conditionnelle d’une rareté admissible `r` est `poids[r] / somme(poids des raretés admissibles)`. Après le choix de rareté, une identité est tirée uniformément parmi les cartes de cette rareté dans les séries autorisées. Les tirages se font avec remise : plusieurs exemplaires identiques dans un paquet sont possibles et valides.

Exemple : la cinquième carte de l’Éclat originel utilise les poids 1 400, 480, 110 et 10 des raretés Rare à Mythique, soit 2 000 unités. Elle a donc 70 % de chances d’être Rare et 0,5 % d’être Mythique, hors pitié.

### Pitié et validation

Chaque joueur possède un compteur **par type de booster**. Il compte les ouvertures successives de ce type sans Mythique. Lorsque la prochaine ouverture atteint le seuil, son cinquième emplacement est obligatoirement Mythique. Une Mythique obtenue à n’importe quel emplacement remet le compteur à zéro. Les compteurs ne sont pas partagés entre catégories.

Le serveur vérifie le nombre de raretés, les poids entiers positifs, leur somme, la garantie et le seuil de pitié. Il vérifie également qu’une carte existe dans chacune des six raretés du groupe autorisé. Une configuration incohérente provoque un refus atomique, sans consommer le booster.

### Parcours d’ouverture

Le composant d’ouverture comporte un paquet central interactif, une transition vers cinq dos de cartes, une révélation individuelle ou groupée, des couleurs de rareté, une mise en évidence des Légendaires/Mythiques et un bilan avec badges nouveau/doublon. Le bilan affiche les Éclats reçus et permet une nouvelle ouverture si la réserve le permet.

La préférence du compte et `prefers-reduced-motion` permettent de passer directement à la révélation et de réduire les mouvements. Les modales permettent une fermeture explicite et au clavier. La qualité visuelle effectivement vérifiée et les limitations restantes des effets sont consignées dans l’état du projet.

## Économie et recyclage

Les Éclats sont fictifs et n’ont aucune conversion en argent réel. Les sources présentes sont l’accueil d’un compte, les ouvertures, les succès, les primes d’événement, le parrainage, le recyclage et les ventes. Les dépenses sont les achats de boosters et les achats sur le marché.

Les trois comptes initiaux de démonstration reçoivent chacun 1 200 Éclats et une collection prédéfinie persistante. Un nouveau compte Discord reçoit 300 Éclats. L’initialisation d’un compte fournit trois boosters gratuits, un quotidien et deux de chaque type achetable. Les comptes de démonstration ont des collections différentes ; plusieurs annonces initiales utilisent réellement leurs exemplaires mis en réserve.

Chaque mouvement du solde crée une ligne avec montant signé, motif, solde après mouvement, date et référence éventuelle. Le solde est limité entre zéro et un milliard d’Éclats. Une dépense insuffisamment provisionnée annule toute l’opération.

Le recyclage global de l’interface transforme tous les doublons disponibles et conserve au moins un exemplaire de chaque identité dans l’inventaire. L’API accepte aussi le recyclage ciblé d’une identité. Les exemplaires réservés au marché ne sont pas recyclables. Le recyclage demande une confirmation et affiche un montant prévisionnel ; le serveur recalcule les quantités et la valeur au moment de traiter l’action.

## Marché

Une annonce porte sur une identité et un lot de un à cinquante exemplaires, à un prix **unitaire** entier entre 1 et 1 000 000 Éclats. Un joueur peut conserver au maximum cent annonces actives. Les cartes sont immédiatement retirées de l’inventaire disponible et réservées dans l’annonce.

L’achat concerne le lot entier : `coût = prix unitaire × quantité`. Il débite l’acheteur, crédite intégralement le vendeur, attribue le lot et ferme l’annonce dans une seule transaction. Aucun frais n’est prélevé. Un joueur ne peut acheter sa propre annonce. Deux acheteurs concurrents ne peuvent pas obtenir le même lot.

L’annulation par le vendeur restitue les exemplaires et ferme l’annonce. La recherche, le filtre de rareté, le tri par date/prix, les confirmations, les quantités et une pagination de douze annonces sont présents dans l’interface. L’historique distingue les achats et ventes du joueur connecté.

Les invités et les tiers voient uniquement les annonces actives. Les annonces terminées sont accessibles à leur acheteur et vendeur. L’historique public des prix contient des ventes réellement réalisées, sans identité de l’acheteur. La fiche carte présente ces prix ; sans vente, elle affiche un état vide.

## Échanges

Le formulaire permet de rechercher un destinataire et de composer plusieurs lignes proposées/demandées. Le sélecteur des cartes demandées utilise le catalogue ; l’inventaire privé du destinataire n’est pas consultable. La disponibilité est vérifiée au dépôt puis de nouveau à l’acceptation.

Une proposition ne réserve pas les cartes. L’auteur peut l’annuler ; le destinataire peut l’accepter ou la refuser. Les quatre états persistants sont en attente, accepté, refusé et annulé. L’acceptation retire puis attribue les deux lots atomiquement. Une carte devenue indisponible laisse l’échange en attente et ne transfère rien.

Les garde-fous actuels sont : deux comptes différents, un à vingt identités distinctes par côté, au maximum cinquante exemplaires **au total par côté**, aucune identité répétée sur un côté ni présente sur les deux côtés, au maximum vingt propositions envoyées en attente. Le rapport entre les sommes des valeurs de recyclage des deux lots ne doit pas dépasser **10 pour 1**. Les contrôles de propriété et de statut restent impératifs, même si le client a été modifié.

## Identité, profils et suppression

L’architecture Discord OAuth2 comporte une initiation, un paramètre `state` à usage unique, un échange de code côté serveur, une récupération de l’identité et la création d’une session. Les secrets sont fournis par l’environnement. La session utilise un cookie HTTP-only, avec `SameSite=Lax`, et un jeton haché dans la base. Le parcours réel auprès de Discord demeure **non testé sans identifiants OAuth** ; aucune fausse connexion Discord n’est proposée.

Le mode local est clairement affiché et donne accès à Fredou, Iris et Noam. Fredou possède le rôle administrateur. Ce mode nécessite une origine locale et sa configuration d’activation ; il ne constitue pas un mécanisme d’authentification de production.

Les profils publics exposent pseudonyme, avatar, date d’inscription, statistiques calculées et activités publiques. Le solde, les préférences, le code de parrainage, le registre monétaire, les ouvertures, l’inventaire et les propositions privées restent propres à l’utilisateur connecté. Les profils des autres joueurs ne montrent pas leur inventaire détaillé ou leur historique d’acquisition.

La suppression demande la saisie exacte du pseudonyme. Elle invalide les sessions et supprime le compte, les inventaires, les ouvertures, les acquisitions, les transactions personnelles, les préférences et les données associées par cascade. Les annonces actives sont fermées. Les ventes et prix utiles à d’autres joueurs peuvent conserver une trace dont la référence au compte supprimé est anonymisée. Un reçu technique temporaire permet la répétition sûre de la demande de suppression.

## Classements, succès et parrainage

Les classements sont recalculés depuis SQLite : cartes uniques actuellement possédées, points des identités possédées, exemplaires Mythiques, albums complets, succès débloqués et pourcentage global. Ils comportent un podium, une sélection Top 10/Top 100, une recherche, dix joueurs par page, des liens vers les profils et la position personnelle. Avec trois comptes initiaux, les classements présentent trois joueurs réels ; aucune ligne artificielle ne remplit le Top 100.

Les succès sont évalués après une mutation réussie ; une première action d’un compte de démonstration peut donc débloquer des conditions déjà satisfaites par sa collection initiale. Chaque déblocage verse sa récompense une seule fois et conserve sa date. Les succès débloqués restent acquis si la collection diminue ensuite.

| Condition | Récompense |
|---|---:|
| Première ouverture | 20 Éclats |
| Dix identités possédées | 30 Éclats |
| Première Légendaire obtenue | 60 Éclats |
| Première Mythique obtenue | 150 Éclats |
| Premier album complété | 200 Éclats |
| Premier recyclage | 15 Éclats |
| Première vente ou premier achat au marché | 25 Éclats |
| Cinquante identités possédées | 100 Éclats |
| Dix ouvertures | 75 Éclats |

Le code de parrainage lie un compte à un seul parrain. L’auto-parrainage et les cycles de parrainage sont refusés. Lorsque le filleul atteint trois ouvertures enregistrées, chacun reçoit cent Éclats, une seule fois pour ce lien. Si le code est enregistré après que le seuil a déjà été atteint, la récompense est attribuée immédiatement. Le dispositif ne détecte pas les comptes multiples réels ; les comptes locaux servent à tester la logique.

## Événements, actualités et administration

Un événement contient un nom, une description, des dates de début/fin, un indicateur d’activation, une couleur et une prime de zéro à mille Éclats. La plage temporelle et les droits administrateur sont vérifiés côté serveur. L’événement initial Convergence est lié à son booster et verse une prime de quatre-vingts Éclats lors de la première ouverture éligible de chaque joueur.

L’administration peut créer des événements et modifier ceux existants. **Créer un nouvel événement ne crée pas automatiquement un booster et ne permet pas de rattacher arbitrairement un booster depuis l’interface.** Ce lien relève de la configuration et du modèle de données. Les récompenses d’événements sans booster lié ne disposent pas d’un bouton autonome de récupération.

Les actualités initiales sont persistantes et consultables. Il n’existe pas d’éditeur d’actualités, de cartes ou d’inventaires dans l’administration. Le catalogue et les données de démonstration sont initialisés par les scripts de migration/seed, sans réinitialiser une partie existante.

## Persistance, garanties et limites de consultation

Le serveur utilise SQLite via `node:sqlite`, avec clés étrangères, contraintes, index, mode WAL, attente des verrous et transactions d’écriture `BEGIN IMMEDIATE`. Une lecture de l’état utilise une transaction de lecture pour obtenir un ensemble cohérent. Les paramètres SQL sont liés ; les entrées d’actions sont validées par des schémas Zod stricts.

Une mutation possède une clé UUID d’idempotence. Le serveur conserve l’empreinte de l’action et sa réponse avec les écritures métier. Réutiliser la clé avec la même action restitue la réponse sans doubler les effets ; un contenu différent est refusé. Les contrôles HTTP d’origine, de session, de volume et de fréquence complètent les vérifications métier.

Le chargement de l’interface reçoit un snapshot borné, puis réalise ses filtres et sa pagination sur ce snapshot. Les données anciennes restent conservées en base :

| Données retournées | Limite du snapshot |
|---|---:|
| Ouvertures, mouvements d’Éclats, échanges personnels | 200 par catégorie |
| Annonces visibles, prix réalisés, acquisitions personnelles | 500 par catégorie |
| Activités publiques, événements, actualités | 100 par catégorie |
| Cartes | 10 000 |
| Séries | 500 |

Les annonces actives sont prioritaires avant les anciennes annonces personnelles. Les inventaires et classements sont calculés sur les données complètes. L’écran des boosters présente les vingt ouvertures les plus récentes du snapshot. Les historiques très anciens nécessiteraient des endpoints de pagination supplémentaires pour une exploitation à grande échelle.

## Accessibilité, tests et périmètre restant

Les composants prévoient des boutons et liens natifs, des libellés de champs, des attributs de progression, un lien d’évitement, des notifications de statut et des modales avec fermeture Échap, confinement et restitution du focus. La préférence de réduction des mouvements est persistante. Ces dispositions ne constituent pas une certification d’accessibilité ; la validation navigateur et les corrections constatées sont rapportées séparément.

La suite automatisée comprend les tests métier de `tests/engine.test.ts`, les courses entre processus de `tests/concurrency.test.ts`, les vérifications d’authentification/sécurité et de contrat, ainsi que des scénarios navigateur Playwright. Les tests métier couvrent notamment l’idempotence, les garanties/pitié, les recharges, le recyclage, les annulations, les fonds insuffisants, les échanges périmés, les restrictions de visibilité, les événements, les cycles de parrainage, la suppression et la conservation des historiques après synchronisation de configuration. Voir l’état du projet pour les commandes réellement exécutées et leurs résultats, sans déduire qu’un fichier de test a nécessairement été exécuté.

Les limites explicites de cette version sont :

- SQLite local, sans implémentation PostgreSQL opérationnelle ni ORM Prisma ; la migration de production reste un travail distinct.
- Styles CSS et animations natives, sans dépendance Tailwind CSS ou Framer Motion.
- Pas de paiement réel, déploiement, adaptation Dofus, enchères, messagerie instantanée, négociation avec contre-proposition, mission quotidienne distincte des succès, cadeau arbitraire de monnaie ou mécanisme avancé de modération.
- Pas de statistiques d’occupation d’une identité dans toutes les collections publiques, ni de consultation de l’inventaire privé d’un autre joueur.
- Pas de connexion Discord validée auprès du fournisseur tant que les identifiants ne sont pas configurés.
- Pas d’édition des cartes, des actualités ou des réserves de joueurs depuis l’administration ; les données initiales restent gérées par les scripts et la configuration.
- Pas de promesse de compatibilité mobile, de performance en production ou d’absence d’erreur visuelle sans les vérifications consignées dans [ETAT_DU_PROJET.md](ETAT_DU_PROJET.md).
