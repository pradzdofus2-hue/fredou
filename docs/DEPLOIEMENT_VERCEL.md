# FREDOU — Checklist de livraison Vercel

## Qualité automatique
Le workflow `.github/workflows/ci.yml` vérifie TypeScript, les tests unitaires et concurrents, le build de production, les parcours Playwright dans Chrome et la présence des illustrations sur GitHub. Les exécutions #73 et #74 du commit c3a20e7 ont réussi (24 octobre 2026). Consulter l'onglet **Actions** de GitHub ; ne pas confondre « workflow créé » et « workflow réussi ».

## Validation fonctionnelle avant activation (une seule session)
Sous Windows : une fois tous les changements récupérés, lancer `powershell -ExecutionPolicy Bypass -File .\\scripts\\VALIDATION-FINALE.ps1`. Cette commande regroupe typecheck, tests, build, contrôle des images et tests PostgreSQL avec une seule saisie masquée de l'URI.
Sur le poste local, lancer `npm run db:check:runtime`, `npm run db:check:artwork` et `npm run db:test:writes` avec **la même** variable privée `DATABASE_URL` issue du Session Pooler Supabase. Ne jamais coller l'URI dans GitHub ou dans un journal partagé. Les tests d'écriture utilisent une transaction annulée à la fin, mais nécessitent encore une validation d'exécution réussie.

## Contrôle PostgreSQL GitHub dédié (manuel)
Le workflow `.github/workflows/postgres-release.yml` n'est **pas exécuté sur les push**. **Attention : GitHub exige qu'un workflow `workflow_dispatch` existe sur la branche par défaut (`main`) pour afficher le bouton `Run workflow`.** Le fichier n'existe actuellement que sur `feature/dofus-catalogue` : ne pas chercher le bouton tant que ce workflow n'a pas été intégré à `main`. Après intégration et contrôle de la PR, ouvrir **Actions → FREDOU PostgreSQL Release Validation → Run workflow**, puis choisir la branche à vérifier. Avant l'intégration, exécuter la validation localement avec `scripts/VALIDATION-FINALE.ps1`.
Il nécessite un secret GitHub Actions `FREDOU_TEST_DATABASE_URL` avec une URI de connexion PostgreSQL Session Pooler de l'environnement de validation. **Ne jamais saisir cette URI dans un commit, une issue, une capture ou un chat.**
Il lance la lecture du catalogue, le contrôle des 2 467 illustrations référencées par Supabase, puis le scénario complet de transactions avec annulation. Les comptes et écritures temporaires sont censés être annulés ; l'absence de lignes résiduelles est également vérifiée après le test.
⚠️ Tant que ce workflow n'a pas réussi avec l'environnement visé, **les écritures PostgreSQL ne sont pas validées**. Préférer une base de préproduction isolée et non une base qui héberge déjà des joueurs.

## Assets
L'audit local `npm run art:check` a été rapporté comme réussi (2467 fichiers uniques, aucun manquant). Le contrôle GitHub Actions des images du catalogue de démonstration est aussi passé (exécutions #73 et #74), mais ne vérifie pas encore toutes les 4833 cartes du catalogue Supabase. Vérifier le catalogue intégral et les réponses HTTP des images sur la préproduction avant ouverture.

## Vercel (avant publication)
- Relier le projet Vercel `fredouu` au dépôt GitHub `pradzdofus2-hue/fredou`.
- Déployer d'abord une préproduction depuis `feature/dofus-catalogue`, puis tester avant toute promotion vers la production.
- Saisir les variables **privées** `DATABASE_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, ainsi que `APP_URL` en HTTPS.
- Configurer la redirection Discord : `https://DOMAINE/api/auth/discord/callback`. Ajouter cette même URL dans le portail développeur Discord.
- Garder `PG_AUTH_ENABLED`, `PG_STATE_ENABLED` et `PG_GAME_ACTIONS_ENABLED` à `false` tant que le test d'écriture n'est pas passé et que les actions non migrées ne sont pas traitées. Les basculer ensemble uniquement après audit complet des endpoints.
- Ne jamais définir `LOCAL_DEV_MODE=true` en production.
- Vérifier la configuration avec `npm run deploy:check` dans un environnement muni des variables de production, **avant** d'activer les fonctionnalités. Le contrôle rejette les URLs non HTTPS, les chemins de redirection Discord incohérents, les connexions PostgreSQL locales et les identifiants incomplets. Il n'imprime pas les secrets.
- Un échec de ce contrôle n'active rien : garder les fonctionnalités PostgreSQL fermées jusqu'au succès du test d'écritures sur une base de préproduction.
- Tester le flux Discord, l'état connecté, les boosters, le marché, les échanges, les images et les liens de navigation sur l'URL de préproduction.

## Blocages connus
1. Aucun résultat confirmé de `db:test:writes` sur une base PostgreSQL réelle. Déclencher manuellement le workflow de validation dédié.
2. Vérification de toutes les illustrations du catalogue Supabase et de leur livraison depuis le site public encore nécessaire.
3. Certaines actions API sont encore explicitement indisponibles en mode PostgreSQL.
4. Playwright local/CI validé, mais aucune validation E2E complète sur le déploiement Vercel.
5. La connexion Vercel actuellement disponible n'a pas accès au projet `fredouu` (projet introuvable, lecture des déploiements interdite) : confirmer l'équipe propriétaire et les autorisations Vercel avant de demander un déploiement.

**Ne pas considérer le projet prêt pour un lancement public tant que ces points restent ouverts.**
