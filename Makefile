.PHONY: help build up down logs logs-backend logs-frontend restart clean shell-backend shell-frontend db-backup db-restore

help:
	@echo "BlogNest Docker Commands"
	@echo "======================="
	@echo ""
	@echo "make build              - Build Docker images"
	@echo "make up                 - Start all services"
	@echo "make down               - Stop all services"
	@echo "make restart            - Restart all services"
	@echo "make logs               - View all logs"
	@echo "make logs-backend       - View backend logs"
	@echo "make logs-frontend      - View frontend logs"
	@echo "make shell-backend      - Open backend container shell"
	@echo "make shell-frontend     - Open frontend container shell"
	@echo "make clean              - Remove containers and volumes"
	@echo "make db-backup          - Backup database"
	@echo "make db-restore         - Restore database"
	@echo ""
	@echo "Quick Start:"
	@echo "  1. cp .env.example .env"
	@echo "  2. Edit .env with your settings"
	@echo "  3. make up"
	@echo "  4. Open http://localhost"
	@echo ""

build:
	@echo "Building Docker images..."
	docker-compose build

up:
	@echo "Starting BlogNest application..."
	docker-compose up

up-build:
	@echo "Building and starting BlogNest application..."
	docker-compose up --build

up-d:
	@echo "Starting BlogNest in background..."
	docker-compose up -d
	@echo "Application is running!"
	@echo "Frontend: http://localhost:4200"
	@echo "Backend:  http://localhost:8080"

down:
	@echo "Stopping BlogNest application..."
	docker-compose down

restart:
	@echo "Restarting services..."
	docker-compose restart
	@echo "Services restarted!"

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

status:
	@echo "Service Status:"
	docker-compose ps

shell-backend:
	@echo "Opening backend container shell..."
	docker-compose exec backend sh

shell-frontend:
	@echo "Opening frontend container shell..."
	docker-compose exec frontend sh

db-backup:
	@echo "Backing up database..."
	@mkdir -p ./backups
	docker-compose exec backend cp blognest.db /tmp/backup.db
	docker cp blognest-backend:/tmp/backup.db ./backups/blognest-$(shell date +%Y%m%d-%H%M%S).db
	@echo "Database backed up to ./backups/"

db-restore:
	@echo "Restoring database from most recent backup..."
	@$(eval LATEST_BACKUP := $(shell ls -t ./backups/blognest-*.db 2>/dev/null | head -1))
	@if [ -z "$(LATEST_BACKUP)" ]; then \
		echo "No backup found in ./backups/"; \
		exit 1; \
	fi
	docker cp $(LATEST_BACKUP) blognest-backend:/root/blognest.db
	docker-compose restart backend
	@echo "Database restored from $(LATEST_BACKUP)"

clean:
	@echo "Cleaning up Docker resources..."
	docker-compose down -v
	@echo "Cleanup complete!"

test-backend:
	@echo "Running backend tests..."
	docker-compose exec backend go test ./...

test-frontend:
	@echo "Running frontend tests..."
	docker-compose exec frontend npm test -- --run

lint-backend:
	@echo "Linting backend..."
	docker-compose exec backend go fmt ./...

lint-frontend:
	@echo "Linting frontend..."
	docker-compose exec frontend npm run lint

env-check:
	@echo "Checking .env file..."
	@if [ -f .env ]; then \
		echo ".env file found. Required variables:"; \
		grep -E "^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|JWT_SECRET)" .env || echo "❌ Missing required variables!"; \
	else \
		echo "❌ .env file not found. Run: cp .env.example .env"; \
	fi
