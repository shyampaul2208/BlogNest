# Sprint 4

## Work Completed in Sprint 4

Sprint 4 delivered image upload support across the full stack, thumbnails in the feed and home pages, image editing in post-detail, and a fix for the explore feed showing empty results for the logged-in user.

### 1. Image upload endpoint (backend)
- Added `POST /api/upload` authenticated endpoint accepting `multipart/form-data`.
- Validates file extension (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`) and enforces a 5 MB size limit.
- Saves uploaded file to `./uploads/` directory with a UUID-based filename to prevent collisions.
- Returns `{"url": "/uploads/<uuid>.<ext>"}` on success.
- Registered static file serving so `/uploads/*` paths are reachable from the browser.

### 2. Image URL persisted on posts (backend)
- Extended `Post` model with an `ImageURL` field stored in the database.
- Updated `POST /api/posts` and `PUT /api/posts/:id` handlers to accept and persist an optional `image_url` field from the request body.
- `image_url` is returned in all list and detail post responses.

### 3. Cover image upload in write form (frontend)
- Added image upload UI to the Write (new post) page with a click-to-upload area and file input.
- Client-side validation rejects non-image MIME types and files over 5 MB with inline error messages.
- Shows a preview of the selected image with a remove button before publishing.
- On publish, if a file is selected the component calls `POST /api/upload` first, receives the URL, then calls `createPost` with that URL. If no file is selected, `createPost` is called without an image URL.

### 4. Image display and edit in post-detail (frontend)
- In view mode, the post-detail page renders the post's cover image below the title when one exists.
- In edit mode, the existing image is pre-populated with a remove option; user can keep, replace, or clear it.
- On save, if a new file was selected it is uploaded first and the returned URL is saved; otherwise the existing URL (or empty string to clear) is passed to `updatePost`.

### 5. Image thumbnails in feed and home (frontend)
- Posts with an `imageUrl` display a thumbnail below the post title in both the Feed (explore) and Home pages.
- Thumbnails use `object-fit: cover` at a fixed height (180 px in feed, 160 px in home) for consistent layout.

### 6. Fix: feed explore tab shows all posts (frontend)
- The feed component was filtering out posts authored by the logged-in user, causing an empty explore tab after publishing.
- Removed the per-user filter so the feed now displays all posts from all authors.

### 7. Angular dev proxy for uploaded images (frontend)
- Added `/uploads` entry to `proxy.conf.json` forwarding image requests to `http://localhost:8080` during local development.

---

## Frontend Unit Tests

Current frontend unit test status:
- Total: **155 tests passed**
- Command: `cd frontend && npm test`

### Test suites and counts

| Spec file | Test count |
|---|---:|
| `src/app/guards/auth.guard.spec.ts` | 2 |
| `src/app/services/auth.service.spec.ts` | 12 |
| `src/app/services/post.service.spec.ts` | 32 |
| `src/app/shared/navbar/navbar.component.spec.ts` | 6 |
| `src/app/pages/search/search.component.spec.ts` | 7 |
| `src/app/pages/login/login.component.spec.ts` | 14 |
| `src/app/pages/home/home.component.spec.ts` | 11 |
| `src/app/pages/write/write.component.spec.ts` | 13 |
| `src/app/pages/feed/feed.component.spec.ts` | 16 |
| `src/app/pages/user-profile/user-profile.component.spec.ts` | 13 |
| `src/app/pages/post-detail/post-detail.component.spec.ts` | 29 |
| **Total** | **155** |

### Sprint 4 tests added per spec file

#### post.service.spec.ts (9 new tests)
- uploadImage sends POST /api/upload with FormData and auth header
- createPost sends provided imageUrl as image_url in request body
- createPost sends empty image_url when imageUrl argument is omitted
- updatePost sends provided imageUrl as image_url in request body
- updatePost sends empty image_url when imageUrl argument is omitted
- normalize maps image_url from lowercase field to imageUrl
- normalize maps ImageURL from PascalCase field to imageUrl
- normalize sets imageUrl to undefined when no image field present
- (fixed) createPost and updatePost existing tests updated for new image_url field in body

#### write.component.spec.ts (7 new tests)
- onFileSelected sets selectedFile and imagePreview for a valid image
- onFileSelected sets uploadError for an invalid file type
- onFileSelected sets uploadError when file exceeds 5 MB
- removeImage clears selectedFile, imagePreview, and uploadError
- publish uploads image then calls createPost with returned URL when file is selected
- publish calls createPost with undefined when no file is selected
- publish sets error when uploadImage fails

#### feed.component.spec.ts (3 new tests)
- includes posts with imageUrl in the feed
- includes posts without imageUrl in the feed
- shows own posts in feed (no self-filtering)

#### post-detail.component.spec.ts (8 new tests)
- startEdit populates editImageUrl from post imageUrl
- startEdit sets editImageUrl to empty string when post has no imageUrl
- removeEditImage clears editImageUrl, editImageFile, editImagePreview
- saveEdit passes existing editImageUrl when no new file is selected
- saveEdit uploads new image file then saves with returned url
- onEditFileSelected accepts valid image
- onEditFileSelected rejects invalid file type
- onEditFileSelected rejects file larger than 5 MB

---

## Backend Unit Tests

Current backend unit test status:
- Total: **80 tests**
- Command: `cd backend && go test ./...`

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
- `TestRegisterRoutesIncludesSprint4UploadPath`
- `TestUploadImageRequiresAuth`
- `TestUploadImageRejectsMissingFile`
- `TestUploadImageRejectsDisallowedFileType`
- `TestUploadImageRejectsFileTooLarge`
- `TestUploadImageSavesFileAndReturnsURL`
- `TestCreatePostStoresImageURL`
- `TestCreatePostWithoutImageURLSucceeds`
- `TestUpdatePostUpdatesImageURL`
- `TestUpdatePostClearsImageURL`
- `TestListPostsIncludesImageURLField`

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
| POST | `/api/upload` | Yes | Upload image file, returns URL |
| GET | `/api/auth/google` | No | Start Google OAuth |
| GET | `/api/auth/callback` | No | OAuth callback |
| POST | `/api/auth/signup` | No | Signup via email/password |
| POST | `/api/auth/login` | No | Login via email/password |

### Key request/response examples

#### 1) Upload image
`POST /api/upload`

Request: `multipart/form-data` with field `image` containing the file.

Headers:
```http
Authorization: Bearer <jwt>
Content-Type: multipart/form-data
```

Success response (`200`):
```json
{
  "url": "/uploads/a3f2c1d4-uuid.jpg"
}
```

Possible errors:
- `400` — missing file, disallowed extension, or file exceeds 5 MB
- `401` — no or invalid JWT
- `500` — failed to save file

#### 2) Create post with image
`POST /api/posts`

Request body:
```json
{
  "title": "My post",
  "content": "Post body",
  "image_url": "/uploads/a3f2c1d4-uuid.jpg"
}
```

Success response (`201`):
```json
{
  "id": "post-id",
  "user_id": "user-id",
  "title": "My post",
  "content": "Post body",
  "image_url": "/uploads/a3f2c1d4-uuid.jpg",
  "CreatedAt": "2026-04-29T10:00:00Z",
  "UpdatedAt": "2026-04-29T10:00:00Z"
}
```

#### 3) Update post with image
`PUT /api/posts/:id`

Request body:
```json
{
  "title": "Updated title",
  "content": "Updated body",
  "image_url": "/uploads/new-uuid.png"
}
```

Success response (`200`):
```json
{
  "id": "post-id",
  "user_id": "user-id",
  "title": "Updated title",
  "content": "Updated body",
  "image_url": "/uploads/new-uuid.png",
  "CreatedAt": "2026-04-29T10:00:00Z",
  "UpdatedAt": "2026-04-29T11:00:00Z"
}
```

---

## Sprint 4 Final Test Snapshot

- Frontend: **155/155 tests passed**
- Backend: **80 tests available and passing**
