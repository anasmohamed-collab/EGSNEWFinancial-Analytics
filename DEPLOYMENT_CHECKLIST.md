# DEPLOYMENT CHECKLIST — Eagles Budget CRM

Status today: **not deployment-ready** (app builds and runs; deployment
configuration and production storage are missing). This checklist describes what
**currently exists** and what must be added. It documents state — it does not
change deployment logic.

> Target platform noted as **"Dublyo"** in the brief. The exact platform is
> unclear to the auditor; this checklist assumes a **container/PaaS** target
> (Docker or Nixpacks + managed Postgres). Adjust specifics to the real platform.

---

## What already exists ✅
- Production build works: `npm run build` (`prisma generate && next build`) and
  `npm start` verified.
- Single, correct DB entry point: Prisma `datasource db { url = env("DATABASE_URL") }`.
- Auth secret read from env (`AUTH_SECRET`), fails fast if too short.
- `.env` is **gitignored** (not committed); `.env.example` documents the vars.
- `docker-compose.yml` — **local dev Postgres only** (not the app; not for prod).
- Raw uploaded rows persisted in the DB (`uploaded_files.rawRows`) → months can be
  reprocessed even if original files are lost.

## What is missing ❌ (blockers)
- [ ] **Dockerfile** (or confirmed Nixpacks build) for the app + `.dockerignore`.
- [ ] **Persistent storage for `UPLOAD_DIR`** (volume) or object storage (S3/R2) —
      container disks are ephemeral; original `.xlsx` files would be lost on redeploy.
- [ ] **Migrate-on-deploy**: run `prisma migrate deploy` at release
      (not `migrate dev`).
- [ ] **Managed PostgreSQL** with SSL (`sslmode=require`) and, if serverless, a
      pooled connection URL.
- [ ] **Strong `AUTH_SECRET`** and **rotated admin password** (default is
      `Admin@12345`).
- [ ] Health-check endpoint + platform probe.
- [ ] `engines` (Node ≥ 20) pin in `package.json`.

---

## Environment variables

| Variable | Exists in code | Needed in prod | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✅ used | ✅ | Managed PG + `sslmode=require`; pooled URL if serverless |
| `AUTH_SECRET` | ✅ used | ✅ | Long random (≥ 32 chars); rotate; keep out of git |
| `UPLOAD_DIR` | ✅ used | ✅ | Point at a **persistent volume** mount path |
| `SEED_ADMIN_EMAIL` | ✅ used (seed) | ✅ (one-time) | Real admin email |
| `SEED_ADMIN_PASSWORD` | ✅ used (seed) | ✅ (one-time) | Strong; change on first login |
| `NODE_ENV` | ✅ read | ✅ | `production` (enables `secure` cookies) |
| `NVIDIA_API_KEY` (+ base URL/model) | 🚫 not yet | later (Step 8) | Only when the AI explanation layer is built |

---

## Pre-deploy checklist
- [ ] Provision managed PostgreSQL; set production `DATABASE_URL` (SSL).
- [ ] Generate and set a strong `AUTH_SECRET`.
- [ ] Create a persistent volume; set `UPLOAD_DIR` to its mount path
      (or switch uploads to object storage).
- [ ] Add a `Dockerfile` (multi-stage) **or** confirm the platform build.
- [ ] Release command runs `prisma migrate deploy`.
- [ ] Seed the real admin once; then rotate/att change the password.
- [ ] Set `NODE_ENV=production`.

## Deploy
- [ ] Build image / trigger platform build from `main`.
- [ ] Run migrations (`prisma migrate deploy`).
- [ ] Boot app (`next start`); confirm health check passes.

## Post-deploy verification
- [ ] HTTPS reachable; `/login` loads in Arabic RTL.
- [ ] Admin can log in (session cookie set, `secure` in prod).
- [ ] Upload a real sheet → status reaches **تم التحليل** → analysis renders.
- [ ] **Redeploy, then confirm a previously-uploaded original file still exists**
      (proves persistent storage). Reprocessing works even if not (raw rows in DB).
- [ ] Excel export downloads a valid `.xlsx`.

---

## Deployment risks (from the audit)
1. 🔴 **Ephemeral upload storage** — original files lost on redeploy without a
   volume/object storage. (DB raw rows mitigate reprocessing, not file retention.)
2. 🔴 **No Dockerfile / build config** for the target platform.
3. 🟠 **`migrate dev` is not a deploy strategy** — use `migrate deploy`.
4. 🟠 **Default admin password** must be changed before go-live.
5. 🟡 **No rate limiting / CSRF** on auth + upload POSTs (harden for exposure).
6. 🟡 **No `engines` pin**; no CI gate on build/test.

---

## Notes on current storage behavior (documented, unchanged)
`/api/upload` writes the original file with
`writeFile(join(UPLOAD_DIR, "<year>-<month>-<uuid>.xlsx"), buffer)` and stores the
parsed rows in `uploaded_files.rawRows`. To make this production-safe, either mount
`UPLOAD_DIR` on a persistent volume or replace the `writeFile` sink with an object-
storage upload (S3/R2) — **this is a future change, not part of this audit.**
