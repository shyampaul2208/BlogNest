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

	if err := testDB.AutoMigrate(&User{}, &Post{}, &Comment{}, &Like{}); err != nil {
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
	if payload["error"] != "Invalid email or password" {
		t.Fatalf("expected invalid credentials error, got %#v", payload["error"])
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
