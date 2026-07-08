# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Production image for Eagles Budget CRM (Next.js 15 + Prisma + PostgreSQL).
# Multi-stage build. Compatible with container/PaaS platforms (e.g. Dublyo).
#
# At startup the entrypoint runs `prisma migrate deploy` (production-safe)
# and then `next start`. Migrations can be disabled with RUN_MIGRATIONS=false
# if your platform runs them as a separate release step.
# ---------------------------------------------------------------------------

# ---- deps: full dependency install (incl. dev) for the build ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- builder: generate Prisma client + build Next.js ----
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---- runner: lean production runtime (production deps only) ----
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root runtime user.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Install production dependencies only. `prisma` is a runtime dependency so
# `prisma migrate deploy` is available in the container.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev \
  && npx prisma generate \
  && npm cache clean --force

# Built application + static assets + config.
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Ops scripts (admin bootstrap) — plain Node, uses production deps only.
COPY scripts ./scripts

# Entrypoint (runs migrations, then starts the server).
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh \
  && mkdir -p /app/storage/uploads \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

# NOTE: /app/storage/uploads must be mounted to a PERSISTENT VOLUME in
# production (see DEPLOYMENT_CHECKLIST.md). Without it, original uploaded
# Excel files are lost on redeploy (parsed rows survive in the database).
VOLUME ["/app/storage/uploads"]

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
