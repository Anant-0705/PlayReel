# GameReel 🎮

> A vertical-scroll game discovery platform — like Instagram Reels but every card is a **live, playable WebAssembly game**.

## Quick Start

```bash
# 1. Clone the repo and enter the project
cd PlayReel

# 2. First-time setup (copies .env, builds images, starts all 14 services)
make dev-setup

# 3. Edit secrets
nano .env   # or open with your editor

# 4. Frontend
open http://localhost:5173

# 5. API Gateway
open http://localhost:80
```

## Architecture at a Glance

```
Browser ─── Nginx (port 80)
             ├── /api/auth/    → user-service   (3001)
             ├── /api/users/   → user-service   (3001)
             ├── /api/games/   → game-service   (3002)
             ├── /api/feed/    → feed-service   (3003)
             ├── /api/social/  → social-service (3004)
             ├── /socket.io/   → social-service (3004) [WebSocket]
             └── /api/upload/  → upload-service (3005)
```

## Services

| Service | Port | Purpose |
|---|---|---|
| `nginx` | **80** | API Gateway (only public port in prod) |
| `frontend` | 5173 | React + Vite dev server |
| `user-service` | 3001 | Auth (JWT), profiles, follow graph |
| `game-service` | 3002 | Game metadata, MinIO signed URLs, search |
| `feed-service` | 3003 | Personalized feed, Redis cache |
| `social-service` | 3004 | Likes, comments, Socket.io live presence |
| `upload-service` | 3005 | Chunked resumable uploads (5MB chunks) |
| `game-processor` | — | WASM/zip processing, security scan, thumbnail |
| `notification-worker` | — | Firebase push notifications |

## Infrastructure

| Dependency | Dev Port | Purpose |
|---|---|---|
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Feed cache, viewer presence |
| RabbitMQ | 5672 / **15672** (UI) | Async messaging |
| MinIO | 9000 / **9001** (UI) | Object storage (game assets) |
| Elasticsearch | 9200 | Full-text game search |

## Makefile Commands

```bash
make dev-setup          # First-time setup
make up / down          # Start / stop services
make logs               # Tail all logs
make logs-user-service  # Tail a specific service
make shell-db           # PostgreSQL psql shell
make shell-redis        # Redis CLI
make rabbit-ui          # Open RabbitMQ UI in browser
make scale-worker WORKER=game-processor N=3
make test               # Run all service tests
make build-prod         # Build production images
make clean              # Remove everything
```

## Project Structure

```
PlayReel/
├── docker-compose.yml          # Development (14 services)
├── docker-compose.prod.yml     # Production overrides
├── Makefile                    # Dev lifecycle commands
├── .env.example                # Environment variable templates
│
├── shared/                     # Shared TypeScript types + constants
├── postgres/init.sql           # DB schema (all tables + triggers)
├── nginx/nginx.conf            # API Gateway config
├── rabbitmq/
│   ├── rabbitmq.conf           # RabbitMQ server config
│   └── definitions.json        # Exchanges + queues + bindings
│
├── services/
│   ├── user-service/           # port 3001
│   ├── game-service/           # port 3002
│   ├── feed-service/           # port 3003
│   ├── social-service/         # port 3004
│   └── upload-service/         # port 3005
│
├── workers/
│   ├── game-processor/         # WASM processing, thumbnail
│   └── notification-worker/    # Firebase FCM
│
├── frontend/                   # React + Vite + TypeScript + Tailwind
└── ci/
    ├── Jenkinsfile             # Backend CI/CD
    └── .circleci/config.yml    # Frontend CI/CD
```

## Game 5-State Lifecycle

The zero-buffer scroll engine keeps the next game **always preloaded**:

```
DEAD (±3+) → DORMANT (±2) → PRELOAD (±1) → READY (adj) → ACTIVE (0)
```

| State | Distance | What's Loaded |
|---|---|---|
| DEAD | ±3+ | Nothing — DOM node empty |
| DORMANT | ±2 | `manifest.json` fetched |
| PRELOAD | ±1 | WASM + assets loaded in Web Worker, paused at frame 0 |
| READY | adjacent | Fully loaded, waiting for tap |
| ACTIVE | current (tapped) | Running, audio on, input accepted |

## Upload Flow

Games go **live in ~3 seconds** via Instant Publish:

1. Upload chunks (5MB each, resumable)
2. game-processor assembles + builds `manifest.json`
3. Game status → `ready` → **visible immediately**
4. Security scan, thumbnail, Elasticsearch indexing run **async**

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript + TailwindCSS + Zustand |
| Game Runtime | WebAssembly (WASM) + WebGL in sandboxed iframes |
| Backend | Node.js microservices (Express) |
| Message Queue | RabbitMQ (topic + fanout + direct exchanges) |
| Cache | Redis |
| Database | PostgreSQL |
| Search | Elasticsearch |
| File Storage | MinIO (S3-compatible) |
| Gateway | Nginx |
| Containers | Docker + Docker Compose |
| CI/CD | Jenkins (backend) + CircleCI (frontend) |
