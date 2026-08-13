# ---- Builder Stage ----
# Build context is the REPO ROOT (not server/), same convention as the root
# frontend Dockerfile — tsconfig.json has rootDir:".." and includes the
# sibling ../shared directory (server/src/**/*.ts imports from
# '../../../shared/enums.js'), so the build needs shared/ on disk too.
FROM node:20-alpine AS builder

WORKDIR /app/server

# Install deps first (layer caching)
COPY server/package.json server/package-lock.json* ./
# Coolify injects every is_buildtime env var (incl. NODE_ENV=production) as a
# build ARG/ENV, which makes npm ci skip devDependencies — but prisma and
# typescript (needed below) are both devDependencies. --include=dev forces
# them in regardless of NODE_ENV.
RUN npm ci --ignore-scripts --include=dev

# Copy Prisma schema and generate client
COPY server/prisma ./prisma
RUN npx prisma generate

# Copy source and build
COPY server/tsconfig.json ./
COPY server/src ./src
COPY shared /app/shared

# V8 caps its default heap at ~460MB when it detects low physical RAM (this
# host has 1GB), regardless of swap available — tsc OOMs before touching
# swap otherwise. Same fix as Rent-Income's Dockerfile.
#
# rootDir:".." mirrors the full relative path into dist/, so the real build
# output is dist/server/src/index.js (not dist/index.js) — see CMD below.
RUN NODE_OPTIONS="--max-old-space-size=3072" npm run build

# ---- Runner Stage ----
FROM node:20-alpine AS runner

WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# Copy only what's needed to run — builder's WORKDIR is /app/server, and its
# tsc output mirrors rootDir:".." (/app), landing at dist/server/src/*.js and
# dist/shared/*.js rather than a flat dist/*.js.
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/prisma ./prisma
COPY --from=builder /app/server/package.json ./package.json

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
CMD ["sh", "-c", "DATABASE_URL=\"$DIRECT_DATABASE_URL\" npx prisma migrate deploy && node dist/server/src/index.js"]
