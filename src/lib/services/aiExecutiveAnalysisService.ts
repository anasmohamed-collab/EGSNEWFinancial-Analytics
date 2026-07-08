/**
 * aiExecutiveAnalysisService
 * -------------------------------------------------------------------------
 * Explanation-only AI layer. Receives ALREADY-CALCULATED metrics and returns
 * Arabic narrative text for the Board. It never computes, recalculates, or
 * changes any number, and it never blocks the app:
 *   - AI disabled / no key  -> { source: "disabled" } (small UI message)
 *   - API error / bad JSON  -> { source: "fallback" } (deterministic Arabic)
 *   - success               -> { source: "ai" }
 *
 * All NVIDIA calls happen here (server-side). The API key is never returned to
 * the caller and never logged.
 */
import { isAiEnabled, aiProviderConfig, type AiProviderConfig } from "../ai/config";
import {
  buildExecutivePrompt,
  parseAiExplanation,
  type ExecutiveAiInput,
  type AiExecutiveExplanation,
} from "../ai/prompt";
import { formatCurrency, formatPercent, formatSigned } from "../../i18n/format";

export type AiExplanationSource = "ai" | "fallback" | "disabled";

export interface AiExplanationResult {
  enabled: boolean;
  source: AiExplanationSource;
  explanation: AiExecutiveExplanation | null;
  /** Short Arabic status message (for disabled / fallback states). */
  message: string | null;
}

export interface AiServiceDeps {
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
  /** Force enabled state (tests). */
  enabled?: boolean;
  /** Force config (tests). null = treat as missing key. */
  config?: AiProviderConfig | null;
  timeoutMs?: number;
}

const DISABLED_MESSAGE = "تحليل الذكاء الاصطناعي غير مفعل حاليًا.";
const FAILURE_MESSAGE =
  "تعذّر توليد تحليل الذكاء الاصطناعي الآن. الأرقام الرسمية أعلاه غير متأثرة.";

export async function generateMonthlyExecutiveExplanation(
  input: ExecutiveAiInput,
  deps: AiServiceDeps = {},
): Promise<AiExplanationResult> {
  const enabled = deps.enabled ?? isAiEnabled();
  const config = deps.config !== undefined ? deps.config : aiProviderConfig();

  // Disabled or no key → never call NVIDIA; app continues normally.
  if (!enabled || !config) {
    return { enabled: false, source: "disabled", explanation: null, message: DISABLED_MESSAGE };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const { system, user } = buildExecutivePrompt(input);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 25_000);

  try {
    const res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 1200,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Log status only — never the response body, headers, or key.
      console.error(`[ai] provider returned HTTP ${res.status}`);
      return fallback(input);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const explanation = parseAiExplanation(
      typeof content === "string" ? content : JSON.stringify(content),
    );
    if (!explanation) return fallback(input);

    return { enabled: true, source: "ai", explanation, message: null };
  } catch (err) {
    // Log the error NAME only (e.g. "AbortError") — never messages that could
    // echo request details.
    console.error(`[ai] explanation generation failed: ${(err as Error)?.name ?? "Error"}`);
    return fallback(input);
  } finally {
    clearTimeout(timer);
  }
}

function fallback(input: ExecutiveAiInput): AiExplanationResult {
  return {
    enabled: true,
    source: "fallback",
    explanation: buildDeterministicFallback(input),
    message: FAILURE_MESSAGE,
  };
}

/**
 * Deterministic Arabic explanation built ONLY from the provided numbers (no AI).
 * Used when the AI call fails, so the panel still shows something useful and
 * consistent with the official figures.
 */
export function buildDeterministicFallback(
  input: ExecutiveAiInput,
): AiExecutiveExplanation {
  const ar = "ar" as const;
  const won = input.varianceVsStandard >= 0;
  const ach = input.standardAchievementPercentage;

  const riskLevel =
    ach === null ? "مرتفع" : ach >= 100 ? "منخفض" : ach >= 90 ? "متوسط" : ach >= 70 ? "مرتفع" : "حرج";

  const executiveSummary = won
    ? `حقق الشهر أداءً أعلى من الاستاندرد بفارق ${formatSigned(input.varianceVsStandard, ar)}، بإجمالي صافٍ ${formatCurrency(input.totalNet, ar)}.`
    : `جاء أداء الشهر أقل من الاستاندرد بفارق ${formatSigned(input.varianceVsStandard, ar)}، بإجمالي صافٍ ${formatCurrency(input.totalNet, ar)}.`;

  const keyInsight = `نسبة تحقيق الاستاندرد ${formatPercent(ach)}، والفجوة عن الاستاندرد ${formatSigned(input.varianceVsStandard, ar)}.`;

  const mainProblem = input.biggestNegativeVarianceSite
    ? `أكبر ضغط على موقع «${input.biggestNegativeVarianceSite.name}» بانحراف ${formatSigned(input.biggestNegativeVarianceSite.variance, ar)}.`
    : "لا يوجد موقع ذو انحراف سلبي جوهري هذا الشهر.";

  const problems: string[] = [];
  if (input.biggestNegativeVarianceSite && input.biggestNegativeVarianceSite.variance < 0) {
    problems.push(
      `موقع «${input.biggestNegativeVarianceSite.name}» أقل من الاستاندرد بـ ${formatSigned(input.biggestNegativeVarianceSite.variance, ar)}.`,
    );
  }
  if (input.worstSite) {
    problems.push(
      `أضعف موقع أداءً: «${input.worstSite.name}» (${formatPercent(input.worstSite.achievementPct)} من الاستاندرد).`,
    );
  }
  if (!won) {
    problems.push("إجمالي الأداء الشهري أقل من الاستاندرد المستهدف.");
  }
  if (problems.length === 0) problems.push("لا توجد مشاكل جوهرية هذا الشهر.");

  const recommendations: string[] = [];
  if (input.biggestNegativeVarianceSite && input.biggestNegativeVarianceSite.variance < 0) {
    recommendations.push(
      `مراجعة عاجلة لتكاليف وإيرادات موقع «${input.biggestNegativeVarianceSite.name}».`,
    );
  }
  recommendations.push("متابعة المواقع الأقل من الاستاندرد ووضع خطة تحسين شهرية.");
  if (input.bestSite) {
    recommendations.push(
      `تعميم ممارسات أفضل موقع «${input.bestSite.name}» على باقي المواقع.`,
    );
  }

  const boardMessage = won
    ? "الأداء العام ضمن المستهدف؛ يوصى بالحفاظ على المستوى ومتابعة المواقع الأضعف."
    : "الأداء العام أقل من المستهدف؛ يتطلب متابعة إدارية للمواقع الحرجة.";

  return {
    executiveSummary,
    keyInsight,
    mainProblem,
    topThreeProblems: problems.slice(0, 3),
    topThreeRecommendations: recommendations.slice(0, 3),
    riskLevel,
    boardMessage,
  };
}
