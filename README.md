# Eagles Budget CRM & Financial Analytics System

A financial-operations CRM built specifically for **Eagles Group Security** to
analyse monthly security-site budgets. It ingests monthly Excel budget sheets,
normalises them, and answers the core question every month:

> **Actual Net vs Standard** — is each site hitting its target?
> (الصافي الفعلي مقابل الاستاندرد)

This is **not** a generic CRM. Every screen and calculation is oriented around
monthly site budget analysis: contract values, collections, salaries, operating
expenses, net profit, and the standard target per site.

## Priority 1 — Arabic-first & executive-simple

The system is **Arabic-first**: default language Arabic, default direction **RTL**,
currency **الجنيه المصري**, Arabic month names, and Arabic labels on every
dashboard, table, chart, report, button, and message. English is supported as a
secondary language via a one-click switcher, but Arabic is the default.

- **No hardcoded UI text** — all strings live in typed dictionaries under
  [`src/i18n/dictionaries`](src/i18n/dictionaries) (`ar.ts` is the source of
  truth; `en.ts` mirrors it). Server components read the active locale from a
  cookie via [`getI18n()`](src/i18n/server.ts); client components use
  [`useI18n()`](src/i18n/provider.tsx).
- **Numbers** use Latin digits (0–9) with Arabic currency labels — Egyptian
  corporate-finance convention for readability. Switch to Arabic-Indic digits by
  changing `NUMBER_LOCALE` in [`src/i18n/format.ts`](src/i18n/format.ts).
- **Executive Dashboard** (`/executive`) is the Board of Directors' default
  landing page. It shows only management-level summaries in Arabic —
  إجمالي الصافي، إجمالي الاستاندرد، الفرق عن الاستاندرد، نسبة تحقيق الاستاندرد،
  صافي الربح بعد المصروفات العامة، أفضل موقع، أضعف موقع، سبب الانحراف الرئيسي،
  وتوصية الإدارة — plus a current-vs-previous-month comparison.
- **Detailed accounting tables are hidden by default** and revealed with a
  «عرض التفاصيل» button ([`DetailsToggle`](src/components/details-toggle.tsx)).
- **Executive Report** (`/executive/report`) is a clean RTL Arabic page designed
  for **Print → Save as PDF**, which reliably renders Arabic text and RTL.
- **Simple Arabic status labels:** أعلى من الاستاندرد · قريب من الاستاندرد ·
  أقل من الاستاندرد · خطر.

---

## The business rules (baked into the engine)

- The **only** comparison against the standard is **Net vs Standard**.
- `net = gross_collection − salaries − operating_expenses`.
- If the 14% value is already inside the sheet's Operating Expenses, it is
  already reflected in net (we never subtract it twice).
- **Collection after 14%** (`gross / 1.14`) is a **supporting** metric only,
  compared to the **contract value** — never to the standard.
- General (company-level) expenses reduce **Final Net (after general)**, but the
  site-level Net-vs-Standard comparison stays on net **before** general expenses.

### Formulas (`src/lib/calculations.ts`)

| Metric | Formula |
| --- | --- |
| Collection after 14% | `gross_collection / 1.14` |
| 14% value | `gross_collection − collection_after_14` |
| Net | `gross_collection − salaries − operating_expenses` |
| Variance vs Standard | `net − standard` |
| Standard achievement % | `net / standard × 100` |
| Net margin % | `net / gross_collection × 100` |
| Collection gap (supporting) | `collection_after_14 − contract_value` |

**Status buckets** (from standard achievement %): Above Standard `≥100%`,
Near Standard `≥90%`, Below Standard `≥70%`, Critical `<70%`.

---

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **PostgreSQL** + **Prisma ORM**
- **Tailwind CSS** with shadcn-style UI primitives
- **SheetJS (xlsx)** for Excel parsing & export
- **Recharts** for charts
- Custom JWT-cookie authentication (bcrypt + jose) with role support

---

## Running locally

### Prerequisites

- Node.js 20+ (tested on Node 24)
- Docker Desktop (for the bundled PostgreSQL) — or your own PostgreSQL 14+

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

The defaults already match the bundled database. For production, set a strong
`AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Start PostgreSQL

```bash
docker compose up -d
```

(Or point `DATABASE_URL` at any existing PostgreSQL instance.)

### 4. Create the schema

```bash
npm run db:migrate      # creates tables via Prisma Migrate
# or, for a quick start without migration files:
# npm run db:push
```

### 5. Seed demo data

Loads an admin user, 7 security sites, and four monthly uploads
(Oct 2025 → Jan 2026) modelled on a real January 2026 budget sheet, plus
standards history and general expenses.

```bash
npm run db:seed
```

### 6. Run the app

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with the seeded admin:

- **Email:** `admin@eaglesgroup.local`
- **Password:** `Admin@12345`

(Both configurable in `.env`.)

---

## The monthly Excel format

The parser ([`excelBudgetParserService`](src/lib/services/excelBudgetParserService.ts))
reads the **first worksheet** and **auto-detects the header row** (title rows,
blank rows, or notes above the table are fine). Header matching is tolerant —
case-insensitive, punctuation-insensitive, light Arabic normalization, and
accepts **Arabic or English** aliases. One row per site:

| Column | Required | Arabic aliases | English aliases |
| --- | --- | --- | --- |
| Site Name | ✅ | اسم الموقع، الموقع، المشروع | site, project, location |
| Client | — | العميل، اسم العميل | client, customer |
| Contract Value | — | التعاقد، قيمة التعاقد | contract |
| Gross Collection | ✅ | التحصيل، إجمالي التحصيل | gross collection, revenue |
| Salaries | ✅ | المرتبات، الرواتب، الأجور | salaries, wages, payroll |
| Operating Expenses | ✅ | مصاريف التشغيل، المصروفات التشغيلية | operating expenses, opex |
| Net | — | الصافي، صافي الربح | net (cross-checked vs computed) |
| Standard | — | الاستاندرد، المستهدف، الهدف | standard, target |

- Numeric cells may contain commas, currency symbols, `(parentheses)` for
  negatives, or **Arabic-Indic digits** (٠١٢٣…).
- Rows named `الإجمالي` / `Total` / `Sum`, blank rows, and label-only note rows
  are **skipped safely** — the sheet never breaks on extra content.
- **Net** is always computed deterministically (`gross − salaries − opex`); if a
  Net column disagrees, a warning is recorded and the computed value is used.
- If `Standard` is omitted, it is resolved from **standards history** or the
  site's **default standard** (a warning is recorded).
- Validation errors are returned as **clear Arabic messages**.

Upload status lifecycle: `تم الرفع` → `جاري التحليل` → `تم التحليل` / `فشل التحليل`.

A ready-to-test sample sheet is generated at
`storage/uploads/budget-2026-01.xlsx` when you run the seed.

---

## Data model

Both **raw** and **normalized** data are stored so any month can be audited or
reprocessed later.

| Table | Purpose |
| --- | --- |
| `users` | Auth + roles (ADMIN / FINANCE / OPERATIONS / VIEWER) |
| `uploaded_files` | Original file registry + **raw parsed rows** (JSON) + status |
| `sites` | Site master (client, type, default standard, active flag) |
| `monthly_site_budgets` | **Normalized** per-site/month inputs + all derived metrics |
| `expense_items` | General (company-level) expenses |
| `monthly_summaries` | Precomputed company rollup per month |
| `standards_history` | Source of truth + full history for standards |

---

## Feature status

| Module | Status |
| --- | --- |
| Arabic-first + RTL + i18n (ar/en) | ✅ Default Arabic, cookie switcher, no hardcoded text |
| Executive dashboard + report (PDF via print) | ✅ Board landing, «عرض التفاصيل» toggle |
| Admin auth + roles (schema) | ✅ Login, session, route protection |
| Monthly Excel upload + validation + raw storage | ✅ |
| Monthly analysis engine | ✅ |
| Monthly dashboard (KPIs, highlights, chart, site table) | ✅ |
| Multi-month analysis (last 4/6/12, all) | ✅ |
| Sites / Standards / General Expenses | ✅ Read views (seeded data) |
| Reports — Monthly Excel export | ✅ |
| Custom-range analysis, CRUD forms, PDF export, more charts | 🔜 Roadmap |

### Next steps (roadmap)

1. CRUD forms + APIs for Sites, Standards, and General Expenses.
2. Custom date-range and full-year presets on the analysis page.
3. Remaining report types + PDF export.
4. Role-based UI gating (Finance/Operations/Viewer).
5. Unit tests for `calculations.ts`.

---

## Project structure

```
prisma/
  schema.prisma          # all 7 tables + enums
  seed.ts                # admin + sites + 4 months of demo data
src/
  app/
    (app)/               # authenticated shell (sidebar + topbar)
      executive/         # ⭐ Executive dashboard (board default landing)
      dashboard/         # monthly dashboard (detailed)
      analysis/          # multi-month analysis
      upload/            # Excel upload
      sites/ standards/ expenses/ reports/
    (print)/             # chrome-free layout for print/PDF
      executive/report/  # ⭐ Arabic RTL executive report (Print → PDF)
    api/
      auth/              # login / logout
      upload/            # parse + validate + normalize
      reports/monthly/   # localized Excel export
    login/               # sign-in page
  i18n/                  # ⭐ Arabic-first localization
    config.ts            # locales, default (ar), direction
    dictionaries/ar.ts   # source-of-truth strings
    dictionaries/en.ts   # English mirror
    server.ts            # getI18n() for server components
    provider.tsx         # useI18n() for client components
    format.ts            # locale-aware currency / % / dates / months
  components/            # UI primitives + app components + charts
  lib/
    calculations.ts      # ⭐ the financial engine (pure functions)
    excel.ts             # workbook parsing
    processing.ts        # normalize rows → DB + recompute summaries
    analytics.ts         # dashboard / multi-month / executive reads
    auth.ts  prisma.ts  constants.ts  utils.ts
  middleware.ts          # auth route protection
docker-compose.yml       # local PostgreSQL
```

---

## Useful scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (runs `prisma generate`) |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:push` | Push schema without migrations |
| `npm run db:seed` | Load demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Drop, re-migrate, and re-seed |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run the unit tests (calculations + parser) |
