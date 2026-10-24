# Extension future vers un autre univers

Aucun contenu Dofus n'est inclus. Les personnages, descriptions et illustrations livrés sont fictifs et originaux.

1. Obtenir les autorisations et choisir des sources de données et d'images réutilisables. Documenter licences, attribution et provenance avant import.
2. Écrire un adaptateur de catalogue qui fournit les mêmes identifiants stables, raretés, séries, descriptions et chemins d'images. Conserver les identités historiques plutôt que réattribuer un numéro existant.
3. Définir une politique de correspondance des séries vers les futurs albums. Préparer une migration versionnée avec sauvegarde et vérification d'intégrité.
4. Remplacer les ressources graphiques et jetons de thème dans l'interface. Le moteur ne dépend d'aucun nom de personnage.
5. Revoir probabilités, valeur des doublons et garanties avec des simulations, puis versionner les paramètres d'économie. Ne pas recalculer rétroactivement les ouvertures enregistrées.
6. Préserver transactions, soldes, quantités, escrow du marché et idempotence. Pour une production publique, migrer vers PostgreSQL et tester les transactions concurrentes sur plusieurs instances.
7. Étendre les fiches avec des métadonnées spécifiques via un schéma validé ; garder les données de collection distinctes des informations descriptives.

Travaux à planifier séparément : hébergement, exploitation, sauvegardes automatiques, modération, politique de données et authentification Discord validée en conditions réelles. Aucun déploiement n'est réalisé dans ce projet local.
