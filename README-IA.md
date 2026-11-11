# Activer le tuteur IA de STUDYPRO CAMEROUN

Le site GitHub Pages est statique : il ne peut pas protéger une clé API ni exécuter un backend. Cette version ajoute une fonction serveur Vercel (/api/chat) qui appelle l'API OpenAI sans exposer la clé dans le navigateur.

## 1. Déployer le site et le backend sur Vercel
1. Connecter le dépôt GitHub corettaboo6-oss/studypro-cameroun à Vercel.
2. Importer le dépôt avec la racine du projet à la racine du dépôt. Aucun framework ni commande de build n'est nécessaire.
3. Déployer. Vercel servira les fichiers HTML/CSS/JS et la fonction /api/chat sur le même domaine.
4. Dans Project → Settings → Environment Variables, ajouter :
   - OPENAI_API_KEY : clé secrète de l'API OpenAI (type Secret).
   - STUDYPRO_ALLOWED_ORIGIN : origine exacte du site Vercel, par exemple https://mon-projet.vercel.app (sans slash final).
   - OPENAI_MODEL : facultatif, modèle disponible sur le compte, par défaut gpt-4.1-mini.
5. Redéployer après avoir enregistré les variables.

Ne jamais placer la clé OpenAI dans index.html, dans un fichier JavaScript public, ni dans GitHub. Ne pas envoyer la clé dans une conversation.

## 2. Fonctionnement pédagogique
Le navigateur recherche les passages pertinents dans courses.js et les trois bibliothèques lessons-year*.js. Il envoie uniquement la question, quelques extraits sélectionnés et un court historique de conversation au serveur. Le serveur appelle l'API Responses avec store: false, puis renvoie la réponse et les intitulés des sources.

Les contenus transmis ne sont pas des dossiers patients. Ne jamais saisir d'informations permettant d'identifier un patient.

## 3. Limites et sécurité
- Une limite indicative de 12 requêtes par minute et par adresse IP est appliquée en mémoire ; elle n'est pas un système anti-abus durable. Configurer aussi les limites de dépenses et alertes de facturation du compte API.
- Les réponses sont des aides pédagogiques, pas des prescriptions ni des protocoles de soins.
- Le site GitHub Pages historique ne peut pas exécuter /api/chat. Le tuteur fonctionnera sur le domaine Vercel après déploiement et configuration des secrets.