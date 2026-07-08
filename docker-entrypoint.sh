#!/bin/sh
# Container entrypoint: apply production migrations, then start the app.
# Set RUN_MIGRATIONS=false to skip (e.g. if the platform runs migrations as a
# separate release step).
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
  npx prisma migrate deploy
else
  echo "[entrypoint] RUN_MIGRATIONS=false — skipping migrations."
fi

echo "[entrypoint] Starting application..."
exec "$@"
