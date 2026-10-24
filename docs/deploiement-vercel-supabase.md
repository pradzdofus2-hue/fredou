# FREDOU — migration Vercel + Supabase

## Architecture validée

- **Vercel** : Next.js 16, API routes, hébergement.
- **Supabase Postgres** : catalogue, sessions, comptes Discord, inventaires, boosters, historique, échanges, marché.
- **Supabase Storage ou assets statiques autorisés** : images de cartes. Les images présentes uniquement sur un PC ne sont pas accessibles à Vercel.
- **Discord OAuth existant** : conserver `/api/auth/discord` et `/api/auth/discord/callback` ; configurer les variables secrètes côté serveur.

## Pré-requis (NE PAS lancer la version SQLite actuelle en production)

Le dépôt utilise actuellement `DatabaseSync` de `node:sqlite` dans `src/server/database.ts` et un stockage local `data/fredou.sqlite`. Les fonctions Vercel ne constituent pas un stockage SQLite permanent. Une chaîne de connexion Supabase seule ne migre pas le code.

1. Sauvegarder la base SQLite sur le PC avant toute migration; ne jamais la publier sur GitHub.
2. Créer un projet Supabase en région européenne proche du déploiement Vercel.
3. Depuis Vercel, relier Supabase via **Marketplace > Supabase** pour synchroniser `POSTGRES_URL` et autres secrets.
4. Porter schéma, contraintes, migrations, transactions, requêtes SQL, gestion des identifiants, et opérations atomiques à PostgreSQL.
5. Importer les cartes et albums; migrer ensuite les comptes et données associées en respectant les clefs étrangères et toutes les références.
6. Tester les opérations concurrentes sur boosters, achats, échanges, inventaires, sessions et authentification avant d'ouvrir la production.
7. Importer les illustrations autorisées vers un support accessible aux visiteurs.
8. Déployer la branche validée, configurer le domaine permanent, puis les redirections Discord.

## Variables d'environnement

- `POSTGRES_URL` : URL du pool de connexions PostgreSQL Supabase, **secret serveur uniquement**.
- `APP_URL` : URL HTTPS définitive de FREDOU.
- `DISCORD_CLIENT_ID` : identifiant de l'application Discord.
- `DISCORD_CLIENT_SECRET` : secret Discord (**jamais** dans GitHub).
- `DISCORD_REDIRECT_URI` : `https://DOMAINE/api/auth/discord/callback`.
- `LOCAL_DEV_MODE=false` : en production.
- `DATABASE_PATH` et `DB_PATH` : variables SQLite locales à abandonner après migration.

Éviter d'exposer les clés Supabase privées avec un préfixe `NEXT_PUBLIC_`. Si un accès aux données doit être réalisé côté navigateur, utiliser des politiques RLS explicites; préférer les API serveur pour les opérations de jeu.

## Validation avant bascule

- `npm run typecheck`
- `npm test`
- `npm run build`
- Contrôler le nombre de cartes visibles et d'images accessibles
- Vérifier que les statistiques et transactions persistent après un nouveau déploiement
- Tester la liaison d'un compte local à Discord et les cas de compte Discord déjà associé
- Confirmer que les inventaires et historiques survivent à la migration

## Notes spécifiques à FREDOU

Les cartes `monster-*` importées ont été ajoutées à la base locale et ne sont pas nécessairement présentes dans `src/server/catalog.ts`. Il faut donc importer la **vraie base locale** ou reconstruire le catalogue depuis un export complet, en préservant les IDs. `docs/audit-catalogue-complet.csv` est un export d'audit, pas une sauvegarde des données joueurs.

Les PNG Dofus peuvent relever de droits tiers : vérifier l'autorisation avant publication, y compris sur Supabase Storage.
