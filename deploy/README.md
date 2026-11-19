# Deploy: staging → live

Server: one VPS, PM2 + Nginx, PostgreSQL 16, Redis (localhost).

| | Live | Staging |
|---|---|---|
| Folder | `/home/ez-manage` | `/home/ezmanage-staging` |
| Branch | `main` | `staging` |
| Web | `ezmanage-web` · port 3096 · manage.ezify.pk | `ezmanage-staging-web` · port 3100 · staging-manage.ezify.pk |
| API | `ezmanage-api` · port 3010 · apimanage.ezify.pk | `ezmanage-staging-api` · port 3110 · staging-apimanage.ezify.pk |
| Database | `ezmanage` | `ezmanage_staging` |
| Redis | `REDIS_DB=0` | `REDIS_DB=1` |

## Flow
1. Work on a feature branch → merge into `staging` → `./deploy/deploy.sh staging` → test on staging-manage.ezify.pk.
2. When staging is good → merge `staging` into `main` → `./deploy/deploy.sh live` (asks you to type `LIVE`, backs up the database first).

## Staging `.env` — must differ from live
`apps/api/.env`
- `DATABASE_URL` → the `ezmanage_staging` database (never the live one)
- `PORT=3110`, `NODE_ENV=production`
- `FRONTEND_URL=https://staging-manage.ezify.pk`
- `REDIS_DB=1` (otherwise staging and live share background jobs)
- `MAIL_REDIRECT_TO=you@yourcompany.com` (every staging email goes to this inbox, never to clients)
- `SESSION_SECRET` → a new random value
- `WHATSAPP_TOKEN=` (empty), `VAPID_*` → new keys or empty (no WhatsApp / push to real people)
- `BUNNY_*` → a separate storage zone or folder if possible

`apps/web/.env.local` (read at build time)
- `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_BACKEND_BASE_URL` → `https://staging-apimanage.ezify.pk`
