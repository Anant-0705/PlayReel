# ── Stage 1: base ──────────────────────────────────────────────
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
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
