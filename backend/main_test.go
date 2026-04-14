package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:test-%d?mode=memory&cache=shared", time.Now().UnixNano())
	testDB, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}

	if err := testDB.AutoMigrate(&User{}, &Post{}, &Comment{}, &Like{}, &Follow{}); err != nil {
		t.Fatalf("migrate test db: %v", err)
	}

	db = testDB
	return testDB
}

func setupTestRouter(t *testing.T) *gin.Engine {
	t.Helper()

	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", "test-secret")
	frontendURL = "http://localhost:4200"
	googleUserInfoURL = "https://www.googleapis.com/oauth2/v2/userinfo"
	oauthConfig = &oauth2.Config{
		ClientID:     "client-id",
		ClientSecret: "client-secret",
		RedirectURL:  "http://localhost:8080/api/auth/callback",
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://accounts.example.test/o/oauth2/auth",
			TokenURL: "https://accounts.example.test/o/oauth2/token",
		},
	}

	setupTestDB(t)

	router := gin.New()
	registerRoutes(router)
	return router
}

func performRequest(router http.Handler, method string, path string, body []byte, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	if body != nil && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	return recorder
}

func createTestUser(t *testing.T, email string, password string) User {
	t.Helper()

	user := User{
		ID:        fmt.Sprintf("user-%d", time.Now().UnixNano()),
		Email:     email,
		FirstName: "Test",
		LastName:  "User",
		Name:      "Test User",
	}

	if password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			t.Fatalf("hash password: %v", err)
		}
		user.Password = string(hash)
	}

	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	return user
}

func createTokenForUser(t *testing.T, userID string) string {
	t.Helper()

	token, err := generateJWT(userID)
	if err != nil {
		t.Fatalf("generate jwt: %v", err)
	}

	return token
}

func decodeJSONBody(t *testing.T, recorder *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response json: %v", err)
	}

	return payload
}

func TestGetEnvReturnsValueWhenPresent(t *testing.T) {
	t.Setenv("APP_MODE", "test")

	if value := getEnv("APP_MODE", "fallback"); value != "test" {
		t.Fatalf("expected env value, got %q", value)
	}
}

func TestGetEnvReturnsFallbackWhenMissing(t *testing.T) {
	_ = os.Unsetenv("MISSING_ENV")

	if value := getEnv("MISSING_ENV", "fallback"); value != "fallback" {
		t.Fatalf("expected fallback, got %q", value)
	}
}

func TestGenerateStateReturnsDifferentNonEmptyValues(t *testing.T) {
	first := generateState()
	second := generateState()

	if first == "" || second == "" {
		t.Fatal("expected non-empty oauth states")
	}

	if first == second {
		t.Fatal("expected generated states to differ")
	}
}

func TestGenerateJWTSignsExpectedClaims(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	tokenString, err := generateJWT("user-123")
	if err != nil {
		t.Fatalf("generate jwt: %v", err)
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte("test-secret"), nil
	})
	if err != nil {
		t.Fatalf("parse jwt: %v", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatal("expected jwt map claims")
	}

	if claims["user_id"] != "user-123" {
		t.Fatalf("expected user_id claim, got %#v", claims["user_id"])
	}
}

func TestRegisterRoutesIncludesExpectedAPIPaths(t *testing.T) {
	router := setupTestRouter(t)
	routes := router.Routes()

	expected := map[string]bool{
		"GET /api/health":        false,
		"GET /api/posts":         false,
		"POST /api/posts":        false,
		"GET /api/me":            false,
		"GET /api/auth/google":   false,
		"GET /api/auth/callback": false,
		"POST /api/auth/signup":  false,
		"POST /api/auth/login":   false,
	}

	for _, route := range routes {
		key := route.Method + " " + route.Path
		if _, ok := expected[key]; ok {
			expected[key] = true
		}
	}

	for route, found := range expected {
		if !found {
			t.Fatalf("expected route %s to be registered", route)
		}
	}
}

func TestHealthCheckReturnsOK(t *testing.T) {
	router := setupTestRouter(t)
	recorder := performRequest(router, http.MethodGet, "/api/health", nil, nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	body := decodeJSONBody(t, recorder)
	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %#v", body["status"])
	}
}

func TestListPostsReturnsOrderedPostsWithUsers(t *testing.T) {
	router := setupTestRouter(t)
	firstUser := createTestUser(t, "first@example.com", "secret123")
	secondUser := createTestUser(t, "second@example.com", "secret123")

	older := time.Now().Add(-2 * time.Hour)
	newer := time.Now().Add(-1 * time.Hour)
	posts := []Post{
		{ID: "post-old", UserID: firstUser.ID, Title: "Older", Content: "Older content", CreatedAt: older, UpdatedAt: older},
		{ID: "post-new", UserID: secondUser.ID, Title: "Newer", Content: "Newer content", CreatedAt: newer, UpdatedAt: newer},
	}
	if err := db.Create(&posts).Error; err != nil {
		t.Fatalf("create posts: %v", err)
	}

	recorder := performRequest(router, http.MethodGet, "/api/posts", nil, nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	var response []Post
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode posts response: %v", err)
	}

	if len(response) != 2 {
		t.Fatalf("expected 2 posts, got %d", len(response))
	}

	if response[0].ID != "post-new" {
		t.Fatalf("expected newest post first, got %s", response[0].ID)
	}

	if response[0].User.Email != "second@example.com" {
		t.Fatalf("expected preloaded user on newest post, got %#v", response[0].User.Email)
	}
}

func TestCreatePostRequiresAuth(t *testing.T) {
	router := setupTestRouter(t)
	body := []byte(`{"title":"My first post","content":"Hello BlogNest"}`)
	recorder := performRequest(router, http.MethodPost, "/api/posts", body, nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func TestCreatePostRejectsInvalidPayload(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "writer@example.com", "secret123")
	token := createTokenForUser(t, user.ID)
	body := []byte(`{"title":"","content":""}`)
	recorder := performRequest(router, http.MethodPost, "/api/posts", body, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
}

func TestCreatePostCreatesPostForAuthenticatedUser(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "writer@example.com", "secret123")
	token := createTokenForUser(t, user.ID)
	body := []byte(`{"title":"My first post","content":"Hello BlogNest"}`)
	recorder := performRequest(router, http.MethodPost, "/api/posts", body, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var response Post
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode created post: %v", err)
	}

	if response.Title != "My first post" || response.Content != "Hello BlogNest" {
		t.Fatalf("unexpected post payload: %#v", response)
	}

	if response.UserID != user.ID {
		t.Fatalf("expected post user id %s, got %s", user.ID, response.UserID)
	}
}

func TestHandleGoogleLoginRedirectsAndSetsCookie(t *testing.T) {
	router := setupTestRouter(t)
	recorder := performRequest(router, http.MethodGet, "/api/auth/google", nil, nil)

	if recorder.Code != http.StatusTemporaryRedirect {
		t.Fatalf("expected 307, got %d", recorder.Code)
	}

	location := recorder.Header().Get("Location")
	if !strings.HasPrefix(location, "https://accounts.example.test/o/oauth2/auth") {
		t.Fatalf("expected oauth redirect, got %q", location)
	}

	setCookie := recorder.Header().Get("Set-Cookie")
	if !strings.Contains(setCookie, "oauth_state=") {
		t.Fatalf("expected oauth_state cookie, got %q", setCookie)
	}
}

func TestHandleGoogleCallbackRejectsInvalidState(t *testing.T) {
	router := setupTestRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/api/auth/callback?state=wrong&code=abc", nil)
	req.AddCookie(&http.Cookie{Name: "oauth_state", Value: "expected"})
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}

	body := decodeJSONBody(t, recorder)
	if body["error"] != "Invalid state" {
		t.Fatalf("expected invalid state error, got %#v", body["error"])
	}
}

func TestHandleGoogleCallbackCreatesUserAndRedirectsToFrontend(t *testing.T) {
	router := setupTestRouter(t)
	oauthServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/token":
			writer.Header().Set("Content-Type", "application/json")
			_, _ = writer.Write([]byte(`{"access_token":"access-token","token_type":"Bearer"}`))
		case "/userinfo":
			writer.Header().Set("Content-Type", "application/json")
			_, _ = writer.Write([]byte(`{"id":"google-123","email":"google@example.com","name":"Google User","picture":"https://example.com/avatar.png"}`))
		default:
			http.NotFound(writer, request)
		}
	}))
	defer oauthServer.Close()

	oauthConfig = &oauth2.Config{
		ClientID:     "client-id",
		ClientSecret: "client-secret",
		RedirectURL:  "http://localhost:8080/api/auth/callback",
		Endpoint: oauth2.Endpoint{
			AuthURL:  oauthServer.URL + "/auth",
			TokenURL: oauthServer.URL + "/token",
		},
	}
	googleUserInfoURL = oauthServer.URL + "/userinfo"

	values := url.Values{}
	values.Set("state", "valid-state")
	values.Set("code", "auth-code")
	req := httptest.NewRequest(http.MethodGet, "/api/auth/callback?"+values.Encode(), nil)
	req.AddCookie(&http.Cookie{Name: "oauth_state", Value: "valid-state"})
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusTemporaryRedirect {
		t.Fatalf("expected 307, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	location := recorder.Header().Get("Location")
	if !strings.HasPrefix(location, frontendURL+"/login?token=") {
		t.Fatalf("expected frontend redirect with token, got %q", location)
	}

	var user User
	if err := db.Where("google_id = ?", "google-123").First(&user).Error; err != nil {
		t.Fatalf("lookup google user: %v", err)
	}

	if user.Email != "google@example.com" {
		t.Fatalf("expected google user to be created, got %q", user.Email)
	}
}

func TestHandleSignupCreatesUserAndReturnsToken(t *testing.T) {
	router := setupTestRouter(t)
	body := []byte(`{"first_name":"Test","last_name":"User","email":"user@example.com","password":"secret123"}`)
	recorder := performRequest(router, http.MethodPost, "/api/auth/signup", body, nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	payload := decodeJSONBody(t, recorder)
	if payload["token"] == "" {
		t.Fatal("expected token in signup response")
	}

	var user User
	if err := db.Where("email = ?", "user@example.com").First(&user).Error; err != nil {
		t.Fatalf("lookup user: %v", err)
	}

	if user.Name != "Test User" {
		t.Fatalf("expected full name to be built, got %q", user.Name)
	}

	if user.Password == "secret123" || user.Password == "" {
		t.Fatal("expected stored password hash")
	}
}

func TestHandleSignupRejectsDuplicateEmail(t *testing.T) {
	router := setupTestRouter(t)
	createTestUser(t, "duplicate@example.com", "secret123")
	body := []byte(`{"first_name":"Test","last_name":"User","email":"duplicate@example.com","password":"secret123"}`)
	recorder := performRequest(router, http.MethodPost, "/api/auth/signup", body, nil)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["error"] != "Email already registered" {
		t.Fatalf("expected duplicate email error, got %#v", payload["error"])
	}
}

func TestHandleSignupRejectsInvalidPayload(t *testing.T) {
	router := setupTestRouter(t)
	body := []byte(`{"first_name":"Test","last_name":"User","email":"bad-email","password":"123"}`)
	recorder := performRequest(router, http.MethodPost, "/api/auth/signup", body, nil)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
}

func TestHandleLoginReturnsTokenForValidCredentials(t *testing.T) {
	router := setupTestRouter(t)
	createTestUser(t, "login@example.com", "secret123")
	body := []byte(`{"email":"login@example.com","password":"secret123"}`)
	recorder := performRequest(router, http.MethodPost, "/api/auth/login", body, nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	payload := decodeJSONBody(t, recorder)
	if payload["token"] == "" {
		t.Fatal("expected token in login response")
	}
}

func TestHandleLoginRejectsUnknownUser(t *testing.T) {
	router := setupTestRouter(t)
	body := []byte(`{"email":"missing@example.com","password":"secret123"}`)
	recorder := performRequest(router, http.MethodPost, "/api/auth/login", body, nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["error"] != "User does not exist" {
		t.Fatalf("expected user does not exist error, got %#v", payload["error"])
	}
}

func TestHandleLoginRejectsOAuthOnlyUser(t *testing.T) {
	router := setupTestRouter(t)
	createTestUser(t, "oauth@example.com", "")
	body := []byte(`{"email":"oauth@example.com","password":"secret123"}`)
	recorder := performRequest(router, http.MethodPost, "/api/auth/login", body, nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["error"] != "This account uses Google OAuth. Please sign in with Google." {
		t.Fatalf("expected oauth-only error, got %#v", payload["error"])
	}
}

func TestHandleLoginRejectsWrongPassword(t *testing.T) {
	router := setupTestRouter(t)
	createTestUser(t, "login@example.com", "secret123")
	body := []byte(`{"email":"login@example.com","password":"wrongpass"}`)
	recorder := performRequest(router, http.MethodPost, "/api/auth/login", body, nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["error"] != "Invalid email or password" {
		t.Fatalf("expected invalid credentials error, got %#v", payload["error"])
	}
}

func TestAuthMiddlewareRejectsMissingToken(t *testing.T) {
	router := setupTestRouter(t)
	recorder := performRequest(router, http.MethodGet, "/api/me", nil, nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["error"] != "No token" {
		t.Fatalf("expected no token error, got %#v", payload["error"])
	}
}

func TestAuthMiddlewareRejectsInvalidToken(t *testing.T) {
	router := setupTestRouter(t)
	recorder := performRequest(router, http.MethodGet, "/api/me", nil, map[string]string{
		"Authorization": "Bearer not-a-valid-token",
	})

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["error"] != "Invalid token" {
		t.Fatalf("expected invalid token error, got %#v", payload["error"])
	}
}

func TestGetMeReturnsAuthenticatedUser(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "me@example.com", "secret123")
	token := createTokenForUser(t, user.ID)
	recorder := performRequest(router, http.MethodGet, "/api/me", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var response User
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode me response: %v", err)
	}

	if response.Email != "me@example.com" {
		t.Fatalf("expected authenticated user, got %q", response.Email)
	}
}

func TestAuthMiddlewareRejectsTokenForMissingUser(t *testing.T) {
	router := setupTestRouter(t)
	token := createTokenForUser(t, "missing-user")
	recorder := performRequest(router, http.MethodGet, "/api/me", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["error"] != "User not found" {
		t.Fatalf("expected user not found error, got %#v", payload["error"])
	}
}

func TestListMyPostsReturnsOnlyCurrentUserPosts(t *testing.T) {
	router := setupTestRouter(t)
	me := createTestUser(t, "me@example.com", "secret123")
	other := createTestUser(t, "other@example.com", "secret123")
	token := createTokenForUser(t, me.ID)

	now := time.Now()
	posts := []Post{
		{ID: "post-mine-1", UserID: me.ID, Title: "My Post", Content: "My content", CreatedAt: now.Add(-2 * time.Hour), UpdatedAt: now.Add(-2 * time.Hour)},
		{ID: "post-other", UserID: other.ID, Title: "Other Post", Content: "Other content", CreatedAt: now.Add(-1 * time.Hour), UpdatedAt: now.Add(-1 * time.Hour)},
		{ID: "post-mine-2", UserID: me.ID, Title: "My Second Post", Content: "More content", CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(&posts).Error; err != nil {
		t.Fatalf("create posts: %v", err)
	}

	recorder := performRequest(router, http.MethodGet, "/api/my-posts", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var response []Post
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode my-posts response: %v", err)
	}

	if len(response) != 2 {
		t.Fatalf("expected 2 posts for current user, got %d", len(response))
	}

	// Newest first
	if response[0].ID != "post-mine-2" {
		t.Fatalf("expected newest post first, got %s", response[0].ID)
	}

	// Verify no other user's posts leaked
	for _, p := range response {
		if p.UserID != me.ID {
			t.Fatalf("expected only current user's posts, got userId=%s", p.UserID)
		}
	}
}

func TestListMyPostsRequiresAuth(t *testing.T) {
	router := setupTestRouter(t)
	recorder := performRequest(router, http.MethodGet, "/api/my-posts", nil, nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

// ======== Sprint 3 Tests ========

// --- GET /api/posts/:id ---

func TestGetPostReturnsPostWithCounts(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "author@example.com", "secret123")
	post := Post{ID: "post-detail", UserID: user.ID, Title: "Detail Post", Content: "Detail body"}
	db.Create(&post)

	// Add a comment and a like
	db.Create(&Comment{ID: "c1", PostID: "post-detail", UserID: user.ID, Content: "Nice"})
	db.Create(&Like{ID: "l1", PostID: "post-detail", UserID: user.ID})

	recorder := performRequest(router, http.MethodGet, "/api/posts/post-detail", nil, nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	payload := decodeJSONBody(t, recorder)
	postData, ok := payload["post"].(map[string]any)
	if !ok {
		t.Fatal("expected post object in response")
	}
	if postData["title"] != "Detail Post" {
		t.Fatalf("expected title, got %#v", postData["title"])
	}
	if payload["comment_count"] != float64(1) {
		t.Fatalf("expected comment_count 1, got %v", payload["comment_count"])
	}
	if payload["like_count"] != float64(1) {
		t.Fatalf("expected like_count 1, got %v", payload["like_count"])
	}
}

func TestGetPostReturns404ForMissingPost(t *testing.T) {
	router := setupTestRouter(t)
	recorder := performRequest(router, http.MethodGet, "/api/posts/nonexistent", nil, nil)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
}

// --- PUT /api/posts/:id ---

func TestUpdatePostUpdatesOwnPost(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "author@example.com", "secret123")
	token := createTokenForUser(t, user.ID)
	post := Post{ID: "post-edit", UserID: user.ID, Title: "Old Title", Content: "Old Content"}
	db.Create(&post)

	body := []byte(`{"title":"New Title","content":"New Content"}`)
	recorder := performRequest(router, http.MethodPut, "/api/posts/post-edit", body, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var response Post
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Title != "New Title" || response.Content != "New Content" {
		t.Fatalf("unexpected update result: %#v", response)
	}
}

func TestUpdatePostRejectsForeignPost(t *testing.T) {
	router := setupTestRouter(t)
	owner := createTestUser(t, "owner@example.com", "secret123")
	other := createTestUser(t, "other@example.com", "secret123")
	otherToken := createTokenForUser(t, other.ID)
	post := Post{ID: "post-foreign", UserID: owner.ID, Title: "Owned", Content: "Content"}
	db.Create(&post)

	body := []byte(`{"title":"Hacked","content":"Hacked"}`)
	recorder := performRequest(router, http.MethodPut, "/api/posts/post-foreign", body, map[string]string{
		"Authorization": "Bearer " + otherToken,
	})

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", recorder.Code)
	}
}

func TestUpdatePostReturns404ForMissingPost(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "author@example.com", "secret123")
	token := createTokenForUser(t, user.ID)
	body := []byte(`{"title":"X","content":"Y"}`)
	recorder := performRequest(router, http.MethodPut, "/api/posts/missing-post", body, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
}

func TestUpdatePostRequiresAuth(t *testing.T) {
	router := setupTestRouter(t)
	recorder := performRequest(router, http.MethodPut, "/api/posts/any-id", []byte(`{"title":"X","content":"Y"}`), nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

// --- DELETE /api/posts/:id ---

func TestDeletePostDeletesOwnPost(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "author@example.com", "secret123")
	token := createTokenForUser(t, user.ID)
	post := Post{ID: "post-del", UserID: user.ID, Title: "Delete Me", Content: "Body"}
	db.Create(&post)
	db.Create(&Comment{ID: "cd1", PostID: "post-del", UserID: user.ID, Content: "Comment"})
	db.Create(&Like{ID: "ld1", PostID: "post-del", UserID: user.ID})

	recorder := performRequest(router, http.MethodDelete, "/api/posts/post-del", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	// Verify post is gone
	var p Post
	if err := db.First(&p, "id = ?", "post-del").Error; err == nil {
		t.Fatal("expected post to be deleted")
	}

	// Verify associated comments and likes are gone
	var cCount int64
	db.Model(&Comment{}).Where("post_id = ?", "post-del").Count(&cCount)
	if cCount != 0 {
		t.Fatalf("expected 0 comments, got %d", cCount)
	}
	var lCount int64
	db.Model(&Like{}).Where("post_id = ?", "post-del").Count(&lCount)
	if lCount != 0 {
		t.Fatalf("expected 0 likes, got %d", lCount)
	}
}

func TestDeletePostRejectsForeignPost(t *testing.T) {
	router := setupTestRouter(t)
	owner := createTestUser(t, "owner@example.com", "secret123")
	other := createTestUser(t, "other@example.com", "secret123")
	otherToken := createTokenForUser(t, other.ID)
	post := Post{ID: "post-nodelete", UserID: owner.ID, Title: "No Delete", Content: "Content"}
	db.Create(&post)

	recorder := performRequest(router, http.MethodDelete, "/api/posts/post-nodelete", nil, map[string]string{
		"Authorization": "Bearer " + otherToken,
	})

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", recorder.Code)
	}
}

func TestDeletePostRequiresAuth(t *testing.T) {
	router := setupTestRouter(t)
	recorder := performRequest(router, http.MethodDelete, "/api/posts/any-id", nil, nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

// --- Comments ---

func TestListCommentsReturnsCommentsInOrder(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "commenter@example.com", "secret123")
	post := Post{ID: "post-comments", UserID: user.ID, Title: "Post", Content: "Body"}
	db.Create(&post)

	now := time.Now()
	db.Create(&Comment{ID: "c-old", PostID: "post-comments", UserID: user.ID, Content: "First", CreatedAt: now.Add(-1 * time.Hour)})
	db.Create(&Comment{ID: "c-new", PostID: "post-comments", UserID: user.ID, Content: "Second", CreatedAt: now})

	recorder := performRequest(router, http.MethodGet, "/api/posts/post-comments/comments", nil, nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	var comments []Comment
	if err := json.Unmarshal(recorder.Body.Bytes(), &comments); err != nil {
		t.Fatalf("decode comments: %v", err)
	}
	if len(comments) != 2 {
		t.Fatalf("expected 2 comments, got %d", len(comments))
	}
	if comments[0].ID != "c-old" {
		t.Fatalf("expected oldest first, got %s", comments[0].ID)
	}
	if comments[0].User.Email == "" {
		t.Fatal("expected user preloaded on comment")
	}
}

func TestCreateCommentCreatesComment(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "commenter@example.com", "secret123")
	token := createTokenForUser(t, user.ID)
	post := Post{ID: "post-c", UserID: user.ID, Title: "Post", Content: "Body"}
	db.Create(&post)

	body := []byte(`{"content":"Great post!"}`)
	recorder := performRequest(router, http.MethodPost, "/api/posts/post-c/comments", body, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var comment Comment
	if err := json.Unmarshal(recorder.Body.Bytes(), &comment); err != nil {
		t.Fatalf("decode comment: %v", err)
	}
	if comment.Content != "Great post!" {
		t.Fatalf("unexpected comment content: %q", comment.Content)
	}
	if comment.PostID != "post-c" {
		t.Fatalf("expected post_id post-c, got %q", comment.PostID)
	}
}

func TestCreateCommentRequiresAuth(t *testing.T) {
	router := setupTestRouter(t)
	recorder := performRequest(router, http.MethodPost, "/api/posts/any/comments", []byte(`{"content":"Hi"}`), nil)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func TestCreateCommentRejectsEmptyContent(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "commenter@example.com", "secret123")
	token := createTokenForUser(t, user.ID)
	post := Post{ID: "post-empty-c", UserID: user.ID, Title: "Post", Content: "Body"}
	db.Create(&post)

	body := []byte(`{"content":"   "}`)
	recorder := performRequest(router, http.MethodPost, "/api/posts/post-empty-c/comments", body, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
}

func TestCreateCommentRejects404Post(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "commenter@example.com", "secret123")
	token := createTokenForUser(t, user.ID)

	body := []byte(`{"content":"Hello"}`)
	recorder := performRequest(router, http.MethodPost, "/api/posts/missing/comments", body, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
}

func TestDeleteCommentDeletesOwnComment(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "commenter@example.com", "secret123")
	token := createTokenForUser(t, user.ID)
	db.Create(&Comment{ID: "c-del", PostID: "post-x", UserID: user.ID, Content: "Delete me"})

	recorder := performRequest(router, http.MethodDelete, "/api/comments/c-del", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
}

func TestDeleteCommentRejectsForeignComment(t *testing.T) {
	router := setupTestRouter(t)
	owner := createTestUser(t, "owner@example.com", "secret123")
	other := createTestUser(t, "other@example.com", "secret123")
	otherToken := createTokenForUser(t, other.ID)
	db.Create(&Comment{ID: "c-foreign", PostID: "post-x", UserID: owner.ID, Content: "Not yours"})

	recorder := performRequest(router, http.MethodDelete, "/api/comments/c-foreign", nil, map[string]string{
		"Authorization": "Bearer " + otherToken,
	})

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", recorder.Code)
	}
}

func TestDeleteCommentReturns404ForMissing(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "commenter@example.com", "secret123")
	token := createTokenForUser(t, user.ID)

	recorder := performRequest(router, http.MethodDelete, "/api/comments/missing", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
}

// --- Likes ---

func TestToggleLikeCreatesLike(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "liker@example.com", "secret123")
	token := createTokenForUser(t, user.ID)
	post := Post{ID: "post-like", UserID: user.ID, Title: "Like Me", Content: "Body"}
	db.Create(&post)

	recorder := performRequest(router, http.MethodPost, "/api/posts/post-like/like", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	payload := decodeJSONBody(t, recorder)
	if payload["liked"] != true {
		t.Fatalf("expected liked=true, got %v", payload["liked"])
	}
	if payload["like_count"] != float64(1) {
		t.Fatalf("expected like_count=1, got %v", payload["like_count"])
	}
}

func TestToggleLikeRemovesExistingLike(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "liker@example.com", "secret123")
	token := createTokenForUser(t, user.ID)
	post := Post{ID: "post-unlike", UserID: user.ID, Title: "Unlike Me", Content: "Body"}
	db.Create(&post)
	db.Create(&Like{ID: "like-existing", PostID: "post-unlike", UserID: user.ID})

	recorder := performRequest(router, http.MethodPost, "/api/posts/post-unlike/like", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["liked"] != false {
		t.Fatalf("expected liked=false, got %v", payload["liked"])
	}
	if payload["like_count"] != float64(0) {
		t.Fatalf("expected like_count=0, got %v", payload["like_count"])
	}
}

func TestToggleLikeRequiresAuth(t *testing.T) {
	router := setupTestRouter(t)
	recorder := performRequest(router, http.MethodPost, "/api/posts/any/like", nil, nil)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func TestToggleLikeRejects404Post(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "liker@example.com", "secret123")
	token := createTokenForUser(t, user.ID)

	recorder := performRequest(router, http.MethodPost, "/api/posts/missing/like", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
}

func TestGetLikeStatusReturnsCountAndLikedForAuthUser(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "liker@example.com", "secret123")
	token := createTokenForUser(t, user.ID)
	post := Post{ID: "post-ls", UserID: user.ID, Title: "Status", Content: "Body"}
	db.Create(&post)
	db.Create(&Like{ID: "like-ls", PostID: "post-ls", UserID: user.ID})

	recorder := performRequest(router, http.MethodGet, "/api/posts/post-ls/like", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["liked"] != true {
		t.Fatalf("expected liked=true, got %v", payload["liked"])
	}
	if payload["like_count"] != float64(1) {
		t.Fatalf("expected like_count=1, got %v", payload["like_count"])
	}
}

func TestGetLikeStatusReturnsCountWithoutAuth(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "author@example.com", "secret123")
	post := Post{ID: "post-ls2", UserID: user.ID, Title: "Public", Content: "Body"}
	db.Create(&post)
	db.Create(&Like{ID: "like-ls2", PostID: "post-ls2", UserID: user.ID})

	recorder := performRequest(router, http.MethodGet, "/api/posts/post-ls2/like", nil, nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["liked"] != false {
		t.Fatalf("expected liked=false for unauthenticated, got %v", payload["liked"])
	}
	if payload["like_count"] != float64(1) {
		t.Fatalf("expected like_count=1, got %v", payload["like_count"])
	}
}

// --- Route registration for new endpoints ---

func TestRegisterRoutesIncludesSprint3Paths(t *testing.T) {
	router := setupTestRouter(t)
	routes := router.Routes()

	expected := map[string]bool{
		"GET /api/posts/:id":           false,
		"PUT /api/posts/:id":           false,
		"DELETE /api/posts/:id":        false,
		"GET /api/posts/:id/comments":  false,
		"POST /api/posts/:id/comments": false,
		"DELETE /api/comments/:id":     false,
		"POST /api/posts/:id/like":     false,
		"GET /api/posts/:id/like":      false,
		"GET /api/users/search":        false,
		"GET /api/users/:id/posts":     false,
	}

	for _, route := range routes {
		key := route.Method + " " + route.Path
		if _, ok := expected[key]; ok {
			expected[key] = true
		}
	}

	for route, found := range expected {
		if !found {
			t.Fatalf("expected route %s to be registered", route)
		}
	}
}

// === User Search Tests ===

func TestSearchUsersReturnsEmptyForBlankQuery(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "searcher@test.com", "pass123")
	token := createTokenForUser(t, user.ID)

	recorder := performRequest(router, "GET", "/api/users/search?q=", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	var result []map[string]any
	json.Unmarshal(recorder.Body.Bytes(), &result)
	if len(result) != 0 {
		t.Fatalf("expected empty array, got %d items", len(result))
	}
}

func TestSearchUsersFindsMatchingUsers(t *testing.T) {
	router := setupTestRouter(t)
	searcher := createTestUser(t, "searcher@test.com", "pass123")
	token := createTokenForUser(t, searcher.ID)

	// Create some users to search for
	db.Create(&User{ID: "alice-id", Email: "alice@test.com", Name: "Alice Wonderland"})
	db.Create(&User{ID: "bob-id", Email: "bob@test.com", Name: "Bob Builder"})
	db.Create(&User{ID: "charlie-id", Email: "charlie@test.com", Name: "Charlie Brown"})

	recorder := performRequest(router, "GET", "/api/users/search?q=alice", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	var result []map[string]any
	json.Unmarshal(recorder.Body.Bytes(), &result)
	if len(result) != 1 {
		t.Fatalf("expected 1 result, got %d", len(result))
	}
	if result[0]["name"] != "Alice Wonderland" {
		t.Fatalf("expected Alice Wonderland, got %v", result[0]["name"])
	}
}

func TestSearchUsersMatchesByEmail(t *testing.T) {
	router := setupTestRouter(t)
	searcher := createTestUser(t, "searcher@test.com", "pass123")
	token := createTokenForUser(t, searcher.ID)

	db.Create(&User{ID: "dave-id", Email: "dave@example.org", Name: "Dave"})

	recorder := performRequest(router, "GET", "/api/users/search?q=example.org", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	var result []map[string]any
	json.Unmarshal(recorder.Body.Bytes(), &result)
	if len(result) != 1 {
		t.Fatalf("expected 1 result, got %d", len(result))
	}
	if result[0]["email"] != "dave@example.org" {
		t.Fatalf("expected dave@example.org, got %v", result[0]["email"])
	}
}

func TestSearchUsersReturnsNoMatchesGracefully(t *testing.T) {
	router := setupTestRouter(t)
	searcher := createTestUser(t, "searcher@test.com", "pass123")
	token := createTokenForUser(t, searcher.ID)

	recorder := performRequest(router, "GET", "/api/users/search?q=zzzznotfound", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	var result []map[string]any
	json.Unmarshal(recorder.Body.Bytes(), &result)
	if len(result) != 0 {
		t.Fatalf("expected 0 results, got %d", len(result))
	}
}

func TestSearchUsersRequiresAuth(t *testing.T) {
	router := setupTestRouter(t)

	recorder := performRequest(router, "GET", "/api/users/search?q=alice", nil, nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

// === Get User Posts Tests ===

func TestGetUserPostsReturnsUserAndPosts(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "author@test.com", "pass123")

	// Create posts for this user
	db.Create(&Post{ID: "post-1", UserID: user.ID, Title: "First Post", Content: "Body 1"})
	db.Create(&Post{ID: "post-2", UserID: user.ID, Title: "Second Post", Content: "Body 2"})

	recorder := performRequest(router, "GET", "/api/users/"+user.ID+"/posts", nil, nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	userObj, ok := payload["user"].(map[string]any)
	if !ok {
		t.Fatal("expected user object in response")
	}
	if userObj["email"] != "author@test.com" {
		t.Fatalf("expected author@test.com, got %v", userObj["email"])
	}

	posts, ok := payload["posts"].([]any)
	if !ok {
		t.Fatal("expected posts array in response")
	}
	if len(posts) != 2 {
		t.Fatalf("expected 2 posts, got %d", len(posts))
	}
}

func TestGetUserPostsReturns404ForUnknownUser(t *testing.T) {
	router := setupTestRouter(t)

	recorder := performRequest(router, "GET", "/api/users/nonexistent-user/posts", nil, nil)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["error"] != "User not found" {
		t.Fatalf("expected 'User not found' error, got %v", payload["error"])
	}
}

func TestGetUserPostsReturnsEmptyPostsForUserWithNoPosts(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "nopost@test.com", "pass123")

	recorder := performRequest(router, "GET", "/api/users/"+user.ID+"/posts", nil, nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	posts, ok := payload["posts"].([]any)
	if !ok {
		t.Fatal("expected posts array in response")
	}
	if len(posts) != 0 {
		t.Fatalf("expected 0 posts, got %d", len(posts))
	}
}

func TestGetUserPostsIsPublic(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "public@test.com", "pass123")

	// No auth header - should still work
	recorder := performRequest(router, "GET", "/api/users/"+user.ID+"/posts", nil, nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 without auth, got %d", recorder.Code)
	}
}

// === Follow System Tests ===

func TestToggleFollowCreatesFollow(t *testing.T) {
	router := setupTestRouter(t)
	user1 := createTestUser(t, "follower@test.com", "pass123")
	user2 := createTestUser(t, "target@test.com", "pass123")
	token := createTokenForUser(t, user1.ID)

	recorder := performRequest(router, "POST", "/api/users/"+user2.ID+"/follow", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	payload := decodeJSONBody(t, recorder)
	if payload["following"] != true {
		t.Fatalf("expected following=true, got %v", payload["following"])
	}
	if payload["follower_count"] != float64(1) {
		t.Fatalf("expected follower_count=1, got %v", payload["follower_count"])
	}
}

func TestToggleFollowUnfollows(t *testing.T) {
	router := setupTestRouter(t)
	user1 := createTestUser(t, "follower@test.com", "pass123")
	user2 := createTestUser(t, "target@test.com", "pass123")
	token := createTokenForUser(t, user1.ID)

	// Follow first
	performRequest(router, "POST", "/api/users/"+user2.ID+"/follow", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	// Toggle again = unfollow
	recorder := performRequest(router, "POST", "/api/users/"+user2.ID+"/follow", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["following"] != false {
		t.Fatalf("expected following=false after unfollow, got %v", payload["following"])
	}
	if payload["follower_count"] != float64(0) {
		t.Fatalf("expected follower_count=0 after unfollow, got %v", payload["follower_count"])
	}
}

func TestToggleFollowSelfBlocked(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "self@test.com", "pass123")
	token := createTokenForUser(t, user.ID)

	recorder := performRequest(router, "POST", "/api/users/"+user.ID+"/follow", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for self-follow, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["error"] != "Cannot follow yourself" {
		t.Fatalf("expected self-follow error, got %v", payload["error"])
	}
}

func TestToggleFollowRequiresAuth(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "target@test.com", "pass123")

	recorder := performRequest(router, "POST", "/api/users/"+user.ID+"/follow", nil, nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func TestToggleFollow404ForMissingUser(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "follower@test.com", "pass123")
	token := createTokenForUser(t, user.ID)

	recorder := performRequest(router, "POST", "/api/users/nonexistent/follow", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
}

func TestGetFollowStatusReturnsCorrectState(t *testing.T) {
	router := setupTestRouter(t)
	user1 := createTestUser(t, "follower@test.com", "pass123")
	user2 := createTestUser(t, "target@test.com", "pass123")
	token := createTokenForUser(t, user1.ID)

	// Not following yet
	recorder := performRequest(router, "GET", "/api/users/"+user2.ID+"/follow-status", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["following"] != false {
		t.Fatalf("expected following=false, got %v", payload["following"])
	}

	// Follow the user
	performRequest(router, "POST", "/api/users/"+user2.ID+"/follow", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	// Now check status
	recorder = performRequest(router, "GET", "/api/users/"+user2.ID+"/follow-status", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	payload = decodeJSONBody(t, recorder)
	if payload["following"] != true {
		t.Fatalf("expected following=true after follow, got %v", payload["following"])
	}
	if payload["follower_count"] != float64(1) {
		t.Fatalf("expected follower_count=1, got %v", payload["follower_count"])
	}
}

func TestGetFollowStatusRequiresAuth(t *testing.T) {
	router := setupTestRouter(t)
	user := createTestUser(t, "target@test.com", "pass123")

	recorder := performRequest(router, "GET", "/api/users/"+user.ID+"/follow-status", nil, nil)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func TestGetFollowCountsIsPublic(t *testing.T) {
	router := setupTestRouter(t)
	user1 := createTestUser(t, "follower@test.com", "pass123")
	user2 := createTestUser(t, "target@test.com", "pass123")
	token := createTokenForUser(t, user1.ID)

	// Follow user2
	performRequest(router, "POST", "/api/users/"+user2.ID+"/follow", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})

	// Get counts without auth
	recorder := performRequest(router, "GET", "/api/users/"+user2.ID+"/counts", nil, nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	payload := decodeJSONBody(t, recorder)
	if payload["follower_count"] != float64(1) {
		t.Fatalf("expected follower_count=1, got %v", payload["follower_count"])
	}
	if payload["following_count"] != float64(0) {
		t.Fatalf("expected following_count=0, got %v", payload["following_count"])
	}
}

func TestFollowCountsAccuracy(t *testing.T) {
	router := setupTestRouter(t)
	user1 := createTestUser(t, "a@test.com", "pass123")
	user2 := createTestUser(t, "b@test.com", "pass123")
	user3 := createTestUser(t, "c@test.com", "pass123")
	token1 := createTokenForUser(t, user1.ID)
	token2 := createTokenForUser(t, user2.ID)

	// user1 follows user3
	performRequest(router, "POST", "/api/users/"+user3.ID+"/follow", nil, map[string]string{
		"Authorization": "Bearer " + token1,
	})
	// user2 follows user3
	performRequest(router, "POST", "/api/users/"+user3.ID+"/follow", nil, map[string]string{
		"Authorization": "Bearer " + token2,
	})
	// user1 follows user2
	performRequest(router, "POST", "/api/users/"+user2.ID+"/follow", nil, map[string]string{
		"Authorization": "Bearer " + token1,
	})

	// user3 should have 2 followers, 0 following
	recorder := performRequest(router, "GET", "/api/users/"+user3.ID+"/counts", nil, nil)
	payload := decodeJSONBody(t, recorder)
	if payload["follower_count"] != float64(2) {
		t.Fatalf("expected user3 follower_count=2, got %v", payload["follower_count"])
	}
	if payload["following_count"] != float64(0) {
		t.Fatalf("expected user3 following_count=0, got %v", payload["following_count"])
	}

	// user1 should have 0 followers, 2 following
	recorder = performRequest(router, "GET", "/api/users/"+user1.ID+"/counts", nil, nil)
	payload = decodeJSONBody(t, recorder)
	if payload["follower_count"] != float64(0) {
		t.Fatalf("expected user1 follower_count=0, got %v", payload["follower_count"])
	}
	if payload["following_count"] != float64(2) {
		t.Fatalf("expected user1 following_count=2, got %v", payload["following_count"])
	}

	// user2 should have 1 follower, 1 following
	recorder = performRequest(router, "GET", "/api/users/"+user2.ID+"/counts", nil, nil)
	payload = decodeJSONBody(t, recorder)
	if payload["follower_count"] != float64(1) {
		t.Fatalf("expected user2 follower_count=1, got %v", payload["follower_count"])
	}
	if payload["following_count"] != float64(1) {
		t.Fatalf("expected user2 following_count=1, got %v", payload["following_count"])
	}
}

func TestRegisterRoutesIncludesFollowPaths(t *testing.T) {
	router := setupTestRouter(t)
	routes := router.Routes()

	expected := map[string]bool{
		"POST /api/users/:id/follow":       false,
		"GET /api/users/:id/follow-status": false,
		"GET /api/users/:id/counts":        false,
	}

	for _, route := range routes {
		key := route.Method + " " + route.Path
		if _, ok := expected[key]; ok {
			expected[key] = true
		}
	}

	for route, found := range expected {
		if !found {
			t.Fatalf("expected route %s to be registered", route)
		}
	}
}
