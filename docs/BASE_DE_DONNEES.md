# Base de données

## Stockage et transactions

La source du schéma exécutable est `src/server/database.ts`, fonction `migrate`. Le fichier SQLite est choisi par `DATABASE_PATH`, puis `DB_PATH`, sinon `data/fredou.sqlite`, résolu par rapport au dossier courant. Node ouvre une connexion synchrone réutilisée par chemin. Les scripts Windows lancent le projet dans son dossier.

Chaque connexion active `foreign_keys=ON`, `journal_mode=WAL`, `busy_timeout=10000` et `synchronous=FULL`. Les mutations métier, l’attribution de récompenses et leur reçu d’idempotence partagent un `BEGIN IMMEDIATE` suivi d’un `COMMIT` ou `ROLLBACK`. Le snapshot `/api/state` est lu dans une transaction différée `BEGIN`, afin que ses différents tableaux représentent la même version de la base. Les opérations réseau OAuth ont lieu hors des transactions économiques.

Les identifiants sont des `TEXT` (UUID ou identifiants stables du seed), les dates des `TEXT` ISO UTC et les compteurs des `INTEGER`. La base n’utilise pas les tables SQLite `STRICT`. Les contraintes SQL complètent donc la validation Zod des entrées et les contrôles métier ; elles ne remplacent pas ces contrôles.

## Tables et relations

| Table | Colonnes et clés principales | Relations et contraintes |
|---|---|---|
| `migrations` | `version` PK entier, `applied_at` | Trace l’installation du schéma version 1. |
| `users` | `id` PK, `username`, `avatar`, `discord_id`, `mode`, `role`, `balance`, `reduced_motion`, `referral_code`, `referred_by`, `created_at` | `discord_id` et `referral_code` uniques ; mode development/discord ; rôle player/admin ; solde 0 à 1 milliard ; préférence 0/1 ; parrain FK users avec SET NULL. |
| `sessions` | `token_hash` PK, `user_id`, `expires_at` | Hash SHA-256 du jeton, jamais le jeton brut ; utilisateur FK CASCADE. |
| `oauth_states` | `state_hash` PK, `expires_at` | Nonce OAuth hashé, consommé une fois, durée dix minutes. |
| `auth_receipts` | `id` PK, `action_hash`, `response`, `expires_at` | `id` = SHA-256 de l’UUID de requête ; registre global auth/suppression indépendant des FK utilisateurs, durée 24 h. Réponse JSON ; cookie de rejeu chiffré AES-256-GCM. |
| `series` | `id` PK, `name`, `description`, `color` | Trois séries fictives initiales. |
| `cards` | `id` PK, `number`, `name`, `rarity`, `series_id`, `description`, `image`, `recycle_value`, `collection_points` | Numéro unique, rareté entre 0 et 5, valeurs strictement positives, série FK. Identité unique d’une carte. |
| `inventory` | PK (`user_id`,`card_id`), `quantity`, `favorite`, `first_obtained_at`, `last_obtained_at` | Utilisateur FK CASCADE, carte FK, quantité ≥ 0. Les lignes à zéro conservent l’identité et les dates mais sont exclues de la collection disponible. |
| `events` | `id` PK, `name`, `description`, `starts_at`, `ends_at`, `active`, `color`, `reward` | Fin strictement après début, récompense ≥ 0. Le serveur normalise les dates. |
| `boosters` | `id` PK, `name`, `description`, `kind`, `price`, `color`, `guarantee`, `weights`, `pity_limit`, `cooldown_seconds`, `event_id`, `series_id`, `capacity` | Prix ≥ 0, événement et série FK optionnelles ; poids JSON validés par configuration serveur. |
| `user_boosters` | PK (`user_id`,`booster_id`), `available`, `last_refill`, `pity_count` | Utilisateur FK CASCADE, booster FK, réserve et pitié ≥ 0. |
| `openings` | `id` PK, `user_id`, `booster_id`, `created_at`, `cards`, `shards_reward`, `pity_triggered` | Utilisateur FK CASCADE, booster FK ; les cinq résultats sont conservés en JSON. |
| `ledger` | `id` PK, `user_id`, `amount`, `balance_after`, `reason`, `created_at`, `reference_id` | Utilisateur FK CASCADE ; montant signé, solde après ≥ 0. Référence métier polymorphe, sans FK. |
| `listings` | `id` PK, `seller_id`, `card_id`, `quantity`, `price`, `status`, `buyer_id`, `created_at`, `completed_at` | Vendeur/acheteur FK SET NULL, carte FK ; quantité/prix > 0 ; statut active/sold/cancelled. Prix unitaire. |
| `trades` | `id` PK, `sender_id`, `recipient_id`, `offered`, `requested`, `status`, `created_at`, `resolved_at` | Deux utilisateurs FK CASCADE et différents ; listes JSON ; statut pending/accepted/rejected/cancelled. |
| `achievements` | `id` PK, `name`, `description`, `icon`, `target`, `reward` | Cible > 0, récompense ≥ 0. Définitions des succès. |
| `user_achievements` | PK (`user_id`,`achievement_id`), `unlocked_at` | Utilisateur FK CASCADE et succès FK ; unicité empêche un second versement pour le même succès. |
| `acquisitions` | `id` PK, `user_id`, `card_id`, `quantity`, `source`, `created_at`, `reference_id` | Utilisateur FK CASCADE, carte FK, quantité > 0 ; journal des entrées, dont retours d’annonce. |
| `activities` | `id` PK, `user_id`, `kind`, `message`, `created_at` | Utilisateur FK CASCADE ; flux public synthétique sans secrets. |
| `price_history` | `id` PK, `listing_id`, `card_id`, `unit_price`, `quantity`, `sold_at` | Annonce FK unique : une vente par annonce ; carte FK ; prix et quantité > 0. |
| `idempotency` | PK (`user_id`,`key`), `action_hash`, `response`, `created_at` | Utilisateur FK CASCADE ; hash du corps canonique, réponse JSON. Pas de purge automatique métier actuellement. |
| `referral_rewards` | `referred_id` PK, `referrer_id`, `created_at` | Filleul FK CASCADE, parrain FK SET NULL ; récompense unique par filleul. |
| `event_rewards` | PK (`user_id`,`event_id`), `created_at` | Utilisateur FK CASCADE, événement FK ; bonus unique par joueur/événement. |
| `news` | `id` PK, `title`, `body`, `kind`, `published_at` | Actualités du seed ; pas d’éditeur d’actualités dans l’API actuelle. |
| `settings` | `key` PK, `value` | `seed_version` empêche la réinjection de la démonstration. |

Les listes JSON `openings.cards`, `trades.offered/requested`, `boosters.weights` et les reçus sont validés par les services. Le schéma SQL ne possède pas de contraintes JSON dédiées. `favorite`, `events.active`, `boosters.guarantee` et certains compteurs techniques sont également bornés par l’application plutôt que par des CHECK SQL exhaustifs.

## Index explicites

- `idx_sessions_expiry` : sessions(expires_at).
- `idx_cards_series_rarity` : cards(series_id, rarity).
- `idx_openings_user_date` : openings(user_id, created_at DESC).
- `idx_ledger_user_date` : ledger(user_id, created_at DESC).
- `idx_listings_status_card` : listings(status, card_id, price).
- `idx_trades_recipient` : trades(recipient_id, status).
- `idx_acquisitions_user_card` : acquisitions(user_id, card_id, created_at DESC).
- `idx_activities_user` : activities(user_id, created_at DESC).

Les PK et contraintes UNIQUE créent aussi leurs index SQLite. Il n’existe pas encore d’index distinct pour chaque clé étrangère, notamment le côté émetteur des échanges ; la taille locale reste petite. Ajouter les index après mesure pour une population importante.

## Flux atomiques

**Ouverture.** Calcul de réserve/recharge → contrôle événement et disponibilité → tirages cryptographiques côté serveur → cinq acquisitions → diminution réserve et mise à jour pitié → écriture ouverture → crédit Éclats/registre → succès/parrainage → reçu. Les recharges gratuites sont calculées à la lecture et persistées lors d’une ouverture ; quotidien renouvelé à minuit UTC. Le compteur de pitié est propre au couple joueur/booster.

**Marché.** Publier retire les quantités disponibles de `inventory` et les place en réserve logique dans `listings`. Acheter le lot vérifie qu’il est encore actif, débite l’acheteur, crédite le vendeur, livre les cartes et crée un seul point de prix. Annuler restitue la réserve une seule fois. Le verrou d’écriture empêche deux acheteurs de consommer la même annonce.

**Échange.** Une proposition n’immobilise pas les cartes. À l’acceptation, les deux inventaires et le rapport de valeur sont revérifiés ; les retraits et acquisitions sont enregistrés ensemble. Les cartes déjà réservées en annonce ne sont plus disponibles. Les limites actuelles sont vingt lignes et cinquante exemplaires au total par côté, avec un rapport maximal de valeur de recyclage de 10:1.

**Monnaie.** `adjustBalance` met à jour le solde et ajoute une ligne de registre dans la transaction appelante. Les tests comparent le solde à la somme des mouvements et vérifient les refus sans fonds. Le registre est append-only par convention des services ; aucun trigger n’interdit une modification SQL administrative directe. Les récompenses de succès et d’événements disposent de clés uniques pour prévenir les versements multiples.

**Suppression.** Après confirmation exacte du pseudo, les annonces actives du compte sont annulées, puis le compte est supprimé. Ses inventaires, sessions, registres, échanges et activités disparaissent par cascade. Les annonces et ventes historiques conservent les références économiques avec acheteur/vendeur anonymisé à NULL. Les cartes encore en réserve d’un compte supprimé disparaissent avec ses possessions ; elles ne sont pas transférées à un autre joueur. Un reçu de suppression sans pseudo en clair est créé dans la même transaction pour autoriser le retry après révocation de session.

## Initialisation et évolution

`migrate` applique actuellement un schéma initial idempotent avec `CREATE TABLE IF NOT EXISTS` et enregistre la version 1. Il n’existe pas de moteur complet de migrations différentielles avec rollback : toute évolution de colonnes doit ajouter une vraie migration versionnée et être testée sur une copie de base existante.

Le seed initial insère 72 cartes, trois séries, cinq boosters, neuf succès, un événement et trois actualités. En mode démo local, il crée Fredou (admin), Iris et Noam, leurs cartes et quelques annonces. `seed_version` empêche tout rétablissement involontaire des comptes ou quantités après une suppression. Aux démarrages ultérieurs, la configuration des boosters existants ainsi que les valeurs de recyclage et points des cartes par rareté sont synchronisés depuis la configuration centrale, sans réinitialiser les réserves ni réécrire les anciens mouvements monétaires. Les futurs recyclages et les classements courants utilisent donc les nouvelles valeurs. L’ajout de nouveaux boosters/cartes nécessite une migration explicite ; le seed n’est pas un outil général d’édition du catalogue.

Les nouveaux événements créés par l’administration sont informatifs. Le booster Convergence est lié à l’événement initial ; modifier cet événement contrôle sa période, son activation et sa récompense. L’API ne permet pas encore de relier dynamiquement un nouveau booster à un nouvel événement.

## Sauvegarde et PostgreSQL

Conserver une sauvegarde cohérente avec l’API de sauvegarde SQLite, ou fermer le serveur et les connexions avant copie de la base. Une simple copie du fichier `.sqlite` pendant des écritures WAL peut omettre les transactions récentes. Le secret `data/session.key` est nécessaire aux reçus auth chiffrés ; le garder séparément et hors du dépôt. Les autres jetons de session restent hashés.

SQLite sérialise les écritures et le pilote synchrone occupe la boucle Node pendant l’accès. Cette installation n’est pas conçue pour des répliques multiples partageant un fichier réseau. PostgreSQL demandera une adaptation du SQL, des verrous de lignes (`SELECT ... FOR UPDATE` ou mises à jour conditionnelles), des transactions et des types JSON/dates ; conserver les invariants, les tests de concurrence et le contrat HTTP. Prévoir une migration de données, une sauvegarde, un essai de restauration et une vérification des soldes/quantités avant toute exploitation hébergée. Aucun déploiement n’est réalisé ici.
