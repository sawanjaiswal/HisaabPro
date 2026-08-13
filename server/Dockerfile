# ---- Builder Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runner Stage ----
FROM node:20-alpine AS runner

WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# Copy only what's needed to run
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Switch to non-root
USER appuser

ENV PORT=4000
EXPOSE $PORT

# Health check — reads $PORT so it stays correct whatever port Coolify injects
# at runtime (render.yaml previously overrode PORT=10000; ENV above is only
# the image default, actual value comes from the platform's env var).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/api/health || exit 1

# Migrations run against DIRECT_DATABASE_URL (unpooled) — prisma migrate
# deploy holds an advisory lock, which a pooled/PgBouncer endpoint can drop
# mid-transaction. Render's old buildCommand ran this at build time; moved
# to container start so build-time images never need DB credentials baked in
# (same reasoning as Rent-Income's and Flint's Dockerfiles).
CMD ["sh", "-c", "DATABASE_URL=\"$DIRECT_DATABASE_URL\" npx prisma migrate deploy && node dist/index.js"]
