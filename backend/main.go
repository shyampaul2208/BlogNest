package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var db *gorm.DB
var oauthConfig *oauth2.Config
var frontendURL string
var googleUserInfoURL = "https://www.googleapis.com/oauth2/v2/userinfo"

func main() {
	// Load .env
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	frontendURL = getEnv("FRONTEND_URL", "http://localhost:4200")
	backendURL := getEnv("BACKEND_URL", "http://localhost:8080")
	oauthRedirectURL := getEnv("OAUTH_REDIRECT_URL", backendURL+"/auth/callback")

	// Database
	var err error
	db, err = gorm.Open(sqlite.Open(getEnv("DATABASE_URL", "./blognest.db")), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Migrate
	db.AutoMigrate(&User{}, &Post{}, &Comment{}, &Like{}, &Follow{})

	// OAuth config
	oauthConfig = &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  oauthRedirectURL,
		Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"},
		Endpoint:     google.Endpoint,
	}

	// Gin
	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:4200"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	registerRoutes(r)

	r.Run(":8080")
}

func registerRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		api.GET("/health", healthCheck)
		api.GET("/posts", listPosts)
		api.GET("/my-posts", authMiddleware(), listMyPosts)
		api.POST("/posts", authMiddleware(), createPost)
		api.GET("/posts/:id", getPost)
		api.PUT("/posts/:id", authMiddleware(), updatePost)
		api.DELETE("/posts/:id", authMiddleware(), deletePost)
		api.GET("/me", authMiddleware(), getMe)

		// Comments
		api.GET("/posts/:id/comments", listComments)
		api.POST("/posts/:id/comments", authMiddleware(), createComment)
		api.DELETE("/comments/:id", authMiddleware(), deleteComment)

		// Likes
		api.POST("/posts/:id/like", authMiddleware(), toggleLike)
		api.GET("/posts/:id/like", optionalAuthMiddleware(), getLikeStatus)

		// Users / Search
		api.GET("/users/search", authMiddleware(), searchUsers)
		api.GET("/users/:id/posts", getUserPosts)

		// Follow
		api.POST("/users/:id/follow", authMiddleware(), toggleFollow)
		api.GET("/users/:id/follow-status", authMiddleware(), getFollowStatus)
		api.GET("/users/:id/counts", getFollowCounts)
		api.GET("/users/:id/followers", getFollowersList)
		api.GET("/users/:id/following", getFollowingList)

		auth := api.Group("/auth")
		{
			auth.GET("/google", handleGoogleLogin)
			auth.GET("/callback", handleGoogleCallback)
			auth.POST("/signup", handleSignup)
			auth.POST("/login", handleLogin)
		}
	}

	// Backward-compatible routes for existing direct backend calls.
	r.GET("/auth/google", handleGoogleLogin)
	r.GET("/auth/callback", handleGoogleCallback)
	r.POST("/auth/signup", handleSignup)
	r.POST("/auth/login", handleLogin)
	r.GET("/me", authMiddleware(), getMe)
	r.GET("/posts", listPosts)
	r.GET("/my-posts", authMiddleware(), listMyPosts)
	r.POST("/posts", authMiddleware(), createPost)
}

func handleGoogleLogin(c *gin.Context) {
	state := generateState()
	// Host-only cookie works for localhost and 127.0.0.1 during local development.
	c.SetCookie("oauth_state", state, 3600, "/", "", false, true)
	url := oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
	c.Redirect(http.StatusTemporaryRedirect, url)
}

func handleGoogleCallback(c *gin.Context) {
	state := c.Query("state")
	cookieState, err := c.Cookie("oauth_state")
	if err != nil || state != cookieState {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state"})
		return
	}

	code := c.Query("code")
	token, err := oauthConfig.Exchange(context.Background(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange code"})
		return
	}

	// Get user info
	client := oauthConfig.Client(context.Background(), token)
	resp, err := client.Get(googleUserInfoURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info"})
		return
	}
	defer resp.Body.Close()

	var googleUser struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode user info"})
		return
	}

	// Find or create user
	var user User
	if err := db.Where("google_id = ?", googleUser.ID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			user = User{
				ID:       uuid.New().String(),
				GoogleID: googleUser.ID,
				Email:    googleUser.Email,
				Name:     googleUser.Name,
				Picture:  googleUser.Picture,
			}
			db.Create(&user)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
	}

	// Generate JWT
	jwtToken, err := generateJWT(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Redirect to frontend with token
	c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/login?token="+jwtToken)
}

func generateJWT(userID string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No token"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(os.Getenv("JWT_SECRET")), nil
		})
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid claims"})
			c.Abort()
			return
		}

		userID := claims["user_id"].(string)
		var user User
		if err := db.First(&user, "id = ?", userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			c.Abort()
			return
		}

		c.Set("user", user)
		c.Next()
	}
}

func getMe(c *gin.Context) {
	user, _ := c.Get("user")
	c.JSON(http.StatusOK, user)
}

func listPosts(c *gin.Context) {
	posts := []Post{}

	if err := db.Preload("User").Order("created_at desc").Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts"})
		return
	}

	c.JSON(http.StatusOK, posts)
}

func listMyPosts(c *gin.Context) {
	userValue, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	user, ok := userValue.(User)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
		return
	}

	posts := []Post{}
	if err := db.Preload("User").Where("user_id = ?", user.ID).Order("created_at desc").Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user posts"})
		return
	}

	c.JSON(http.StatusOK, posts)
}

func createPost(c *gin.Context) {
	var req struct {
		Title   string `json:"title" binding:"required"`
		Content string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userValue, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}

	user, ok := userValue.(User)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
		return
	}

	post := Post{
		ID:      uuid.New().String(),
		UserID:  user.ID,
		Title:   strings.TrimSpace(req.Title),
		Content: strings.TrimSpace(req.Content),
	}

	if post.Title == "" || post.Content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and content are required"})
		return
	}

	if err := db.Create(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create post"})
		return
	}

	if err := db.Preload("User").First(&post, "id = ?", post.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load created post"})
		return
	}

	c.JSON(http.StatusCreated, post)
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func generateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func getEnv(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}

func handleSignup(c *gin.Context) {
	var req struct {
		FirstName string `json:"first_name" binding:"required"`
		LastName  string `json:"last_name" binding:"required"`
		Email     string `json:"email" binding:"required,email"`
		Password  string `json:"password" binding:"required,min=6"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if email already exists
	var existingUser User
	if err := db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Create user
	user := User{
		ID:        uuid.New().String(),
		Email:     req.Email,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Name:      req.FirstName + " " + req.LastName,
		Password:  string(hashedPassword),
		// GoogleID is left empty/null for email signups
	}

	if err := db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Generate JWT
	jwtToken, err := generateJWT(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": jwtToken,
		"user":  user,
	})
}

func handleLogin(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user by email
	var user User
	if err := db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User does not exist"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	// Check if password is empty (OAuth-only user)
	if user.Password == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "This account uses Google OAuth. Please sign in with Google."})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		log.Println("Password comparison failed:", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Generate JWT
	jwtToken, err := generateJWT(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": jwtToken,
		"user":  user,
	})
}

// --- Sprint 3: Single post, Edit, Delete, Comments, Likes ---

func optionalAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(os.Getenv("JWT_SECRET")), nil
		})
		if err != nil || !token.Valid {
			c.Next()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.Next()
			return
		}

		userID := claims["user_id"].(string)
		var user User
		if err := db.First(&user, "id = ?", userID).Error; err == nil {
			c.Set("user", user)
		}
		c.Next()
	}
}

func getPost(c *gin.Context) {
	postID := c.Param("id")
	var post Post
	if err := db.Preload("User").First(&post, "id = ?", postID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch post"})
		}
		return
	}

	// Get comment count
	var commentCount int64
	db.Model(&Comment{}).Where("post_id = ?", postID).Count(&commentCount)

	// Get like count
	var likeCount int64
	db.Model(&Like{}).Where("post_id = ?", postID).Count(&likeCount)

	c.JSON(http.StatusOK, gin.H{
		"post":          post,
		"comment_count": commentCount,
		"like_count":    likeCount,
	})
}

func updatePost(c *gin.Context) {
	postID := c.Param("id")

	var post Post
	if err := db.First(&post, "id = ?", postID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	userValue, _ := c.Get("user")
	user := userValue.(User)
	if post.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only edit your own posts"})
		return
	}

	var req struct {
		Title   string `json:"title" binding:"required"`
		Content string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	title := strings.TrimSpace(req.Title)
	content := strings.TrimSpace(req.Content)

	if title == "" || content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and content are required"})
		return
	}

	post.Title = title
	post.Content = content

	if err := db.Save(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update post"})
		return
	}

	db.Preload("User").First(&post, "id = ?", post.ID)
	c.JSON(http.StatusOK, post)
}

func deletePost(c *gin.Context) {
	postID := c.Param("id")

	var post Post
	if err := db.First(&post, "id = ?", postID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	userValue, _ := c.Get("user")
	user := userValue.(User)
	if post.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete your own posts"})
		return
	}

	// Delete associated comments and likes first
	db.Where("post_id = ?", postID).Delete(&Comment{})
	db.Where("post_id = ?", postID).Delete(&Like{})

	if err := db.Delete(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete post"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Post deleted"})
}

func listComments(c *gin.Context) {
	postID := c.Param("id")

	var comments []Comment
	if err := db.Preload("User").Where("post_id = ?", postID).Order("created_at asc").Find(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comments"})
		return
	}

	c.JSON(http.StatusOK, comments)
}

func createComment(c *gin.Context) {
	postID := c.Param("id")

	// Verify post exists
	var post Post
	if err := db.First(&post, "id = ?", postID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content is required"})
		return
	}

	userValue, _ := c.Get("user")
	user := userValue.(User)

	comment := Comment{
		ID:      uuid.New().String(),
		PostID:  postID,
		UserID:  user.ID,
		Content: content,
	}

	if err := db.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create comment"})
		return
	}

	db.Preload("User").First(&comment, "id = ?", comment.ID)
	c.JSON(http.StatusCreated, comment)
}

func deleteComment(c *gin.Context) {
	commentID := c.Param("id")

	var comment Comment
	if err := db.First(&comment, "id = ?", commentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	userValue, _ := c.Get("user")
	user := userValue.(User)
	if comment.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete your own comments"})
		return
	}

	if err := db.Delete(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Comment deleted"})
}

func toggleLike(c *gin.Context) {
	postID := c.Param("id")

	// Verify post exists
	var post Post
	if err := db.First(&post, "id = ?", postID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	userValue, _ := c.Get("user")
	user := userValue.(User)

	var existing Like
	err := db.Where("post_id = ? AND user_id = ?", postID, user.ID).First(&existing).Error

	if err == nil {
		// Already liked — unlike
		db.Delete(&existing)
		var count int64
		db.Model(&Like{}).Where("post_id = ?", postID).Count(&count)
		c.JSON(http.StatusOK, gin.H{"liked": false, "like_count": count})
		return
	}

	// Not liked — like
	like := Like{
		ID:     uuid.New().String(),
		PostID: postID,
		UserID: user.ID,
	}
	if err := db.Create(&like).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle like"})
		return
	}

	var count int64
	db.Model(&Like{}).Where("post_id = ?", postID).Count(&count)
	c.JSON(http.StatusOK, gin.H{"liked": true, "like_count": count})
}

func getLikeStatus(c *gin.Context) {
	postID := c.Param("id")

	var likeCount int64
	db.Model(&Like{}).Where("post_id = ?", postID).Count(&likeCount)

	liked := false
	userValue, exists := c.Get("user")
	if exists {
		user := userValue.(User)
		var existing Like
		if err := db.Where("post_id = ? AND user_id = ?", postID, user.ID).First(&existing).Error; err == nil {
			liked = true
		}
	}

	c.JSON(http.StatusOK, gin.H{"liked": liked, "like_count": likeCount})
}

func searchUsers(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusOK, []User{})
		return
	}

	var users []User
	pattern := "%" + q + "%"
	if err := db.Where("name LIKE ? OR email LIKE ?", pattern, pattern).
		Limit(20).Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search users"})
		return
	}

	c.JSON(http.StatusOK, users)
}

func getUserPosts(c *gin.Context) {
	userID := c.Param("id")

	var user User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	var posts []Post
	if err := db.Preload("User").Where("user_id = ?", userID).Order("created_at desc").Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user, "posts": posts})
}

// --- Follow System ---

func toggleFollow(c *gin.Context) {
	userValue, _ := c.Get("user")
	currentUser := userValue.(User)
	currentUserID := currentUser.ID
	targetUserID := c.Param("id")

	if currentUserID == targetUserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot follow yourself"})
		return
	}

	// Verify target user exists
	var targetUser User
	if err := db.First(&targetUser, "id = ?", targetUserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	// Check if already following
	var existing Follow
	err := db.Where("follower_id = ? AND following_id = ?", currentUserID, targetUserID).First(&existing).Error
	if err == nil {
		// Already following — unfollow
		db.Delete(&existing)
		var followerCount, followingCount int64
		db.Model(&Follow{}).Where("following_id = ?", targetUserID).Count(&followerCount)
		db.Model(&Follow{}).Where("follower_id = ?", targetUserID).Count(&followingCount)
		c.JSON(http.StatusOK, gin.H{
			"following":       false,
			"follower_count":  followerCount,
			"following_count": followingCount,
		})
		return
	}

	// Create follow
	follow := Follow{
		ID:          uuid.New().String(),
		FollowerID:  currentUserID,
		FollowingID: targetUserID,
	}
	if err := db.Create(&follow).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to follow user"})
		return
	}

	var followerCount, followingCount int64
	db.Model(&Follow{}).Where("following_id = ?", targetUserID).Count(&followerCount)
	db.Model(&Follow{}).Where("follower_id = ?", targetUserID).Count(&followingCount)
	c.JSON(http.StatusOK, gin.H{
		"following":       true,
		"follower_count":  followerCount,
		"following_count": followingCount,
	})
}

func getFollowStatus(c *gin.Context) {
	userValue, _ := c.Get("user")
	currentUser := userValue.(User)
	currentUserID := currentUser.ID
	targetUserID := c.Param("id")

	var count int64
	db.Model(&Follow{}).Where("follower_id = ? AND following_id = ?", currentUserID, targetUserID).Count(&count)

	var followerCount, followingCount int64
	db.Model(&Follow{}).Where("following_id = ?", targetUserID).Count(&followerCount)
	db.Model(&Follow{}).Where("follower_id = ?", targetUserID).Count(&followingCount)

	c.JSON(http.StatusOK, gin.H{
		"following":       count > 0,
		"follower_count":  followerCount,
		"following_count": followingCount,
	})
}

func getFollowCounts(c *gin.Context) {
	userID := c.Param("id")

	var followerCount, followingCount int64
	db.Model(&Follow{}).Where("following_id = ?", userID).Count(&followerCount)
	db.Model(&Follow{}).Where("follower_id = ?", userID).Count(&followingCount)

	c.JSON(http.StatusOK, gin.H{
		"follower_count":  followerCount,
		"following_count": followingCount,
	})
}

func getFollowersList(c *gin.Context) {
	userID := c.Param("id")

	var follows []Follow
	db.Where("following_id = ?", userID).Preload("Follower").Find(&follows)

	users := make([]gin.H, 0, len(follows))
	for _, f := range follows {
		users = append(users, gin.H{
			"id":      f.Follower.ID,
			"name":    f.Follower.Name,
			"email":   f.Follower.Email,
			"picture": f.Follower.Picture,
		})
	}
	c.JSON(http.StatusOK, users)
}

func getFollowingList(c *gin.Context) {
	userID := c.Param("id")

	var follows []Follow
	db.Where("follower_id = ?", userID).Preload("Following").Find(&follows)

	users := make([]gin.H, 0, len(follows))
	for _, f := range follows {
		users = append(users, gin.H{
			"id":      f.Following.ID,
			"name":    f.Following.Name,
			"email":   f.Following.Email,
			"picture": f.Following.Picture,
		})
	}
	c.JSON(http.StatusOK, users)
}
