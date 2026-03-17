# ── Stage 1: base ──────────────────────────────────────────────
FROM node:20-slim AS base
WORKDIR /app

# ── Stage 2: deps ───────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 3: dev ────────────────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npx", "ts-node", "-r", "tsconfig-paths/register", "src/index.ts"]

# ── Stage 4: builder ────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc

# ── Stage 5: production ─────────────────────────────────────────
FROM base AS production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
RUN addgroup --system --gid 1001 gamereel && \
    adduser --system --uid 1001 gamereel && \
    chown -R gamereel:gamereel /app
USER gamereel
CMD ["node", "dist/index.js"]
