# Plan FREDOU COLLECTION

Le cahier des charges utilisateur autorise la réalisation sans validation intermédiaire. Aucun déploiement, push, fichier hors du dossier ou adaptation Dofus. Projet neuf sans dépôt préexistant : réalisation directement dans le dossier exclusif demandé, sans worktree extérieur.

## Architecture retenue
Next.js App Router, React, TypeScript strict, CSS responsive, Zod, animations CSS GPU. SQLite natif Node pour installation Windows sans compilation de modules natifs. Couche SQL isolée et migrations versionnées ; PostgreSQL ultérieur documenté. Prisma est une préférence et non une exigence : le pilote natif simplifie cette livraison locale et permet BEGIN IMMEDIATE, contraintes et registre atomique explicites.

## Phases et fichiers
1. A — `docs/AUDIT_KYARA.md` : audit public, limites et preuves. Avant tout code métier.
2. B — `docs/api/openapi.json`, `src/lib/contracts.ts`, `src/server/database.ts`, `src/server/schema.sql`, `src/server/seed.ts` : contrat et stockage avant services. Risque élevé : intégrité des relations.
3. C/D — `src/server/game.ts`, `src/server/economy.ts`, `src/server/catalog.ts`, `tests/engine.test.ts` : tests puis boosters garantis, idempotence, collection et recyclage. Risque élevé : atomiques.
4. E/F — `src/server/auth.ts`, `src/server/market.ts`, `src/server/trades.ts`, `src/server/achievements.ts`, `src/app/api/` : sessions, OAuth configuré, marché, échanges, classements réels. Contrat API référencé ci-dessus. Risque élevé : autorisations/concurrence.
5. G — `src/components/`, `src/app/`, `public/art/` : interface complète, art original, animations, événements, administration locale. Dépend des contrats ; risque moyen : cohérence des états.
6. H — `tests/`, `scripts/`, `LANCER.bat`, `README.md`, `docs/` : build, tests réels SQLite, HTTP et navigateur desktop/mobile, corrections, statut exact. Risque moyen : environnement Windows.

## Vérifications prévues
Tests unitaires des probabilités/garanties. Intégration sur base isolée : double ouverture, refus sans fonds, solde non négatif, deux acheteurs, échange atomique, recyclage gardant un exemplaire, récompense unique, suppression. Vérification TypeScript/build. Parcours UI ouverture/révélation/collection/recyclage/marché/échanges, responsive et console. Documentation des limites non vérifiées.
