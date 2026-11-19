#!/usr/bin/env bash
# EZ Manage deploy (run ON THE SERVER):
#   ./deploy/deploy.sh staging   → /home/ezmanage-staging, branch staging, ports 3100 (web) / 3110 (api)
#   ./deploy/deploy.sh live      → /home/ez-manage,        branch main,    ports 3096 (web) / 3010 (api)
# Steps: pull → (live: database backup) → install → migrate → build → reload PM2 → health check.
set -euo pipefail

TARGET="${1:-}"
case "$TARGET" in
  staging) DIR=/home/ezmanage-staging; BRANCH=staging; API=ezmanage-staging-api; WEB=ezmanage-staging-web; WEB_PORT=3100; API_PORT=3110 ;;
  live)    DIR=/home/ez-manage;        BRANCH=main;    API=ezmanage-api;         WEB=ezmanage-web;         WEB_PORT=3096; API_PORT=3010 ;;
  *) echo "usage: $0 staging|live"; exit 1 ;;
esac

if [ "$TARGET" = "live" ]; then
  read -r -p "Deploy branch 'main' to LIVE (manage.ezify.pk)? Type LIVE to continue: " ok
  [ "$ok" = "LIVE" ] || { echo "Cancelled."; exit 1; }
fi

cd "$DIR"
echo "▶ $TARGET: $DIR ($BRANCH)"

# 1. code — only fast-forward, never overwrite local changes
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
echo "  now at $(git log --oneline -1)"

# 2. live only: database backup before migrations
if [ "$TARGET" = "live" ]; then
  mkdir -p /root/backups
  DB_URL="$(grep -E '^DATABASE_URL=' apps/api/.env | head -1 | cut -d= -f2- | tr -d '"'"'")"
  DB_URL="${DB_URL%%\?*}"   # pg_dump does not accept ?schema=…
  FILE="/root/backups/ezmanage-$(date +%Y-%m-%d-%H%M).sql.gz"
  pg_dump "$DB_URL" | gzip > "$FILE"
  echo "  backup: $FILE ($(du -h "$FILE" | cut -f1))"
  ls -1t /root/backups/ezmanage-*.sql.gz | tail -n +15 | xargs -r rm --   # keep the newest 14
fi

# 3. install + database migrations
pnpm install --frozen-lockfile
( cd apps/api && npx prisma migrate deploy && npx prisma generate )

# 4. build
pnpm --filter api build
pnpm --filter web build

# 5. (re)start with PM2
if pm2 describe "$API" >/dev/null 2>&1; then pm2 reload "$API" --update-env; else
  ( cd apps/api && pm2 start dist/apps/api/src/main.js --name "$API" ); fi
if pm2 describe "$WEB" >/dev/null 2>&1; then pm2 reload "$WEB" --update-env; else
  pm2 start pnpm --name "$WEB" -- -F web start -p "$WEB_PORT"; fi
pm2 save

# 6. health check (the API answers 401 on /auth/me when it is up)
sleep 8
code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$API_PORT/api/auth/me" || true)"
web="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$WEB_PORT/login" || true)"
echo "  api $API_PORT → $code   web $WEB_PORT → $web"
if [ "$code" != "401" ] || [ "$web" != "200" ]; then
  echo "⚠ health check failed — see: pm2 logs $API --lines 50 --nostream / pm2 logs $WEB --lines 50 --nostream"
  exit 1
fi
echo "✅ $TARGET deployed"
