# STUDYPRO CAMEROUN — préparation de la monétisation

## Tarifs approuvés
- Gratuit : 0 XAF.
- Premium : 1 500 XAF par mois.
- Premium Plus : 3 000 XAF par mois.
- Devise : XAF (FCFA).

Ces montants doivent être configurés côté serveur, jamais acceptés depuis le navigateur. Toute modification de prix doit être versionnée et auditée.

## État actuel
La page publique affiche maintenant les trois offres et les tarifs. Les boutons Premium sont volontairement désactivés. Aucun paiement, abonnement ou droit Premium n'est simulé ou accordé côté navigateur.

Le dépôt contient un site statique. Le déploiement GitHub Pages seul ne peut pas protéger des cours Premium : un utilisateur peut lire les fichiers JavaScript et les contenus livrés au navigateur. Il faut un backend, une authentification et un stockage privé des contenus.

## Architecture cible
1. **Frontend** : demande de souscription à une fonction serveur; n'envoie que le plan et le fournisseur choisi.
2. **Authentification** : vérifier le JWT Supabase Auth côté serveur et utiliser l'identifiant utilisateur issu du JWT, jamais un user_id libre fourni par le client.
3. **Prix** : le serveur lit le tarif dans sa configuration/DB. Refuser tout montant fourni par le navigateur.
4. **Paiement** : créer une tentative unique avec un identifiant UUID et un statut pending; appeler le fournisseur depuis le serveur uniquement.
5. **Confirmation** : accepter le paiement uniquement après vérification serveur-à-serveur du statut ou d'une notification authentifiée. Vérifier montant, devise, référence, fournisseur et statut final. Rendre le traitement idempotent.
6. **Abonnement** : activer/renouveler les droits seulement après confirmation réelle; stocker début, échéance, état et référence de transaction.
7. **Contenus** : déplacer les documents Premium derrière une API/stockage privé avec contrôle d'accès serveur. Ne pas se contenter de masquer des cartes ou boutons en JavaScript.
8. **Administration** : tableau de bord des paiements confirmés, remboursements, abonnements actifs/expirés et chiffre d'affaires net. Journaliser chaque action sensible.

## MTN MoMo — Cameroun
- API officielle : https://momo.mtn.com/api/
- Produit visé : Collection / Request to Pay.
- Environnement cible : pays MTN Cameroon, code d'environnement `mtncameroon`, devise XAF.
- Les clés d'abonnement, API User et API Key sont des secrets serveur; ne jamais les mettre dans le dépôt, dans le HTML ou dans un bundle client.
- Configurer le domaine de callback comme demandé par le portail marchand. Vérifier le statut par interrogation API si le callback n'arrive pas; la documentation indique que le callback peut être envoyé une seule fois.
- Commencer par le sandbox et faire valider les tests/KYC avant toute mise en production.

Variables serveur à obtenir/configurer :
- `MTN_MOMO_BASE_URL`
- `MTN_MOMO_SUBSCRIPTION_KEY`
- `MTN_MOMO_API_USER`
- `MTN_MOMO_API_KEY`
- `MTN_MOMO_TARGET_ENV=mtncameroon`
- `MTN_MOMO_CALLBACK_URL`

## Orange Money — Cameroun
- Portail développeur : https://developer.orange.com/apis/om-webpay/
- Informations locales : https://www.orange.cm/fr/orange-developer.html
- Le Web Payment est réservé aux marchands Orange Money autorisés/KYA conformes. L'accès aux paramètres API et aux contrats doit être obtenu auprès d'Orange Cameroun.
- Utiliser exclusivement les endpoints, signatures, jetons et règles de notification remis dans le dossier marchand officiel. Ne pas inventer d'URL ou de signature.
- Commencer par le sandbox officiel puis faire valider le dossier marchand avant le go-live.

Variables serveur à obtenir depuis le dossier marchand officiel :
- `ORANGE_MONEY_BASE_URL`
- `ORANGE_MONEY_MERCHANT_ID`
- `ORANGE_MONEY_CLIENT_ID`
- `ORANGE_MONEY_CLIENT_SECRET`
- `ORANGE_MONEY_CALLBACK_SECRET`

## Variables Supabase / serveur
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (client autorisé)
- `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement, jamais côté navigateur)
- `APP_BASE_URL`
- Les secrets opérateurs ci-dessus.

Ne pas committer de fichier `.env`. Utiliser les variables d'environnement de l'hébergeur. Le site GitHub Pages ne peut pas exécuter les fonctions Netlify; le backend devra être déployé sur Netlify Functions (ou un service serveur équivalent) et le frontend pointer vers son URL HTTPS.

## Contrôles obligatoires avant ouverture
- JWT valide et utilisateur actif.
- Prix et devise issus du serveur.
- Référence transaction unique; idempotence des callbacks.
- Vérification serveur du paiement auprès du fournisseur; ne jamais faire confiance à une redirection navigateur.
- Montant, XAF, plan et destinataire correspondent exactement à la commande.
- Signature/secret callback vérifié selon les spécifications officielles.
- Gestion des expirations, échecs, annulations, remboursements et rapprochement.
- Limitation de débit, validation stricte des entrées, CORS restrictif, HTTPS, journalisation sans données sensibles.
- Aucun code PIN, mot de passe Mobile Money ou OTP conservé par STUDYPRO.
- Tests de sécurité et tests réels de bout en bout avant activation.

## Prochaine étape requise
Obtenir les accès marchands/KYC et documents API MTN MoMo Cameroun et Orange Money Cameroun, puis connecter le projet à Supabase Auth/DB et déployer les fonctions serveur. Tant que ces accès ne sont pas fournis et testés, les paiements restent désactivés.

## Connexion Supabase — état du code
Le frontend contient maintenant :
- `supabase-config.js` : emplacement réservé à l'URL du projet et à la clé publique anon/publishable.
- `billing-auth.js` : création de compte, connexion e-mail/mot de passe, déconnexion et lecture de l'abonnement actif avec la session Supabase.
- `index.html` : formulaire de compte intégré à la page des offres.

Le frontend ne peut lire que les abonnements de l'utilisateur connecté grâce à RLS. Il ne peut ni créer un paiement, ni modifier un abonnement, ni attribuer un plan Premium. La migration SQL donne uniquement des droits de lecture au navigateur.

### Mise en service à effectuer dans le projet Supabase
1. Créer/ouvrir le projet Supabase et confirmer la région/hébergement.
2. Dans SQL Editor, exécuter `supabase/migrations/202611110001_billing.sql`.
3. Dans Authentication > URL Configuration, ajouter l'URL publique STUDYPRO comme Site URL et URL de redirection autorisée.
4. Dans Authentication > Providers, activer Email et définir la confirmation d'adresse selon la politique choisie.
5. Copier Project URL et la clé publique anon/publishable dans `supabase-config.js`. Ces deux valeurs sont destinées au client; ne jamais y mettre `service_role`.
6. Tester inscription, confirmation d'e-mail, connexion, déconnexion et lecture d'un abonnement vide. L'offre reste Gratuit tant qu'aucun abonnement actif n'a été confirmé côté serveur.

### Limite de déploiement
Le site actuellement publié sur GitHub Pages est statique. Le fichier de configuration public doit être renseigné puis publié. Les fonctions serveur Netlify/Supabase Edge Functions pour paiements et administration ne sont pas encore déployées. Les paiements demeurent désactivés.
