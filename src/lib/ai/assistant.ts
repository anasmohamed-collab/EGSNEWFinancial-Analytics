/**
 * AI Management Assistant — question classification + prompt + output contract.
 *
 * SAFETY (same rules as the executive explanation layer):
 * - The assistant receives ONLY already-calculated metrics (AssistantAiContext),
 *   never raw Excel rows, DB access, or secrets.
 * - The answer type contains ONLY text fields — the model cannot produce a
 *   numeric field that could overwrite a KPI or DB value.
 * - Questions outside the budget data are answered with a fixed Arabic message
 *   WITHOUT calling the AI provider at all.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Scope — which period the management question is about
// ---------------------------------------------------------------------------

export type AssistantScopeKind = "month" | "last4" | "last6" | "year" | "all" | "custom";

export interface AssistantScope {
  kind: AssistantScopeKind;
  month?: number;
  year?: number;
  from?: { month: number; year: number };
  to?: { month: number; year: number };
}

// ---------------------------------------------------------------------------
// Read-only structured context (already calculated by the backend)
// ---------------------------------------------------------------------------

export interface AssistantSiteMetric {
  name: string;
  net: number;
  standard: number;
  variance: number;
  achievementPct: number | null;
  status: string;
}

export interface AssistantMonthPoint {
  month: number;
  year: number;
  net: number;
  standard: number;
  variance: number;
  achievementPct: number | null;
}

/** Everything the AI is allowed to see. Numbers here are pre-computed. */
export interface AssistantAiContext {
  /** Arabic label of the selected scope, e.g. "يناير 2026" or "آخر 4 شهور". */
  scopeLabel: string;
  periods: { month: number; year: number }[];
  totals: {
    totalNet: number;
    totalStandard: number;
    varianceVsStandard: number;
    standardAchievementPercentage: number | null;
    totalSalaries: number;
    totalOperatingExpenses: number;
    totalGeneralExpenses: number;
    finalNetAfterGeneral: number;
    siteCount: number;
  };
  monthlyTrend: AssistantMonthPoint[];
  bestSite: { name: string; achievementPct: number | null } | null;
  worstSite: { name: string; achievementPct: number | null } | null;
  biggestNegativeVarianceSite: { name: string; variance: number } | null;
  bestMonth: { month: number; year: number; achievementPct: number | null } | null;
  worstMonth: { month: number; year: number; achievementPct: number | null } | null;
  sitesRepeatedlyBelow: { name: string; monthsBelowStandard: number; monthsPresent: number }[];
  /** Most-pressured sites first (lowest variance), capped to keep prompts small. */
  topPressuredSites: AssistantSiteMetric[];
  /** Only for single-month scope, when the previous month has data. */
  previousMonthComparison: {
    prevMonth: number;
    prevYear: number;
    prevNet: number;
    netChange: number;
    prevAchievementPercentage: number | null;
    salariesChange: number | null;
    operatingExpensesChange: number | null;
    generalExpensesChange: number | null;
  } | null;
  /** Arabic notes about missing data the answer should mention. */
  dataNotes: string[];
}

// ---------------------------------------------------------------------------
// Question categories
// ---------------------------------------------------------------------------

export type AssistantQuestionCategory =
  | "monthly_summary"
  | "deviation_reason"
  | "best_worst_site"
  | "site_trend"
  | "comparison"
  | "trend_direction"
  | "recommendations"
  | "board_summary"
  | "repeated_below"
  | "expense_movement"
  | "out_of_scope";

export const OUT_OF_SCOPE_MESSAGE = "السؤال خارج نطاق بيانات الميزانية المتاحة حاليًا.";
export const ASSISTANT_DISABLED_MESSAGE = "مساعد الذكاء الاصطناعي غير مفعل حاليًا.";

/**
 * Normalize Arabic text for keyword matching: unify alef/yaa/taa-marbuta forms,
 * strip diacritics/tatweel, convert Arabic-Indic digits to Latin.
 */
export function normalizeArabic(text: string): string {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  return text
    .replace(/[ً-ْٰـ]/g, "") // diacritics + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
    .replace(/[؟?!.,،]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));

/** Finance-domain words: if none appear, the question is out of scope. */
const DOMAIN_WORDS = [
  "شهر", "اداء", "موقع", "مواقع", "صافي", "استاندرد", "ستاندرد", "ربح", "خسار",
  "تحصيل", "ميزانيه", "مصروف", "مصاريف", "رواتب", "مرتبات", "ارقام", "نتيجه",
  "انحراف", "تقرير", "توصي", "فتره", "سنه", "شهور",
];

/**
 * Deterministic (non-AI) keyword classifier for the management questions.
 * Order matters: more specific categories are checked first.
 */
export function classifyQuestion(question: string): AssistantQuestionCategory {
  const q = normalizeArabic(question);
  if (!q) return "out_of_scope";

  if (has(q, "مجلس الاداره", "لخص التقرير", "تقرير المجلس", "board")) return "board_summary";
  if (has(q, "متكرر", "باستمرار", "بشكل متكرر")) return "repeated_below";
  if (has(q, "مصروف", "مصاريف")) return "expense_movement";
  if (has(q, "قارن", "مقارنه")) return "comparison";
  if (has(q, "يتحسن", "بيتحسن", "يتراجع", "بيتراجع", "تحسن ولا", "الاتجاه العام")) return "trend_direction";
  if (has(q, "موقع", "مواقع") && has(q, "اتجاه", "تطور", "عبر الشهور", "خلال الشهور")) return "site_trend";
  if (has(q, "موقع", "مواقع") && has(q, "افضل", "احسن", "اضعف", "اسوا", "خسار")) return "best_worst_site";
  if (has(q, "توصي", "اقتراح", "نصائح", "نصايح")) return "recommendations";
  if (has(q, "سبب", "ليه", "لماذا", "ضعف")) return "deviation_reason";
  if (has(q, "لخص", "ملخص", "كويس", "كان عامل", "اداء")) return "monthly_summary";

  return has(q, ...DOMAIN_WORDS) ? "monthly_summary" : "out_of_scope";
}

/**
 * If the question itself names a period ("قارن آخر 4 شهور"), return the scope
 * kind it implies so the backend can answer about the right period even when
 * the UI selector is on a single month. Deterministic, no AI.
 */
export function detectScopeHint(question: string): AssistantScopeKind | null {
  const q = normalizeArabic(question);
  if (/اخر\s*4|اربع(ه)?\s*شهور/.test(q)) return "last4";
  if (/اخر\s*6|ست(ه)?\s*شهور/.test(q)) return "last6";
  if (has(q, "السنه كامله", "السنه كلها", "طول السنه")) return "year";
  if (has(q, "كل الشهور", "كل الفترات")) return "all";
  return null;
}

// ---------------------------------------------------------------------------
// Answer contract — text only, structured for management
// ---------------------------------------------------------------------------

/** AI output — Arabic text only. No numeric fields by design. */
export interface AiAssistantAnswer {
  /** الإجابة المختصرة */
  shortAnswer: string;
  /** الدليل من الأرقام */
  evidence: string;
  /** ماذا يعني ذلك للإدارة؟ */
  meaning: string;
  /** التوصية */
  recommendation: string;
}

export const aiAssistantAnswerSchema = z.object({
  shortAnswer: z.string().min(1),
  evidence: z.string().default(""),
  meaning: z.string().default(""),
  recommendation: z.string().default(""),
});

/**
 * Extract + validate the model's JSON answer. Returns null on any failure so
 * the caller can fall back to the deterministic answer. A model response with
 * non-string fields fails validation — the AI cannot inject numbers.
 */
export function parseAssistantAnswer(content: string): AiAssistantAnswer | null {
  if (!content) return null;
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = aiAssistantAnswerSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

const CATEGORY_FOCUS: Record<Exclude<AssistantQuestionCategory, "out_of_scope">, string> = {
  monthly_summary: "قدّم ملخصاً بسيطاً للأداء: هل الفترة أعلى أم أقل من الاستاندرد وبكم.",
  deviation_reason: "اشرح سبب الانحراف عن الاستاندرد بالاستناد إلى المواقع الأكثر ضغطاً في البيانات.",
  best_worst_site: "حدّد أفضل موقع وأضعف موقع من الحقول bestSite و worstSite و topPressuredSites فقط.",
  site_trend: "اشرح اتجاه أداء المواقع عبر الفترة من topPressuredSites و sitesRepeatedlyBelow.",
  comparison: "قارن الشهور الموجودة في monthlyTrend ببساطة: أيها أفضل وأيها أضعف وهل الاتجاه صاعد أم هابط.",
  trend_direction: "حدّد هل الأداء يتحسن أم يتراجع اعتماداً على monthlyTrend و previousMonthComparison.",
  recommendations: "قدّم أهم ٣ توصيات إدارية عملية مبنية على المواقع الأضعف والانحرافات المذكورة.",
  board_summary: "اكتب خلاصة تنفيذية موجزة تصلح لمجلس الإدارة: الوضع العام، المشكلة الأساسية، نقاط القوة والضعف، والتوصيات.",
  repeated_below: "اذكر المواقع المتكررة تحت الاستاندرد من الحقل sitesRepeatedlyBelow فقط، وإن كان فارغاً فقل ذلك.",
  expense_movement: "علّق على حركة المصروفات (الرواتب والتشغيلية والعامة) من الأرقام المعطاة فقط، بما فيها التغير عن الشهر السابق إن وُجد.",
};

/**
 * Build the system + user messages. The model is instructed to explain only,
 * using only the provided pre-computed metrics, in simple management Arabic.
 */
export function buildAssistantPrompt(
  question: string,
  category: Exclude<AssistantQuestionCategory, "out_of_scope">,
  context: AssistantAiContext,
): { system: string; user: string } {
  const system = [
    "أنت «مساعد الإدارة الذكي» لشركة خدمات أمنية. تجيب على أسئلة الإدارة عن الأداء المالي.",
    "قواعد صارمة يجب الالتزام بها:",
    "- استخدم الأرقام المُعطاة في السياق فقط، ولا تخترع أي رقم جديد إطلاقاً.",
    "- لا تُجرِ أي عملية حسابية ولا تُعِد حساب أي قيمة — كل الأرقام محسوبة مسبقاً.",
    "- المقارنة الأساسية دائماً: الصافي الفعلي مقابل الاستاندرد.",
    "- إذا كانت هناك ملاحظات عن بيانات ناقصة في dataNotes فاذكرها بوضوح.",
    `- إذا كان السؤال لا يمكن الإجابة عليه من البيانات المعطاة، اجعل shortAnswer بالضبط: «${OUT_OF_SCOPE_MESSAGE}»`,
    "- اكتب بالعربية فقط، بلغة بسيطة ومباشرة تناسب الإدارة، وكن مختصراً.",
    "- أعد الإجابة على هيئة JSON صالح فقط، دون أي نص خارج JSON.",
  ].join("\n");

  const user = [
    `الفترة المختارة: ${context.scopeLabel}`,
    "هذه هي الأرقام النهائية التي حسبها النظام مسبقاً (لا تُعدّلها ولا تضِف عليها):",
    "```json",
    JSON.stringify(context, null, 2),
    "```",
    "",
    `سؤال الإدارة: ${question}`,
    `تركيز الإجابة: ${CATEGORY_FOCUS[category]}`,
    "",
    "أعد النتيجة بصيغة JSON بهذا الشكل بالضبط وبالعربية فقط:",
    "{",
    '  "shortAnswer": "الإجابة المختصرة في جملة أو جملتين",',
    '  "evidence": "الدليل من الأرقام المعطاة فقط",',
    '  "meaning": "ماذا يعني ذلك للإدارة",',
    '  "recommendation": "توصية عملية واحدة أو أكثر"',
    "}",
  ].join("\n");

  return { system, user };
}
