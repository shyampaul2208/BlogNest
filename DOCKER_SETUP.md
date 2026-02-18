# Docker Setup Guide for BlogNest

This guide will help you run the BlogNest application using Docker and Docker Compose.

## Prerequisites

- Docker Desktop installed ([Download here](https://www.docker.com/products/docker-desktop))
- Docker Compose (included with Docker Desktop)
- Git (for cloning the repository)

## Quick Start (Easiest Way)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd blognest
```

### 2. Configure Environment Variables
```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your configuration
nano .env
```

**Required Environment Variables:**
- `GOOGLE_CLIENT_ID` - Get from [Google Cloud Console](https://console.cloud.google.com/)
- `GOOGLE_CLIENT_SECRET` - Get from [Google Cloud Console](https://console.cloud.google.com/)
- `JWT_SECRET` - Keep this secret in production!

### 3. Start the Application
```bash
docker-compose up --build
```

This command will:
- Build Docker images for both frontend and backend
- Start all services (backend API and frontend)
- Create necessary networks and volumes
- Initialize the database

### 4. Access the Application
- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:8080

Press `Ctrl+C` to stop the application.

---

## Detailed Commands

### Start Services
```bash
# Start in foreground (see logs)
docker-compose up

# Start with rebuilt images
docker-compose up --build

# Start in background (detached mode)
docker-compose up -d
```

### Stop Services
```bash
# Stop all running containers
docker-compose down

# Stop and remove volumes (careful - deletes database!)
docker-compose down -v
```

### View Logs
```bash
# View all logs
docker-compose logs

# View logs for specific service
docker-compose logs backend
docker-compose logs frontend

# Follow logs in real-time
docker-compose logs -f

# Follow specific service
docker-compose logs -f backend
```

### Access Container Shell
```bash
# Access backend container
docker-compose exec backend sh

# Access frontend container
docker-compose exec frontend sh
```

### Restart Services
```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

---

## Google OAuth Configuration

### Step 1: Create Google OAuth App
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:8080/auth/callback`

### Step 2: Update .env File
```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

### Step 3: Restart Services
```bash
docker-compose restart backend
```

---

## Project Structure

```
blognest/
├── backend/
│   ├── Dockerfile          # Backend Docker image
│   ├── main.go            # Main application
│   ├── models.go          # Data models
│   ├── go.mod             # Go dependencies
│   └── blognest.db        # SQLite database
├── frontend/
│   ├── Dockerfile         # Frontend Docker image
│   ├── nginx.conf         # Nginx configuration
│   ├── package.json       # Node dependencies
│   ├── src/               # Angular source code
│   └── public/            # Public assets
├── docker-compose.yml     # Docker orchestration
└── .env                   # Environment variables
```

---

## Database Management

### Database Files
- Database file is stored in a Docker volume: `backend-db`
- Local path: `./backend/blognest.db`

### Backup Database
```bash
# Copy database from container
docker-compose exec backend cp blognest.db /tmp/backup.db
docker cp blognest-backend:/tmp/backup.db ./backup.db
```

### Restore Database
```bash
# Copy database to container
docker cp ./backup.db blognest-backend:/root/blognest.db
docker-compose restart backend
```

### Reset Database
```bash
# Remove volume and restart (WARNING: Deletes all data!)
docker-compose down -v
docker-compose up --build
```

---

## Troubleshooting

### Services Won't Start
```bash
# Check logs
docker-compose logs

# Verify Docker is running
docker ps

# Rebuild images
docker-compose build --no-cache
docker-compose up
```

### Port Already in Use
If ports 80 or 8080 are in use, modify `docker-compose.yml`:
```yaml
ports:
  - "3000:8080"  # Maps port 3000 on host to 8080 in container
  - "3001:80"    # Maps port 3001 on host to 80 in container
```

Then access:
- Frontend: http://localhost:3001
- Backend: http://localhost:3000

### Database Connection Issues
```bash
# Check backend logs
docker-compose logs backend

# Ensure database volume exists
docker volume ls | grep blognest

# Reinitialize database
docker-compose down -v
docker-compose up --build
```

### Frontend Can't Reach Backend
- Ensure backend is running: `docker-compose logs backend`
- Check nginx configuration in `frontend/nginx.conf`
- Verify network connectivity: `docker-compose exec frontend ping backend`

---

## Performance Tips

### Production Optimization
1. **Use specific image tags** instead of latest
2. **Set resource limits** in docker-compose.yml:
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: '0.5'
             memory: 512M
   ```

3. **Enable Docker BuildKit** for faster builds:
   ```bash
   export DOCKER_BUILDKIT=1
   docker-compose build
   ```

4. **Use .dockerignore** files (already configured)

---

## Security Notes

⚠️ **Important for Production:**
1. Change `JWT_SECRET` in `.env`
2. Use HTTPS instead of HTTP
3. Don't commit `.env` file to version control
4. Use strong database passwords
5. Set proper CORS origins in backend code
6. Run services with non-root users

---

## Getting Help

- Docker Documentation: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- Angular Documentation: https://angular.io/docs
- Go Documentation: https://golang.org/doc/

---

## Next Steps

1. ✅ Customize `.env` with your settings
2. ✅ Run `docker-compose up --build`
3. ✅ Access http://localhost in your browser
4. ✅ Start developing!

Happy coding! 🚀
