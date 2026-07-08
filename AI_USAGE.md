# AI Usage — NVIDIA Executive Explanation Layer (Phase 1)

## What it is
An **explanation-only** AI layer that writes a short **Arabic** narrative for the
Board of Directors, based on the month's **already-calculated** figures. It answers:
هل كسب الشهر أم خسر مقابل الاستاندرد؟ · نسبة تحقيق الاستاندرد · الفجوة عن الاستاندرد ·
الموقع صاحب أكبر ضغط · أفضل موقع · هل الأداء يتحسن أم يتراجع · أهم 3 مشاكل · أهم 3 توصيات.

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
| `src/lib/ai/prompt.ts` | Types + safe prompt builder + strict output schema (text-only) + parser. |
| `src/lib/services/aiExecutiveAnalysisService.ts` | Calls NVIDIA; validates; deterministic fallback. |
| `src/app/api/ai/executive-summary/route.ts` | Auth → load DB metrics → build input → call service. |
| `src/components/executive-ai-panel.tsx` | Optional panel «توضيح الإدارة بالذكاء الاصطناعي». |

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

## Test it safely (no network, no key)
```
npm test
```
Covers: AI-disabled mode, missing key, prompt builder contains only provided
metrics + safety rules, and fallback on API error / non-200 / invalid JSON.

## Cost / behavior
- The panel is **button-triggered** (not auto-run) so NVIDIA is only called when a
  user asks for an explanation.
- Requests use low temperature and a 25s timeout; on timeout → fallback.
