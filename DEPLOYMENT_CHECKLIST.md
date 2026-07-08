# DEPLOYMENT CHECKLIST — Eagles Budget CRM

Deployment foundation is now in place: a production **Dockerfile**, **health
check**, **production scripts**, and complete **env vars**. This document is the
exact runbook for deploying to a container/PaaS platform (e.g. **Dublyo**).

> Target platform is referred to as **"Dublyo"**. The steps below are written for
> a generic container/PaaS (Docker image + managed Postgres + persistent volume).
> Map the "platform config" items to Dublyo's dashboard equivalents.

---

## 0. What now exists ✅
- `Dockerfile` — multi-stage, non-root, production runtime.
- `docker-entrypoint.sh` — runs `prisma migrate deploy` then starts the app
  (skippable with `RUN_MIGRATIONS=false`).
- `.dockerignore` — keeps secrets, `node_modules`, `.next`, uploads out of the image.
- `/api/health` — public health probe (app + DB + timestamp).
- Scripts: `build` (`prisma generate && next build`), `start` (`next start`),
  `db:deploy` (`prisma migrate deploy`).
- `prisma` CLI is a **runtime dependency** → `migrate deploy` works in the container.
- `engines.node >= 20`.

Still **out of scope** (documented, not implemented): S3/object storage, CRUD
forms, NVIDIA AI, CI pipeline.

---

## 1. Environment variables (audited & minimized)

**Absolute minimum to run in production right now:** `DATABASE_URL` + `AUTH_SECRET`.
Plus `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` **only for the one-time admin seed**.

### Set in Dublyo now
| Variable | Tier | Notes |
| --- | --- | --- |
| `DATABASE_URL` | **Required** | Managed Postgres URL; append `&sslmode=require`. Only variable the app truly needs to connect. |
| `AUTH_SECRET` | **Required** | Long random string (≥ 32). App throws if missing/short. |
| `SEED_ADMIN_EMAIL` | One-time | Needed only to run `npm run db:seed` (create the first admin). Removable after. |
| `SEED_ADMIN_PASSWORD` | One-time | Same; change after first login. |

### Optional (safe defaults — set only to override)
| Variable | Default | When to set |
| --- | --- | --- |
| `NODE_ENV` | `production` (auto-set by `next start`) | Rarely needed. |
| `UPLOAD_DIR` | `./storage/uploads` → `/app/storage/uploads` (the VOLUME) | Only if the volume mounts at a different path. |
| `RUN_MIGRATIONS` | `true` (entrypoint runs `migrate deploy`) | Set `false` to migrate as a separate release step. |

### Do NOT set in Dublyo
| Variable | Why |
| --- | --- |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | **Local docker-compose only** — they configure the local Postgres container. Production uses `DATABASE_URL`. Delete these in the Dublyo UI. |
| `APP_URL` | Not referenced anywhere in the app yet. |
| `NVIDIA_API_KEY` / `NVIDIA_BASE_URL` / `NVIDIA_MODEL` / `AI_ANALYSIS_ENABLED` | AI not implemented — future step. |

> Dublyo auto-detected 14 keys because it scanned **both** `docker-compose.yml`
> (the `POSTGRES_*`) **and** `.env.example`. Those extra keys are now commented
> out in `.env.example`; the `POSTGRES_*` remain in `docker-compose.yml` for local
> dev only — **delete them from the Dublyo variables list.**

---

## 2. Build command
```
npm run build
```
(= `prisma generate && next build`.) In Docker this runs inside the image build.

## 3. Start command
```
npm run start
```
(= `next start`, binds `PORT` / `HOSTNAME`.) In Docker the entrypoint runs this
after migrations.

## 4. Migration command (production)
```
npm run db:deploy      # = prisma migrate deploy
```
Run automatically by `docker-entrypoint.sh` on container start, or as a platform
release step. **Never** use `prisma migrate dev` or `prisma db push` in production.

## 5. Upload storage requirement ⚠️
- `UPLOAD_DIR` **must** be mounted to a **persistent volume** (the Dockerfile
  declares `VOLUME ["/app/storage/uploads"]`).
- **If no persistent volume is attached, original uploaded Excel files are lost
  on every redeploy.** The parsed/normalized data survives in the database
  (`uploaded_files.rawRows` + `monthly_site_budgets`), so analysis is unaffected,
  but the original `.xlsx` files would be gone.
- Object storage (S3/R2) is intentionally **not** used yet.

## 6. Health check URL
```
GET /api/health   →   200 { "status":"ok", "app":"up", "database":"up", "timestamp":"…" }
```
Returns `503` with `"database":"down"` if the DB is unreachable. Public (no auth).
Point the platform's health probe at `/api/health`.

---

## Deploy runbook (step by step)

**Provision**
- [ ] Create managed PostgreSQL; get its SSL connection string.
- [ ] Create a persistent volume for uploads.

**Configure platform env** (section 1)
- [ ] `DATABASE_URL` (SSL), `AUTH_SECRET` (strong), `APP_URL`, `UPLOAD_DIR`
      (volume path), `NODE_ENV=production`, admin seed vars.

**Build & release**
- [ ] Build the image from the `Dockerfile` (platform build from `main`).
- [ ] On start, the entrypoint runs `prisma migrate deploy` automatically
      (or run `npm run db:deploy` as a release step with `RUN_MIGRATIONS=false`).
- [ ] Seed the real admin once: `npm run db:seed` (or a one-off task).

**Verify (post-deploy)**
- [ ] **Health check:** `curl https://<APP_URL>/api/health` → `200` and
      `"database":"up"`.
- [ ] **First login test:** open `/login`, sign in with the seeded admin →
      lands on `/executive` (Arabic RTL). Then change the admin password.
- [ ] **First Excel upload test:** go to **رفع ملف Excel**, pick month/year,
      upload a real sheet → status reaches **تم التحليل** → redirected to the
      monthly analysis with correct Net-vs-Standard numbers.
- [ ] **Persistence test:** redeploy, then confirm a previously-uploaded original
      file still exists on the volume (proves the persistent mount). Reprocessing
      works regardless (raw rows in DB).

---

## Deployment risks (tracked)
1. 🔴 **Ephemeral upload storage** without a mounted volume → original files lost.
2. 🟠 **Default admin password** (`Admin@12345`) must be changed after first login.
3. 🟠 **`AUTH_SECRET`** must be a strong per-environment secret (never the example).
4. 🟡 **No rate limiting / CSRF** on auth + upload (harden before public exposure).
5. 🟡 **No CI gate** yet (run `typecheck` + `build` + `test` before release).

## Local Docker smoke test (optional, needs Docker)
```
docker build -t eagles-budget .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://…?sslmode=require" \
  -e AUTH_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")" \
  -e APP_URL="http://localhost:3000" \
  -e UPLOAD_DIR="/app/storage/uploads" \
  -e NODE_ENV=production \
  -v eagles_uploads:/app/storage/uploads \
  eagles-budget
# then: curl http://localhost:3000/api/health
```
