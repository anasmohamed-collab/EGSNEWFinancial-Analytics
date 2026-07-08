# ROADMAP — Eagles Budget CRM & Financial Analytics

Ordered exactly as prioritized. Each step lists **status**, **tasks**, and
**done-when** acceptance criteria. Legend: ✅ done · 🟡 partial · 🚫 not started.

> Guiding rule that survives every step: **all financial numbers are produced by
> deterministic backend code** (`src/lib/calculations.ts`). AI never computes or
> edits a number.

---

## Step 1 — Backend foundation verification 🟡→✅
Confirm the existing backend is solid before building on it.
- [x] Prisma + PostgreSQL wired; singleton client.
- [x] Real API routes (auth, upload, report export).
- [x] Deterministic engine with unit tests (`npm test` → 21 passing).
- [ ] Add CI to run `typecheck` + `build` + `test` on every push.
- [ ] Add `engines` (Node ≥ 20) to `package.json`.
- [ ] Expand tests: `processing.ts` (standard resolution, summary recompute) and
      `analytics.ts` (aggregation) with a test DB or fixtures.

**Done when:** `npm run typecheck && npm run build && npm test` all pass in CI on
a clean checkout.

---

## Step 2 — PostgreSQL production database readiness 🚫
- [ ] Provision managed PostgreSQL (or the Dublyo-managed DB).
- [ ] Production `DATABASE_URL` with `sslmode=require`; add a pooled URL if the
      host is serverless.
- [ ] Switch deploy to **`prisma migrate deploy`** (never `migrate dev` in prod).
- [ ] One-time production seed of the **real admin** (not the demo password);
      decide whether to seed sites/standards or import them.
- [ ] Backup/restore policy (automated snapshots).

**Done when:** a fresh managed DB comes up via `migrate deploy`, the app connects
over SSL, and a real admin can log in.

---

## Step 3 — Environment variables & Dublyo/deployment readiness 🚫
- [ ] Add a **`Dockerfile`** (multi-stage: build → `next start`) or confirm the
      platform's Nixpacks build; add `.dockerignore`.
- [ ] Run `prisma migrate deploy` on release (entrypoint or release command).
- [ ] **Persistent upload storage:** mount a volume for `UPLOAD_DIR`, **or** move
      originals to object storage (S3/R2) — required because container disks are
      ephemeral. (DB already keeps raw rows for reprocessing.)
- [ ] Configure env in the platform: `DATABASE_URL`, `AUTH_SECRET` (strong random),
      `UPLOAD_DIR`, `NODE_ENV=production`, admin seed vars.
- [ ] Health check route + platform health probe.

**Done when:** a deploy from `main` boots, migrates, serves over HTTPS, persists an
uploaded file across a redeploy, and login works. (See `DEPLOYMENT_CHECKLIST.md`.)

---

## Step 4 — Real Excel upload & parsing ✅ (harden)
Already implemented and verified. Remaining hardening:
- [ ] Optional stricter mode: require a Standard column and fail if absent.
- [ ] General-expense section extraction (needs a real sample sheet format).
- [ ] Duplicate-upload UX: warn before overwriting an existing month.
- [ ] Larger-file handling / background processing if sheets grow.

**Done when:** a finance user can upload real monthly sheets (Arabic or English)
and see correct results, with clear Arabic errors on bad files.

---

## Step 5 — Deterministic monthly analysis engine ✅ (freeze)
Already implemented and unit-tested. Remaining:
- [ ] Golden-file tests: check a known sheet in → exact expected numbers out.
- [ ] Document the formulas + thresholds as a frozen spec (done in README; keep
      it authoritative and versioned).

**Done when:** the engine is covered by regression tests that fail if any formula
or threshold changes unexpectedly.

---

## Step 6 — Connect Executive Dashboard to real DB data ✅ (verify + guard)
Already DB-backed. Remaining:
- [ ] Add a visible **"بيانات تجريبية / Demo data"** banner while seed data is
      present, to prevent confusing demo with real numbers.
- [ ] Provide a safe "clear demo data" path before go-live.

**Done when:** the board sees only real uploaded data, with no ambiguity about
demo rows.

---

## Step 7 — Multi-month analysis 🟡
Logic exists (last4/6/12/all + custom/year in `resolvePeriods`); UI is partial.
- [ ] Wire **custom date range** and **full year** to the analysis UI.
- [ ] Add a multi-month **export** (Excel) and charts parity with monthly.
- [ ] Persisted `monthly_summaries` already speed this up — reuse them.

**Done when:** a user can pick any range (incl. custom + full year) and get correct
aggregated Net-vs-Standard, trends, and repeatedly-below-standard.

---

## Step 8 — NVIDIA AI executive **explanation** layer 🚫
Explanation only — never numeric authorship.
- [ ] Add `NVIDIA_API_KEY` / base URL / model to env (documented, not committed).
- [ ] Build `src/lib/services/aiExplanationService.ts` that takes **already-computed**
      metrics and returns **Arabic narrative** ("why did site X deviate?").
- [ ] Guardrails: read-only numeric context; ignore/validate any numbers the model
      emits; render AI text in a separate "توضيح الإدارة" panel beside the
      authoritative figures.
- [ ] Cache/store explanations per month to control cost.

**Done when:** the executive view shows an optional AI Arabic explanation that
**cannot change** any displayed number, with a clear separation from the data.

---

## Step 9 — Reports and exports 🟡
Monthly Excel export is live; the rest are placeholders.
- [ ] Server-side **PDF** (Arabic RTL) for the executive report (beyond browser print).
- [ ] Report types: site, standard-variance, expense, collection, multi-month.
- [ ] Scheduled/emailed monthly report (optional).

**Done when:** each catalogued report generates real Excel/PDF output.

---

## Step 10 — Final production hardening 🚫
- [ ] Security: rate limiting + lockout on login, CSRF token on POSTs, security
      headers, forced admin password change.
- [ ] Role enforcement in the UI (nav + actions per role).
- [ ] Edit **audit log** once CRUD exists (who changed a standard/expense, when).
- [ ] Observability: error logging, uptime + DB monitoring, backups tested.
- [ ] Load-check upload/parse on realistic sheet sizes.

**Done when:** the app passes a security + reliability review for internal
production use.

---

### Parallel/enabling work (not blocking the main line)
- Management **CRUD forms** for Sites / Standards / General Expenses (currently
  read-only) — needed before real operations; slot after Step 3 or alongside 6–7.
- User management (add finance/operations/viewer users).
