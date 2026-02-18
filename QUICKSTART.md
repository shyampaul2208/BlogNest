# 🚀 Quick Start Guide

Get BlogNest running in 3 simple steps:

## Step 1: Setup Environment
```bash
cp .env.example .env
# Edit .env and add your Google OAuth credentials
nano .env
```

## Step 2: Start Application
```bash
# Option A: Using Docker Compose directly
docker-compose up --build

# Option B: Using Makefile (easier)
make up-build
```

## Step 3: Access Application
- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:8080

---

## 📋 Common Commands

| Command | Description |
|---------|------------|
| `make up` | Start all services |
| `make down` | Stop all services |
| `make logs` | View all logs |
| `make logs-backend` | View backend logs only |
| `make shell-backend` | Open backend container terminal |
| `make db-backup` | Backup database |
| `make clean` | Delete all containers & volumes |
| `docker-compose ps` | Check service status |

---

## 🔧 Configuration

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Set redirect URI: `http://localhost:8080/auth/callback`
4. Copy credentials to `.env`:
   ```
   GOOGLE_CLIENT_ID=your_id
   GOOGLE_CLIENT_SECRET=your_secret
   ```

### Environment Variables
See `.env.example` for all available options.

---

## 📚 More Information

- Full guide: See [DOCKER_SETUP.md](DOCKER_SETUP.md)
- All available commands: `make help`

---

## ⚙️ Troubleshooting

### Port Already in Use
Edit `docker-compose.yml` and change port mappings:
```yaml
ports:
  - "3000:8080"  # Backend
  - "3001:80"    # Frontend
```

### Services Won't Start
```bash
docker-compose logs
docker-compose up --build
```

### Database Issues
```bash
docker-compose down -v  # WARNING: Deletes data!
docker-compose up --build
```

---

**Need help?** See [DOCKER_SETUP.md](DOCKER_SETUP.md) for detailed documentation.
