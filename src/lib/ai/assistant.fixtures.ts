/**
 * Shared test fixture — a realistic AssistantAiContext built from
 * already-calculated January 2026 figures (mirrors the seed data).
 * Used by assistant.test.ts and aiAssistantService.test.ts only.
 */
import type { AssistantAiContext } from "./assistant";

export const SAMPLE_CONTEXT: AssistantAiContext = {
  scopeLabel: "يناير 2026",
  periods: [{ month: 1, year: 2026 }],
  totals: {
    totalNet: 1_244_000,
    totalStandard: 1_310_000,
    varianceVsStandard: -66_000,
    standardAchievementPercentage: 94.96,
    totalSalaries: 800_000,
    totalOperatingExpenses: 150_000,
    totalGeneralExpenses: 255_000,
    finalNetAfterGeneral: 989_000,
    siteCount: 5,
  },
  monthlyTrend: [
    { month: 1, year: 2026, net: 1_244_000, standard: 1_310_000, variance: -66_000, achievementPct: 94.96 },
  ],
  bestSite: { name: "Smart Village HQ", achievementPct: 109.38 },
  worstSite: { name: "Alexandria Port Terminal", achievementPct: 67 },
  biggestNegativeVarianceSite: { name: "Alexandria Port Terminal", variance: -66_000 },
  bestMonth: null,
  worstMonth: null,
  sitesRepeatedlyBelow: [
    { name: "Alexandria Port Terminal", monthsBelowStandard: 3, monthsPresent: 4 },
  ],
  topPressuredSites: [
    {
      name: "Alexandria Port Terminal",
      net: 134_000,
      standard: 200_000,
      variance: -66_000,
      achievementPct: 67,
      status: "CRITICAL",
    },
  ],
  previousMonthComparison: null,
  dataNotes: ["لا توجد بيانات للشهر السابق للمقارنة."],
};
