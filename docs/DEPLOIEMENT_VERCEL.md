# FREDOU — Checklist de livraison Vercel

## Qualité automatique
Le workflow `.github/workflows/ci.yml` vérifie TypeScript, les tests unitaires et concurrents, le build de production, les parcours Playwright dans Chrome, les illustrations sur GitHub **et une véritable instance PostgreSQL 17 éphémère** qui exécute les scénarios d'écriture, rollback, idempotence et connexions concurrentes. Les exécutions #73 et #74 du commit c3a20e7 ont réussi (24 octobre 2026). Consulter l'onglet **Actions** de GitHub ; ne pas confondre « workflow créé » et « workflow réussi ».

## Validation fonctionnelle avant activation (une seule session)
Sous Windows : une fois tous les changements récupérés, lancer `powershell -ExecutionPolicy Bypass -File .\\scripts\\VALIDATION-FINALE.ps1`. Si `DATABASE_URL` ou `SUPABASE_DB_URL` existe déjà dans la session PowerShell, le script la réutilise sans l'effacer ; sinon il demande l'URI de manière masquée et nettoie seulement la variable temporaire qu'il a créée. Cette commande regroupe typecheck, tests, build, contrôle des images et tests PostgreSQL avec une seule saisie masquée de l'URI.
Sur le poste local, lancer `npm run db:check:runtime`, `npm run db:check:artwork` et `npm run db:test:writes` avec **la même** variable privée `DATABASE_URL` issue du Session Pooler Supabase. Ne jamais coller l'URI dans GitHub ou dans un journal partagé. Les tests d'écriture utilisent une transaction annulée à la fin, mais nécessitent encore une validation d'exécution réussie.

## Contrôle PostgreSQL GitHub dédié (manuel)
Le workflow `.github/workflows/postgres-release.yml` n'est **pas exécuté sur les push**. **Attention : GitHub exige qu'un workflow `workflow_dispatch` existe sur la branche par défaut (`main`) pour afficher le bouton `Run workflow`.** Le fichier n'existe actuellement que sur `feature/dofus-catalogue` : ne pas chercher le bouton tant que ce workflow n'a pas été intégré à `main`. Après intégration et contrôle de la PR, ouvrir **Actions → FREDOU PostgreSQL Release Validation → Run workflow**, puis choisir la branche à vérifier. Avant l'intégration, exécuter la validation localement avec `scripts/VALIDATION-FINALE.ps1`.
Il nécessite un secret GitHub Actions `FREDOU_TEST_DATABASE_URL` avec une URI de connexion PostgreSQL Session Pooler de l'environnement de validation. **Ne jamais saisir cette URI dans un commit, une issue, une capture ou un chat.**
Il lance la lecture du catalogue, le contrôle des 2 467 illustrations référencées par Supabase, puis le scénario complet de transactions avec annulation. Les comptes et écritures temporaires sont censés être annulés ; l'absence de lignes résiduelles est également vérifiée après le test.
⚠️ Tant que ce workflow n'a pas réussi avec l'environnement visé, **les écritures PostgreSQL ne sont pas validées**. Préférer une base de préproduction isolée et non une base qui héberge déjà des joueurs.

## Assets
L'audit local `npm run art:check` a été rapporté comme réussi (2467 fichiers uniques, aucun manquant). Le contrôle GitHub Actions des images du catalogue de démonstration est aussi passé (exécutions #73 et #74), mais ne vérifie pas encore toutes les 4833 cartes du catalogue Supabase. Vérifier le catalogue intégral et les réponses HTTP des images sur la préproduction avant ouverture.

## Audit Vercel constaté le 24 octobre 2026
- Le projet existant **`fredouu`** est accessible par son nom via la connexion Vercel ; projet `prj_1sK5IzdYXPcEy54jFwzF6vd6F9TX`.
- Son dernier déploiement connu est `READY`, mais basé sur **`pradzdofus2-hue/fredouu`, branche `main`, ancien commit `e2c52e0`**. Ce n'est **pas** le dépôt du nouveau FREDOU (`pradzdofus2-hue/fredou`, `feature/dofus-catalogue`).
- L'API du projet affiche **zéro variable d'environnement** ; les secrets PostgreSQL et Discord ne sont donc pas configurés pour ce projet.
- Le domaine connu est **`fredouu.vercel.app`**. La protection SSO est activée pour les déploiements non personnalisés ; vérifier l'accès à la préproduction avant les tests de navigation.
- **Action dans Vercel** : choisir le projet `fredouu` → Settings → Git et vérifier/modifier sa connexion Git vers `pradzdofus2-hue/fredou`. Vérifier ensuite Production Branch et les déploiements de préproduction ; ne pas publier depuis une branche erronée.
- **Action dans Environment Variables** : configurer sans jamais les écrire dans GitHub `APP_URL`, `DATABASE_URL` (Session Pooler Supabase), `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` et l'URI de redirection Discord ; faire correspondre `APP_URL` au domaine HTTPS testé.
- Laisser les bascules `PG_AUTH_ENABLED`, `PG_STATE_ENABLED` et `PG_GAME_ACTIONS_ENABLED` désactivées tant que la connexion réelle à la base n'est pas validée. Les activer **ensemble** uniquement lorsque le déploiement correspondant est prêt, car les routes hébergées refusent de basculer automatiquement sur SQLite.
- Le workflow automatique GitHub **#194 et #195 a réussi**, y compris PostgreSQL temporaire, tests navigateur et illustrations : ce succès ne prouve pas la configuration réelle du déploiement Vercel.

## Vercel (avant publication)
- Relier le projet Vercel `fredouu` au dépôt GitHub `pradzdofus2-hue/fredou`.
- Déployer d'abord une préproduction depuis `feature/dofus-catalogue`, puis tester avant toute promotion vers la production.
- Saisir les variables **privées** `DATABASE_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, ainsi que `APP_URL` en HTTPS.
- Configurer la redirection Discord : `https://DOMAINE/api/auth/discord/callback`. Ajouter cette même URL dans le portail développeur Discord.
- Garder `PG_AUTH_ENABLED`, `PG_STATE_ENABLED` et `PG_GAME_ACTIONS_ENABLED` à `false` tant que le test d'écriture n'est pas passé et que les actions non migrées ne sont pas traitées. Les basculer ensemble uniquement après audit complet des endpoints.
- Ne jamais définir `LOCAL_DEV_MODE=true` en production.
- Vérifier la configuration avec `npm run deploy:check` dans un environnement muni des variables de production, **avant** d'activer les fonctionnalités. Le contrôle rejette les URLs non HTTPS, les chemins de redirection Discord incohérents, les connexions PostgreSQL locales et les identifiants incomplets. Il n'imprime pas les secrets.
- Un échec de ce contrôle n'active rien : garder les fonctionnalités PostgreSQL fermées jusqu'au succès du test d'écritures sur une base de préproduction.
- Dès qu'une préproduction HTTPS est disponible, lancer `PREVIEW_URL=https://domaine-preview.example npm run preview:check` (PowerShell : `$env:PREVIEW_URL='https://domaine-preview.example'; npm run preview:check`). Cette commande **sans écriture** vérifie la page d'accueil, le mode Discord actif, la configuration OAuth, le catalogue invité, l'absence d'inventaire/ledger et d'activités économiques privées, les cinq boosters et un échantillon réparti de cinq illustrations HTTP. Pour contrôler **toutes les illustrations uniques** servies par la préproduction, définir également `PREVIEW_CHECK_ALL_IMAGES=true` (PowerShell : `$env:PREVIEW_CHECK_ALL_IMAGES='true'`) puis relancer `npm run preview:check`. Les téléchargements HTTP sont limités à huit en parallèle. Le contrôle complet ne remplace pas les tests de connexion Discord ni les écritures PostgreSQL.
- Tester le flux Discord, l'état connecté, les boosters, le marché, les échanges, les images et les liens de navigation sur l'URL de préproduction.

## Blocages connus
1. Le scénario complet d'écriture PostgreSQL avec rollback est **vert sur une base PostgreSQL 17 éphémère dans GitHub Actions** (#190 et #191). La connexion et les transactions sur l'instance Supabase de destination n'ont pas encore été vérifiées : lancer `db:check:runtime`, `db:check:artwork` et `db:test:writes` avec la configuration de cette instance avant publication.
2. Vérification de toutes les illustrations du catalogue Supabase et de leur livraison depuis le site public encore nécessaire.
3. Le routage principal des actions PostgreSQL est implémenté, mais l'authentification Discord réelle et le parcours navigateur avec PostgreSQL activé n'ont pas été validés sur Vercel.
4. Playwright local/CI validé, mais aucune validation E2E complète sur le déploiement Vercel.
5. Le projet Vercel `fredouu` est désormais consultable, mais il utilise encore l'ancien dépôt `fredouu` et ne possède aucune variable d'environnement : raccorder le bon dépôt et configurer les secrets avant un déploiement.

**Ne pas considérer le projet prêt pour un lancement public tant que ces points restent ouverts.**
