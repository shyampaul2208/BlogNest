# Sprint 3

## Work Completed in Sprint 3

Sprint 3 delivered the core social and interaction features for BlogNest, along with quality and usability improvements across the stack.

### 1. Post detail, edit, and delete
- Added single-post view (`/post/:id`) with full content, author information, timestamps, comments, and likes.
- Added owner-only post edit and delete flows.
- Enforced backend authorization for update/delete so only the post owner can modify the post.
- Implemented cascade cleanup for related likes/comments on post deletion.

### 2. Comments system
- Implemented comment listing per post.
- Implemented authenticated comment creation.
- Implemented owner-only comment deletion.
- Added comments UI in the post detail page.

### 3. Like system
- Implemented like/unlike toggle per post.
- Added like count and liked-state APIs.
- Added UI integration in feed and post detail pages.
- Added optional-auth behavior for like status endpoint so count can still be shown to non-authenticated requests.

### 4. User search and profile
- Added authenticated user search by name/email.
- Added public user profile page with user information and that user's posts.
- Added like count display for profile posts.

### 5. Follow system
- Added follow/unfollow toggle endpoint.
- Added follow status endpoint for relationship + counts.
- Added public follow counts endpoint.
- Added followers list endpoint and following list endpoint.
- Added follow controls on feed/profile pages.
- Added clickable Followers/Following counts on profile and navbar with popup list UI.
- Added reactive follower/following count refresh after follow/unfollow.

### 6. Authentication and UX fixes
- Updated sign-in behavior to return `User does not exist` for unknown email during login.
- Fixed signup first-name/last-name row alignment and overflow issues in login/signup card.
- Ensured zoneless Angular change detection updates login/signup error states correctly.

---

## Frontend Unit Tests

Current frontend unit test status:
- Total: **129 tests passed**
- Command: `cd frontend && npx ng test --watch=false`

### Test suites and counts

| Spec file | Test count |
|---|---:|
| `src/app/guards/auth.guard.spec.ts` | 2 |
| `src/app/services/post.service.spec.ts` | 24 |
| `src/app/services/auth.service.spec.ts` | 12 |
| `src/app/shared/navbar/navbar.component.spec.ts` | 6 |
| `src/app/pages/search/search.component.spec.ts` | 7 |
| `src/app/pages/write/write.component.spec.ts` | 6 |
| `src/app/pages/login/login.component.spec.ts` | 14 |
| `src/app/pages/feed/feed.component.spec.ts` | 13 |
| `src/app/pages/home/home.component.spec.ts` | 11 |
| `src/app/pages/user-profile/user-profile.component.spec.ts` | 13 |
| `src/app/pages/post-detail/post-detail.component.spec.ts` | 21 |
| **Total** | **129** |

### Coverage summary by area
- Auth guard and route protection.
- Auth service (login, signup, token/session handling).
- Post service (CRUD, likes, comments, follow APIs, counts, search, profile fetches).
- Page components: login, home, feed, write, search, user-profile, post-detail.
- Shared navbar state and follow count behavior.

---

## Backend Unit Tests

Current backend unit test status:
- Total: **69 tests**
- Command: `cd backend && go test ./...`
- Test name listing command: `cd backend && go test -list .`

### Complete backend test list

- `TestGetEnvReturnsValueWhenPresent`
- `TestGetEnvReturnsFallbackWhenMissing`
- `TestGenerateStateReturnsDifferentNonEmptyValues`
- `TestGenerateJWTSignsExpectedClaims`
- `TestRegisterRoutesIncludesExpectedAPIPaths`
- `TestHealthCheckReturnsOK`
- `TestListPostsReturnsOrderedPostsWithUsers`
- `TestCreatePostRequiresAuth`
- `TestCreatePostRejectsInvalidPayload`
- `TestCreatePostCreatesPostForAuthenticatedUser`
- `TestHandleGoogleLoginRedirectsAndSetsCookie`
- `TestHandleGoogleCallbackRejectsInvalidState`
- `TestHandleGoogleCallbackCreatesUserAndRedirectsToFrontend`
- `TestHandleSignupCreatesUserAndReturnsToken`
- `TestHandleSignupRejectsDuplicateEmail`
- `TestHandleSignupRejectsInvalidPayload`
- `TestHandleLoginReturnsTokenForValidCredentials`
- `TestHandleLoginRejectsUnknownUser`
- `TestHandleLoginRejectsOAuthOnlyUser`
- `TestHandleLoginRejectsWrongPassword`
- `TestAuthMiddlewareRejectsMissingToken`
- `TestAuthMiddlewareRejectsInvalidToken`
- `TestGetMeReturnsAuthenticatedUser`
- `TestAuthMiddlewareRejectsTokenForMissingUser`
- `TestListMyPostsReturnsOnlyCurrentUserPosts`
- `TestListMyPostsRequiresAuth`
- `TestGetPostReturnsPostWithCounts`
- `TestGetPostReturns404ForMissingPost`
- `TestUpdatePostUpdatesOwnPost`
- `TestUpdatePostRejectsForeignPost`
- `TestUpdatePostReturns404ForMissingPost`
- `TestUpdatePostRequiresAuth`
- `TestDeletePostDeletesOwnPost`
- `TestDeletePostRejectsForeignPost`
- `TestDeletePostRequiresAuth`
- `TestListCommentsReturnsCommentsInOrder`
- `TestCreateCommentCreatesComment`
- `TestCreateCommentRequiresAuth`
- `TestCreateCommentRejectsEmptyContent`
- `TestCreateCommentRejects404Post`
- `TestDeleteCommentDeletesOwnComment`
- `TestDeleteCommentRejectsForeignComment`
- `TestDeleteCommentReturns404ForMissing`
- `TestToggleLikeCreatesLike`
- `TestToggleLikeRemovesExistingLike`
- `TestToggleLikeRequiresAuth`
- `TestToggleLikeRejects404Post`
- `TestGetLikeStatusReturnsCountAndLikedForAuthUser`
- `TestGetLikeStatusReturnsCountWithoutAuth`
- `TestRegisterRoutesIncludesSprint3Paths`
- `TestSearchUsersReturnsEmptyForBlankQuery`
- `TestSearchUsersFindsMatchingUsers`
- `TestSearchUsersMatchesByEmail`
- `TestSearchUsersReturnsNoMatchesGracefully`
- `TestSearchUsersRequiresAuth`
- `TestGetUserPostsReturnsUserAndPosts`
- `TestGetUserPostsReturns404ForUnknownUser`
- `TestGetUserPostsReturnsEmptyPostsForUserWithNoPosts`
- `TestGetUserPostsIsPublic`
- `TestToggleFollowCreatesFollow`
- `TestToggleFollowUnfollows`
- `TestToggleFollowSelfBlocked`
- `TestToggleFollowRequiresAuth`
- `TestToggleFollow404ForMissingUser`
- `TestGetFollowStatusReturnsCorrectState`
- `TestGetFollowStatusRequiresAuth`
- `TestGetFollowCountsIsPublic`
- `TestFollowCountsAccuracy`
- `TestRegisterRoutesIncludesFollowPaths`

---

## Updated Backend API Documentation

### Base URL
- Backend direct: `http://localhost:8080`
- Frontend proxied: `/api`

### Authentication
- Protected routes require header: `Authorization: Bearer <jwt>`
- JWT is returned by signup/login (and OAuth callback redirect flow).

### API endpoint matrix

| Method | Path | Auth required | Description |
|---|---|---|---|
| GET | `/api/health` | No | Health check |
| GET | `/api/posts` | No | List all posts (newest first) |
| GET | `/api/my-posts` | Yes | List current user's posts |
| POST | `/api/posts` | Yes | Create a post |
| GET | `/api/posts/:id` | No | Get single post |
| PUT | `/api/posts/:id` | Yes | Update own post |
| DELETE | `/api/posts/:id` | Yes | Delete own post |
| GET | `/api/me` | Yes | Current user profile |
| GET | `/api/posts/:id/comments` | No | List comments for post |
| POST | `/api/posts/:id/comments` | Yes | Create comment |
| DELETE | `/api/comments/:id` | Yes | Delete own comment |
| POST | `/api/posts/:id/like` | Yes | Toggle like |
| GET | `/api/posts/:id/like` | Optional | Get like count and liked state |
| GET | `/api/users/search?q=<query>` | Yes | Search users by name/email |
| GET | `/api/users/:id/posts` | No | User profile + posts |
| POST | `/api/users/:id/follow` | Yes | Follow/unfollow toggle |
| GET | `/api/users/:id/follow-status` | Yes | Current user follow relationship + counts |
| GET | `/api/users/:id/counts` | No | Public follow counts |
| GET | `/api/users/:id/followers` | No | List users who follow this user |
| GET | `/api/users/:id/following` | No | List users this user follows |
| GET | `/api/auth/google` | No | Start Google OAuth |
| GET | `/api/auth/callback` | No | OAuth callback |
| POST | `/api/auth/signup` | No | Signup via email/password |
| POST | `/api/auth/login` | No | Login via email/password |

### Key request/response examples

#### 1) Login
`POST /api/auth/login`

Request body:

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

Success response (`200`):

```json
{
  "token": "<jwt>",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

Known error responses:
- `401` unknown email:

```json
{
  "error": "User does not exist"
}
```

- `401` OAuth-only account:

```json
{
  "error": "This account uses Google OAuth. Please sign in with Google."
}
```

- `401` wrong password:

```json
{
  "error": "Invalid email or password"
}
```

#### 2) Follow toggle
`POST /api/users/:id/follow`

Success response (`200`):

```json
{
  "following": true,
  "follower_count": 6,
  "following_count": 3
}
```

#### 3) Followers list
`GET /api/users/:id/followers`

Success response (`200`):

```json
[
  {
    "id": "follower-user-id",
    "name": "Follower Name",
    "email": "follower@example.com",
    "picture": ""
  }
]
```

#### 4) Following list
`GET /api/users/:id/following`

Success response (`200`):

```json
[
  {
    "id": "following-user-id",
    "name": "Following Name",
    "email": "following@example.com",
    "picture": ""
  }
]
```

#### 5) Follow counts
`GET /api/users/:id/counts`

Success response (`200`):

```json
{
  "follower_count": 6,
  "following_count": 3
}
```

---

## Sprint 3 Final Test Snapshot

- Frontend: **129/129 tests passed**
- Backend: **69 tests available and passing**

