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

## 1. Required environment variables

| Variable | Required | Production value / notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Managed Postgres URL; append `&sslmode=require`. Use a pooled URL if the platform is serverless. |
| `AUTH_SECRET` | ✅ | Long random string (≥ 32 chars). `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `APP_URL` | ✅ | Public HTTPS URL of the app (e.g. `https://budget.eaglesgroup.…`). |
| `UPLOAD_DIR` | ✅ | Path mounted to a **persistent volume** (e.g. `/app/storage/uploads`). |
| `SEED_ADMIN_EMAIL` | ✅ (one-time) | Real admin email for the initial seed. |
| `SEED_ADMIN_PASSWORD` | ✅ (one-time) | Strong password; change after first login. |
| `NODE_ENV` | ✅ | `production` (enables secure cookies). |
| `RUN_MIGRATIONS` | optional | Default `true` (entrypoint runs migrations). Set `false` to run them as a separate release step. |
| `NVIDIA_API_KEY` / `NVIDIA_BASE_URL` / `NVIDIA_MODEL` | ❌ (later) | Placeholders only — leave empty. |
| `AI_ANALYSIS_ENABLED` | ❌ (later) | Keep `false`. |

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
