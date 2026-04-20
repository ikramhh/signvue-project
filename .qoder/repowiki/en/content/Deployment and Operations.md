# Deployment and Operations

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [DEPLOY.md](file://DEPLOY.md)
- [deploy.bat](file://deploy.bat)
- [docker-compose.yml](file://docker-compose.yml)
- [services/api-service/src/index.js](file://services/api-service/src/index.js)
- [services/api-service/src/db.js](file://services/api-service/src/db.js)
- [services/api-service/Dockerfile](file://services/api-service/Dockerfile)
- [services/api-service/package.json](file://services/api-service/package.json)
- [services/auth-service/src/index.js](file://services/auth-service/src/index.js)
- [services/auth-service/src/db.js](file://services/auth-service/src/db.js)
- [services/auth-service/Dockerfile](file://services/auth-service/Dockerfile)
- [services/auth-service/package.json](file://services/auth-service/package.json)
- [services/worker-service/src/index.js](file://services/worker-service/src/index.js)
- [services/worker-service/Dockerfile](file://services/worker-service/Dockerfile)
- [services/worker-service/package.json](file://services/worker-service/package.json)
- [infra/init-db.sql](file://infra/init-db.sql)
- [frontend/config.js](file://frontend/config.js)
- [frontend/index.html](file://frontend/index.html)
- [frontend/script.js](file://frontend/script.js)
- [frontend/style.css](file://frontend/style.css)
- [frontend/verify-email.html](file://frontend/verify-email.html)
</cite>

## Update Summary
**Changes Made**
- Added comprehensive deployment documentation section covering deployment procedures and email configuration
- Added automated deployment script documentation for Windows environments
- Updated authentication service documentation to include email verification workflow
- Enhanced frontend documentation to cover new introduction session and camera controls
- Updated database schema documentation to reflect email verification fields

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Production Deployment Strategies](#production-deployment-strategies)
8. [Environment Configuration Management](#environment-configuration-management)
9. [Scaling Considerations](#scaling-considerations)
10. [Monitoring and Logging](#monitoring-and-logging)
11. [Health Checks and Service Discovery](#health-checks-and-service-discovery)
12. [Security Hardening](#security-hardening)
13. [Backup and Disaster Recovery](#backup-and-disaster-recovery)
14. [CI/CD Pipeline Integration](#cicd-pipeline-integration)
15. [Operational Runbooks](#operational-runbooks)
16. [Alerting and Incident Response](#alerting-and-incident-response)
17. [Troubleshooting Guide](#troubleshooting-guide)
18. [Performance Optimization](#performance-optimization)
19. [Maintenance Procedures](#maintenance-procedures)
20. [Deployment and Operations](#deployment-and-operations)
21. [Conclusion](#conclusion)

## Introduction
This document provides a comprehensive deployment and operations guide for the SignVue microservices system. It covers production deployment strategies, environment configuration management, scaling considerations, monitoring and logging, health checks, service discovery, security hardening, backup and disaster recovery, CI/CD integration, operational runbooks, alerting, and incident response procedures. The guide leverages the existing Docker Compose setup and service implementations to define repeatable, reliable, and secure operations for both development and production environments.

## Project Structure
The repository follows a clear separation of concerns:
- Frontend static assets served by Nginx
- Three Node.js microservices: auth-service, api-service, worker-service
- Supporting infrastructure: Consul (service registry and discovery), RabbitMQ (message broker), PostgreSQL (database)
- Docker Compose orchestrates all services on a single network

```mermaid
graph TB
subgraph "Networking"
net["signvue-net"]
end
subgraph "Infrastructure"
consul["Consul"]
rabbitmq["RabbitMQ"]
postgres["PostgreSQL"]
end
subgraph "Services"
authsvc["auth-service"]
ap svc["api-service"]
workersvc["worker-service"]
end
subgraph "Edge"
traefik["Traefik"]
frontend["Nginx (frontend)"]
end
traefik --> authsvc
traefik --> ap svc
frontend --> traefik
ap svc --> postgres
authsvc --> postgres
workersvc --> rabbitmq
workersvc --> consul
ap svc --> consul
authsvc --> consul
consul --> net
rabbitmq --> net
postgres --> net
traefik --> net
frontend --> net
```

**Diagram sources**
- [docker-compose.yml:3-137](file://docker-compose.yml#L3-L137)

**Section sources**
- [README.md:1-111](file://README.md#L1-L111)
- [docker-compose.yml:1-137](file://docker-compose.yml#L1-L137)

## Core Components
- Traefik: Reverse proxy and entrypoint routing HTTP traffic to services based on host/path prefixes.
- Consul: Service registry and discovery; services register themselves with HTTP health checks.
- RabbitMQ: Message broker for asynchronous processing; worker-service consumes a durable queue.
- PostgreSQL: Relational database storing users, sessions, and translation records.
- auth-service: JWT-based authentication, registration, login, verification endpoints, and email verification workflow.
- api-service: Business CRUD endpoints for sessions, JWT verification, and publishing interpretation requests to RabbitMQ.
- worker-service: Consumes messages from the RabbitMQ queue and logs processing events.
- frontend: Static Nginx serving the SPA with introduction session, camera controls, and email verification page.

Key runtime characteristics:
- Services expose health endpoints for readiness/liveness.
- Database connections are managed via connection pools with startup waits and migrations.
- JWT secrets are shared between auth-service and api-service.
- Email verification system with token-based validation and resend functionality.

**Section sources**
- [README.md:7-31](file://README.md#L7-L31)
- [docker-compose.yml:4-137](file://docker-compose.yml#L4-L137)
- [services/api-service/src/index.js:16-24](file://services/api-service/src/index.js#L16-L24)
- [services/auth-service/src/index.js:114-117](file://services/auth-service/src/index.js#L114-L117)
- [services/worker-service/src/index.js:14-17](file://services/worker-service/src/index.js#L14-L17)
- [services/api-service/src/db.js:14-27](file://services/api-service/src/db.js#L14-L27)
- [infra/init-db.sql:1-44](file://infra/init-db.sql#L1-L44)

## Architecture Overview
The system routes external traffic through Traefik to services, with Consul managing service registration and health checks. Asynchronous workloads are decoupled via RabbitMQ, while PostgreSQL persists state. The frontend proxies API calls through Traefik to the appropriate backend service. The email verification workflow adds an additional layer of user validation before authentication.

```mermaid
sequenceDiagram
participant Client as "Browser"
participant Traefik as "Traefik"
participant Auth as "auth-service"
participant API as "api-service"
participant DB as "PostgreSQL"
participant MQ as "RabbitMQ"
participant Worker as "worker-service"
Client->>Traefik : "POST /auth/register"
Traefik->>Auth : "Route to /auth"
Auth->>DB : "Insert user with verify_token"
Auth->>Auth : "Send verification email"
Auth-->>Traefik : "Registration initiated"
Traefik-->>Client : "Registration message"
Client->>Traefik : "GET /auth/verify-email?token=..."
Traefik->>Auth : "Verify token"
Auth->>DB : "Mark user as verified"
Auth-->>Traefik : "Verification success"
Traefik-->>Client : "Verification confirmed"
Client->>Traefik : "POST /auth/login"
Traefik->>Auth : "Route to /auth"
Auth->>DB : "Verify credentials and email status"
Auth-->>Traefik : "JWT token"
Traefik-->>Client : "200 OK with token"
Client->>Traefik : "POST /api/interpretation-requests"
Traefik->>API : "Route to /api"
API->>MQ : "Publish message"
API-->>Client : "202 Accepted"
Worker->>MQ : "Consume message"
Worker-->>Worker : "Log processing"
```

**Diagram sources**
- [docker-compose.yml:70-130](file://docker-compose.yml#L70-L130)
- [services/api-service/src/index.js:26-104](file://services/api-service/src/index.js#L26-L104)
- [services/worker-service/src/index.js:45-81](file://services/worker-service/src/index.js#L45-L81)

## Detailed Component Analysis

### auth-service
Responsibilities:
- Registration and login with hashed passwords
- JWT issuance with roles
- Email verification workflow with token-based validation
- Resend verification functionality
- Health endpoint for Consul integration

Operational notes:
- Uses PostgreSQL via connection pool with email verification fields
- Supports both real SMTP services and development testing via Ethereal
- Exposes a simple health endpoint suitable for Consul checks
- No explicit CORS configuration; defaults apply

```mermaid
flowchart TD
Start(["Startup"]) --> InitDB["Initialize DB pool"]
InitDB --> InitMailer["Initialize email transport"]
InitMailer --> Listen["Listen on configured port"]
Listen --> Health["Expose /health"]
Listen --> AuthRoutes["Expose /auth endpoints"]
AuthRoutes --> Verify["Verify JWT on /auth/me"]
AuthRoutes --> VerifyEmail["Handle email verification"]
AuthRoutes --> ResendEmail["Resend verification email"]
```

**Diagram sources**
- [services/auth-service/src/index.js:114-124](file://services/auth-service/src/index.js#L114-L124)
- [services/auth-service/src/db.js:1-13](file://services/auth-service/src/db.js#L1-L13)

**Section sources**
- [services/auth-service/src/index.js:1-273](file://services/auth-service/src/index.js#L1-L273)
- [services/auth-service/src/db.js:1-13](file://services/auth-service/src/db.js#L1-L13)
- [services/auth-service/Dockerfile:1-8](file://services/auth-service/Dockerfile#L1-L8)
- [services/auth-service/package.json:1-19](file://services/auth-service/package.json#L1-L19)

### api-service
Responsibilities:
- Session CRUD and admin stats
- JWT verification for protected routes
- Publishing interpretation requests to RabbitMQ
- Database initialization and migrations

Operational notes:
- Waits for database readiness before starting
- Performs lightweight migrations at startup
- Health check validates database connectivity
- Depends on auth-service for token verification

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "api-service"
participant DB as "PostgreSQL"
participant MQ as "RabbitMQ"
Client->>API : "POST /auth/me (with Bearer)"
API->>DB : "Validate token against stored users"
DB-->>API : "User info"
API-->>Client : "Decoded token payload"
Client->>API : "POST /api/interpretation-requests"
API->>MQ : "Publish message"
API-->>Client : "202 Accepted"
```

**Diagram sources**
- [services/api-service/src/index.js:106-121](file://services/api-service/src/index.js#L106-L121)
- [services/api-service/src/index.js:123-133](file://services/api-service/src/index.js#L123-L133)
- [services/api-service/src/db.js:29-78](file://services/api-service/src/db.js#L29-L78)

**Section sources**
- [services/api-service/src/index.js:1-133](file://services/api-service/src/index.js#L1-L133)
- [services/api-service/src/db.js:1-84](file://services/api-service/src/db.js#L1-L84)
- [services/api-service/Dockerfile:1-8](file://services/api-service/Dockerfile#L1-L8)
- [services/api-service/package.json:1-19](file://services/api-service/package.json#L1-L19)

### worker-service
Responsibilities:
- Consumes RabbitMQ messages from a durable queue
- Registers itself with Consul for discovery and health checks
- Logs processing events and acknowledges messages

Operational notes:
- Prefetch ensures single-consumption fairness
- Uses durable queues and manual acknowledgments for reliability
- Health endpoint reports service and queue status

```mermaid
flowchart TD
Start(["Startup"]) --> Register["Register with Consul"]
Register --> Connect["Connect to RabbitMQ"]
Connect --> Assert["Assert durable queue"]
Assert --> Consume["Start consuming with prefetch(1)"]
Consume --> Ack["Acknowledge processed messages"]
```

**Diagram sources**
- [services/worker-service/src/index.js:19-43](file://services/worker-service/src/index.js#L19-L43)
- [services/worker-service/src/index.js:45-81](file://services/worker-service/src/index.js#L45-L81)

**Section sources**
- [services/worker-service/src/index.js:1-88](file://services/worker-service/src/index.js#L1-L88)
- [services/worker-service/Dockerfile:1-8](file://services/worker-service/Dockerfile#L1-L8)
- [services/worker-service/package.json:1-14](file://services/worker-service/package.json#L1-L14)

### Infrastructure Services
- Consul: Dev agent with UI; services register with HTTP health checks
- RabbitMQ: Management plugin enabled; default credentials for dev
- PostgreSQL: Initialized with schema and migrations; healthcheck configured

**Section sources**
- [docker-compose.yml:20-57](file://docker-compose.yml#L20-L57)
- [infra/init-db.sql:1-44](file://infra/init-db.sql#L1-L44)

## Dependency Analysis
The services depend on infrastructure components and each other as follows:

```mermaid
graph LR
authsvc["auth-service"] --> pg["PostgreSQL"]
apsvc["api-service"] --> pg
apsvc --> rmq["RabbitMQ"]
workersvc["worker-service"] --> rmq
workersvc --> consul["Consul"]
apsvc --> consul
authsvc --> consul
traefik["Traefik"] --> authsvc
traefik --> apsvc
frontend["Nginx (frontend)"] --> traefik
```

**Diagram sources**
- [docker-compose.yml:59-130](file://docker-compose.yml#L59-L130)

**Section sources**
- [docker-compose.yml:59-130](file://docker-compose.yml#L59-L130)

## Production Deployment Strategies
- Orchestration: Prefer container orchestration platforms (e.g., Kubernetes) for production, deploying one service per pod with resource limits and autoscaling policies.
- Network segmentation: Use separate namespaces/virtual networks for services and infrastructure.
- Secrets management: Store JWT_SECRET, DATABASE_URL, and RabbitMQ credentials in a secrets manager; inject via environment variables or mounted files.
- Rolling updates: Configure rolling deployments with readiness probes to avoid downtime.
- Blue/green or canary releases: Gradually shift traffic to minimize risk.
- Immutable artifacts: Build images deterministically and pin digests in manifests.

[No sources needed since this section provides general guidance]

## Environment Configuration Management
- Shared secrets:
  - JWT_SECRET: Required by both auth-service and api-service
  - DATABASE_URL: Connection string for PostgreSQL
  - RABBITMQ_URL: Connection string for RabbitMQ
- Service-specific:
  - PORT: Listening port for each service
  - CONSUL_HOST: Service discovery host for worker-service
  - SMTP_HOST: Email server host for auth-service
  - SMTP_PORT: Email server port for auth-service
  - SMTP_USER: Email authentication username for auth-service
  - SMTP_PASS: Email authentication password for auth-service
  - FRONTEND_URL: Frontend base URL for email verification links
- Compose overrides: Use environment files or override files for dev vs prod.

**Section sources**
- [README.md:92-95](file://README.md#L92-L95)
- [docker-compose.yml:61-116](file://docker-compose.yml#L61-L116)
- [services/api-service/src/db.js:3-8](file://services/api-service/src/db.js#L3-L8)
- [services/auth-service/src/db.js:3-7](file://services/auth-service/src/db.js#L3-L7)

## Scaling Considerations
- Stateless services: auth-service and api-service are stateless; scale horizontally behind load balancers.
- Queue-driven processing: worker-service scales by adding replicas; RabbitMQ queue distribution is handled by the broker.
- Database scaling: Use read replicas for reporting/admin queries; keep primary for writes.
- Horizontal Pod Autoscaler (Kubernetes): Scale based on CPU/memory or custom metrics (e.g., queue length).
- Network policies: Restrict cross-service traffic to reduce contention.

**Section sources**
- [services/worker-service/src/index.js:56-75](file://services/worker-service/src/index.js#L56-L75)
- [docker-compose.yml:88-94](file://docker-compose.yml#L88-L94)

## Monitoring and Logging
- Centralized logging: Ship service logs to a centralized collector (e.g., ELK, Loki, Cloud Logging).
- Metrics: Expose Prometheus-compatible metrics endpoints for latency, throughput, and error rates.
- Tracing: Add distributed tracing (e.g., OpenTelemetry) to track requests across services.
- Frontend monitoring: Track client-side errors and performance via SDKs.
- Infrastructure metrics: Monitor CPU, memory, disk, and network utilization for containers and VMs.

[No sources needed since this section provides general guidance]

## Health Checks and Service Discovery
- Health endpoints:
  - auth-service: /health returning service status
  - api-service: /health validating DB connectivity
  - worker-service: /health reporting service and queue status
- Consul integration:
  - Services register themselves with HTTP health checks
  - Traefik integrates with Docker provider for dynamic routing
- Readiness probes: Ensure dependent services (DB, MQ) are ready before accepting traffic.

```mermaid
flowchart TD
Probe["Consul HTTP Check"] --> Health["/health endpoint"]
Health --> Status{"Service Healthy?"}
Status --> |Yes| Register["Register in Consul catalog"]
Status --> |No| Retry["Retry until healthy"]
```

**Diagram sources**
- [services/auth-service/src/index.js:114-117](file://services/auth-service/src/index.js#L114-L117)
- [services/api-service/src/index.js:16-24](file://services/api-service/src/index.js#L16-L24)
- [services/worker-service/src/index.js:14-17](file://services/worker-service/src/index.js#L14-L17)

**Section sources**
- [README.md:22-22](file://README.md#L22-L22)
- [docker-compose.yml:70-130](file://docker-compose.yml#L70-L130)

## Security Hardening
- Secrets:
  - Rotate JWT_SECRET regularly; enforce minimum entropy
  - Use strong database and RabbitMQ credentials; disable default users in production
- Transport security:
  - Enable TLS termination at Traefik; enforce HTTPS redirects
  - Use private registries and image signing
- Access control:
  - Network policies to restrict inter-service traffic
  - Principle of least privilege for service accounts
- Authentication:
  - Enforce bearer token validation on all protected endpoints
  - Rate-limit authentication endpoints to prevent brute force
- Secrets injection:
  - Mount secrets as files or use secret managers; avoid embedding in images
- Email security:
  - Use encrypted SMTP connections (STARTTLS)
  - Implement rate limiting for verification emails
  - Validate email domains for registration

**Section sources**
- [README.md:92-95](file://README.md#L92-L95)
- [docker-compose.yml:34-37](file://docker-compose.yml#L34-L37)

## Backup and Disaster Recovery
- Database backups:
  - Schedule regular logical backups of PostgreSQL
  - Test restore procedures periodically
- Message persistence:
  - Ensure durable queues and persistent messages in RabbitMQ
- Artifact storage:
  - Back up container images and configuration files
- DR plan:
  - Define RTO/RPO targets
  - Practice failover drills across regions/zones

[No sources needed since this section provides general guidance]

## CI/CD Pipeline Integration
- Build:
  - Build services with pinned dependencies and minimal base images
  - Scan images for vulnerabilities
- Test:
  - Unit and integration tests in CI; health check validation
- Deploy:
  - Automated rollout with rollback on failure
  - Canary or blue/green strategy
- GitOps:
  - Manage infrastructure and deployments via declarative manifests

[No sources needed since this section provides general guidance]

## Operational Runbooks
- Startup sequence:
  - Start Consul and RabbitMQ
  - Start PostgreSQL and wait for health
  - Start auth-service and api-service
  - Start worker-service
  - Start Traefik and frontend
- Communication testing:
  - Verify JWT issuance and validation
  - Publish an interpretation request and confirm worker logs
  - Test email verification workflow
- Recovery steps:
  - Restart unhealthy services
  - Re-register services with Consul if needed
  - Drain queues and restart consumers if required

**Section sources**
- [README.md:51-91](file://README.md#L51-L91)
- [docker-compose.yml:59-130](file://docker-compose.yml#L59-L130)

## Alerting and Incident Response
- Alerts:
  - Service health failures, queue backlog growth, DB connection errors
  - Frontend error rate and latency spikes
  - Email delivery failures and verification token expiration
- Escalation:
  - On-call rotation with defined escalation paths
- Postmortems:
  - Document root causes and remediation steps

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Database not ready:
  - api-service waits for DB readiness; verify connection string and credentials
- JWT verification failures:
  - Confirm JWT_SECRET matches between auth-service and api-service
- RabbitMQ connectivity:
  - Validate RABBITMQ_URL and queue existence
- Frontend API base URL:
  - Ensure frontend resolves to the correct backend base URL
- Email verification failures:
  - Check SMTP configuration and credentials
  - Verify email transport initialization
  - Test token validity and expiration

**Section sources**
- [services/api-service/src/db.js:14-27](file://services/api-service/src/db.js#L14-L27)
- [README.md:92-95](file://README.md#L92-L95)
- [frontend/config.js:1-18](file://frontend/config.js#L1-L18)
- [frontend/script.js:23-34](file://frontend/script.js#L23-L34)

## Performance Optimization
- Database:
  - Use connection pooling; optimize queries and indexes
  - Separate reporting queries to read replicas
- Messaging:
  - Tune prefetch count and worker concurrency
  - Monitor queue depth and consumer lag
- Caching:
  - Cache frequently accessed user metadata
- CDN and static assets:
  - Serve frontend via CDN for global performance
- Email delivery:
  - Use dedicated SMTP providers for production
  - Implement email delivery retry mechanisms

[No sources needed since this section provides general guidance]

## Maintenance Procedures
- Regular patching:
  - OS, container base images, and application dependencies
- Schema changes:
  - Apply migrations during maintenance windows
- Rotation:
  - Rotate secrets and certificates
- Capacity planning:
  - Monitor resource usage and plan growth
- Email system maintenance:
  - Monitor email delivery rates and bounce handling
  - Update SMTP credentials and configurations as needed

[No sources needed since this section provides general guidance]

## Deployment and Operations

### Deployment Documentation
The project now includes comprehensive deployment documentation covering the complete deployment lifecycle for the SignVue microservices system.

**Updated** Added comprehensive deployment documentation with step-by-step instructions for dependency installation, database migration options, service restart procedures, and production email configuration.

**Section sources**
- [DEPLOY.md:1-94](file://DEPLOY.md#L1-L94)

### Automated Deployment Script
Windows users can leverage the automated deployment script for streamlined deployment processes.

**Updated** Added automated deployment script (deploy.bat) for Windows environments that automates the complete deployment workflow.

The deployment script provides four main stages:
1. **Install Dependencies**: Installs npm packages for the auth-service
2. **Stop Services**: Gracefully shuts down existing services
3. **Start Services**: Builds and starts all services in detached mode
4. **Verify Deployment**: Displays service status for verification

**Section sources**
- [deploy.bat:1-32](file://deploy.bat#L1-L32)

### Email Verification System
The authentication service now includes a comprehensive email verification workflow to ensure user email addresses are valid before allowing login access.

**Updated** Enhanced authentication service with email verification capabilities including token-based validation and resend functionality.

Key email verification features:
- **Registration Workflow**: Users receive verification emails upon registration
- **Token Validation**: Secure token-based email verification process
- **Resend Functionality**: Ability to resend verification emails
- **Development Testing**: Uses Ethereal SMTP for development testing
- **Production Ready**: Supports real SMTP providers like SendGrid, Mailgun, AWS SES

Database schema enhancements:
- `verified` boolean field for email verification status
- `verify_token` field for token-based validation
- Automatic cleanup of expired verification tokens

**Section sources**
- [services/auth-service/src/index.js:49-78](file://services/auth-service/src/index.js#L49-L78)
- [services/auth-service/src/index.js:129-158](file://services/auth-service/src/index.js#L129-L158)
- [services/auth-service/src/index.js:209-240](file://services/auth-service/src/index.js#L209-L240)
- [infra/init-db.sql:3-11](file://infra/init-db.sql#L3-L11)

### Frontend Enhancements
The frontend has been enhanced with new user experience features including an introduction session and improved camera controls.

**Updated** Added introduction session with camera demonstration, stop camera button, and navigation improvements.

Frontend enhancements:
- **Introduction Session**: Dedicated section with sign8.jpg image and camera usage instructions
- **Stop Camera Button**: Red stop button appears when camera is active
- **Navigation Improvements**: Added "Introduction" button to the header navigation
- **Camera Controls**: Enhanced camera activation/deactivation with proper cleanup
- **Verification Page**: New verify-email.html page for email verification workflow

**Section sources**
- [frontend/index.html:146-164](file://frontend/index.html#L146-L164)
- [frontend/index.html:172-191](file://frontend/index.html#L172-L191)
- [frontend/script.js:412-458](file://frontend/script.js#L412-L458)
- [frontend/script.js:619-624](file://frontend/script.js#L619-L624)
- [frontend/verify-email.html:1-148](file://frontend/verify-email.html#L1-L148)

### Database Migration Options
The deployment guide provides flexible database migration options to accommodate different deployment scenarios.

**Updated** Added comprehensive database migration options covering both destructive and non-destructive approaches.

Migration options:
- **Option A (Destructive)**: Complete database reset with volume removal
- **Option B (Non-destructive)**: Manual schema updates preserving existing data
- **Manual Migration**: SQL commands for adding verification fields to existing users table

**Section sources**
- [DEPLOY.md:31-44](file://DEPLOY.md#L31-L44)

### Production Email Configuration
The deployment guide includes detailed instructions for configuring production email services with recommended providers.

**Updated** Added comprehensive production email configuration guide with SMTP settings and provider recommendations.

Recommended email providers:
- **SendGrid**: Free tier up to 100 emails/day
- **Mailgun**: Free tier up to 5000 emails/month  
- **AWS SES**: Cost-effective enterprise solution

Configuration requirements:
- SMTP_HOST: Email server hostname
- SMTP_PORT: Email server port (typically 587)
- SMTP_USER: Email authentication username
- SMTP_PASS: Email authentication password
- FRONTEND_URL: Base URL for verification email links

**Section sources**
- [DEPLOY.md:56-74](file://DEPLOY.md#L56-L74)

### Development vs Production Differences
The deployment system supports both development and production environments with different email handling approaches.

**Updated** Enhanced deployment system to support development testing with Ethereal SMTP and production with real email providers.

Development features:
- **Ethereal Testing**: Automatic creation of test email accounts for development
- **Preview URLs**: Access to email preview functionality during development
- **Local Testing**: Full email verification workflow without real email delivery

Production features:
- **Real SMTP Integration**: Direct integration with production email providers
- **Secure Credentials**: Environment-based credential management
- **Reliable Delivery**: Production-grade email delivery with proper error handling

**Section sources**
- [services/auth-service/src/index.js:22-47](file://services/auth-service/src/index.js#L22-L47)

## Conclusion
This guide consolidates production-grade deployment and operations practices for the SignVue microservices system. By leveraging the existing Compose setup, implementing robust configuration management, health checks, and service discovery, and adopting security hardening, monitoring, and CI/CD practices, teams can reliably operate the system at scale with predictable outcomes.

The recent additions to the deployment system, including comprehensive documentation, automated deployment scripts, email verification workflow, and enhanced frontend features, provide a complete solution for both development and production environments. These enhancements ensure proper user validation, streamlined deployment processes, and robust operational procedures for the SignVue platform.