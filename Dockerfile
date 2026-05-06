# Hirecanvas — Docker build cache
# -------------------------------
# BuildKit caches layers when inputs are unchanged. Re-running `docker compose build`
# may skip `COPY . .` and `npm run build` if Docker thinks nothing relevant changed.
# Restarting a container does not rebuild the image.
#
# Full clean rebuild (slowest, strongest guarantee):
#   docker compose build --no-cache app
#
# Bust cache from app source onward (fast path — use a new CACHEBUST each time):
#   docker compose build --build-arg CACHEBUST=$(date +%s) app
#   PowerShell:
#   docker compose build --build-arg CACHEBUST=$(Get-Date -Format 'yyyyMMddHHmmss') app
#   Or set once for this shell / .env (docker-compose passes CACHEBUST into the build):
#   $env:CACHEBUST = (Get-Date -Format 'yyyyMMddHHmmss'); docker compose build app
#
# Recreate the running container after a new image exists:
#   docker compose up -d --build --force-recreate app

# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: Build the application ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# When CACHEBUST changes, layers below are rebuilt (fresh COPY + npm run build).
ARG CACHEBUST
RUN echo "builder CACHEBUST=${CACHEBUST:-}"
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
# Remove env files from standalone output so Docker/K8s env vars win at runtime.
RUN rm -f .next/standalone/.env .next/standalone/.env.local \
          .next/standalone/.env.production .next/standalone/.env.production.local

# ── Stage 3: Worker Runner (Full source + deps for tsx/scripts) ──
FROM node:20-alpine AS worker-runner
WORKDIR /app
ENV NODE_ENV=production
# Copy everything needed for workers to execute
COPY --from=deps /app/node_modules ./node_modules
ARG CACHEBUST
RUN echo "worker-runner CACHEBUST=${CACHEBUST:-}"
COPY . .
# Ensure .env.local exists so tsx --env-file=.env.local doesn't crash.
# In Docker all env vars come from Compose; this file is intentionally empty.
RUN touch .env.local

# ── Stage 4: Web Runner (Optimized Standalone) ──
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only standalone artifacts
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
