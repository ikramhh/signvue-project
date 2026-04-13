# SignVue — architecture microservices

Projet de démonstration couvrant les contraintes **API REST métier**, **service d’authentification JWT**, **UI web**, **RabbitMQ**, **Consul**, **Traefik** et **déploiement multi-conteneurs** (un service par conteneur, équivalent logique à des serveurs distincts).

## Vue d’ensemble

| Composant | Rôle |
|-----------|------|
| **Traefik** | Reverse proxy / répartition (entrée HTTP unique) |
| **Consul** | Service registry & discovery (enregistrement HTTP des instances) |
| **RabbitMQ** | File de messages (traitement asynchrone) |
| **auth-service** | Inscription, login, JWT, rôles `USER` / `ADMIN`, `/me` |
| **api-service** | CRUD `/sessions`, métier `POST /interpretation-requests` → file, stats admin |
| **worker-service** | Consommateur de la file `signvue.interpretation` |
| **frontend** | UI statique (Nginx) consommant `/auth/*` et `/api/*` via le même hôte |

### Flux principaux

1. L’utilisateur s’inscrit ou se connecte via l’UI → **auth-service** délivre un **JWT**.
2. L’UI appelle l’**api-service** avec `Authorization: Bearer <token>` ; le JWT est vérifié localement (même secret partagé).
3. Un démarrage de démo caméra envoie une **demande d’interprétation** (`POST /api/interpretation-requests`) → message publié dans **RabbitMQ** → **worker-service** traite (logs console).
4. Chaque microservice s’**enregistre dans Consul** au démarrage (checks HTTP `/health`).
5. **Traefik** route `localhost:9080` vers le bon conteneur selon le chemin.

## Accès après `docker compose up`

- **Application** : http://localhost:9080  
- **Traefik dashboard** : http://localhost:9081  
- **Consul UI** : http://localhost:8500  
- **RabbitMQ (management)** : http://localhost:15672 — `guest` / `guest`  

> Le premier compte créé reçoit le rôle **ADMIN** ; les suivants **USER**.

## API (aperçu)

Préfixe navigateur via Traefik : tout part de `http://localhost:9080`.

### Auth (`/auth` → service sans préfixe interne)

- `POST /auth/register` — `{ "email", "password" }` → `{ token, user }`
- `POST /auth/login` — idem
- `GET /auth/me` — en-tête `Authorization: Bearer …`

### API métier (`/api` → service sans préfixe interne)

- `GET/POST /api/sessions` — CRUD sessions (filtrées par utilisateur ; admin voit tout)
- `GET/PUT/DELETE /api/sessions/:id`
- `POST /api/interpretation-requests` — corps JSON optionnel `{ "source", "sessionId" }` → **202** + file RabbitMQ
- `GET /api/stats/sessions` — **ADMIN** uniquement

## Guide de déploiement (checklist)

### 1. Préparation des « serveurs »

- En production : une **machine ou VM par microservice** (ou orchestrateur type Kubernetes / Nomad).  
- En démo : **un conteneur par service** dans Docker Compose (séparation des processus et des images).

### 2. Démarrage du broker + registry

```bash
docker compose up -d consul rabbitmq
```

Vérifier Consul (8500) et RabbitMQ (5672, management 15672).

### 3. Déploiement des microservices

```bash
docker compose up -d auth-service api-service worker-service
```

Vérifier les logs : enregistrement Consul et connexion RabbitMQ pour `api-service` et `worker-service`.

### 4. Reverse proxy + UI

```bash
docker compose up -d traefik frontend
```

Ou tout d’un coup :

```bash
docker compose up --build -d
```

### 5. Tests de la communication asynchrone

1. Ouvrir http://localhost:9080 , créer un compte, lancer la **démo caméra**.  
2. Observer les logs du **worker** : `docker compose logs -f worker-service` — messages `traitement job …`.  
3. Optionnel : `curl` avec JWT vers `POST http://localhost:9080/api/interpretation-requests`.

### Variable d’environnement

- `JWT_SECRET` : secret partagé **auth-service** / **api-service** (définir en prod, ex. fichier `.env` à la racine du projet).

## UI sans Docker (mode local)

Ouvrir le fichier HTML directement ne fournit pas `/auth` ni `/api`. Pour retrouver l’ancien comportement (localStorage) : ajouter **`?local=1`** à l’URL.

## Structure du dépôt

```
projet/
  docker-compose.yml
  frontend/           # UI
  services/
    auth-service/
    api-service/
    worker-service/
```
