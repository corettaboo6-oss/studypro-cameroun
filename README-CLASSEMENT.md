# Classement collectif STUDYPRO CAMEROUN

Cette évolution ajoute une authentification par e-mail et un classement hebdomadaire partagé avec Supabase. Les scores sont enregistrés côté serveur : le navigateur ne peut pas attribuer directement des points ou modifier un chrono.

## Déploiement requis

Le classement collectif fonctionne sur le déploiement Vercel du dépôt, pas sur GitHub Pages seul.

### 1. Créer un projet Supabase
1. Créer un projet sur https://supabase.com/.
2. Dans **Project Settings → API**, relever le Project URL et la clé **anon/public**.
3. Dans **Authentication → Providers → Email**, activer le fournisseur e-mail. Pour un usage réel, conserver la confirmation d'adresse e-mail.

### 2. Créer les tables et fonctions
Dans le tableau de bord Supabase, ouvrir **SQL Editor → New query**.
Copier tout le contenu de `supabase/schema.sql`, exécuter le script et vérifier que les trois tables `studypro_profiles`, `studypro_weekly_scores` et `studypro_weekly_answers` sont créées.

Le script active RLS, interdit les écritures directes sur les scores et utilise une fonction SQL authentifiée pour empêcher qu'une même question rapporte plusieurs fois dans la même semaine.

### 3. Variables d'environnement Vercel
Dans **Project → Settings → Environment Variables**, ajouter pour Production (et Preview si souhaité) :
- `SUPABASE_URL` : URL du projet Supabase.
- `SUPABASE_ANON_KEY` : clé anon/public Supabase. Elle n'est pas une clé service-role.
- `STUDYPRO_ALLOWED_ORIGIN` : origine exacte du site Vercel, par exemple `https://studypro-cameroun.vercel.app` (sans slash final).
- Conserver aussi les variables du tuteur IA décrites dans `README-IA.md`.

Ne jamais ajouter de clé Supabase **service_role** au navigateur ni dans le dépôt.

### 4. Redéployer et tester
Redéployer Vercel après l'ajout des variables. Tester la création d'un compte avec une adresse e-mail valide, confirmer l'adresse si demandé, se connecter, répondre correctement à une question QCM puis vérifier que le score apparaît depuis un autre navigateur ou appareil connecté à un autre compte.

## Règles du classement
- Période hebdomadaire calculée en UTC, du lundi au dimanche.
- +5 points par question correcte unique et par étudiant et par semaine.
- Le meilleur chrono est le temps le plus court sur les questions correctes.
- Classement par score décroissant, puis meilleur chrono croissant.
- Les profils d'exemple affichés hors connexion restent des démonstrations fictives.
- Le score collectif réel est partagé entre les comptes inscrits.
- Le temps mesuré côté navigateur est indicatif : un utilisateur avancé peut manipuler son navigateur. Le serveur contrôle le format, les doublons et les limites, mais une validation anti-triche forte demanderait un moteur QCM côté serveur.

## Confidentialité
Les e-mails et mots de passe sont gérés par Supabase Auth. L'API STUDYPRO ne journalise pas les mots de passe. Les jetons de session sont conservés dans la session du navigateur et supprimés à la déconnexion. Les noms affichés et scores hebdomadaires sont visibles par les utilisateurs connectés au classement.
