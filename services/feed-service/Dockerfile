# ============================================================
# feed-service Dockerfile — 5-stage multi-stage build
# ============================================================

FROM node:20-alpine AS base
RUN apk add --no-cache curl dumb-init
WORKDIR /app
ENV NODE_ENV=production

FROM base AS development
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3003
CMD ["dumb-init", "npx", "nodemon", "--watch", "src", "--ext", "ts", \
     "--exec", "ts-node -r tsconfig-paths/register src/index.ts"]

FROM development AS test
ENV NODE_ENV=test
CMD ["npm", "test"]

FROM development AS builder
ENV NODE_ENV=production
RUN npm run build

FROM base AS production
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER appuser
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1
CMD ["dumb-init", "node", "dist/index.js"]
