# AI Usage — NVIDIA Explanation Layer

## What it is
An **explanation-only** AI layer with two surfaces:

1. **Phase 1 — Executive explanation panel** (`/executive`): writes a short
   **Arabic** narrative for the Board, based on the month's **already-calculated**
   figures. It answers: هل كسب الشهر أم خسر مقابل الاستاندرد؟ · نسبة تحقيق الاستاندرد ·
   الفجوة عن الاستاندرد · الموقع صاحب أكبر ضغط · أفضل موقع · هل الأداء يتحسن أم يتراجع ·
   أهم 3 مشاكل · أهم 3 توصيات.
2. **Phase 2 — «مساعد الإدارة الذكي»** (`/assistant`): an Arabic-first management
   Q&A chat. Management picks a scope (شهر محدد · آخر 4 شهور · آخر 6 شهور ·
   السنة كاملة · كل الشهور · فترة مخصصة), asks a simple question
   (e.g. "هل شهر يناير كان كويس؟" · "إيه سبب ضعف الشهر؟" · "مين أفضل موقع؟" ·
   "قارن آخر 4 شهور" · "هل في موقع متكرر تحت الاستاندرد؟"), and gets a structured
   Arabic answer: **الإجابة المختصرة · الدليل من الأرقام · ماذا يعني ذلك للإدارة؟ · التوصية**.

### What data the assistant can access
Before any AI call, the backend builds a **read-only structured context** from the
existing deterministic services only (`src/lib/analytics.ts`): period totals
(net / standard / variance / achievement %), monthly trend, best & worst site,
biggest negative-variance site, sites repeatedly below standard, top pressured
sites (capped), salaries / operating / general expense totals, and — for a single
month — the pre-computed change vs the previous month. That JSON context is the
**only** thing the model sees.

### What the assistant cannot do
- It cannot query the database (it never gets a connection or a query tool).
- It never sees raw Excel files, user credentials, or `NVIDIA_API_KEY`.
- It cannot calculate or change numbers: the answer schema is **text-only**, and a
  response containing numeric fields fails validation → deterministic fallback.
- Questions outside the budget data get a fixed answer with **no provider call**:
  «السؤال خارج نطاق بيانات الميزانية المتاحة حاليًا.»
- A deterministic Arabic **question classifier** (keyword-based, no AI) routes each
  question; period mentions in the question ("قارن آخر 4 شهور") override the scope.

## What it is NOT — the safety guarantees
- **AI never computes, recalculates, or changes any number.** All financial math
  stays deterministic in `src/lib/calculations.ts`. The AI only receives
  already-computed metrics as read-only context and returns text.
- **Structurally impossible to overwrite data:** the AI output type
  (`AiExecutiveExplanation`) has **only text fields** — there is no numeric field
  the model can populate, and nothing maps AI output back into the DB or KPIs.
- **Server-side only.** All NVIDIA calls happen in `aiExecutiveAnalysisService`
  (Node runtime). `NVIDIA_API_KEY` is **never** sent to the browser — the client
  receives only a boolean `aiEnabled` flag and the resulting text.
- **Never blocks the app.** If AI is disabled, misconfigured, times out, errors,
  or returns invalid JSON → the app keeps working and the panel shows either the
  "disabled" message or a **deterministic Arabic fallback** built from the numbers.
- **Secrets are never logged** — only HTTP status codes / error names.

## The moving parts
| File | Role |
| --- | --- |
| `src/lib/ai/config.ts` | Reads env safely (`isAiEnabled()`, `aiProviderConfig()`); never throws. |
| `src/lib/ai/prompt.ts` | Executive types + safe prompt builder + strict text-only schema + parser. |
| `src/lib/ai/executiveInput.ts` | Pure mapper: MonthlyAnalysis → ExecutiveAiInput (shared by route + board report). |
| `src/lib/services/aiExecutiveAnalysisService.ts` | Calls NVIDIA; validates; deterministic fallback. |
| `src/app/api/ai/executive-summary/route.ts` | Auth → load DB metrics → build input → call service. |
| `src/components/executive-ai-panel.tsx` | Optional panel «توضيح الإدارة بالذكاء الاصطناعي». |
| `src/lib/ai/assistant.ts` | Assistant: Arabic question classifier + scope hints + prompt + text-only answer schema. |
| `src/lib/ai/assistantContext.ts` | Pure builders: analytics read-models → read-only AI context. |
| `src/lib/services/aiAssistantService.ts` | Assistant service: out-of-scope guard, NVIDIA call, deterministic fallback. |
| `src/app/api/ai/assistant/route.ts` | Auth → validate question+scope → load computed analysis → call service. |
| `src/app/(app)/assistant/page.tsx` + `src/components/assistant-chat.tsx` | «مساعد الإدارة الذكي» chat page (RTL, suggested questions, scope picker). |

## Environment variables
Only these four are used (see `.env.example` section 5):

| Variable | Purpose |
| --- | --- |
| `AI_ANALYSIS_ENABLED` | `true` to enable. Anything else = disabled (no NVIDIA call). |
| `NVIDIA_API_KEY` | NVIDIA API key (`nvapi-…`). Server-side only. |
| `NVIDIA_BASE_URL` | OpenAI-compatible base, default `https://integrate.api.nvidia.com/v1`. |
| `NVIDIA_MODEL` | Chat/instruct model, default `meta/llama-3.1-70b-instruct`. |

**AI is enabled only when `AI_ANALYSIS_ENABLED=true` AND `NVIDIA_API_KEY` is set.**
Missing key → AI silently disabled (app never crashes).

## Enable / disable
- **Enable:** set all four vars (`AI_ANALYSIS_ENABLED=true` + key + base + model).
- **Disable:** set `AI_ANALYSIS_ENABLED=false` (or remove the key). No NVIDIA calls.

### Enable in Dublyo
1. App → **Environment Variables** → **+ Add Variable** for each:
   - `AI_ANALYSIS_ENABLED = true`
   - `NVIDIA_API_KEY = nvapi-…`  (tick **Secret**)
   - `NVIDIA_BASE_URL = https://integrate.api.nvidia.com/v1`
   - `NVIDIA_MODEL = meta/llama-3.1-70b-instruct`  (a chat/instruct model with Arabic support)
2. **Save & Redeploy.**
3. Open **`/executive`** → the panel **توضيح الإدارة بالذكاء الاصطناعي** now shows a
   **توليد توضيح الإدارة** button. Click it to generate the Arabic explanation.

> Note: the NVIDIA "prototype" snippet may show a vision/diffusion model — that is
> not suitable here. Use a **text chat/instruct** model for `NVIDIA_MODEL`.

## Verify the panel
- **Disabled (default):** on `/executive`, the panel shows
  **"تحليل الذكاء الاصطناعي غير مفعل حاليًا."** and makes no network call. The
  official KPIs are unchanged.
- **Enabled:** click **توليد توضيح الإدارة** → after a moment you get the Arabic
  summary, key insight, biggest-pressure site, top 3 problems, top 3
  recommendations, a risk badge, and a board message — with a disclaimer that it
  is AI-generated and does not change the numbers.
- **Resilience:** with AI enabled but a bad key/model, clicking the button returns
  the **deterministic Arabic fallback** (source `fallback`) — never an error page.

## Verify the assistant («مساعد الإدارة الذكي»)
- **Disabled:** `/assistant` shows only
  **"مساعد الذكاء الاصطناعي غير مفعل حاليًا."** — no input, no network call.
- **Enabled:** pick a scope, click a suggested question (e.g. **لخص الشهر**) →
  a structured Arabic answer (الإجابة المختصرة / الدليل من الأرقام / ماذا يعني ذلك
  للإدارة؟ / التوصية).
- **Out of scope:** ask something non-financial (e.g. "اكتب لي قصيدة") →
  **"السؤال خارج نطاق بيانات الميزانية المتاحة حاليًا."** with no NVIDIA call.
- **Resilience:** with a bad key/model, answers fall back to the deterministic
  Arabic explanation with a small notice — the dashboard is never blocked.
- **No data:** a scope with no uploaded months returns
  **"لا توجد بيانات للفترة المختارة."**

## Test it safely (no network, no key)
```
npm test
```
Covers (both layers): AI-disabled mode, missing key, out-of-scope questions never
call the provider, prompt/request body contains only structured metrics and no
secrets, fallback on API error / non-200 / invalid JSON, the text-only schema
rejecting numeric AI output, the Arabic question classifier, and scope hints
("قارن آخر 4 شهور" → last-4-months scope).

## Cost / behavior
- The panel is **button-triggered** (not auto-run) so NVIDIA is only called when a
  user asks for an explanation.
- Requests use low temperature and a 25s timeout; on timeout → fallback.
