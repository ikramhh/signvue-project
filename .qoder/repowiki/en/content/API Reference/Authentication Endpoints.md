# Authentication Endpoints

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [docker-compose.yml](file://docker-compose.yml)
- [services/auth-service/src/index.js](file://services/auth-service/src/index.js)
- [services/auth-service/src/db.js](file://services/auth-service/src/db.js)
- [services/api-service/src/index.js](file://services/api-service/src/index.js)
- [services/api-service/src/db.js](file://services/api-service/src/db.js)
- [frontend/script.js](file://frontend/script.js)
- [frontend/config.js](file://frontend/config.js)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document provides comprehensive API documentation for the SignVue authentication endpoints. It focuses on:
- Registration endpoint for user creation
- Login endpoint for authentication and JWT issuance
- Token verification endpoint for validating Bearer tokens

It covers request/response schemas, error handling, practical curl examples, client implementation guidelines for storing and sending JWTs, and security considerations for token management.

## Project Structure
The authentication endpoints are exposed by the auth-service and consumed by the frontend and api-service. Traefik routes requests to the appropriate service based on path prefixes.

```mermaid
graph TB
subgraph "Reverse Proxy"
TRAEFIK["Traefik"]
end
subgraph "Services"
AUTH["auth-service<br/>/auth endpoints"]
API["api-service<br/>/api endpoints"]
FRONT["frontend<br/>Nginx static UI"]
end
subgraph "Infrastructure"
PG["PostgreSQL"]
RMQ["RabbitMQ"]
CONSUL["Consul"]
end
TRAEFIK --> AUTH
TRAEFIK --> API
TRAEFIK --> FRONT
AUTH --> PG
API --> PG
API --> RMQ
AUTH -. health checks .-> CONSUL
API -. health checks .-> CONSUL
```

**Diagram sources**
- [docker-compose.yml:59-105](file://docker-compose.yml#L59-L105)
- [docker-compose.yml:40-58](file://docker-compose.yml#L40-L58)
- [docker-compose.yml:20-27](file://docker-compose.yml#L20-L27)

**Section sources**
- [README.md:34-50](file://README.md#L34-L50)
- [docker-compose.yml:59-105](file://docker-compose.yml#L59-L105)

## Core Components
- auth-service exposes:
  - POST /auth/register
  - POST /auth/login
  - GET /auth/verify
- api-service exposes:
  - POST /auth/register (alternative implementation)
  - POST /auth/login (alternative implementation)
  - GET /auth/me (alternative verification endpoint)
- Frontend integrates with auth-service and api-service using Bearer tokens.

Key implementation references:
- auth-service endpoints: [services/auth-service/src/index.js:13-112](file://services/auth-service/src/index.js#L13-L112)
- api-service endpoints: [services/api-service/src/index.js:27-121](file://services/api-service/src/index.js#L27-L121)
- Frontend token handling: [frontend/script.js:160-182](file://frontend/script.js#L160-L182)

**Section sources**
- [services/auth-service/src/index.js:13-112](file://services/auth-service/src/index.js#L13-L112)
- [services/api-service/src/index.js:27-121](file://services/api-service/src/index.js#L27-L121)
- [frontend/script.js:160-182](file://frontend/script.js#L160-L182)

## Architecture Overview
The authentication flow relies on JWT issued by auth-service. The frontend stores the token and sends it in Authorization headers for protected routes.

```mermaid
sequenceDiagram
participant Client as "Browser"
participant Traefik as "Traefik"
participant AuthSvc as "auth-service"
participant ApiSvc as "api-service"
participant DB as "PostgreSQL"
Client->>Traefik : "POST /auth/register"
Traefik->>AuthSvc : "Route to /auth/register"
AuthSvc->>DB : "Check existing user"
DB-->>AuthSvc : "Result"
AuthSvc->>DB : "Insert new user"
DB-->>AuthSvc : "Success"
AuthSvc-->>Client : "201 Created {message, user}"
Client->>Traefik : "POST /auth/login"
Traefik->>AuthSvc : "Route to /auth/login"
AuthSvc->>DB : "Lookup user by email"
DB-->>AuthSvc : "User row"
AuthSvc->>AuthSvc : "Verify password"
AuthSvc-->>Client : "200 OK {token}"
Client->>Traefik : "GET /auth/verify"
Traefik->>AuthSvc : "Route to /auth/verify"
AuthSvc-->>Client : "200 OK {decoded payload}"
Client->>Traefik : "GET /api/sessions (with Bearer)"
Traefik->>ApiSvc : "Route to /api/sessions"
ApiSvc-->>Client : "200 OK (protected resource)"
```

**Diagram sources**
- [services/auth-service/src/index.js:13-112](file://services/auth-service/src/index.js#L13-L112)
- [services/api-service/src/index.js:27-121](file://services/api-service/src/index.js#L27-L121)
- [frontend/script.js:160-182](file://frontend/script.js#L160-L182)

## Detailed Component Analysis

### POST /auth/register
- Purpose: Register a new user with email and password.
- Request body schema:
  - email: string (required)
  - password: string (required)
- Success response:
  - Status: 201 Created
  - Body: { message, user }
- Error responses:
  - 400 Bad Request: Missing fields
  - 409 Conflict: Duplicate email
  - 500 Internal Server Error: Server error

Notes:
- Password is hashed before storage.
- On success, the endpoint returns a user object with id and email.

Practical curl example:
- curl -X POST http://localhost:9080/auth/register -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"securePass"}'

Client implementation guidelines:
- Store the returned user object and session state appropriately.
- Do not store the JWT token here; login will issue the token.

Security considerations:
- Enforce minimum password length and complexity on the client side.
- Use HTTPS in production to protect credentials in transit.

**Section sources**
- [services/api-service/src/index.js:27-59](file://services/api-service/src/index.js#L27-L59)
- [services/auth-service/src/index.js:13-50](file://services/auth-service/src/index.js#L13-L50)

### POST /auth/login
- Purpose: Authenticate a user and issue a JWT.
- Request body schema:
  - email: string (required)
  - password: string (required)
- Success response:
  - Status: 200 OK
  - Body: { ok: true, token, user }
- Error responses:
  - 400 Bad Request: Missing fields
  - 401 Unauthorized: User not found or wrong password
  - 500 Internal Server Error: Server error

JWT details:
- Issued by auth-service with a shared JWT_SECRET.
- Expiration: 1 hour for auth-service, 7 days for api-service.

Practical curl example:
- curl -X POST http://localhost:9080/auth/login -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"securePass"}'

Client implementation guidelines:
- Store the JWT token securely (e.g., in secure HTTP-only cookies or browser storage).
- Send Authorization: Bearer <token> on subsequent protected requests.
- Clear stored token on logout.

Security considerations:
- Use HTTPS in production.
- Prefer short-lived tokens and refresh token mechanisms if needed.
- Avoid logging tokens.

**Section sources**
- [services/auth-service/src/index.js:53-94](file://services/auth-service/src/index.js#L53-L94)
- [services/api-service/src/index.js:62-104](file://services/api-service/src/index.js#L62-L104)

### GET /auth/verify
- Purpose: Validate a Bearer token and return decoded claims.
- Request headers:
  - Authorization: Bearer <token>
- Success response:
  - Status: 200 OK
  - Body: Decoded JWT payload
- Error responses:
  - 401 Unauthorized: Missing or invalid token

Notes:
- auth-service verifies the token using the shared JWT_SECRET.
- api-service exposes a similar endpoint at GET /auth/me with the same behavior.

Practical curl example:
- curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." http://localhost:9080/auth/verify

Client implementation guidelines:
- Use this endpoint to validate tokens on startup or periodically.
- On failure, prompt the user to re-authenticate.

Security considerations:
- Ensure Authorization header is sent only over HTTPS.
- Do not expose tokens in URLs.

**Section sources**
- [services/auth-service/src/index.js:97-112](file://services/auth-service/src/index.js#L97-L112)
- [services/api-service/src/index.js:107-121](file://services/api-service/src/index.js#L107-L121)

### Alternative Endpoints in api-service
- POST /auth/register: Similar registration flow with different response shape.
- POST /auth/login: Similar login flow with different response shape.
- GET /auth/me: Similar verification endpoint.

These endpoints demonstrate an alternative implementation and can be used interchangeably depending on deployment configuration.

**Section sources**
- [services/api-service/src/index.js:27-59](file://services/api-service/src/index.js#L27-L59)
- [services/api-service/src/index.js:62-104](file://services/api-service/src/index.js#L62-L104)
- [services/api-service/src/index.js:107-121](file://services/api-service/src/index.js#L107-L121)

## Dependency Analysis
- auth-service depends on:
  - PostgreSQL for user persistence
  - jsonwebtoken for JWT signing/verification
  - bcryptjs for password hashing
- api-service depends on:
  - PostgreSQL for user persistence
  - jsonwebtoken for JWT signing/verification
  - RabbitMQ for asynchronous processing
- Frontend depends on:
  - auth-service for authentication
  - api-service for protected resources

```mermaid
graph LR
AUTH["auth-service"] --> PG["PostgreSQL"]
AUTH --> JWT["jsonwebtoken"]
AUTH --> BC["bcryptjs"]
API["api-service"] --> PG
API --> JWT
API --> RMQ["RabbitMQ"]
FRONT["frontend"] --> AUTH
FRONT --> API
```

**Diagram sources**
- [services/auth-service/src/index.js:1-10](file://services/auth-service/src/index.js#L1-L10)
- [services/api-service/src/index.js:1-7](file://services/api-service/src/index.js#L1-L7)
- [frontend/script.js:176-182](file://frontend/script.js#L176-L182)

**Section sources**
- [services/auth-service/src/db.js:1-13](file://services/auth-service/src/db.js#L1-L13)
- [services/api-service/src/db.js:1-84](file://services/api-service/src/db.js#L1-L84)
- [frontend/script.js:176-182](file://frontend/script.js#L176-L182)

## Performance Considerations
- Hashing passwords is computationally expensive; consider tuning bcrypt cost factor if needed.
- JWT verification is lightweight; keep token sizes minimal.
- Use connection pooling to PostgreSQL to handle concurrent requests efficiently.
- Implement rate limiting on registration/login endpoints to prevent abuse.

## Troubleshooting Guide
Common issues and resolutions:
- Missing Authorization header:
  - Symptom: 401 Unauthorized on protected endpoints.
  - Resolution: Ensure Authorization: Bearer <token> is present.
- Invalid or expired token:
  - Symptom: 401 Unauthorized on verification or protected routes.
  - Resolution: Re-authenticate to obtain a new token.
- Database connectivity:
  - Symptom: 500 Internal Server Error during registration/login.
  - Resolution: Verify PostgreSQL is healthy and reachable.
- CORS issues:
  - Symptom: Preflight failures or blocked requests.
  - Resolution: Ensure api-service CORS configuration allows the frontend origin.

**Section sources**
- [services/auth-service/src/index.js:97-112](file://services/auth-service/src/index.js#L97-L112)
- [services/api-service/src/index.js:107-121](file://services/api-service/src/index.js#L107-L121)
- [docker-compose.yml:40-58](file://docker-compose.yml#L40-L58)

## Conclusion
The SignVue authentication system provides secure, stateless authentication using JWT. The endpoints are straightforward to integrate, with clear request/response schemas and standardized error handling. Following the client implementation guidelines and security recommendations will help ensure a robust and secure authentication flow.

## Appendices

### Endpoint Reference Summary
- POST /auth/register
  - Request: { email, password }
  - Responses: 201 Created, 400 Bad Request, 409 Conflict, 500 Internal Server Error
- POST /auth/login
  - Request: { email, password }
  - Responses: 200 OK (token), 400 Bad Request, 401 Unauthorized, 500 Internal Server Error
- GET /auth/verify
  - Headers: Authorization: Bearer <token>
  - Responses: 200 OK (claims), 401 Unauthorized

### Client Implementation Checklist
- Store JWT securely (avoid localStorage for sensitive scenarios).
- Always send Authorization: Bearer <token> on protected requests.
- Validate token on startup and on navigation.
- Clear tokens on logout.
- Use HTTPS in production.
- Implement retry/backoff for transient network errors.

**Section sources**
- [frontend/script.js:160-182](file://frontend/script.js#L160-L182)
- [frontend/config.js:1-18](file://frontend/config.js#L1-L18)