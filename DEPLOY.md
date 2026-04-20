# Guide de Déploiement - SignVue

## Changements Réalisés

### 1. Vérification d'Email
- Backend modifié pour envoyer un email de vérification à l'inscription
- Nouvelle page `verify-email.html` pour confirmer la vérification
- L'utilisateur doit vérifier son email avant de pouvoir se connecter

### 2. Session d'Introduction
- Nouvelle section avec l'image sign8.jpg
- Instructions pour l'utilisation de la caméra
- Bouton "Suivant" pour accéder à la démo

### 3. Bouton Stop Caméra
- Bouton rouge pour arrêter la caméra
- Apparaît quand la caméra est active

### 4. Navigation
- Bouton "Introduction" ajouté dans le header

## Étapes de Déploiement

### Étape 1 : Installer les dépendances
```bash
cd services/auth-service
npm install
cd ../..
```

### Étape 2 : Mettre à jour la base de données
Option A - Recréer tout (perte des données) :
```bash
docker-compose down -v
docker-compose up -d
```

Option B - Migration manuelle (garde les données) :
```bash
docker-compose exec db psql -U postgres -d signvue -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token VARCHAR(255);
"
```

### Étape 3 : Redémarrer les services
```bash
docker-compose restart auth-service
```

### Étape 4 : Vérifier le déploiement
1. Allez sur votre site
2. Testez l'inscription avec un email
3. Vérifiez les logs du auth-service pour voir l'email envoyé

## Configuration Email (Production)

Pour utiliser un vrai service d'email, modifiez le `docker-compose.yml` :

```yaml
auth-service:
  environment:
    - SMTP_HOST=smtp.sendgrid.net
    - SMTP_PORT=587
    - SMTP_USER=votre_api_key
    - SMTP_PASS=votre_mot_de_passe
    - FRONTEND_URL=https://votre-site.com
```

Services recommandés :
- **SendGrid** : https://sendgrid.com (gratuit jusqu'à 100 emails/jour)
- **Mailgun** : https://mailgun.com (gratuit jusqu'à 5000 emails/mois)
- **AWS SES** : https://aws.amazon.com/ses/ (très bon marché)

## Fichiers Modifiés

- `services/auth-service/package.json` - Ajout de nodemailer
- `services/auth-service/src/index.js` - Logique de vérification d'email
- `infra/init-db.sql` - Nouveau schéma de base de données
- `frontend/index.html` - Session d'introduction, bouton stop caméra
- `frontend/script.js` - Gestion de la vérification d'email
- `frontend/style.css` - Styles pour la session d'introduction et bouton stop
- `frontend/verify-email.html` - Page de vérification d'email (nouveau)

## Test en Local

En mode développement, les emails sont envoyés via Ethereal (faux service).
Les logs du serveur affichent l'URL de prévisualisation de l'email.

Pour voir les logs :
```bash
docker-compose logs -f auth-service
```
