# STUDYPRO CAMEROUN — préparation de la version 2

## Protection de la production

- La branche `main` reste inchangée pendant la préparation.
- Les changements V2 sont isolés dans `version-2`.
- Le workflow GitHub Pages `.github/workflows/static.yml` ne publie que les changements poussés sur `main`; la branche V2 ne déclenche donc pas de mise en production.
- La mise en ligne ne doit se faire qu'après revue et validation de la Pull Request.

## Audit rapide de l'existant

### Déjà présent
- Site statique HTML/CSS/JavaScript, sans dépendance externe.
- Bibliothèque de cours organisée sur trois années IDE.
- Leçons détaillées de première année.
- Filtres de recherche par année et domaine.
- Mini-QCM, vidéos YouTube et système de points/badges.
- Progression enregistrée dans le stockage local du navigateur.

### Limites identifiées
- Les points, badges et le profil sont stockés dans `localStorage` : ils ne sont ni synchronisés ni protégés contre la modification locale.
- Il n'existe pas encore de comptes étudiants, de base de données ni de sauvegarde multi-appareils.
- Les leçons détaillées visibles concernent surtout la première année ; les contenus des années 2 et 3 sont principalement des fiches et objectifs.
- Le programme est présenté comme une base de révision et non comme une reproduction certifiée du référentiel officiel complet.
- Le dépôt ne comporte pas encore de tests automatisés dédiés à l'interface.

## V2 préparée dans cette branche

- Ajout d'un lien « Mon espace » dans la navigation.
- Nouveau tableau de bord étudiant affichant les points, le nombre de leçons validées et le niveau.
- Profil local avec prénom/pseudonyme et objectif de points personnalisable.
- Barre de progression et export JSON des données locales.
- Aucune donnée personnelle n'est envoyée à un serveur par ce module.
- Les pages de cours, QCM, récompenses existantes et le thème visuel sont conservés.

## Prochaines étapes recommandées

1. Vérifier manuellement le rendu sur téléphone et ordinateur, puis corriger les éventuels problèmes d'affichage.
2. Ajouter des tests de fumée pour le chargement des cours, le filtrage, les QCM et les récompenses.
3. Faire relire les leçons des années 2 et 3 par un formateur IDE et les comparer aux curricula détaillés applicables à chaque école.
4. Définir une vraie architecture de comptes et de sauvegarde avant de promettre une synchronisation ou un espace personnel multi-appareils.
5. Ne jamais stocker de mot de passe, clé API ou secret dans le dépôt public ou dans le JavaScript livré au navigateur.
6. Ne pas transformer les points locaux en certificats officiels ou en preuves de compétence clinique.

## Contrôle avant publication

- [ ] Vérifier le site de prévisualisation de la Pull Request.
- [ ] Tester navigation, recherche, filtres et affichage des leçons.
- [ ] Terminer une leçon et confirmer la mise à jour des points.
- [ ] Répondre à un QCM et confirmer que les points ne sont attribués qu'une fois par question.
- [ ] Tester l'enregistrement du profil, l'objectif et l'export des données.
- [ ] Confirmer que `main` n'a pas été modifiée avant validation.


## Enrichissement pédagogique réalisé dans V2

- Ajout de leçons détaillées pour les modules de deuxième et troisième années.
- Le bouton « Ouvrir le cours détaillé » ouvre désormais la bibliothèque correspondant à l'année du cours.
- Ajout de vérifications automatiques pour les scripts pédagogiques des trois années.
- Ajout de `SOURCES-PEDAGOGIQUES.md` pour distinguer références institutionnelles, repères professionnels et synthèses pédagogiques internes.
- Réserve importante : le communiqué MINSANTÉ du 15 juin 2023 confirme l'harmonisation et la révision des curricula, mais ne constitue pas à lui seul le référentiel détaillé des unités IDE. Une validation pédagogique par une école/formateur reste nécessaire.
