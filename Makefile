# ============================================================
# GameReel — Makefile
# ============================================================
# Usage:
#   make dev-setup   → First-time setup: copy .env, build, start all services
#   make up          → Start all development services
#   make down        → Stop all services
#   make logs        → Tail all service logs (Ctrl+C to exit)
#   make logs-<svc>  → Tail a specific service   e.g. make logs-user-service
#   make shell-db    → Open psql shell in PostgreSQL container
#   make shell-redis → Open redis-cli in Redis container
#   make rabbit-ui   → Open RabbitMQ Management UI in browser
#   make scale-worker WORKER=game-processor N=3 → Scale a worker
#   make test        → Run all service test suites
#   make build-prod  → Build production images
#   make ps          → Show running containers
#   make clean       → Remove all containers, volumes, and networks

COMPOSE         := docker compose
COMPOSE_FILE    := docker-compose.yml
COMPOSE_PROD    := docker-compose.prod.yml
SHELL_CMD       := /bin/sh

.PHONY: dev-setup up down logs shell-db shell-redis rabbit-ui \
        scale-worker test build-prod ps clean help

# ── First-time setup ─────────────────────────────────────────
dev-setup:
	@echo "🚀  GameReel dev setup starting..."
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅  .env created from .env.example — edit secrets before continuing!"; \
	else \
		echo "ℹ️   .env already exists, skipping copy"; \
	fi
	$(COMPOSE) -f $(COMPOSE_FILE) build --parallel
	$(COMPOSE) -f $(COMPOSE_FILE) up -d
	@echo "✅  All services started."
	@echo "    Frontend:   http://localhost:5173"
	@echo "    API:        http://localhost:80"
	@echo "    RabbitMQ:   http://localhost:15672"
	@echo "    MinIO:      http://localhost:9001"
	@echo ""
	@echo "⏳  Waiting for services to be ready..."
	@sleep 10
	@$(MAKE) ps

# ── Core lifecycle ───────────────────────────────────────────
up:
	$(COMPOSE) -f $(COMPOSE_FILE) up -d

down:
	$(COMPOSE) -f $(COMPOSE_FILE) down

ps:
	$(COMPOSE) -f $(COMPOSE_FILE) ps

# ── Logs ─────────────────────────────────────────────────────
logs:
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f --tail=50

logs-%:
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f --tail=100 $*

# ── Database & Cache shells ───────────────────────────────────
shell-db:
	$(COMPOSE) -f $(COMPOSE_FILE) exec postgres psql -U $${POSTGRES_USER:-gamereel} -d $${POSTGRES_DB:-gamereel}

shell-redis:
	$(COMPOSE) -f $(COMPOSE_FILE) exec redis redis-cli -a $${REDIS_PASSWORD:-changeme_redis_password}

# ── RabbitMQ ─────────────────────────────────────────────────
rabbit-ui:
	@echo "🐰  Opening RabbitMQ Management UI at http://localhost:15672"
	@start http://localhost:15672 2>/dev/null || open http://localhost:15672 2>/dev/null || xdg-open http://localhost:15672

# ── Worker scaling ───────────────────────────────────────────
scale-worker:
	@if [ -z "$(WORKER)" ] || [ -z "$(N)" ]; then \
		echo "Usage: make scale-worker WORKER=game-processor N=3"; \
		exit 1; \
	fi
	$(COMPOSE) -f $(COMPOSE_FILE) up -d --scale $(WORKER)=$(N)

# ── Testing ──────────────────────────────────────────────────
test:
	$(COMPOSE) -f $(COMPOSE_FILE) run --rm user-service npm test
	$(COMPOSE) -f $(COMPOSE_FILE) run --rm game-service npm test
	$(COMPOSE) -f $(COMPOSE_FILE) run --rm feed-service npm test
	$(COMPOSE) -f $(COMPOSE_FILE) run --rm social-service npm test
	$(COMPOSE) -f $(COMPOSE_FILE) run --rm upload-service npm test

# ── Production build ─────────────────────────────────────────
build-prod:
	$(COMPOSE) -f $(COMPOSE_FILE) -f $(COMPOSE_PROD) build --parallel

# ── Clean ────────────────────────────────────────────────────
clean:
	@echo "⚠️   This will remove all containers, volumes, and images!"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	$(COMPOSE) -f $(COMPOSE_FILE) down -v --remove-orphans --rmi local

# ── Help ─────────────────────────────────────────────────────
help:
	@echo "GameReel Makefile commands:"
	@echo "  make dev-setup          First-time setup"
	@echo "  make up / down          Start / stop services"
	@echo "  make logs               Tail all logs"
	@echo "  make logs-<service>     Tail specific service logs"
	@echo "  make shell-db           PostgreSQL shell"
	@echo "  make shell-redis        Redis CLI"
	@echo "  make rabbit-ui          Open RabbitMQ UI in browser"
	@echo "  make scale-worker       Scale a worker (WORKER= N=)"
	@echo "  make test               Run all tests"
	@echo "  make build-prod         Build production images"
	@echo "  make clean              Remove everything"
