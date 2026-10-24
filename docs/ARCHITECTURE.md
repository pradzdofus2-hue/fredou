# Architecture FREDOU COLLECTION

## Décision et périmètre

FREDOU est une application locale de collection en univers fictif : Next.js App Router, React, TypeScript strict et SQLite via le pilote natif `node:sqlite`. Le navigateur affiche l’état et les animations ; le serveur possède les règles, la source aléatoire, les inventaires et les soldes. Les assets de démonstration sont des SVG originaux, sans ressource Kyara ou Dofus.

Le contrat public est `docs/api/openapi.json`. Les interfaces communes sans dépendance serveur sont dans `src/lib/contracts.ts`. Leur revue précède les implémentations. Ce document décrit les décisions d’architecture ; l’état effectivement vérifié et les limites de livraison figurent dans `ETAT_DU_PROJET.md`.

## Décision ADR-001 : SQLite natif pour Windows

**Contexte.** L’installation doit fonctionner localement sur Windows sans serveur PostgreSQL et sans compilation de modules natifs tiers. Les opérations de collection et de marché doivent disposer de transactions et de contraintes réelles.

**Décision.** Utiliser une version de Node disposant de `node:sqlite` et isoler tout SQL dans `src/server`. Les migrations SQL versionnées définissent clés étrangères, unicités, index et contraintes de solde/quantité. Activer les clés étrangères, un délai d’attente approprié et WAL. Les mutations économiques prennent un verrou d’écriture avec `BEGIN IMMEDIATE`, valident et écrivent dans une même transaction, puis valident ou annulent intégralement.

**Conséquences.** Pas de dépendance à un service de base externe pour le démarrage. SQLite sérialise les écritures ; il convient à cette instance locale et à une charge limitée. Son pilote synchrone bloque brièvement la boucle Node pendant une requête : éviter les opérations longues, les appels réseau et les rendus dans une transaction. Ne pas stocker la base sur un partage réseau et ne pas déployer plusieurs répliques serveur accédant au même fichier. La disponibilité/stabilité du pilote natif dépend de la version Node ; respecter la version annoncée dans README et scripts.

**Alternative.** Prisma/PostgreSQL reste pertinent pour un service hébergé, mais ajoute une étape de génération et un serveur à maintenir. Le choix SQLite natif répond à la préférence explicitement acceptable de SQLite local. Il ne prétend pas offrir une migration automatique par changement d’URL.

**Migration future.** Remplacer la couche de persistance par PostgreSQL et des verrous de lignes, conserver les validations métier et le contrat JSON, adapter les placeholders/types/dates, migrer les données par un plan validé avec sauvegarde et restauration testées. Ajouter des tests multi-processus et une gestion des reprises transactionnelles avant montée en charge.

## Découpage

- `src/app` : pages Next.js, styles et points d’entrée HTTP. Les routes gèrent cookies, origine, validation, statut et sérialisation.
- `src/components` : navigation, tableaux, collection, fiches, modales, scènes d’ouverture et formulaires accessibles.
- `src/lib/contracts.ts` : DTO partagés. Dates ISO UTC, montants entiers en Éclats, raretés 0 à 5.
- `src/server` : persistance, seed, règles de tirage, économie, marché, échanges, succès et sessions. Aucun import de ce dossier dans les composants client.
- `public/art` : cartes et illustrations originales locales.
- `tests` : vérifications métier et intégration sur bases temporaires isolées.
- `scripts` : installation, migration, seed et lancement Windows.

La répartition précise des modules peut évoluer sans changer les responsabilités. Les règles et accès à la base doivent rester indépendants de la présentation.

## Contrat et cycle de requête

`GET /api/state` renvoie un snapshot public et, si une session existe, les données privées du compte courant. Les profils publics ne contiennent ni solde, ni session, ni identifiants privés. Les disponibilités des boosters sont calculées à partir de l’heure serveur. Ce GET n’effectue pas de récompense ou de modification persistante. Le client effectue la recherche, les tris et la pagination sur le snapshot borné.

`POST /api/actions` accepte une union discriminée `type` validée côté serveur. Chaque mutation reçoit une clé UUID `Idempotency-Key`. Le serveur contrôle origine, taille, session, autorisation et données, entre dans une transaction, vérifie la clé et les conditions métier, applique les écritures puis conserve le résultat de l’action. Un retry avec le même corps ne doit pas réappliquer les récompenses ; une réutilisation avec un corps différent échoue. L’interface ne génère une nouvelle clé que pour une nouvelle intention utilisateur.

Le snapshot renvoyé permet au client de se réconcilier avec l’état serveur après une opération. Les collections historiques sont bornées : ouvertures et registre à 200 entrées, acquisitions et prix à 500, activités à 100. Ces limites préservent la taille du payload ; elles ne constituent pas un export exhaustif. Une API paginée serveur sera nécessaire avec un catalogue et une population importants.

## Invariants de collection et d’économie

Une identité de carte existe une fois dans le catalogue ; l’inventaire conserve la quantité par couple utilisateur/carte. Les soldes, prix, récompenses et quantités sont des entiers contrôlés. Un registre monétaire décrit chaque crédit/débit et le solde après opération ; le registre et le solde sont modifiés ensemble.

Une ouverture produit exactement cinq cartes. Les poids et garanties viennent d’une configuration serveur validée, pas du navigateur. Le serveur applique garanties et pitié, consomme le booster, enregistre tirage et acquisition, met à jour l’inventaire et débloque les succès dans une transaction. Le client n’anime que le résultat déjà acquis.

Le recyclage conserve au moins un exemplaire disponible et ne recycle pas une carte séquestrée dans une annonce. Une publication au marché retire les quantités disponibles et crée une réserve ; un achat paie le lot entier au prix unitaire annoncé, distribue les cartes et clôt l’annonce atomiquement. L’annulation restitue la réserve une fois.

Les propositions d’échange ne garantissent pas une disponibilité future. L’acceptation revérifie les deux inventaires, les limites et l’état `pending` avant d’effectuer les quatre mouvements. Seul le destinataire accepte/refuse ; seul l’auteur annule. Les configurations limitent quantités et déséquilibres de valeur.

## Sessions et OAuth

Sans configuration Discord, le mode développement est explicitement affiché et utilise des comptes fictifs persistants. Ce mode est un outil de test local, pas une authentification Discord simulée.

Les sessions utilisent un jeton opaque dans un cookie HttpOnly, SameSite et Secure sous HTTPS ; seul son hash est conservé dans la base. L’intégration Discord reçoit les identifiants depuis l’environnement serveur, vérifie un `state` aléatoire de courte durée, échange le code côté serveur et récupère un profil réel. Les tokens et secrets ne sont jamais livrés au client ni journalisés. Le chemin OAuth réel nécessite des identifiants pour son test de bout en bout ; leur absence doit être indiquée dans la livraison.

Les mutations vérifient une origine exacte de confiance et appliquent une limitation de débit. L’administration est réservée au rôle admin. La suppression exige le pseudo exact, révoque les sessions et traite les réserves, échanges et références économiques sans casser les comptes des contreparties.

## Interface et accessibilité

L’identité provisoire FREDOU COLLECTION associe thème sombre, accents lumineux et couleurs de rareté. Les vues utilisent les mêmes données : accueil, boosters, collection/albums, catalogue/wiki, profils, classements, succès, marché, échanges, boutique, événements et administration.

L’animation de booster révèle progressivement les cinq résultats déjà reçus. Elle utilise principalement transform et opacity, distingue les raretés et indique nouvelles cartes et doublons. La préférence utilisateur et `prefers-reduced-motion` doivent réduire ou supprimer les mouvements. Les formulaires utilisent des labels, les dialogues gèrent focus/échappement et les notifications annoncent les résultats. Les états de chargement, erreurs et absence de données font partie du parcours.

## Extension future

Le remplacement futur des cartes fictives dépend d’adaptateurs de catalogue, de séries et de ressources autorisées. Les moteurs d’inventaire, de tirage et d’économie utilisent les identifiants stables et la rareté plutôt que des noms de personnages. Aucun contenu Dofus n’est implémenté dans cette livraison. Voir `ROADMAP_DOFUS.md` pour les points d’extension.
