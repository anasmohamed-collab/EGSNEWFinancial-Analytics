/**
 * aiAssistantService — «مساعد الإدارة الذكي»
 * -------------------------------------------------------------------------
 * Explanation-only Q&A layer. Receives an Arabic management question plus a
 * read-only AssistantAiContext of ALREADY-CALCULATED metrics and returns a
 * structured Arabic answer. It never computes, recalculates, or changes any
 * number, and it never blocks the app:
 *   - out-of-scope question  -> fixed Arabic message, NO provider call
 *   - AI disabled / no key   -> { source: "disabled" }
 *   - API error / bad JSON   -> { source: "fallback" } (deterministic Arabic)
 *   - success                -> { source: "ai" }
 *
 * All NVIDIA calls happen here (server-side). The API key is never returned
 * to the caller and never logged.
 */
import { isAiEnabled, aiProviderConfig, type AiProviderConfig } from "../ai/config";
import {
  ASSISTANT_DISABLED_MESSAGE,
  OUT_OF_SCOPE_MESSAGE,
  buildAssistantPrompt,
  classifyQuestion,
  parseAssistantAnswer,
  type AiAssistantAnswer,
  type AssistantAiContext,
  type AssistantQuestionCategory,
} from "../ai/assistant";
import { formatCurrency, formatPercent, formatSigned, monthName } from "../../i18n/format";

export type AssistantAnswerSource = "ai" | "fallback" | "disabled" | "out_of_scope";

export interface AssistantResult {
  enabled: boolean;
  source: AssistantAnswerSource;
  category: AssistantQuestionCategory;
  answer: AiAssistantAnswer | null;
  /** Short Arabic status message (disabled / fallback / out-of-scope states). */
  message: string | null;
}

export interface AssistantServiceDeps {
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
  /** Force enabled state (tests). */
  enabled?: boolean;
  /** Force config (tests). null = treat as missing key. */
  config?: AiProviderConfig | null;
  timeoutMs?: number;
}

const FAILURE_MESSAGE =
  "تعذّر الاتصال بخدمة الذكاء الاصطناعي — هذه إجابة آلية مبنية مباشرة على الأرقام المحسوبة.";

export async function answerManagementQuestion(
  question: string,
  context: AssistantAiContext,
  deps: AssistantServiceDeps = {},
): Promise<AssistantResult> {
  const category = classifyQuestion(question);

  // Outside the budget data → fixed answer, never call the provider.
  if (category === "out_of_scope") {
    return {
      enabled: deps.enabled ?? isAiEnabled(),
      source: "out_of_scope",
      category,
      answer: null,
      message: OUT_OF_SCOPE_MESSAGE,
    };
  }

  const enabled = deps.enabled ?? isAiEnabled();
  const config = deps.config !== undefined ? deps.config : aiProviderConfig();

  // Disabled or no key → never call NVIDIA; app continues normally.
  if (!enabled || !config) {
    return {
      enabled: false,
      source: "disabled",
      category,
      answer: null,
      message: ASSISTANT_DISABLED_MESSAGE,
    };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const { system, user } = buildAssistantPrompt(question, category, context);

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
        max_tokens: 900,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Log status only — never the response body, headers, or key.
      console.error(`[ai-assistant] provider returned HTTP ${res.status}`);
      return fallback(category, context);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const answer = parseAssistantAnswer(
      typeof content === "string" ? content : JSON.stringify(content),
    );
    if (!answer) return fallback(category, context);

    return { enabled: true, source: "ai", category, answer, message: null };
  } catch (err) {
    // Log the error NAME only — never messages that could echo request details.
    console.error(`[ai-assistant] answer generation failed: ${(err as Error)?.name ?? "Error"}`);
    return fallback(category, context);
  } finally {
    clearTimeout(timer);
  }
}

function fallback(
  category: Exclude<AssistantQuestionCategory, "out_of_scope">,
  context: AssistantAiContext,
): AssistantResult {
  return {
    enabled: true,
    source: "fallback",
    category,
    answer: buildAssistantFallback(category, context),
    message: FAILURE_MESSAGE,
  };
}

/**
 * Deterministic Arabic answer built ONLY from the provided pre-computed
 * numbers (no AI). Used when the provider fails so management still gets a
 * useful, consistent answer.
 */
export function buildAssistantFallback(
  category: Exclude<AssistantQuestionCategory, "out_of_scope">,
  context: AssistantAiContext,
): AiAssistantAnswer {
  const ar = "ar" as const;
  const t = context.totals;
  const won = t.varianceVsStandard >= 0;
  const notes = context.dataNotes.length > 0 ? ` (${context.dataNotes.join(" ")})` : "";

  const evidence = `الصافي ${formatCurrency(t.totalNet, ar)} مقابل استاندرد ${formatCurrency(t.totalStandard, ar)} — الفرق ${formatSigned(t.varianceVsStandard, ar)} ونسبة التحقيق ${formatPercent(t.standardAchievementPercentage)}.`;

  const baseSummary = won
    ? `أداء ${context.scopeLabel} أعلى من الاستاندرد.`
    : `أداء ${context.scopeLabel} أقل من الاستاندرد.`;

  const baseMeaning = won
    ? "الأداء العام ضمن المستهدف؛ المطلوب الحفاظ على المستوى ومتابعة المواقع الأضعف."
    : "الأداء العام أقل من المستهدف؛ يتطلب متابعة إدارية للمواقع الحرجة.";

  const worstRec = context.biggestNegativeVarianceSite
    ? `مراجعة عاجلة لتكاليف وإيرادات موقع «${context.biggestNegativeVarianceSite.name}».`
    : "متابعة المواقع الأقل من الاستاندرد ووضع خطة تحسين شهرية.";

  switch (category) {
    case "best_worst_site": {
      const best = context.bestSite
        ? `أفضل موقع: «${context.bestSite.name}» (${formatPercent(context.bestSite.achievementPct)} من الاستاندرد).`
        : "لا يوجد موقع بنسبة تحقيق متاحة.";
      const worst = context.worstSite
        ? `أضعف موقع: «${context.worstSite.name}» (${formatPercent(context.worstSite.achievementPct)} من الاستاندرد).`
        : "";
      const pressure = context.biggestNegativeVarianceSite
        ? `أكبر انحراف سلبي على «${context.biggestNegativeVarianceSite.name}» بمقدار ${formatSigned(context.biggestNegativeVarianceSite.variance, ar)}.`
        : "";
      return {
        shortAnswer: `${best} ${worst}`.trim() + notes,
        evidence: pressure || evidence,
        meaning: "الموقع الأضعف هو مصدر الضغط الأساسي على النتيجة الإجمالية.",
        recommendation: worstRec,
      };
    }
    case "deviation_reason": {
      const cause = context.biggestNegativeVarianceSite
        ? `أكبر سبب للانحراف هو موقع «${context.biggestNegativeVarianceSite.name}» بانحراف ${formatSigned(context.biggestNegativeVarianceSite.variance, ar)}.`
        : "لا يوجد موقع ذو انحراف سلبي جوهري في هذه الفترة.";
      return {
        shortAnswer: cause + notes,
        evidence,
        meaning: won
          ? "رغم وجود مواقع ضاغطة، الإجمالي ما زال ضمن المستهدف."
          : "الانحراف في هذه المواقع هو ما جعل الإجمالي أقل من الاستاندرد.",
        recommendation: worstRec,
      };
    }
    case "repeated_below": {
      const list = context.sitesRepeatedlyBelow
        .slice(0, 5)
        .map((s) => `«${s.name}» (${s.monthsBelowStandard} من ${s.monthsPresent} شهور)`)
        .join("، ");
      return {
        shortAnswer: list
          ? `نعم، توجد مواقع متكررة تحت الاستاندرد: ${list}.`
          : "لا يوجد موقع أقل من الاستاندرد في شهرين أو أكثر خلال هذه الفترة." + notes,
        evidence: list ? `عدد المواقع المتكررة تحت الاستاندرد: ${context.sitesRepeatedlyBelow.length}.` : evidence,
        meaning: list
          ? "التكرار يعني أن المشكلة هيكلية (تكاليف أو تسعير) وليست شهراً استثنائياً."
          : "لا توجد مشكلة هيكلية متكررة على مستوى المواقع.",
        recommendation: list
          ? "فتح ملف مراجعة لكل موقع متكرر تحت الاستاندرد وتحديد سبب جذري لكل حالة."
          : "الاستمرار في المتابعة الشهرية المعتادة.",
      };
    }
    case "expense_movement": {
      const p = context.previousMonthComparison;
      const moves = p
        ? `التغير عن ${monthName(p.prevMonth, ar)} ${p.prevYear}: الرواتب ${formatSigned(p.salariesChange, ar)}، المصروفات التشغيلية ${formatSigned(p.operatingExpensesChange, ar)}، المصروفات العامة ${formatSigned(p.generalExpensesChange, ar)}.`
        : "لا تتوفر مقارنة مصروفات مع شهر سابق لهذه الفترة.";
      return {
        shortAnswer: moves + notes,
        evidence: `إجمالي الرواتب ${formatCurrency(t.totalSalaries, ar)}، المصروفات التشغيلية ${formatCurrency(t.totalOperatingExpenses, ar)}، المصروفات العامة ${formatCurrency(t.totalGeneralExpenses, ar)}.`,
        meaning: "أي زيادة غير مبررة في هذه البنود تضغط مباشرة على الصافي مقابل الاستاندرد.",
        recommendation: "مراجعة البنود التي زادت عن الشهر السابق وطلب مبرر تشغيلي لكل زيادة.",
      };
    }
    case "comparison":
    case "trend_direction": {
      const trend = context.monthlyTrend;
      const list = trend
        .map((m) => `${monthName(m.month, ar)} ${m.year}: ${formatPercent(m.achievementPct)}`)
        .join(" · ");
      const first = trend[0];
      const last = trend[trend.length - 1];
      const direction =
        trend.length >= 2 && first.achievementPct !== null && last.achievementPct !== null
          ? last.achievementPct >= first.achievementPct
            ? "الاتجاه العام يتحسن عبر الفترة."
            : "الاتجاه العام يتراجع عبر الفترة."
          : "لا تكفي البيانات لتحديد اتجاه واضح.";
      return {
        shortAnswer: direction + notes,
        evidence: list ? `نسبة تحقيق الاستاندرد شهرياً: ${list}.` : evidence,
        meaning: won
          ? "الفترة ككل ضمن المستهدف مقابل الاستاندرد."
          : "الفترة ككل أقل من المستهدف مقابل الاستاندرد.",
        recommendation: worstRec,
      };
    }
    case "recommendations": {
      const recs: string[] = [worstRec, "متابعة المواقع الأقل من الاستاندرد ووضع خطة تحسين شهرية."];
      if (context.bestSite) {
        recs.push(`تعميم ممارسات أفضل موقع «${context.bestSite.name}» على باقي المواقع.`);
      }
      return {
        shortAnswer: `أهم التوصيات للإدارة عن ${context.scopeLabel}:` + notes,
        evidence,
        meaning: baseMeaning,
        recommendation: recs.slice(0, 3).map((r, i) => `${i + 1}) ${r}`).join(" "),
      };
    }
    case "board_summary":
    case "monthly_summary":
    case "site_trend":
    default: {
      return {
        shortAnswer: baseSummary + notes,
        evidence,
        meaning: baseMeaning,
        recommendation: worstRec,
      };
    }
  }
}
