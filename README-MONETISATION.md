# Monétisation STUDYPRO CAMEROUN

Cette version ajoute une base technique de paiement et d'abonnement via CinetPay pour le Cameroun (MTN Mobile Money et Orange Money). Les clés restent côté serveur. L'activation d'un abonnement dépend d'un webhook authentifié puis d'une vérification du statut directement auprès de CinetPay.

## Offres prévues
- Gratuit : matières, présentations et QCM classiques.
- Premium : 1 500 FCFA / 30 jours ; accès à toutes les leçons détaillées des trois années IDE.
- Premium Plus : 3 000 FCFA / 30 jours ; inclut Premium et les examens blancs.

Les montants sont fixés côté serveur dans `api/payments.js`. Le navigateur ne peut pas choisir ni modifier le montant. Le backend utilise le SDK officiel `cinetpay-js` (version publiée 0.1.1).

## Configuration obligatoire avant les vrais paiements

### CinetPay
1. Créer et valider un compte marchand CinetPay et un service marchand pour le Cameroun.
2. Récupérer les identifiants API Cameroun et activer les canaux MTN Mobile Money et Orange Money.
3. Ajouter dans Vercel (Production et Preview de test si nécessaire) :
   - `CINETPAY_API_KEY_CM`
   - `CINETPAY_API_PASSWORD_CM`
4. Utiliser d'abord les identifiants sandbox CinetPay. Les identifiants live ne doivent être ajoutés qu'après les tests de bout en bout.

### Supabase
1. Conserver les variables existantes `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `STUDYPRO_ALLOWED_ORIGIN`.
   - Définir `STUDYPRO_ALLOWED_ORIGIN` comme l’origine HTTPS exacte du site, par exemple `https://votre-domaine.vercel.app`, sans chemin ni barre oblique finale.
2. Ajouter `SUPABASE_SERVICE_ROLE_KEY` dans les variables d'environnement Vercel uniquement. Ne jamais l'ajouter au navigateur ou à Git.
3. Dans Supabase SQL Editor, exécuter d'abord `supabase/schema.sql`, puis `supabase/monetization.sql`.
   - Ne pas exécuter l'ancienne migration `supabase/migrations/202611110001_billing.sql` pour CinetPay; elle est conservée à titre historique et n'est plus utilisée.
4. Vérifier que les tables `studypro_payment_orders` et `studypro_subscriptions` et les fonctions RPC sont créées.

### Administrateur
Définir `STUDYPRO_ADMIN_EMAILS` dans Vercel avec une liste séparée par des virgules des adresses e-mail administratrices exactes. Le tableau de bord de revenus est refusé côté serveur à toute autre adresse.

### Déploiement
- Déployer le projet sur Vercel (les API serverless ne fonctionnent pas sur GitHub Pages seul).
- Le domaine public doit être HTTPS et correspondre à `STUDYPRO_ALLOWED_ORIGIN`.
- Le webhook doit être accessible à `https://VOTRE-DOMAINE/api/payment-webhook`; le configurer dans le service marchand CinetPay si le back-office exige une URL de notification dédiée.
- Redéployer après chaque changement de variable.

## Sécurité et limites
- Les plans, prix, utilisateur, devise et référence sont déterminés/vérifiés côté serveur.
- Les notifications doivent porter le notify token stocké à l'initialisation. Le serveur vérifie ensuite directement la réponse brute de CinetPay : statut SUCCESS, identifiants marchand et fournisseur, montant exact et devise XAF. Le SDK `cinetpay-js` 0.1.1 ne transmet pas montant/devise dans son type `PaymentStatus`; l'API brute est donc interrogée côté serveur après authentification.
- L'activation SQL est transactionnelle et idempotente : un webhook rejoué ne prolonge pas deux fois un abonnement.
- La clé service-role n'est jamais envoyée au navigateur.
- Le tableau de bord des revenus vérifie l'adresse administrateur côté serveur.
- La table `studypro_premium_content` est initialement vide : les leçons détaillées IDE doivent y être importées avec `required_plan=premium`; chaque examen blanc doit être importé avec `required_plan=premium_plus`. Le contrôle serveur refuse les plans inconnus, les abonnements expirés et les examens blancs pour les comptes Premium. Les ressources pédagogiques actuellement publiées dans `courses.js` et `lessons-year*.js` restent publiques car elles sont livrées par le site statique. Ce premier lot ne prétend donc pas verrouiller ces fichiers. La protection réelle des leçons déjà livrées dans ces fichiers n'est pas encore terminée. Tant que leur contenu n'a pas été migré vers `studypro_premium_content` et que les références statiques ne sont pas retirées du site, ces leçons restent publiques. Ne pas considérer cette PR comme prête à fusionner avant cette migration.
- L'abonnement est à renouvellement manuel : aucun prélèvement automatique récurrent n'est activé.
- Les paiements réels ne sont pas activés tant que les identifiants CinetPay, la migration Supabase et le domaine Vercel ne sont pas configurés et testés.

## Vérifications après configuration
1. Tester les deux opérateurs en sandbox.
2. Vérifier les cas paiement réussi, refusé, expiré, webhook rejoué, mauvais montant et mauvais utilisateur.
3. Vérifier que le compte A ne peut pas consulter le statut/les paiements du compte B.
4. Vérifier qu'un utilisateur non administrateur reçoit HTTP 403 sur l'action `admin`.
5. Vérifier l'activation/expiration des abonnements et les montants du tableau de bord.
6. Ne passer en production qu'après validation du compte marchand et un paiement réel de faible montant.
