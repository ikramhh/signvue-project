# Authentication Service

<cite>
**Referenced Files in This Document**
- [package.json](file://services/auth-service/package.json)
- [index.js](file://services/auth-service/src/index.js)
- [db.js](file://services/auth-service/src/db.js)
- [index.js](file://services/api-service/src/index.js)
- [docker-compose.yml](file://docker-compose.yml)
- [init-db.sql](file://infra/init-db.sql)
- [README.md](file://README.md)
- [script.js](file://frontend/script.js)
- [config.js](file://frontend/config.js)
- [verify-email.html](file://frontend/verify-email.html)
</cite>

## Update Summary
**Changes Made**
- Added comprehensive email verification system with SMTP configuration and Nodemailer integration
- Implemented email verification token management with automatic cleanup
- Added new email verification endpoints: `/auth/verify-email` and `/auth/resend-verification`
- Updated registration workflow to require email verification before login access
- Enhanced database schema with verification fields (verified, verify_token)
- Added frontend verification page and resend verification functionality
- Updated authentication flow to prevent login until email verification

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Email Verification System](#email-verification-system)
7. [Frontend Authentication System](#frontend-authentication-system)
8. [Dependency Analysis](#dependency-analysis)
9. [Performance Considerations](#performance-considerations)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Conclusion](#conclusion)

## Introduction
This document describes the Authentication Service responsible for user registration, login, and JWT-based authentication with comprehensive email verification. The service now includes a complete email verification workflow using SMTP configuration, Nodemailer integration, and verification token management. It explains the JWT token generation and verification flows, password hashing with bcryptjs, database schema for user management, and integration with the API gateway and frontend. The system includes enhanced frontend authentication chrome rendering, comprehensive logging capabilities, and demo access support.

## Project Structure
The Authentication Service is implemented as a Node.js/Express application packaged as a containerized microservice. It exposes five primary endpoints under the /auth prefix including new email verification functionality and integrates with a shared JWT secret and a PostgreSQL database initialized by the provided SQL schema. The frontend authentication system supports both remote API authentication and local demo mode.

```mermaid
graph TB
subgraph "Container Runtime"
subgraph "auth-service"
A_Index["src/index.js<br/>Express server"]
A_DB["src/db.js<br/>PostgreSQL connection"]
A_Mailer["Nodemailer SMTP Transport<br/>Email Verification"]
end
subgraph "API Service"
API_Index["src/index.js<br/>/auth/me endpoint"]
end
PG["PostgreSQL<br/>users table with verification fields"]
FRONT["Frontend<br/>verify-email.html"]
end
A_Index --> A_DB
A_DB --> PG
A_Index --> A_Mailer
A_Mailer --> FRONT
API_Index --> A_DB
```

**Diagram sources**
- [index.js:1-273](file://services/auth-service/src/index.js#L1-L273)
- [index.js:106-121](file://services/api-service/src/index.js#L106-L121)
- [db.js:1-13](file://services/auth-service/src/db.js#L1-L13)
- [verify-email.html:1-148](file://frontend/verify-email.html#L1-L148)

**Section sources**
- [docker-compose.yml:59-79](file://docker-compose.yml#L59-L79)
- [README.md:12-23](file://README.md#L12-L23)

## Core Components
- Express server with JSON body parsing and CORS disabled for simplicity.
- PostgreSQL client configured via DATABASE_URL environment variable.
- JWT secret sourced from JWT_SECRET environment variable.
- Nodemailer integration for email verification with configurable SMTP settings.
- Five primary routes:
  - POST /auth/register: Registers a new user and sends verification email.
  - GET /auth/verify-email: Verifies user email using token.
  - POST /auth/login: Authenticates a user after email verification.
  - POST /auth/resend-verification: Resends verification email to pending users.
  - GET /auth/verify: Verifies a JWT passed in Authorization header.
- **New**: GET /auth/me: Retrieves authenticated user information (in API service).

Key implementation references:
- Route handlers and middleware: [index.js:80-273](file://services/auth-service/src/index.js#L80-L273)
- Database connection: [db.js:1-13](file://services/auth-service/src/db.js#L1-L13)
- Dependencies: [package.json:9-16](file://services/auth-service/package.json#L9-L16)

**Section sources**
- [index.js:80-273](file://services/auth-service/src/index.js#L80-L273)
- [db.js:1-13](file://services/auth-service/src/db.js#L1-L13)
- [package.json:1-19](file://services/auth-service/package.json#L1-L19)

## Architecture Overview
The Authentication Service participates in a multi-service deployment orchestrated by Docker Compose. Traefik routes requests to the auth-service for /auth endpoints. The service relies on a shared JWT_SECRET, SMTP configuration for email verification, and a PostgreSQL instance initialized by init-db.sql. The frontend supports both remote authentication via the auth-service and local demo mode.

```mermaid
graph TB
Client["Client Browser"]
Traefik["Traefik Router"]
AuthSvc["auth-service<br/>src/index.js"]
APIService["api-service<br/>src/index.js"]
DB[("PostgreSQL<br/>users table")]
InitSQL["infra/init-db.sql"]
Mailer["Nodemailer SMTP<br/>Email Transport"]
VerifyPage["verify-email.html<br/>Frontend Verification"]
Client --> Traefik
Traefik --> AuthSvc
Traefik --> APIService
AuthSvc --> DB
AuthSvc --> Mailer
APIService --> DB
DB <-- InitSQL --> DB
Mailer --> VerifyPage
```

**Diagram sources**
- [docker-compose.yml:4-137](file://docker-compose.yml#L4-L137)
- [index.js:80-273](file://services/auth-service/src/index.js#L80-L273)
- [index.js:106-121](file://services/api-service/src/index.js#L106-L121)
- [init-db.sql:1-46](file://infra/init-db.sql#L1-L46)
- [verify-email.html:1-148](file://frontend/verify-email.html#L1-L148)

**Section sources**
- [docker-compose.yml:59-79](file://docker-compose.yml#L59-L79)
- [README.md:34-43](file://README.md#L34-L43)

## Detailed Component Analysis

### JWT-Based Authentication Implementation
- Secret Management: JWT_SECRET is loaded from environment variables. In development, it defaults to a dev value; in production, it should be set securely.
- Token Issuance: On successful login, a JWT is signed with claims including subject, user ID, and role, with an expiration of 1 hour.
- Token Verification: The verify endpoint extracts the Bearer token from the Authorization header and validates it against the shared secret.

```mermaid
sequenceDiagram
participant C as "Client"
participant AS as "auth-service"
participant DB as "PostgreSQL"
C->>AS : POST /auth/login {email,password}
AS->>DB : SELECT user by email
DB-->>AS : user row (must be verified)
AS->>AS : compare password (bcrypt)
AS->>AS : sign JWT (sub, uid, role, expiresIn=1h)
AS-->>C : {token, user}
C->>AS : GET /auth/verify Authorization : Bearer <token>
AS->>AS : verify JWT with shared secret
AS-->>C : decoded claims or error
```

**Diagram sources**
- [index.js:160-206](file://services/auth-service/src/index.js#L160-L206)

**Section sources**
- [index.js:190-200](file://services/auth-service/src/index.js#L190-L200)
- [index.js:242-258](file://services/auth-service/src/index.js#L242-L258)

### User Registration Workflow
- Input Validation: Rejects missing email or password.
- Uniqueness Check: Queries users by email; returns conflict if found and verified.
- Token Generation: Generates UUID verification token for new users.
- Password Hashing: Uses bcryptjs to hash the password with a salt factor.
- Persistence: Inserts a new user record with verification fields and hashed password.
- Email Sending: Sends verification email with token to user's email address.
- Response: Returns success with user identifiers and verification instructions.

```mermaid
flowchart TD
Start(["POST /auth/register"]) --> Validate["Validate email and password"]
Validate --> Valid{"Valid?"}
Valid --> |No| Err400["400 Bad Request"]
Valid --> |Yes| CheckDup["SELECT user by email"]
CheckDup --> Exists{"Exists?"}
Exists --> |Yes| Verified{"Already verified?"}
Verified --> |Yes| Err409["409 Conflict"]
Verified --> |No| DeleteOld["DELETE old unverified user"]
DeleteOld --> Hash["bcrypt.hash(password)"]
Exists --> |No| Hash
Hash --> GenToken["Generate verify_token UUID"]
GenToken --> Insert["INSERT user (id,email,password,verify_token)"]
Insert --> SendEmail["sendVerificationEmail()"]
SendEmail --> Ok["200 OK with verification instructions"]
```

**Diagram sources**
- [index.js:80-127](file://services/auth-service/src/index.js#L80-L127)

**Section sources**
- [index.js:80-127](file://services/auth-service/src/index.js#L80-L127)

### Email Verification Workflow
- Token Validation: Validates verification token from query parameters.
- User Lookup: Finds user by verification token and ensures they are unverified.
- Verification Process: Marks user as verified and clears verification token.
- Success Response: Confirms email verification completion.
- Error Handling: Handles invalid tokens and server errors gracefully.

```mermaid
flowchart TD
Start(["GET /auth/verify-email?token=..."]) --> Validate["Validate token parameter"]
Validate --> Valid{"Token provided?"}
Valid --> |No| Err400["400 Bad Request"]
Valid --> |Yes| Lookup["SELECT user by verify_token AND verified=false"]
Lookup --> Found{"User found?"}
Found --> |No| Err400b["400 Invalid or used token"]
Found --> |Yes| Update["UPDATE users SET verified=true, verify_token=NULL"]
Update --> Success["200 OK - Email verified"]
```

**Diagram sources**
- [index.js:129-158](file://services/auth-service/src/index.js#L129-L158)

**Section sources**
- [index.js:129-158](file://services/auth-service/src/index.js#L129-L158)

### Login Workflow
- Input Validation: Rejects missing credentials.
- Lookup: Finds user by email.
- Verification Check: Ensures user has completed email verification.
- Authentication: Compares provided password with stored hash.
- Token Generation: Issues a signed JWT with subject, user ID, and role.
- Response: Returns the token and user information.

```mermaid
flowchart TD
Start(["POST /auth/login"]) --> V["Validate email and password"]
V --> VOK{"Valid?"}
VOK --> |No| E400["400 Bad Request"]
VOK --> |Yes| Q["SELECT user by email"]
Q --> Found{"Found?"}
Found --> |No| E401a["401 Not Found"]
Found --> |Yes| VerifyCheck["Check user.verified"]
VerifyCheck --> Verified{"Verified?"}
Verified --> |No| E401b["401 Email not verified"]
Verified --> |Yes| Cmp["bcrypt.compare(password,user.password)"]
Cmp --> Ok{"Match?"}
Ok --> |No| E401c["401 Unauthorized"]
Ok --> |Yes| Sign["jwt.sign({sub,uid,role},secret,{expiresIn})"]
Sign --> R200["200 OK {token, user}"]
```

**Diagram sources**
- [index.js:160-206](file://services/auth-service/src/index.js#L160-L206)

**Section sources**
- [index.js:160-206](file://services/auth-service/src/index.js#L160-L206)

### Role-Based Access Control (RBAC)
- Role Field: The users table includes a role field with default USER.
- First Account: The README indicates that the first account created receives ADMIN privileges.
- Token Claims: Login includes role in JWT claims for downstream services to enforce policies.

```mermaid
erDiagram
USERS {
int id PK
varchar email UK
text password_hash
varchar role
boolean verified
varchar verify_token
timestamptz created_at
}
```

**Diagram sources**
- [init-db.sql:3-11](file://infra/init-db.sql#L3-L11)

**Section sources**
- [init-db.sql:3-11](file://infra/init-db.sql#L3-L11)
- [README.md:32](file://README.md#L32)

### Database Schema for User Management
The initialization script defines:
- users: id, email, password_hash, role, verified, verify_token, created_at
- refresh_tokens: id, user_id, token_hash, expires_at (for optional refresh tokens)
- Indexes on user_id and token_hash for efficient lookup
- Additional tables for interpretation sessions and translations

```mermaid
erDiagram
USERS {
uuid id PK
varchar email UK
text password_hash
varchar role
boolean verified
varchar verify_token
timestamptz created_at
}
REFRESH_TOKENS {
int id PK
int user_id FK
text token_hash
timestamptz expires_at
timestamptz created_at
}
USERS ||--o{ REFRESH_TOKENS : "has"
INTERPRETATION_SESSIONS {
uuid id PK
varchar user_email
varchar title
text notes
timestamptz created_at
}
TRANSLATIONS {
uuid id PK
int user_id FK
text source_text
text target_text
varchar lang_from
varchar lang_to
timestamptz created_at
}
```

**Diagram sources**
- [init-db.sql:1-46](file://infra/init-db.sql#L1-L46)

**Section sources**
- [init-db.sql:1-46](file://infra/init-db.sql#L1-L46)

### API Endpoints and Schemas
- POST /auth/register
  - Request: { email, password }
  - Response: { message, userId, email }
  - Status Codes: 200, 400, 409, 500
- GET /auth/verify-email
  - Query: token (verification token)
  - Response: { message }
  - Status Codes: 200, 400, 500
- POST /auth/login
  - Request: { email, password }
  - Response: { token, user: { email, role } }
  - Status Codes: 200, 400, 401, 500
- POST /auth/resend-verification
  - Request: { email }
  - Response: { message }
  - Status Codes: 200, 400, 500
- GET /auth/verify
  - Headers: Authorization: Bearer <token>
  - Response: Decoded JWT claims or { message }
  - Status Codes: 200, 401
- **New**: GET /auth/me
  - Headers: Authorization: Bearer <token>
  - Response: Decoded JWT claims with user information
  - Status Codes: 200, 401

Note: The verify endpoint reads Authorization header and verifies the JWT using the shared secret.

**Section sources**
- [index.js:80-273](file://services/auth-service/src/index.js#L80-L273)
- [index.js:106-121](file://services/api-service/src/index.js#L106-L121)

### Authentication Middleware
- Header Parsing: Extracts Authorization header and ensures it starts with "Bearer ".
- Token Verification: Validates JWT signature and expiration using the shared secret.
- Error Handling: Returns 401 for malformed or invalid tokens.

```mermaid
flowchart TD
H["GET /auth/verify"] --> A["Read Authorization header"]
A --> B{"Has 'Bearer ' prefix?"}
B --> |No| E401a["401 No token"]
B --> |Yes| T["Extract token"]
T --> V["jwt.verify(token, secret)"]
V --> OK{"Valid?"}
OK --> |Yes| R200["200 {decoded}"]
OK --> |No| E401b["401 Token invalid"]
```

**Diagram sources**
- [index.js:242-258](file://services/auth-service/src/index.js#L242-L258)

**Section sources**
- [index.js:242-258](file://services/auth-service/src/index.js#L242-L258)

## Email Verification System

### SMTP Configuration and Nodemailer Integration
The authentication service includes comprehensive email verification functionality powered by Nodemailer with flexible SMTP configuration:

- **Production SMTP**: Configurable via SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS environment variables.
- **Development Testing**: Automatic fallback to Ethereal SMTP for testing without real email delivery.
- **Email Templates**: Custom HTML templates with responsive design for verification emails.
- **Security**: Tokens are UUID-based and automatically cleaned up after verification.

```mermaid
flowchart TD
Config["SMTP Configuration"] --> Prod{"SMTP_USER/PASS set?"}
Prod --> |Yes| ProdSMTP["Use Production SMTP"]
Prod --> |No| TestSMTP["Use Ethereal SMTP (testing)"]
ProdSMTP --> Transport["Nodemailer Transporter"]
TestSMTP --> Transport
Transport --> Send["sendVerificationEmail()"]
Send --> Template["HTML Email Template"]
Template --> Preview["Preview URL (Ethereal)"]
```

**Diagram sources**
- [index.js:14-47](file://services/auth-service/src/index.js#L14-L47)
- [index.js:49-78](file://services/auth-service/src/index.js#L49-L78)

**Section sources**
- [index.js:14-47](file://services/auth-service/src/index.js#L14-L47)
- [index.js:49-78](file://services/auth-service/src/index.js#L49-L78)

### Verification Token Management
The system implements robust token management for email verification:

- **Token Generation**: UUID-based verification tokens generated during registration.
- **Token Storage**: Secure storage in database with automatic cleanup after verification.
- **Token Expiration**: Tokens expire after 24 hours (implicit through verification process).
- **Duplicate Prevention**: Automatic cleanup of previous unverified registrations.

```mermaid
sequenceDiagram
participant U as "User"
participant AS as "auth-service"
participant DB as "PostgreSQL"
U->>AS : Register with email/password
AS->>DB : INSERT user (verified=false, verify_token=UUID)
AS->>AS : sendVerificationEmail()
AS-->>U : Email with verification link
U->>AS : GET /auth/verify-email?token=UUID
AS->>DB : UPDATE user SET verified=true
AS->>DB : UPDATE user SET verify_token=NULL
AS-->>U : Verification success
```

**Diagram sources**
- [index.js:80-127](file://services/auth-service/src/index.js#L80-L127)
- [index.js:129-158](file://services/auth-service/src/index.js#L129-L158)

**Section sources**
- [index.js:80-127](file://services/auth-service/src/index.js#L80-L127)
- [index.js:129-158](file://services/auth-service/src/index.js#L129-L158)

### Frontend Verification Page
The frontend includes a dedicated verification page that handles the verification process:

- **Token Extraction**: Automatically extracts verification token from URL query parameters.
- **API Integration**: Calls backend verification endpoint with the token.
- **User Feedback**: Provides clear success/error messaging with visual indicators.
- **Navigation**: Offers navigation back to home page after verification.

```mermaid
flowchart TD
Load["verify-email.html loads"] --> Extract["Extract token from URL"]
Extract --> HasToken{"Token present?"}
HasToken --> |No| ShowError["Show 'Token missing' error"]
HasToken --> |Yes| CallAPI["Call /auth/verify-email?token"]
CallAPI --> Success{"API success?"}
Success --> |Yes| ShowSuccess["Show 'Email verified!' success"]
Success --> |No| ShowError2["Show 'Verification failed' error"]
ShowSuccess --> ShowButton["Show Home button"]
ShowError2 --> ShowButton
```

**Diagram sources**
- [verify-email.html:101-144](file://frontend/verify-email.html#L101-L144)

**Section sources**
- [verify-email.html:1-148](file://frontend/verify-email.html#L1-148)

## Frontend Authentication System

### Enhanced Authentication Chrome Rendering
The frontend authentication system has been significantly improved with a streamlined `renderAuthChrome()` function that provides better user experience for authenticated and unauthenticated states.

**Key Features:**
- **Streamlined Logic**: Simplified conditional rendering for login/logout buttons
- **Enhanced State Management**: Improved handling of user account panels and navigation
- **Demo Mode Support**: Special handling for local authentication mode (`?local=1`)
- **Accessibility**: Proper ARIA attributes and keyboard navigation support
- **Demo Access Locking**: Buttons are locked until user is authenticated

### Comprehensive Logging Capabilities
The frontend authentication system now includes extensive console logging for debugging and monitoring authentication flows.

**Logging Features:**
- **Registration Flow**: Console logs for registration attempts and responses
- **Login Flow**: Detailed logging for login requests, responses, and errors
- **Session Validation**: Logging for server-side session validation
- **Demo Access**: Debug information for local authentication mode

### Demo Access and Local Authentication
The frontend supports both remote authentication and local demo mode for testing and development purposes.

**Local Authentication Features:**
- **Demo Accounts**: Pre-configured demo accounts for testing
- **Local Storage**: Session persistence using localStorage instead of JWT tokens
- **Role Simulation**: Automatic role assignment for demo users
- **Mode Switching**: Toggle between local and remote authentication using `?local=1`

```mermaid
flowchart TD
Start(["Frontend Authentication"]) --> Mode{"USE_LOCAL_AUTH ?"}
Mode --> |Yes| Local["Local Authentication Mode"]
Mode --> |No| Remote["Remote Authentication Mode"]
Local --> DemoAccounts["Demo Accounts<br/>demo@example.com / admin@example.com"]
Local --> LocalStorage["Session in localStorage"]
Remote --> JWT["JWT Token Authentication"]
Remote --> Server["auth-service /api-service"]
```

**Diagram sources**
- [script.js:6](file://frontend/script.js#L6)
- [script.js:97-111](file://frontend/script.js#L97-L111)
- [script.js:172-177](file://frontend/script.js#L172-L177)

**Section sources**
- [script.js:350-383](file://frontend/script.js#L350-L383)
- [script.js:220-235](file://frontend/script.js#L220-L235)
- [script.js:237-251](file://frontend/script.js#L237-L251)
- [script.js:97-111](file://frontend/script.js#L97-L111)

## Dependency Analysis
External libraries used by the Authentication Service:
- bcryptjs: Password hashing and comparison
- jsonwebtoken: JWT signing and verification
- nodemailer: Email sending with SMTP support
- pg: PostgreSQL client
- uuid: Unique identifier generation during registration
- cors: Cross-origin allowance (present but not enabled in current implementation)

```mermaid
graph LR
Pkg["package.json deps"]
Bcrypt["bcryptjs"]
JWT["jsonwebtoken"]
Nodemailer["nodemailer"]
PG["pg"]
UUID["uuid"]
CORS["cors"]
Pkg --> Bcrypt
Pkg --> JWT
Pkg --> Nodemailer
Pkg --> PG
Pkg --> UUID
Pkg --> CORS
```

**Diagram sources**
- [package.json:9-16](file://services/auth-service/package.json#L9-L16)

**Section sources**
- [package.json:1-19](file://services/auth-service/package.json#L1-L19)

## Performance Considerations
- Password hashing cost: bcryptjs uses a fixed salt factor in the current implementation. Consider tuning for production workloads.
- Database queries: Single-row lookups by email and verification token are efficient with proper indexing.
- Token lifetime: Short-lived tokens reduce risk and require clients to manage refresh strategies.
- Connection pooling: The PostgreSQL pool is configured via DATABASE_URL; ensure appropriate pool sizing for load.
- **Email Delivery**: SMTP configuration affects performance; consider using reliable SMTP providers for production.
- **Frontend Optimization**: Local authentication mode reduces network overhead for demo purposes.
- **Email Queue**: Consider implementing email queueing for high-volume scenarios.

## Troubleshooting Guide
Common issues and resolutions:
- Missing DATABASE_URL: The service exits early if DATABASE_URL is not set.
  - Check environment configuration in docker-compose.
- JWT_SECRET not set or mismatch: Ensure both auth-service and api-service share the same secret.
- 401 Unauthorized on login: Verify email/password correctness and that the user exists and is verified.
- 409 Conflict on register: Email already exists and is verified; choose another email.
- 401 on verify: Missing or malformed Authorization header; ensure "Bearer <token>" format.
- **Email Issues**:
  - SMTP configuration errors: Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables.
  - Email not delivered: Verify SMTP credentials and network connectivity.
  - Verification failures: Ensure token is valid and not expired.
- **Frontend Issues**: 
  - Local authentication mode not working: Check `?local=1` parameter in URL.
  - Demo accounts not loading: Verify localStorage permissions.
  - Console errors: Enable browser developer tools for detailed logging.

Operational checks:
- Confirm auth-service health endpoint responds.
- Validate PostgreSQL connectivity and schema initialization.
- **Email Configuration**: Test SMTP connection and verify email delivery.
- **Frontend Checks**: Verify authentication chrome renders correctly for both authenticated and unauthenticated states.

**Section sources**
- [db.js:3-7](file://services/auth-service/src/db.js#L3-L7)
- [docker-compose.yml:61-64](file://docker-compose.yml#L61-L64)
- [index.js:260-273](file://services/auth-service/src/index.js#L260-L273)
- [script.js:350-383](file://frontend/script.js#L350-L383)

## Conclusion
The Authentication Service provides a comprehensive foundation for user registration, login, JWT verification, and email verification workflows. It leverages bcryptjs for secure password handling, Nodemailer for email verification, a shared JWT secret for token validation, and a PostgreSQL-backed schema supporting roles and optional refresh tokens. The enhanced frontend authentication system now includes comprehensive logging, streamlined chrome rendering, demo access capabilities, and a complete email verification system with SMTP configuration and token management. For production, ensure secure secret management, implement proper SMTP configuration, consider adding rate limiting and audit logging, and implement token refresh mechanisms. The dual-mode authentication system (remote and local) provides flexibility for both production deployments and development/testing scenarios with enhanced security through mandatory email verification.