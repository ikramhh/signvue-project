# Frontend Application

<cite>
**Referenced Files in This Document**
- [index.html](file://frontend/index.html)
- [script.js](file://frontend/script.js)
- [style.css](file://frontend/style.css)
- [config.js](file://frontend/config.js)
- [docker-compose.yml](file://docker-compose.yml)
- [README.md](file://README.md)
- [services/auth-service/src/index.js](file://services/auth-service/src/index.js)
- [services/api-service/src/index.js](file://services/api-service/src/index.js)
- [infra/init-db.sql](file://infra/init-db.sql)
</cite>

## Update Summary
**Changes Made**
- Enhanced navigation system with new Introduction link for improved user experience
- Improved JavaScript DOM element access in hideIntroSession() function with better error handling
- Enhanced authentication system with improved debugging capabilities and streamlined authentication logic
- Better user experience for demo access with comprehensive console logging for showIntroSession()
- Improved error handling in camera controls with enhanced feature detail panel functionality
- Added comprehensive console logging for authentication flows and UI state management
- Enhanced session validation with /auth/me endpoint for improved user experience

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
This document describes the Frontend Single Page Application for SignVue, focusing on the web UI architecture, authentication flow, webcam integration for sign language detection, and the demo interface. It explains state management patterns, user interaction handling, responsive design, backend integration via Traefik routing, localStorage usage for offline functionality, and configuration management. It also covers browser compatibility, accessibility considerations, and performance optimization techniques.

**Updated** Enhanced navigation system with new Introduction link for improved user experience. Improved JavaScript DOM element access in hideIntroSession() function with better error handling and robust element validation.

## Project Structure
The frontend is a static SPA served by Nginx and integrated with a microservices backend orchestrated by Traefik. The SPA consists of:
- index.html: markup for the UI, including authentication modal, feature cards, intro-session panel, and demo camera area
- script.js: client-side logic for authentication, session management, webcam access, demo simulation, intro-session handling, and UI interactions
- style.css: responsive styles, animations, component layouts, and new intro-session and stop-fab styling
- config.js: runtime configuration resolution for the API base URL

```mermaid
graph TB
subgraph "Frontend"
HTML["index.html"]
JS["script.js"]
CSS["style.css"]
CFG["config.js"]
INTRO["Intro Session Panel"]
STOPFAB["Stop-FAB Button"]
AUTHLOGIC["Enhanced Auth Logic"]
DEBUGLOGS["Console Debugging"]
NAVIGATION["Enhanced Navigation"]
END
subgraph "Reverse Proxy"
TRAEFIK["Traefik"]
END
subgraph "Backend Services"
AUTH["auth-service"]
API["api-service"]
WORKER["worker-service"]
PG["Postgres"]
END
HTML --> JS
HTML --> CSS
HTML --> CFG
HTML --> INTRO
HTML --> STOPFAB
HTML --> NAVIGATION
JS --> AUTHLOGIC
AUTHLOGIC --> DEBUGLOGS
JS --> TRAEFIK
TRAEFIK --> AUTH
TRAEFIK --> API
API --> PG
API --> WORKER
```

**Diagram sources**
- [docker-compose.yml:118-131](file://docker-compose.yml#L118-L131)
- [index.html:17-246](file://frontend/index.html#L17-L246)
- [script.js:23-34](file://frontend/script.js#L23-L34)

**Section sources**
- [docker-compose.yml:118-131](file://docker-compose.yml#L118-L131)
- [index.html:17-246](file://frontend/index.html#L17-L246)
- [script.js:23-34](file://frontend/script.js#L23-L34)

## Core Components
- Authentication and session management: login/register forms, JWT handling, user panel, and role display with enhanced debugging
- Introduction session panel: guided tutorial with camera setup instructions and next-step progression
- Demo camera interface: webcam access, video preview, stop-fab button for camera termination, and simulated recognition output
- Feature cards: expandable detail panels with animated reveal and enhanced error handling
- Responsive navigation and accessibility: mobile-friendly navigation, keyboard support, and reduced motion preferences with enhanced navigation system
- Configuration and routing: API base URL resolution and Traefik routing rules

Key responsibilities:
- script.js orchestrates UI state, user actions, intro-session flow, and API interactions with comprehensive logging
- style.css defines responsive layouts, animations, accessibility attributes, and new intro-session/stopping styling
- config.js resolves the API base URL from meta tag or global override
- index.html provides the DOM structure with intro-session panel, stop-fab button, and enhanced navigation system

**Updated** Enhanced introduction session panel with automatic display logic and smooth scrolling navigation. Improved authentication debugging with console logs and enhanced error handling. Added new Introduction link to navigation system for better user experience.

**Section sources**
- [script.js:169-174](file://frontend/script.js#L169-L174)
- [script.js:416-462](file://frontend/script.js#L416-L462)
- [script.js:464-475](file://frontend/script.js#L464-L475)
- [script.js:605-629](file://frontend/script.js#L605-L629)
- [style.css:316-482](file://frontend/style.css#L316-L482)
- [style.css:934-963](file://frontend/style.css#L934-L963)
- [style.css:965-1037](file://frontend/style.css#L965-L1037)
- [config.js:7-17](file://frontend/config.js#L7-L17)
- [index.html:19-57](file://frontend/index.html#L19-L57)

## Architecture Overview
The SPA communicates with backend services through Traefik, which routes requests to auth-service and api-service based on host and path prefixes. The frontend uses localStorage for offline sessions and sessionStorage for server-backed sessions. The demo camera flow triggers an interpretation request to the backend queue and includes an intro-session tutorial.

```mermaid
sequenceDiagram
participant U as "User"
participant UI as "SPA (script.js)"
participant AUTH as "auth-service"
participant API as "api-service"
participant MQ as "RabbitMQ"
participant W as "worker-service"
U->>UI : Open app
UI->>UI : Resolve API base URL (config.js)
U->>UI : Click Login/Register
UI->>AUTH : POST /auth/login or /auth/register
AUTH-->>UI : { token }
UI->>UI : Store token in localStorage/sessionStorage
UI->>UI : Console log authentication success
U->>UI : Click Demo Camera
UI->>UI : Show Intro Session Panel with logging
UI->>UI : Click Next
UI->>UI : Start Camera with Stop-FAB
UI->>API : POST /api/interpretation-requests (with Bearer)
API->>MQ : Publish job
MQ-->>W : Consume job
W-->>API : Logs/console
API-->>UI : 202 Accepted
UI->>UI : Simulate recognition output
U->>UI : Click Stop-FAB
UI->>UI : Stop Camera and Clear Simulation
UI->>UI : Console log camera cleanup
```

**Diagram sources**
- [config.js:7-17](file://frontend/config.js#L7-L17)
- [script.js:176-182](file://frontend/script.js#L176-L182)
- [script.js:217-232](file://frontend/script.js#L217-L232)
- [script.js:429-435](file://frontend/script.js#L429-L435)
- [script.js:464-475](file://frontend/script.js#L464-L475)
- [script.js:616-622](file://frontend/script.js#L616-L622)
- [docker-compose.yml:70-105](file://docker-compose.yml#L70-L105)

**Section sources**
- [README.md:17-23](file://README.md#L17-L23)
- [docker-compose.yml:70-105](file://docker-compose.yml#L70-L105)
- [script.js:176-182](file://frontend/script.js#L176-L182)
- [script.js:217-232](file://frontend/script.js#L217-L232)
- [script.js:429-435](file://frontend/script.js#L429-L435)
- [script.js:464-475](file://frontend/script.js#L464-L475)
- [script.js:616-622](file://frontend/script.js#L616-L622)

## Detailed Component Analysis

### Enhanced Navigation System with Introduction Link
The SPA now includes an enhanced navigation system with a new Introduction link for improved user experience:
- New "Introduction" navigation item linking to the intro-session section (#intro-session)
- Smooth scrolling to the introduction panel when clicked
- Consistent styling with other navigation items
- Improved accessibility with proper ARIA attributes
- Better user onboarding experience with direct access to tutorial content

```mermaid
flowchart TD
Start(["User navigates to app"]) --> NavSystem["Enhanced Navigation System"]
NavSystem --> FeaturesLink["Fonctionnalités"]
NavSystem --> IntroLink["Introduction"]
NavSystem --> DemoLink["Démo"]
IntroLink --> ScrollToIntro["Scroll to Intro Session"]
ScrollToIntro --> ShowIntro["Show Intro Session Panel"]
ShowIntro --> UserTips["Display camera setup tips"]
UserTips --> NextButton["Click Next button"]
NextButton --> HideIntro["Hide Intro Session"]
HideIntro --> StartCamera["Start Camera with Stop-FAB"]
```

**Diagram sources**
- [index.html:25-29](file://frontend/index.html#L25-L29)
- [script.js:464-475](file://frontend/script.js#L464-L475)
- [script.js:616-622](file://frontend/script.js#L616-L622)

**Section sources**
- [index.html:25-29](file://frontend/index.html#L25-L29)
- [script.js:464-475](file://frontend/script.js#L464-L475)
- [script.js:616-622](file://frontend/script.js#L616-L622)

### Enhanced Introduction Session System
The SPA now includes a comprehensive introduction session system designed to guide users through the camera setup process with improved user experience:
- Auto-display logic: Introduction session automatically appears when users are logged in
- Step-by-step instructions for optimal camera positioning with practical tips for lighting, distance, and clothing considerations
- "Suivant" (Next) button to progress to the demo camera with smooth scrolling transition
- Automatic scrolling to demo section after clicking next
- Responsive design with grid layout for optimal mobile experience
- Comprehensive console logging for debugging and monitoring
- Enhanced DOM element access with proper validation in hideIntroSession() function

```mermaid
flowchart TD
Start(["User clicks Demo"]) --> CheckAuth{"Authenticated?"}
CheckAuth --> |No| OpenAuth["Open Auth Modal"]
CheckAuth --> |Yes| ShowIntro["Auto-show Intro Session Panel with logging"]
ShowIntro --> LogElement["Console log element existence"]
ShowIntro --> UserTips["Display camera setup tips"]
UserTips --> NextButton["Click Next button"]
NextButton --> HideIntro["Hide Intro Session with validation"]
HideIntro --> LogHide["Console log hide operation"]
HideIntro --> ScrollDemo["Smooth scroll to Demo Section"]
ScrollDemo --> StartCamera["Start Camera with Stop-FAB"]
```

**Diagram sources**
- [script.js:464-475](file://frontend/script.js#L464-L475)
- [script.js:616-622](file://frontend/script.js#L616-L622)
- [index.html:143-162](file://frontend/index.html#L143-L162)

**Section sources**
- [script.js:464-475](file://frontend/script.js#L464-L475)
- [script.js:616-622](file://frontend/script.js#L616-L622)
- [index.html:143-162](file://frontend/index.html#L143-L162)
- [style.css:965-1037](file://frontend/style.css#L965-L1037)

### Enhanced Camera Control with Stop Functionality
The demo camera interface now includes a dedicated stop-fab button for improved camera control:
- Red stop-fab button positioned at bottom-right of video container
- Hover effects with scaling and shadow enhancement
- Hidden state when camera is inactive
- Automatic activation when camera starts
- Comprehensive cleanup of camera streams and simulations with console logging
- Enhanced error handling for camera access failures

```mermaid
flowchart TD
StartCamera["Start Camera"] --> ShowStopFab["Show Stop-FAB"]
ShowStopFab --> PlayVideo["Play Video Stream"]
PlayVideo --> StartSim["Start Simulation"]
StartSim --> UserAction{"User Action"}
UserAction --> |Click Stop-FAB| StopCamera["Stop Camera with logging"]
UserAction --> |Logout| StopCamera
UserAction --> |Error| StopCamera
StopCamera --> LogCleanup["Console log cleanup operations"]
LogCleanup --> ClearStream["Clear Video Stream"]
ClearStream --> HideStopFab["Hide Stop-FAB"]
HideStopFab --> ResetUI["Reset UI State"]
```

**Diagram sources**
- [script.js:416-462](file://frontend/script.js#L416-L462)
- [script.js:608-614](file://frontend/script.js#L608-L614)
- [index.html:178-183](file://frontend/index.html#L178-L183)

**Section sources**
- [script.js:416-462](file://frontend/script.js#L416-L462)
- [script.js:608-614](file://frontend/script.js#L608-L614)
- [index.html:178-183](file://frontend/index.html#L178-L183)
- [style.css:934-963](file://frontend/style.css#L934-L963)

### Enhanced DOM Element Access in hideIntroSession() Function
The hideIntroSession() function has been improved with better DOM element access and validation:
- Proper element existence checking before manipulation
- Robust error handling for missing DOM elements
- Consistent with other DOM manipulation functions in the codebase
- Enhanced debugging capabilities with console logging
- Improved reliability in intro-session panel management

```mermaid
flowchart TD
HideIntroSession["hideIntroSession() called"] --> GetElement["document.getElementById('intro-session')"]
GetElement --> CheckExists{"Element exists?"}
CheckExists --> |Yes| AddHidden["el.classList.add('is-hidden')"]
CheckExists --> |No| SkipOperation["Skip operation (no error thrown)"]
AddHidden --> Success["Intro session hidden successfully"]
SkipOperation --> Success
Success --> LogOperation["Console log operation (if needed)"]
```

**Diagram sources**
- [script.js:471-476](file://frontend/script.js#L471-L476)

**Section sources**
- [script.js:471-476](file://frontend/script.js#L471-L476)

### Authentication Flow
The SPA supports two modes:
- Server-backed JWT mode: authenticates against auth-service, stores JWT in localStorage, and verifies sessions on boot
- Local storage mode (?local=1): uses localStorage for accounts and session without backend

Key flows:
- Login/Register forms submit credentials to backend endpoints with comprehensive console logging
- On success, the SPA stores the JWT and sets the session email
- The user panel displays the email and role (fetched via /auth/verify in server-backed mode)
- Logout clears session, stops camera stream, and hides intro-session panel with cleanup logging
- Session validation uses /auth/me endpoint for improved reliability

```mermaid
sequenceDiagram
participant U as "User"
participant UI as "SPA (script.js)"
participant AUTH as "auth-service"
participant LS as "localStorage/sessionStorage"
U->>UI : Submit Login/Register
UI->>UI : Console log request details
UI->>AUTH : POST /auth/login or /auth/register
AUTH-->>UI : { token }
UI->>UI : Console log response details
UI->>LS : Save token and session email
UI->>UI : Console log success
UI->>UI : renderAuthChrome()
U->>UI : Open User Panel
UI->>AUTH : GET /auth/verify (Bearer)
AUTH-->>UI : { role }
UI->>UI : Update panel role
U->>UI : Click Logout
UI->>UI : clearSession()
UI->>UI : stopCamera()
UI->>UI : hideIntroSession()
UI->>UI : Console log cleanup operations
```

**Diagram sources**
- [script.js:184-232](file://frontend/script.js#L184-L232)
- [script.js:121-142](file://frontend/script.js#L121-L142)
- [script.js:347-380](file://frontend/script.js#L347-L380)
- [auth-service/src/index.js:52-94](file://services/auth-service/src/index.js#L52-L94)

**Section sources**
- [script.js:169-174](file://frontend/script.js#L169-L174)
- [script.js:184-232](file://frontend/script.js#L184-L232)
- [script.js:121-142](file://frontend/script.js#L121-L142)
- [script.js:347-380](file://frontend/script.js#L347-L380)
- [auth-service/src/index.js:52-94](file://services/auth-service/src/index.js#L52-L94)

### Demo Camera and Recognition Simulation
The demo camera integrates with the webcam and simulates recognition output:
- Requires authentication to start with enhanced debugging
- Shows intro-session panel with camera setup instructions and comprehensive logging
- Requests camera permission and starts the video stream with error handling
- Displays a placeholder until playback begins
- Shows stop-fab button for camera termination
- Starts a periodic simulation of recognized words
- Sends an interpretation request to the backend when started

```mermaid
flowchart TD
Start(["User clicks Demo"]) --> CheckAuth{"Authenticated?"}
CheckAuth --> |No| OpenAuth["Open Auth Modal"]
CheckAuth --> |Yes| ShowIntro["Show Intro Session Panel"]
ShowIntro --> UserTips["Display camera setup tips"]
UserTips --> NextButton["Click Next button"]
NextButton --> HideIntro["Hide Intro Session"]
HideIntro --> ScrollDemo["Scroll to Demo Section"]
ScrollDemo --> CheckCamera{"Camera Available?"}
CheckCamera --> |No| ShowError["Show 'Camera not supported'"]
CheckCamera --> |Yes| GetUserMedia["navigator.mediaDevices.getUserMedia"]
GetUserMedia --> StreamOK{"Stream OK?"}
StreamOK --> |No| ShowError["Show 'Access denied'"]
StreamOK --> |Yes| PlayVideo["Set srcObject and play()"]
PlayVideo --> ShowStopFab["Show Stop-FAB"]
ShowStopFab --> SimStart["Start simulation interval"]
SimStart --> SendReq["POST /api/interpretation-requests (optional)"]
SendReq --> Output["Update #output text"]
```

**Diagram sources**
- [script.js:409-441](file://frontend/script.js#L409-L441)
- [script.js:398-407](file://frontend/script.js#L398-L407)
- [script.js:429-435](file://frontend/script.js#L429-L435)

**Section sources**
- [script.js:409-441](file://frontend/script.js#L409-L441)
- [script.js:398-407](file://frontend/script.js#L398-L407)
- [script.js:429-435](file://frontend/script.js#L429-L435)

### State Management Patterns
- Session state: stored in localStorage (local mode) or sessionStorage (server-backed), with migration logic
- Tokens: JWT stored in localStorage for server-backed mode
- UI state: toggled via CSS classes and aria-* attributes for accessibility
- Feature detail panels: controlled by dataset and selection state with enhanced error handling
- Intro-session state: managed separately from main UI state with automatic display logic and improved DOM access
- Reduced motion: respects user preference to disable animations
- Console logging: comprehensive debugging information for all major operations

```mermaid
classDiagram
class Session {
+isLoggedIn() bool
+setSessionEmail(email) void
+clearSession() void
+getAuthToken() string
}
class UIState {
+renderAuthChrome() void
+openFeatureDetailPanel(id) void
+closeFeatureDetailPanel() void
+toggleUserAccountPanel() void
+showIntroSession() void
+hideIntroSession() void
+startCamera() void
+stopCamera() void
}
class Storage {
+getAccounts() Account[]
+saveAccounts(Account[]) void
+getSessionEmail() string
}
class Debugging {
+console.log(operation, details) void
+console.warn(element, status) void
}
Session --> Storage : "reads/writes"
UIState --> Session : "reads"
UIState --> Storage : "reads"
UIState --> Debugging : "uses"
```

**Diagram sources**
- [script.js:94-112](file://frontend/script.js#L94-L112)
- [script.js:144-158](file://frontend/script.js#L144-L158)
- [script.js:347-380](file://frontend/script.js#L347-L380)
- [script.js:588-603](file://frontend/script.js#L588-L603)
- [script.js:464-475](file://frontend/script.js#L464-L475)
- [script.js:451-462](file://frontend/script.js#L451-L462)

**Section sources**
- [script.js:94-112](file://frontend/script.js#L94-L112)
- [script.js:144-158](file://frontend/script.js#L144-L158)
- [script.js:347-380](file://frontend/script.js#L347-L380)
- [script.js:588-603](file://frontend/script.js#L588-L603)
- [script.js:464-475](file://frontend/script.js#L464-L475)
- [script.js:451-462](file://frontend/script.js#L451-L462)

### Responsive Design and Accessibility
- Responsive layout: CSS Grid and Flexbox for adaptive sections
- Animations: CSS keyframes with reduced motion support
- Accessibility: ARIA attributes, focus management, keyboard navigation, and screen reader-friendly labels
- Navigation: Mobile hamburger menu with aria-expanded toggling and enhanced navigation system
- Intro-session panel: Full-width responsive design with grid layout
- Stop-fab button: Accessible floating action button with hover states
- Console debugging: Comprehensive logging for accessibility testing and debugging

```mermaid
flowchart TD
Load(["Page Load"]) --> CheckReduced["Check prefers-reduced-motion"]
CheckReduced --> |Prefers| DisableAnim["Disable animations"]
CheckReduced --> |Not Prefers| EnableAnim["Enable animations"]
EnableAnim --> Observe["IntersectionObserver reveal"]
DisableAnim --> Observe
Observe --> ApplyClasses["Add is-visible classes"]
ApplyClasses --> IntroSession["Intro Session Panel"]
IntroSession --> StopFab["Stop-FAB Button"]
StopFab --> ResponsiveLayout["Responsive Grid Layout"]
```

**Diagram sources**
- [style.css:573-598](file://frontend/style.css#L573-L598)
- [script.js:655-692](file://frontend/script.js#L655-L692)
- [style.css:965-1037](file://frontend/style.css#L965-L1037)
- [style.css:934-963](file://frontend/style.css#L934-L963)

**Section sources**
- [style.css:573-598](file://frontend/style.css#L573-L598)
- [script.js:655-692](file://frontend/script.js#L655-L692)
- [style.css:965-1037](file://frontend/style.css#L965-L1037)
- [style.css:934-963](file://frontend/style.css#L934-L963)

### Configuration Management
The API base URL is resolved from:
- window.__SIGNVUE_API_BASE__ override
- meta[name="signvue-api-base"] content
- Default fallback to a hosted backend

This allows flexible deployment targets without code changes.

**Section sources**
- [config.js:7-17](file://frontend/config.js#L7-L17)
- [index.html:6-7](file://frontend/index.html#L6-L7)
- [script.js:23-34](file://frontend/script.js#L23-L34)

## Dependency Analysis
- Frontend depends on Traefik routing for auth-service (/auth) and api-service (/api)
- Backend services depend on Postgres for persistence and RabbitMQ for asynchronous jobs
- The SPA uses localStorage/sessionStorage for offline/local mode and JWT for server-backed mode
- New dependencies: intro-session panel, stop-fab button, and enhanced navigation system components
- Enhanced debugging infrastructure with comprehensive console logging

```mermaid
graph LR
Browser["Browser"] --> SPA["SPA (script.js)"]
SPA --> Config["config.js"]
SPA --> AuthAPI["/auth/*"]
SPA --> ApiAPI["/api/*"]
AuthAPI --> AuthSvc["auth-service"]
ApiAPI --> ApiSvc["api-service"]
ApiSvc --> DB["Postgres"]
ApiSvc --> MQ["RabbitMQ"]
MQ --> Worker["worker-service"]
IntroSession["Intro Session Panel"] --> SPA
StopFab["Stop-FAB Button"] --> SPA
NavSystem["Enhanced Navigation"] --> SPA
DebugLogs["Console Logging"] --> SPA
```

**Diagram sources**
- [docker-compose.yml:70-105](file://docker-compose.yml#L70-L105)
- [script.js:176-182](file://frontend/script.js#L176-L182)
- [auth-service/src/index.js:12-94](file://services/auth-service/src/index.js#L12-L94)
- [api-service/src/index.js:16-121](file://services/api-service/src/index.js#L16-L121)

**Section sources**
- [docker-compose.yml:70-105](file://docker-compose.yml#L70-L105)
- [script.js:176-182](file://frontend/script.js#L176-L182)
- [auth-service/src/index.js:12-94](file://services/auth-service/src/index.js#L12-L94)
- [api-service/src/index.js:16-121](file://services/api-service/src/index.js#L16-L121)

## Performance Considerations
- Animation budget: reduced motion preference disables heavy animations
- Lazy initialization: IntersectionObserver defers reveal animations until elements are near viewport
- Minimal DOM updates: toggling CSS classes and dataset attributes reduces reflows
- Efficient event handling: delegated listeners and requestAnimationFrame for UI updates
- Camera optimization: explicit play() and track stopping on logout to release resources
- Intro-session optimization: smooth scrolling and conditional rendering based on user state
- Console logging optimization: selective logging for debugging without performance impact
- Session validation optimization: efficient /auth/me endpoint usage for reliable session management
- Enhanced DOM access optimization: improved element validation reduces unnecessary operations

**Updated** Enhanced introduction session optimization with automatic display logic and smooth scrolling navigation. Improved authentication performance with streamlined session validation. Enhanced DOM element access optimization in hideIntroSession() function with better error handling.

## Troubleshooting Guide
Common issues and resolutions:
- Camera access denied: ensure HTTPS or localhost origin and that the user grants permission
- API base URL mismatch: verify meta tag or window override for the API base
- Network errors during login/register: confirm backend services are healthy and Traefik routes are configured
- Session not persisting: check localStorage/sessionStorage availability and browser privacy settings
- Demo locked behind authentication: click "Connexion" to open the modal and log in
- Intro-session not appearing: ensure user is authenticated and JavaScript is enabled
- Stop-fab not working: check browser compatibility with mediaDevices API and camera permissions
- Authentication failures: check console logs for detailed error information
- Session validation issues: verify /auth/me endpoint is accessible and JWT is properly formatted
- Console debugging: use browser developer tools to monitor authentication and UI state changes
- Navigation issues: verify Introduction link exists and points to correct section ID
- DOM element access errors: check if intro-session element exists in DOM before manipulation

**Updated** Enhanced troubleshooting for introduction session and stop-fab functionality. Added authentication debugging guidance and console logging troubleshooting steps. Added navigation system troubleshooting for Introduction link issues.

**Section sources**
- [script.js:437-440](file://frontend/script.js#L437-L440)
- [config.js:7-17](file://frontend/config.js#L7-L17)
- [script.js:484-506](file://frontend/script.js#L484-L506)
- [script.js:509-541](file://frontend/script.js#L509-L541)
- [index.html:25-29](file://frontend/index.html#L25-L29)

## Conclusion
The SignVue frontend delivers a responsive, accessible SPA with robust authentication, seamless webcam integration, and a simulated recognition pipeline. Its modular architecture, clear state management, and Traefik-driven routing enable easy deployment and maintenance across environments. The addition of the comprehensive introduction session system, enhanced camera control with stop functionality, and improved user onboarding experience significantly enhances the overall user experience. The combination of server-backed JWT and local storage modes provides flexibility for development and production scenarios. The enhanced debugging capabilities with comprehensive console logging provide excellent developer experience and troubleshooting support. The new Introduction link in the navigation system improves user accessibility and onboarding experience.

**Updated** Enhanced conclusion to reflect the new introduction session system with automatic display logic, improved authentication debugging, streamlined user experience features, and enhanced navigation system with new Introduction link for better user accessibility.

## Appendices

### API Endpoints Used by the SPA
- POST /auth/register — registers a new user
- POST /auth/login — authenticates and returns a JWT
- GET /auth/verify — verifies JWT and returns decoded payload
- GET /auth/me — returns current user profile for session validation
- POST /api/interpretation-requests — submits a recognition request

**Updated** Added /auth/me endpoint for improved session management and validation.

**Section sources**
- [auth-service/src/index.js:12-94](file://services/auth-service/src/index.js#L12-L94)
- [api-service/src/index.js:26-121](file://services/api-service/src/index.js#L26-L121)

### Data Model References
- Users table with email, password hash, role, timestamps
- Refresh tokens table for optional refresh token management
- Interpretation sessions and translations tables for historical data

**Section sources**
- [infra/init-db.sql:3-44](file://infra/init-db.sql#L3-L44)

### Enhanced Console Logging Reference
The SPA includes comprehensive console logging for debugging and monitoring:
- Authentication flows: detailed request/response logging
- UI state changes: element existence checks and state transitions
- Camera operations: start/stop and error handling logging
- Session management: validation and cleanup operations
- Error handling: detailed error messages and debugging information
- Navigation system: element access validation and smooth scrolling operations
- DOM manipulation: enhanced element access with proper validation

**Section sources**
- [script.js:220-235](file://frontend/script.js#L220-L235)
- [script.js:460-475](file://frontend/script.js#L460-L475)
- [script.js:441-445](file://frontend/script.js#L441-L445)
- [script.js:710-712](file://frontend/script.js#L710-L712)
- [script.js:471-476](file://frontend/script.js#L471-L476)