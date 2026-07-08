# PROJECT AUDIT — Eagles Budget CRM & Financial Analytics

**Audit date:** 2026-07-08
**Method:** Manual code inspection (read-only). **RepoWise was NOT used** — the
RepoWise MCP server is indexing a different repository (`D:\github\legal-crm-Trial`),
not this project, so it could not analyze this codebase. The audit below is based
on directly reading the source, schema, migrations, env files, and git history.

**Repo:** `github.com/anasmohamed-collab/EGSNEWFinancial-Analytics` (branch `main`,
tree clean).
**Commits:** 2 — `a2ee45c` (Arabic RTL executive foundation), `c3d04c2` "P1"
(real Excel upload + parser/analysis services). Both pushed to `origin/main`.

> **Honest one-line status:** This is a **real, working backend application**
> (PostgreSQL + Prisma + deterministic engine + real Excel processing + JWT
> auth + DB-backed dashboards), **not** a frontend/demo shell. The main gaps are
> **deployment readiness**, **management CRUD forms**, and the **not-yet-started
> NVIDIA AI layer** — not the core data pipeline.

---

## 1. Current Project Status

### ✅ Actually implemented (real, verified working)
- **Authentication** — JWT (jose) in an httpOnly cookie, bcrypt password hashing,
  middleware route protection, login/logout API. Verified: login 200, bad
  password 401, unauthenticated redirect 307.
- **PostgreSQL + Prisma** — 7 models, 4 enums, 2 migrations applied; stores BOTH
  raw uploaded data and normalized data.
- **Real Excel upload & processing** — file saved to disk + raw rows to DB,
  parsed, validated, normalized into `monthly_site_budgets` + `monthly_summaries`.
  Verified end-to-end with a real Arabic sheet (numbers matched hand-calculation).
- **Deterministic calculation engine** (`src/lib/calculations.ts`) — pure
  functions, **21 unit tests passing** (`npm test`).
- **Monthly analysis** — computed live from the DB (`getMonthlyAnalysis`).
- **Multi-month analysis** — computed live (`getMultiMonthAnalysis`): last 4 / 6 /
  12 / all, monthly + site trends, repeatedly-below-standard.
- **Executive dashboard** — DB-backed board KPIs, rule-based recommendation,
  deviation reason, current-vs-previous comparison, details hidden behind
  «عرض التفاصيل».
- **Executive report** — Arabic RTL print-to-PDF page.
- **Arabic-first i18n + RTL** — `ar`/`en` dictionaries, cookie switcher, no
  hardcoded UI text.
- **Excel export** — `/api/reports/monthly` returns a localized `.xlsx`.

### 🟡 Partially implemented
- **Sites / Standards / General Expenses pages** — **read-only views** of DB data;
  **no create/edit forms** yet. Standards are created implicitly (upload/seed);
  expenses only via seed.
- **Multi-month presets** — `custom` range and `full year` exist in the analysis
  logic (`resolvePeriods`) but are **not wired to the UI** (only last4/6/12/all
  buttons).
- **Reports** — only the **monthly Excel export** is live; the other report types
  are shown as a labelled "roadmap" catalogue, not implemented.
- **Roles** — 4 roles defined in schema and **VIEWER upload is blocked in the API**,
  but there is **no role-based UI gating / nav filtering**.

### 🚫 Not implemented yet
- **NVIDIA AI executive-explanation layer** — no API key, no service, no usage
  (intentionally deferred; correct per plan).
- **Deployment config** — no Dockerfile / Procfile / PaaS config; uploads use
  local disk (ephemeral in containers).
- **User management / password reset / self-service admin.**
- **Server-side PDF generation** (currently browser print only).
- **Advanced reports** — site, standard-variance, expense, collection,
  multi-month export.
- **General-expense extraction from the Excel sheet** (documented assumption —
  general expenses are entered manually / seeded).
- **Security hardening** — rate limiting, CSRF tokens, edit audit log.

### Demo vs real data
`prisma/seed.ts` inserts **demo data** (admin + 7 sites + 4 months + general
expenses + a sample `.xlsx`). **However, every screen reads live DB data** — there
are **no hardcoded numbers in the UI**. The risk is human (confusing seeded demo
numbers with real ones), not architectural. Mitigated by the fully-real upload flow.

---

## 2. Backend Status

**There is a real backend** (Next.js App Router server components + route handlers
+ Prisma). It is not mock/demo data.

**API routes** (`src/app/api/**`):
| Route | Method | Purpose |
| --- | --- | --- |
| `/api/auth/login` | POST | Verify credentials (bcrypt), set JWT cookie |
| `/api/auth/logout` | POST | Clear session cookie |
| `/api/upload` | POST | Real Excel upload → parse → validate → normalize |
| `/api/reports/monthly` | GET | Localized `.xlsx` export of a month |

**Server actions:** none (mutations go through route handlers; reads happen in
server components). This is a valid pattern; there simply are no `"use server"`
actions yet.

**Services / modules** (`src/lib`):
- `services/excelBudgetParserService.ts` — deterministic workbook parser (header
  detection, Arabic/English aliases, structured issues).
- `services/monthlyAnalysisService.ts` — upload lifecycle orchestrator +
  `generateMonthlyAnalysis`.
- `calculations.ts` — pure financial formulas (the engine).
- `processing.ts` — normalize parsed rows → DB + recompute summaries.
- `analytics.ts` — DB read-models for monthly + multi-month dashboards.
- `auth.ts`, `prisma.ts`, `constants.ts`, `utils.ts`.

**Real Excel processing?** **Yes.** `xlsx` (SheetJS) reads the workbook;
`excelBudgetParserService` extracts + validates; `processing.ts` writes normalized
rows. Confirmed working against a live Arabic sheet.

**Real monthly analysis logic?** **Yes** — computed from the DB by
`analytics.ts` (17 distinct `prisma.*` call sites across the data layer). Not
static; seed data only provides rows to compute over.

---

## 3. Database Status

- **Technology:** PostgreSQL (verified running locally on `:5432`).
- **PostgreSQL ready?** Yes for dev; provider is `postgresql`, `DATABASE_URL`
  wired through `datasource db`. Not yet configured for a managed/production DB
  (SSL params, pooling).
- **ORM:** Prisma (`@prisma/client` 6.19) with a hot-reload-safe singleton.
- **Models (7):** `User`, `UploadedFile`, `Site`, `MonthlySiteBudget`,
  `ExpenseItem`, `MonthlySummary`, `StandardHistory`.
  **Enums (4):** `Role`, `UploadStatus` (UPLOADED/PROCESSING/PROCESSED/FAILED),
  `PerformanceStatus`, `ExpenseType`.
- **Migrations (2):** `..._init`, `..._add_processing_status`. Migration lock =
  postgresql.
- **Suitable for real monthly uploads?** **Yes.** Stores raw file + raw rows
  (audit/reprocess), normalized per-site rows, per-month summaries, and full
  standards history. `@@unique([siteId, year, month])` prevents duplicates;
  re-upload upserts.
- **Missing for production DB:**
  - Managed Postgres connection (SSL `sslmode=require`, connection pooling / a
    pooled URL for serverless).
  - A deploy-time `prisma migrate deploy` step (currently only `migrate dev`).
  - Money is `Decimal(14,2)` (good); confirm precision limits fit largest sites.
  - No soft-delete / row-level audit of manual edits (edits not yet possible).

---

## 4. Deployment Status

- **Ready for deployment?** **Not yet.** The app builds and runs (`npm run build`
  + `npm start` verified), but there is **no deployment configuration**.
- **Env vars currently used:** `DATABASE_URL`, `AUTH_SECRET`, `UPLOAD_DIR`,
  `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `NODE_ENV`. (`.env.example` documents
  the first five.)
- **Env vars missing for production:** a production `DATABASE_URL` (managed PG,
  SSL), a strong `AUTH_SECRET`, and — later — NVIDIA AI keys (not needed yet).
- **"Dublyo" deployment:** the exact platform is unclear to the auditor; treated
  as a container/PaaS target. Ready? **No** — needs a `Dockerfile` (or Nixpacks
  build), a persistent volume for uploads, a managed Postgres, and a
  migrate-on-deploy step. See `DEPLOYMENT_CHECKLIST.md`.
- **`DATABASE_URL` used correctly?** **Yes** — single source via Prisma datasource;
  no hardcoded connection strings in code.
- **Uploads safe for production?** **⚠️ No, as-is.** Files are written to local
  disk (`UPLOAD_DIR` → `writeFile`). On most PaaS/containers the filesystem is
  **ephemeral** — original `.xlsx` files are lost on redeploy. *Mitigation:* the
  raw rows are also stored in the DB (`uploaded_files.rawRows`), so reprocessing
  survives; but to keep original files, mount a persistent volume or move to
  object storage (S3/R2).
- **Deployment risks:**
  1. Ephemeral upload storage (above).
  2. No `Dockerfile`/build config for the target platform.
  3. `migrate dev` is not a deploy strategy — need `migrate deploy`.
  4. Default seeded admin password (`Admin@12345`) must be rotated before prod.
  5. `AUTH_SECRET` in the committed `.env`? — checked: `.env` is **gitignored**
     (not committed); only `.env.example` (placeholder) is tracked. ✅
  6. No `engines` (Node version) pin in `package.json`.

---

## 5. Authentication Status

- **Implemented:** email/password login → **bcrypt** verify → **JWT (HS256, jose)**
  in an **httpOnly, sameSite=lax, secure-in-prod** cookie (8h expiry); `middleware.ts`
  protects all non-public routes; generic error messages (no user enumeration).
- **Production-ready?** **Mostly, for a single-admin internal tool.** Solid
  fundamentals. Missing for a hardened multi-user system: rate limiting / lockout,
  refresh-token rotation, CSRF token on the POST endpoints, and a user-management UI.
- **Admin seed logic:** `prisma/seed.ts` creates one `ADMIN` from
  `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (defaults `admin@eaglesgroup.local` /
  `Admin@12345`).
- **Missing:** password reset, forced first-login password change, additional
  users/roles provisioning, session revocation list.

---

## 6. Executive Dashboard Status

- **Real & DB-connected:** all KPIs (إجمالي الصافي، الاستاندرد، الفرق، نسبة التحقيق،
  الصافي بعد المصروفات، أفضل/أضعف موقع، سبب الانحراف، توصية الإدارة) come from
  `getMonthlyAnalysis` + `getMultiMonthAnalysis` over live DB rows.
- **Recommendation text** is **rule-based** (deterministic thresholds on achievement
  %), not AI — correct and safe for now.
- **Static/demo?** None of the numbers are static; only the *seed rows* they compute
  over are demo data.
- **Detailed tables hidden correctly?** **Yes** — the site chart + full table sit
  inside `DetailsToggle` («عرض التفاصيل»), hidden by default per the board UX rule.

---

## 7. Excel Upload & Processing Status

- **Real upload supported?** **Yes.** `/api/upload` (Node runtime) →
  `processUploadedWorkbook` → `excelBudgetParserService` → `processing.ts`.
- **How it works:** register file (UPLOADED) → save original to disk + raw rows to
  DB → detect header row (handles title/blank/notes above the table) → map
  Arabic/English column aliases → extract site rows (skips totals/notes safely) →
  validate → normalize with deterministic math → status PROCESSING → PROCESSED (or
  FAILED with **Arabic** error messages) → redirect to the monthly analysis page.
- **What's missing:** general-expense extraction **from the sheet** (currently
  manual/seed); optional stricter per-row standard enforcement; large-file
  streaming (fine at ≤10 MB).
- **Parser/service to build next:** none for core — the parser/analysis services
  already exist. Future: an `expenseSectionParser` if sheets carry a general-expenses
  block, and a background job if files get large.
- **Assumptions about the sheet:** first worksheet, one row per site; header appears
  within the first ~25 rows; **hard-required** columns = site name, gross collection,
  salaries, operating expenses; contract/net/standard optional; **Net is always
  computed** (`gross − salaries − opex`), sheet Net is cross-check only; 14% assumed
  already inside operating expenses.

---

## 8. NVIDIA AI Status

- **Configured?** **No.** No NVIDIA (or any LLM) API key, base URL, or client.
- **Env variables present?** **None** for AI.
- **AI service module?** **None.**
- **AI used anywhere?** **No** — the only references are comments/tests asserting
  the engine is deterministic and "no AI."
- **Keeping AI away from financial numbers (later):** the AI layer must be
  **explanation-only** — it receives already-computed, deterministic figures and
  returns *Arabic narrative text*; it must **never** produce or alter a number.
  Enforce by: passing computed metrics as read-only context, validating that AI
  output contains no new figures (or ignoring any numbers it emits), and rendering
  AI text in a clearly-separated "توضيح" panel next to the authoritative numbers.

---

## 9. File / Folder Map

```
prisma/
  schema.prisma            7 models + 4 enums (raw + normalized storage)
  migrations/              2 applied migrations (init, add_processing_status)
  seed.ts                  demo admin + 7 sites + 4 months + expenses + sample .xlsx
src/
  middleware.ts            JWT route protection (redirects unauthenticated users)
  app/
    layout.tsx             root: sets <html lang dir>, wraps I18nProvider
    page.tsx               redirects "/" → "/executive" (board landing)
    login/                 sign-in page (client)
    (app)/                 authenticated shell (sidebar + topbar)
      layout.tsx           session guard
      executive/           ⭐ Executive board dashboard (DB-backed)
      dashboard/           detailed monthly dashboard (DB-backed)
      analysis/            multi-month analysis (DB-backed)
      upload/              Excel upload page + recent uploads
      sites/ standards/ expenses/   READ-ONLY management views
      reports/             report catalogue + monthly Excel export links
    (print)/
      executive/report/    Arabic RTL print-to-PDF report
    api/
      auth/login, auth/logout, upload, reports/monthly
  components/
    ui/                    shadcn-style primitives (card, button, table, input…)
    charts/                Recharts (net-vs-standard, monthly-trend)
    sidebar, topbar, site-table, stat-card, status-badge, period-selector,
    preset-selector, details-toggle, language-switcher, print-button, page-header
  i18n/
    config.ts              locales (ar default), direction
    dictionaries/ar.ts,en.ts   all UI strings (source of truth = ar)
    server.ts              getI18n() for server components
    provider.tsx           useI18n() for client components
    format.ts              locale-aware currency / % / dates / Arabic months
    parse-errors.ts        maps parser issue codes → Arabic messages
  lib/
    calculations.ts        ⭐ pure deterministic engine (+ .test.ts)
    services/
      excelBudgetParserService.ts   ⭐ workbook parser (+ .test.ts)
      monthlyAnalysisService.ts     upload lifecycle + generateMonthlyAnalysis
    processing.ts          parsed rows → DB + recompute summaries
    analytics.ts           DB read-models (monthly + multi-month)
    auth.ts prisma.ts constants.ts utils.ts excel.ts(shim)
root: docker-compose.yml (local Postgres only), next.config.mjs, tailwind,
      tsconfig, vitest.config.ts, .env.example, README.md
```

---

## 10. Risks and Problems

| # | Risk | Severity | Notes |
| --- | --- | --- | --- |
| 1 | **Ephemeral upload storage in production** | 🔴 High | Local `writeFile`; original files lost on redeploy without a volume/object storage. Raw rows in DB mitigate reprocessing. |
| 2 | **No deployment config** | 🔴 High | No Dockerfile / PaaS config / migrate-on-deploy. |
| 3 | **Default admin password** | 🟠 Med | `Admin@12345` must be rotated before prod. |
| 4 | **Management CRUD missing** | 🟠 Med | Sites/Standards/Expenses are read-only; standards editing not possible in-app. |
| 5 | **Seed demo data vs real data confusion** | 🟠 Med | UI reads live DB, but seeded numbers can be mistaken for real. Add a "demo data" banner / a reset path before go-live. |
| 6 | **Roles not enforced in UI** | 🟡 Low | Only VIEWER-upload blocked in API. |
| 7 | **No AI env variables yet** | 🟡 Low | Expected — AI step not started. Not a defect. |
| 8 | **Frontend built alongside/before some backend** | 🟡 Low | True historically, but backend now exists and is real; remaining gap is CRUD + deploy, not core logic. |
| 9 | **No rate limiting / CSRF / lockout** | 🟡 Low | Fine for internal tool; harden before public exposure. |
| 10 | **No `engines` Node pin** | 🟢 Info | Add for reproducible builds. |

**Myth-check:** "mostly frontend/demo data" is **not accurate** — the backend,
database, engine, and Excel pipeline are real and tested. The real gaps are
**operational** (deploy, storage, CRUD, AI), not foundational.

---

## 11. Correct Roadmap From Here

See **`ROADMAP.md`** for the full step-by-step plan. Summary order:

1. Backend foundation verification ✅ (largely done — verify + lock in)
2. PostgreSQL production readiness
3. Environment variables + deployment (Dublyo/container) readiness
4. Real Excel upload & parsing ✅ (done — harden + edge cases)
5. Deterministic monthly analysis engine ✅ (done — freeze + expand tests)
6. Connect Executive Dashboard to real DB ✅ (done — verify + demo-data guard)
7. Multi-month analysis (wire custom-range + full-year to UI)
8. NVIDIA AI executive **explanation** layer (numbers stay deterministic)
9. Reports & exports (PDF server-side, more report types)
10. Final production hardening (security, backups, monitoring)

---

## 12. What was inspected

Git history + status + remote; full tracked file tree; `package.json`,
`.env` / `.env.example`, `next.config.mjs`, `tsconfig.json`; `prisma/schema.prisma`
+ both migrations; `src/lib/auth.ts`, `analytics.ts`, `processing.ts`, `calculations.ts`,
`services/*`; all `src/app/api/**` routes; `src/middleware.ts`; grep sweeps for
`prisma.*` call sites, `process.env.*` usage, NVIDIA/AI references, and
TODO/mock/placeholder markers; deployment-artifact presence check.
