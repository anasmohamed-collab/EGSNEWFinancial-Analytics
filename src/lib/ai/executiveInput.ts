/**
 * Pure mapper: MonthlyAnalysis (already calculated) → ExecutiveAiInput.
 * Shared by the AI executive-summary route and the printable board report so
 * both read the exact same pre-computed figures. No new financial formulas —
 * only field mapping plus the same netChange subtraction the route always did.
 */
import type { MonthlyAnalysis } from "../analytics";
import type { ExecutiveAiInput } from "./prompt";

export function buildExecutiveAiInput(
  analysis: MonthlyAnalysis,
  prevAnalysis: MonthlyAnalysis | null,
): ExecutiveAiInput {
  const s = analysis.summary;
  const h = analysis.highlights;

  return {
    month: analysis.month,
    year: analysis.year,
    totalNet: s.totalNet,
    totalStandard: s.totalStandard,
    varianceVsStandard: s.totalVarianceVsStandard,
    standardAchievementPercentage: s.standardAchievementPercentage,
    finalNetAfterGeneralExpenses: s.finalNetAfterGeneral,
    bestSite: h.bestSite
      ? { name: h.bestSite.siteName, achievementPct: h.bestSite.standardAchievementPercentage }
      : null,
    worstSite: h.worstSite
      ? { name: h.worstSite.siteName, achievementPct: h.worstSite.standardAchievementPercentage }
      : null,
    biggestNegativeVarianceSite: h.biggestNegativeVariance
      ? {
          name: h.biggestNegativeVariance.siteName,
          variance: h.biggestNegativeVariance.varianceVsStandard,
        }
      : null,
    previousMonthComparison: prevAnalysis?.hasData
      ? {
          prevMonth: prevAnalysis.month,
          prevYear: prevAnalysis.year,
          prevNet: prevAnalysis.summary.totalNet,
          netChange: s.totalNet - prevAnalysis.summary.totalNet,
          prevAchievementPercentage: prevAnalysis.summary.standardAchievementPercentage,
        }
      : null,
    // Most-pressured sites first (lowest variance), capped to keep the prompt small.
    topSitesSummary: [...analysis.sites]
      .sort((a, b) => a.varianceVsStandard - b.varianceVsStandard)
      .slice(0, 6)
      .map((r) => ({
        name: r.siteName,
        net: r.net,
        standard: r.standard,
        variance: r.varianceVsStandard,
        achievementPct: r.standardAchievementPercentage,
        status: r.status,
      })),
  };
}
