# Plan de refonte visuelle autorisé

Périmètre : frontend existant uniquement ; backend, contrats, base et inventaires conservés. L'utilisateur demande explicitement la réalisation sans validation technique intermédiaire.

1. Sauvegarder sources et SQLite ; mesurer Kyara desktop/mobile ; conserver captures et observations, sans ressources propriétaires dans l'app.
2. Refaire les composants de cartes5:7, inclinaison3D, cadres et holographie ; inspecteur plein écran et CardReveal contrôlé.
3. Brancher une scène de boosters plein écran sur les réponses serveur existantes ; machine d'états, clics rapides, annulation et réduction des animations testés.
4. Refaire en-tête, navigation mobile, accueil et scène de choix selon les mesures ; intégrer les polices libres observées.
5. Recomposer collection/albums/wiki, marché et classement ; harmoniser toutes les pages secondaires avec les mêmes contrôles et proportions.
6. Capturer référence/avant/après aux mêmes fenêtres, produire planches et rapport géométrique ; corriger les écarts observés.
7. Exécuter tests métier existants, nouveaux tests d'animation et E2E sur base jetable, compilation et vérification visuelle ; contrôler que la base utilisateur reste intacte.

Répartition sans chevauchement : cartes et primitives / boosters et reducer / shell et accueil / pages métier visuelles et intégration finale. Les choix graphiques proviennent de `AUDIT_VISUEL_KYARA.md`, les effets d'ouverture non accessibles sont indiqués comme créations indépendantes.
