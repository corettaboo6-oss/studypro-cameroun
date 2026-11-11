# STUDYPRO CAMEROUN — monétisation active

> **Version de référence : CinetPay.** Ce document remplace l'ancienne préparation directe MTN MoMo / Orange Money.

## Tarifs approuvés
- Gratuit : 0 FCFA.
- Premium : 1 500 FCFA / 30 jours.
- Premium Plus : 3 000 FCFA / 30 jours.

## Architecture retenue
- CinetPay pour le checkout hébergé au Cameroun, avec MTN Mobile Money et Orange Money selon les canaux activés sur le compte marchand.
- Supabase Auth pour les comptes étudiants et PostgreSQL pour les commandes, abonnements et contenus Premium privés.
- Fonctions Netlify côté serveur pour créer les paiements, vérifier les statuts CinetPay, traiter les webhooks et servir les contenus protégés.
- Les secrets CinetPay et la clé Supabase service-role restent exclusivement dans les variables d'environnement serveur.

## Installation
Suivre exclusivement le guide [README-MONETISATION.md](../README-MONETISATION.md).

Dans Supabase SQL Editor, exécuter dans cet ordre :
1. `supabase/schema.sql`
2. `supabase/monetization.sql`

**Ne pas exécuter** l'ancienne migration `supabase/migrations/202611110001_billing.sql` pour cette intégration CinetPay. Elle décrit l'ancien schéma direct MTN/Orange et n'est plus utilisée par l'interface ni par l'API de paiement. Si elle a déjà été exécutée, ses tables peuvent rester en place : elles ne donnent aucun droit Premium et ne sont pas utilisées par le flux CinetPay.

## Configuration avant les paiements réels
Configurer sur Netlify (Site configuration → Environment variables) :
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement)
- `STUDYPRO_ALLOWED_ORIGIN` (origine HTTPS exacte, sans chemin)
- `CINETPAY_API_KEY_CM`
- `CINETPAY_API_PASSWORD_CM`
- `STUDYPRO_ADMIN_EMAILS`

Commencer avec les identifiants sandbox. Les paiements réels restent inactifs tant que le compte marchand, les secrets, la base, le domaine HTTPS et les tests de bout en bout ne sont pas validés.

## Import et bascule des cours privés
Le build Netlify exécute automatiquement `node scripts/import-private-content.mjs --apply` après configuration de `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` dans l'environnement de build. Les fonctions HTTP sont exposées via les adaptateurs `netlify/functions/*.mjs`. Le script importe les leçons IDE avec le plan requis `premium`. Les examens blancs optionnels doivent être fournis dans `private-content-source/mock-exams.json` et reçoivent le plan `premium_plus`. Vérifier les lignes importées et tester les URL directes `/lessons-year1.js`, `/lessons-year2.js` et `/lessons-year3.js` en HTTP 404 sur le Preview avant de publier. Ne jamais commiter les secrets ou le dossier local des examens.

## Limites connues
Les fiches synthétiques de `courses.js` restent publiques. Les sources détaillées `lessons-year*.js` sont conservées dans Git pour l'import, mais Netlify doit les bloquer en HTTP 404 grâce aux redirections forcées définies dans `netlify.toml`. Les leçons importées sont ensuite servies uniquement depuis `studypro_premium_content` après contrôle de l'abonnement. Vérifier les 404 sur le déploiement avant publication. L'abonnement est renouvelé manuellement; aucun prélèvement récurrent automatique n'est activé.
