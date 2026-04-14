# Sprint 2

## Work Completed in Sprint 2

- **Frontend-backend integration**: Connected the Angular frontend to the Go backend via a proxy configuration (`proxy.conf.json`) that forwards all `/api` requests to `localhost:8080`. `AuthService` and `PostService` make HTTP calls to the backend REST API with JWT-based authentication.
- **User authentication**: Implemented email/password signup and login, Google OAuth login, and JWT-based session management across both frontend and backend.
- **Blog post CRUD**: Users can create new posts (title + content) and view their own posts on the home page. A public feed page displays all users' posts in reverse chronological order.
- **Navigation & guards**: Added a navbar with dynamic user state, an `authGuard` to protect routes, and routing between home, feed, write, and login pages.
- **Frontend unit tests**: Wrote 56 unit tests across 8 spec files covering all components, services, and guards using Vitest with Angular's `@angular/build:unit-test` builder.
- **Cypress end-to-end test**: Added a Cypress smoke test that validates the login page form validation behavior.
- **Backend unit tests**: Wrote 24 unit tests in Go covering all API handlers, middleware, JWT generation, OAuth flow, and helper functions using an in-memory SQLite database.
- **Backend API documentation**: Fully documented all 10 REST API endpoints with request/response examples and error cases (see below).

## Backend API Documentation

Base URL

- Local backend: `http://localhost:8080`
- Frontend-proxied API: `/api`

Authentication

- Protected routes expect `Authorization: Bearer <jwt>`.
- JWTs are signed with the `JWT_SECRET` environment variable.
- Tokens currently expire after 24 hours.

Response conventions

- Success responses return JSON payloads with HTTP `200 OK` unless noted otherwise.
- Validation and auth failures return a JSON object with an `error` field.

### Health check

Endpoint

- `GET /api/health`

Purpose

- Confirms the backend is running and reachable.

Response

```json
{
  "status": "ok"
}
```

### List posts

Endpoint

- `GET /api/posts`

Purpose

- Returns the public feed ordered by newest post first.

Authentication

- Not required.

Response

```json
[
  {
    "id": "post-123",
    "user_id": "user-123",
    "user": {
      "id": "user-123",
      "google_id": "",
      "email": "author@example.com",
      "name": "Author Name",
      "first_name": "Author",
      "last_name": "Name",
      "picture": "",
      "CreatedAt": "2026-03-24T10:00:00Z",
      "UpdatedAt": "2026-03-24T10:00:00Z"
    },
    "title": "First Post",
    "content": "Post body",
    "image_url": "",
    "CreatedAt": "2026-03-24T10:00:00Z",
    "UpdatedAt": "2026-03-24T10:00:00Z"
  }
]
```

Possible errors

- `500 Internal Server Error`

```json
{
  "error": "Failed to fetch posts"
}
```

### List my posts

Endpoint

- `GET /api/my-posts`

Purpose

- Returns posts authored by the currently authenticated user, ordered by newest first.

Authentication

- Required.

Headers

```http
Authorization: Bearer <jwt>
```

Response

```json
[
  {
    "id": "post-456",
    "user_id": "user-123",
    "user": {
      "id": "user-123",
      "google_id": "",
      "email": "user@example.com",
      "name": "Test User",
      "first_name": "Test",
      "last_name": "User",
      "picture": "",
      "CreatedAt": "2026-03-24T10:00:00Z",
      "UpdatedAt": "2026-03-24T10:00:00Z"
    },
    "title": "My Post",
    "content": "My post body",
    "image_url": "",
    "CreatedAt": "2026-03-24T10:00:00Z",
    "UpdatedAt": "2026-03-24T10:00:00Z"
  }
]
```

Possible errors

- `401 Unauthorized`

```json
{
  "error": "No token"
}
```

```json
{
  "error": "User not found in context"
}
```

- `500 Internal Server Error`

```json
{
  "error": "Failed to fetch user posts"
}
```

### Create post

Endpoint

- `POST /api/posts`

Purpose

- Creates a new post for the authenticated user.

Authentication

- Required.

Headers

```http
Authorization: Bearer <jwt>
```

Request body

```json
{
  "title": "My first post",
  "content": "Hello BlogNest"
}
```

Response

- `201 Created`

```json
{
  "id": "post-123",
  "user_id": "user-123",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "Test User"
  },
  "title": "My first post",
  "content": "Hello BlogNest",
  "image_url": "",
  "CreatedAt": "2026-03-25T08:00:00Z",
  "UpdatedAt": "2026-03-25T08:00:00Z"
}
```

Possible errors

- `400 Bad Request`

```json
{
  "error": "title and content are required"
}
```

- `401 Unauthorized`

```json
{
  "error": "No token"
}
```

- `500 Internal Server Error`

```json
{
  "error": "Failed to create post"
}
```

### Current user

Endpoint

- `GET /api/me`

Purpose

- Returns the authenticated user profile for the provided JWT.

Authentication

- Required.

Headers

```http
Authorization: Bearer <jwt>
```

Response

```json
{
  "id": "user-123",
  "google_id": "",
  "email": "user@example.com",
  "name": "Test User",
  "first_name": "Test",
  "last_name": "User",
  "picture": "",
  "CreatedAt": "2026-03-24T10:00:00Z",
  "UpdatedAt": "2026-03-24T10:00:00Z"
}
```

Possible errors

- `401 Unauthorized`

```json
{
  "error": "No token"
}
```

```json
{
  "error": "Invalid token"
}
```

```json
{
  "error": "User not found"
}
```

### Email signup

Endpoint

- `POST /api/auth/signup`

Purpose

- Creates a password-based user account and returns a JWT.

Request body

```json
{
  "first_name": "Test",
  "last_name": "User",
  "email": "user@example.com",
  "password": "secret123"
}
```

Validation rules

- `first_name` is required.
- `last_name` is required.
- `email` is required and must be valid.
- `password` is required and must be at least 6 characters.

Response

```json
{
  "token": "<jwt>",
  "user": {
    "id": "user-123",
    "google_id": "",
    "email": "user@example.com",
    "name": "Test User",
    "first_name": "Test",
    "last_name": "User",
    "picture": "",
    "CreatedAt": "2026-03-24T10:00:00Z",
    "UpdatedAt": "2026-03-24T10:00:00Z"
  }
}
```

Possible errors

- `400 Bad Request` for invalid payloads
- `409 Conflict` when the email is already registered
- `500 Internal Server Error` for hashing, token, or database failures

Example duplicate-email response

```json
{
  "error": "Email already registered"
}
```

### Email login

Endpoint

- `POST /api/auth/login`

Purpose

- Authenticates a password-based user and returns a JWT.

Request body

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

Response

```json
{
  "token": "<jwt>",
  "user": {
    "id": "user-123",
    "google_id": "",
    "email": "user@example.com",
    "name": "Test User",
    "first_name": "Test",
    "last_name": "User",
    "picture": "",
    "CreatedAt": "2026-03-24T10:00:00Z",
    "UpdatedAt": "2026-03-24T10:00:00Z"
  }
}
```

Possible errors

- `400 Bad Request` for invalid payloads
- `401 Unauthorized` for invalid credentials
- `401 Unauthorized` when the account is Google-OAuth-only
- `500 Internal Server Error` for database or token failures

Example error responses

```json
{
  "error": "Invalid email or password"
}
```

```json
{
  "error": "This account uses Google OAuth. Please sign in with Google."
}
```

### Google OAuth login start

Endpoint

- `GET /api/auth/google`

Purpose

- Starts the Google OAuth flow.

Behavior

- Sets an `oauth_state` cookie.
- Redirects the browser to Google consent.

Response

- `307 Temporary Redirect`

### Google OAuth callback

Endpoint

- `GET /api/auth/callback`

Query parameters

- `state`: required OAuth state token
- `code`: required Google auth code

Purpose

- Verifies state, exchanges the Google code, fetches the Google profile, creates or loads a user, then redirects back to the frontend login page with a JWT.

Success behavior

- `307 Temporary Redirect` to:

```text
http://localhost:4200/login?token=<jwt>
```

Possible errors

- `400 Bad Request`

```json
{
  "error": "Invalid state"
}
```

- `500 Internal Server Error`

```json
{
  "error": "Failed to exchange code"
}
```

```json
{
  "error": "Failed to get user info"
}
```

```json
{
  "error": "Failed to decode user info"
}
```

```json
{
  "error": "Database error"
}
```

```json
{
  "error": "Failed to generate token"
}
```

### Backward-compatible routes

The backend still exposes the earlier non-prefixed routes for compatibility with older clients:

- `GET /auth/google`
- `GET /auth/callback`
- `POST /auth/signup`
- `POST /auth/login`
- `GET /me`
- `GET /posts`

## Frontend Unit Tests

Run frontend unit tests with:

```bash
cd frontend && npm test
```

**8 spec files, 56 tests total:**

### auth.service.spec.ts (12 tests)

- should be created
- isLoggedIn returns false when no token
- isLoggedIn returns true when token exists
- getUser returns null initially
- login sends POST and stores token
- signup sends POST and stores token
- logout clears token and resets user
- loadUser fetches /api/me and emits user
- loadUser clears token on 401
- handleAuthCallback stores token from URL and loads user
- handleAuthCallback does nothing without token param
- loginWithGoogle navigates to /api/auth/google

### post.service.spec.ts (8 tests)

- should be created
- getPosts returns normalized posts
- getMyPosts sends auth header and returns posts
- createPost sends auth header and post data
- normalize handles missing CreatedAt
- normalize handles lowercase createdAt
- normalize defaults missing fields
- getMyPosts throws when no token

### auth.guard.spec.ts (2 tests)

- allows access when user is logged in
- redirects to /login when user is not logged in

### login.component.spec.ts (14 tests)

- should create
- calls handleAuthCallback on init
- toggleMode switches between login and signup
- googleLogin delegates to AuthService
- submitLogin shows error for empty fields
- submitLogin calls AuthService.login with valid input
- submitLogin shows server error on failure
- submitSignup shows error when fields are empty
- submitSignup shows error when passwords do not match
- submitSignup shows error when password is too short
- submitSignup calls AuthService.signup on valid input
- submitSignup shows server error on failure
- navigates to /home when user$ emits a user
- does not navigate when user$ emits null

### feed.component.spec.ts (4 tests)

- should create
- loads posts and filters out current user posts
- sets loading to false after posts load
- sets error message on failure

### home.component.spec.ts (6 tests)

- should create
- loads my posts on init
- sets loading to false after posts load
- falls back to getPosts when getMyPosts fails
- goWrite navigates to /write
- goFeed navigates to /feed

### write.component.spec.ts (6 tests)

- should create
- shows error if title is empty
- shows error if content is empty
- publishes post and navigates to /home
- shows error on publish failure
- cancel navigates to /home

### navbar.component.spec.ts (4 tests)

- should create
- user is null initially
- updates user on user$ emission
- logout delegates to AuthService

## Cypress End-to-End Tests

Run Cypress tests with:

```bash
cd frontend && npm run cypress:run
```

### login.cy.ts (1 test)

- **shows a validation error for an empty email login submission** — visits `/login`, clicks the submit button without filling in email or password, and asserts that a "Please fill in all fields" error message is displayed.

## Backend Unit Tests

Run backend tests with:

```bash
cd backend && go test ./...
```

**1 test file (main_test.go), 24 tests total:**

### Helper function tests

- `TestGetEnvReturnsValueWhenPresent` — `getEnv` returns env var value when set
- `TestGetEnvReturnsFallbackWhenMissing` — `getEnv` returns fallback for missing var
- `TestGenerateStateReturnsDifferentNonEmptyValues` — `generateState` produces unique non-empty values

### JWT tests

- `TestGenerateJWTSignsExpectedClaims` — `generateJWT` signs token with correct `user_id` claim

### Route registration tests

- `TestRegisterRoutesIncludesExpectedAPIPaths` — all expected API routes are registered

### Health and feed handler tests

- `TestHealthCheckReturnsOK` — `GET /api/health` returns 200 with `{"status":"ok"}`
- `TestListPostsReturnsOrderedPostsWithUsers` — `GET /api/posts` returns posts newest-first with preloaded user

### Post creation tests

- `TestCreatePostRequiresAuth` — `POST /api/posts` returns 401 without auth
- `TestCreatePostRejectsInvalidPayload` — `POST /api/posts` returns 400 for empty title/content
- `TestCreatePostCreatesPostForAuthenticatedUser` — `POST /api/posts` returns 201 for valid authenticated request

### Google OAuth tests

- `TestHandleGoogleLoginRedirectsAndSetsCookie` — `GET /api/auth/google` returns 307 redirect and sets `oauth_state` cookie
- `TestHandleGoogleCallbackRejectsInvalidState` — `GET /api/auth/callback` returns 400 for state mismatch
- `TestHandleGoogleCallbackCreatesUserAndRedirectsToFrontend` — full OAuth callback flow creates user and redirects with JWT

### Signup tests

- `TestHandleSignupCreatesUserAndReturnsToken` — `POST /api/auth/signup` creates user with hashed password and returns token
- `TestHandleSignupRejectsDuplicateEmail` — signup returns 409 for existing email
- `TestHandleSignupRejectsInvalidPayload` — signup returns 400 for invalid payload

### Login tests

- `TestHandleLoginReturnsTokenForValidCredentials` — `POST /api/auth/login` returns token for valid credentials
- `TestHandleLoginRejectsUnknownUser` — login returns 401 for non-existent user
- `TestHandleLoginRejectsOAuthOnlyUser` — login returns 401 for Google-only accounts
- `TestHandleLoginRejectsWrongPassword` — login returns 401 for wrong password

### Auth middleware tests

- `TestAuthMiddlewareRejectsMissingToken` — auth middleware returns 401 when no token
- `TestAuthMiddlewareRejectsInvalidToken` — auth middleware returns 401 for invalid JWT
- `TestAuthMiddlewareRejectsTokenForMissingUser` — auth middleware returns 401 for deleted/missing user

### Authenticated endpoint tests

- `TestGetMeReturnsAuthenticatedUser` — `GET /api/me` returns authenticated user profile
- `TestListMyPostsReturnsOnlyCurrentUserPosts` — `GET /api/my-posts` returns only authenticated user's posts, newest first
- `TestListMyPostsRequiresAuth` — `GET /api/my-posts` returns 401 without token