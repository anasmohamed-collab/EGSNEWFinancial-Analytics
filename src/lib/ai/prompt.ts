/**
 * Prompt builder + output contract for the executive explanation layer.
 *
 * SAFETY: the AI output type contains ONLY text fields. There is no numeric
 * field the model can populate, so a model response can never overwrite a
 * database value or a dashboard KPI. The model is given already-computed numbers
 * as read-only context and is instructed to explain, not calculate.
 */
import { z } from "zod";

export interface SiteMetric {
  name: string;
  net: number;
  standard: number;
  variance: number;
  achievementPct: number | null;
  status: string;
}

/** Structured, already-calculated metrics sent to the AI (read-only context). */
export interface ExecutiveAiInput {
  month: number;
  year: number;
  totalNet: number;
  totalStandard: number;
  varianceVsStandard: number;
  standardAchievementPercentage: number | null;
  finalNetAfterGeneralExpenses: number;
  bestSite: { name: string; achievementPct: number | null } | null;
  worstSite: { name: string; achievementPct: number | null } | null;
  biggestNegativeVarianceSite: { name: string; variance: number } | null;
  previousMonthComparison: {
    prevMonth: number;
    prevYear: number;
    prevNet: number;
    netChange: number;
    prevAchievementPercentage: number | null;
  } | null;
  topSitesSummary: SiteMetric[];
}

/** AI output — Arabic narrative only. No numeric fields by design. */
export interface AiExecutiveExplanation {
  executiveSummary: string;
  keyInsight: string;
  mainProblem: string;
  topThreeProblems: string[];
  topThreeRecommendations: string[];
  riskLevel: string;
  boardMessage: string;
}

export const aiExplanationSchema = z.object({
  executiveSummary: z.string().min(1),
  keyInsight: z.string().min(1),
  mainProblem: z.string().min(1),
  topThreeProblems: z.array(z.string()).default([]),
  topThreeRecommendations: z.array(z.string()).default([]),
  riskLevel: z.string().min(1),
  boardMessage: z.string().min(1),
});

/**
 * Build the system + user messages. The instructions are explicit that the
 * model must use only the provided numbers, must not calculate, must not invent
 * numbers, and must answer in Arabic JSON only.
 */
export function buildExecutivePrompt(input: ExecutiveAiInput): {
  system: string;
  user: string;
} {
  const system = [
    "أنت مساعد تنفيذي مالي لشركة خدمات أمنية. مهمتك شرح النتائج المالية الشهرية لمجلس الإدارة.",
    "قواعد صارمة يجب الالتزام بها:",
    "- استخدم الأرقام المُعطاة فقط، ولا تخترع أي رقم جديد إطلاقاً.",
    "- لا تُجرِ أي عملية حسابية ولا تُعِد حساب أي قيمة.",
    "- لا تُغيّر أي قيمة مالية.",
    "- المقارنة الأساسية دائماً: الصافي الفعلي مقابل الاستاندرد (لا تقارن التحصيل بالاستاندرد).",
    "- اكتب بالعربية فقط، بلغة بسيطة وواضحة تناسب مجلس الإدارة.",
    "- كن مختصراً وركّز على القرارات الإدارية.",
    "- أعد الإجابة على هيئة JSON صالح فقط، دون أي نص خارج JSON.",
  ].join("\n");

  const metrics = JSON.stringify(input, null, 2);

  const user = [
    "هذه هي الأرقام النهائية التي حسبها النظام مسبقاً (لا تُعدّلها ولا تضِف عليها):",
    "```json",
    metrics,
    "```",
    "",
    "اكتب توضيحاً تنفيذياً بالعربية يجيب عن: هل كسب الشهر أم خسر مقابل الاستاندرد؟ ما نسبة تحقيق الاستاندرد؟ ما الفجوة عن الاستاندرد؟ ما الموقع صاحب أكبر ضغط؟ ما أفضل موقع؟ هل الأداء يتحسن أم يتراجع مقارنة بالشهر السابق؟",
    "",
    "أعد النتيجة بصيغة JSON بهذا الشكل بالضبط وبالعربية فقط:",
    "{",
    '  "executiveSummary": "ملخص تنفيذي قصير: هل الشهر أعلى أم أقل من الاستاندرد",',
    '  "keyInsight": "أهم ملاحظة: نسبة تحقيق الاستاندرد والفجوة",',
    '  "mainProblem": "الموقع صاحب أكبر ضغط/أكبر انحراف سلبي",',
    '  "topThreeProblems": ["مشكلة 1", "مشكلة 2", "مشكلة 3"],',
    '  "topThreeRecommendations": ["توصية 1", "توصية 2", "توصية 3"],',
    '  "riskLevel": "منخفض أو متوسط أو مرتفع أو حرج",',
    '  "boardMessage": "رسالة موجزة لمجلس الإدارة"',
    "}",
  ].join("\n");

  return { system, user };
}

/**
 * Extract + validate the model's JSON. Returns null on any parse/validation
 * failure so the caller can fall back safely. Arrays are clamped to 3 items.
 */
export function parseAiExplanation(content: string): AiExecutiveExplanation | null {
  if (!content) return null;
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]);
    const parsed = aiExplanationSchema.safeParse(raw);
    if (!parsed.success) return null;
    return {
      ...parsed.data,
      topThreeProblems: parsed.data.topThreeProblems.slice(0, 3),
      topThreeRecommendations: parsed.data.topThreeRecommendations.slice(0, 3),
    };
  } catch {
    return null;
  }
}
