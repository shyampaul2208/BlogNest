# BlogNest

A full-stack blogging platform where users can write, share, and interact with content. Features include post creation with cover images, comments, likes, follows, user profiles, and real-time social interactions.

## Team

| Name | Role |
|---|---|
| Palavalli Shyam | Frontend |
| Vinay Kumar Thimmavalli Manjunath | Frontend |
| Ashruth Reddy Gangula | Backend |
| Rahul Reddy Asam | Backend |

---

## Requirements

### Backend
- Go 1.21 or higher
- No external database installation needed — uses SQLite (embedded)

### Frontend
- Node.js 18 or higher
- npm 9 or higher
- Angular CLI (installed automatically via `npm install`)

---

## Running the Application

### 1. Clone the repository

```bash
git clone <repository-url>
cd BlogNest
```

### 2. Start the backend

```bash
cd backend
go run main.go
```

The backend starts on **http://localhost:8080**.

On first run it will:
- Create the SQLite database file (`blognest.db`) automatically
- Create the `uploads/` directory for image storage

### 3. Start the frontend

Open a new terminal window:

```bash
cd frontend
npm install
npm start
```

The frontend starts on **http://localhost:4200** and automatically proxies all `/api` and `/uploads` requests to the backend.

> **Note:** Both the backend and frontend must be running at the same time for the application to work.

---

## Environment Variables (Backend)

Create a `.env` file inside the `backend/` directory or export these variables in your shell before running:

| Variable | Description | Required |
|---|---|---|
| `JWT_SECRET` | Secret key used to sign JWT tokens | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Only for Google login |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Only for Google login |

Example `.env`:

```
JWT_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

> If `JWT_SECRET` is not set, the app falls back to a default development value. **Do not use the default in production.**

---

## Using the Application

### Sign up / Log in
- Visit **http://localhost:4200**
- Create an account with your name, email, and password
- Or sign in with your Google account

### Writing a post
- Click **Write** in the navbar
- Enter a title and content
- Optionally upload a cover image (JPEG, PNG, GIF, or WEBP — max 5 MB)
- Click **Publish**

### Exploring posts
- Click **Feed** in the navbar to browse all posts from all users
- Posts with cover images show a thumbnail in the feed
- Click any post to open the full detail view

### Liking and commenting
- Click the heart icon on any post to like or unlike it
- Open a post and scroll to the comment section to leave a comment
- Delete your own comments using the delete button

### Following users
- Click **Follow** on any post card in the feed or on a user's profile page
- View your followers and following counts in the navbar
- Click the counts to see the full list

### Searching users
- Use the search bar in the navbar to find users by name or email
- Click a result to visit their profile and see their posts

### Editing and deleting your posts
- Open one of your own posts
- Click **Edit** to update the title, content, or cover image
- Click **Delete** to permanently remove the post

---

## Running Tests

### Frontend unit tests

```bash
cd frontend
npm test
```

Runs 155 unit tests across 11 spec files using Vitest.

### Frontend end-to-end tests

```bash
cd frontend
npm run cypress:run
```

### Backend unit tests

```bash
cd backend
go test ./...
```

Runs 80 unit tests covering all API handlers, middleware, and business logic.

---

## Project Structure

```
BlogNest/
├── backend/
│   ├── main.go          # All API handlers and route registration
│   ├── models.go        # GORM database models
│   ├── main_test.go     # Backend unit tests
│   ├── blognest.db      # SQLite database (auto-created)
│   └── uploads/         # Uploaded image files (auto-created)
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── pages/   # Route components (home, feed, write, post-detail, etc.)
│   │       ├── services/ # HTTP services (PostService, AuthService)
│   │       ├── guards/  # Route auth guard
│   │       ├── models/  # TypeScript interfaces
│   │       └── shared/  # Navbar component
│   └── proxy.conf.json  # Dev server proxy to backend
├── Sprint 2.md
├── Sprint 3.md
└── Sprint 4.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21, TypeScript |
| Backend | Go, Gin framework |
| Database | SQLite via GORM |
| Auth | JWT, Google OAuth 2.0 |
| Testing (frontend) | Vitest, Angular Testing Library |
| Testing (backend) | Go `testing` package, in-memory SQLite |
| E2E Testing | Cypress |
