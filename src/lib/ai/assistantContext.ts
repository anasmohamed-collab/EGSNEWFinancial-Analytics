/**
 * Builders that turn the deterministic read models (analytics.ts) into the
 * read-only AssistantAiContext sent to the AI.
 *
 * Pure mapping only — no DB access, no new financial formulas. Every number
 * here was already calculated by the backend; deltas reuse the same simple
 * subtraction the executive route already performs for netChange.
 */
import type { MonthlyAnalysis, MultiMonthAnalysis } from "../analytics";
import { round2 } from "../calculations";
import { monthName } from "../../i18n/format";
import type { AssistantAiContext, AssistantSiteMetric } from "./assistant";

const MAX_SITES_IN_PROMPT = 8;

const arPeriod = (month: number, year: number) => `${monthName(month, "ar")} ${year}`;

/** Context for a single-month scope (with optional previous-month comparison). */
export function buildMonthContext(
  analysis: MonthlyAnalysis,
  prevAnalysis: MonthlyAnalysis | null,
): AssistantAiContext {
  const s = analysis.summary;
  const h = analysis.highlights;

  const topPressuredSites: AssistantSiteMetric[] = [...analysis.sites]
    .sort((a, b) => a.varianceVsStandard - b.varianceVsStandard)
    .slice(0, MAX_SITES_IN_PROMPT)
    .map((r) => ({
      name: r.siteName,
      net: r.net,
      standard: r.standard,
      variance: r.varianceVsStandard,
      achievementPct: r.standardAchievementPercentage,
      status: r.status,
    }));

  const dataNotes: string[] = [];
  if (!prevAnalysis?.hasData) {
    dataNotes.push("لا توجد بيانات للشهر السابق للمقارنة.");
  }
  if (s.standardAchievementPercentage === null) {
    dataNotes.push("نسبة تحقيق الاستاندرد غير متاحة لهذه الفترة.");
  }

  const prevS = prevAnalysis?.hasData ? prevAnalysis.summary : null;

  return {
    scopeLabel: arPeriod(analysis.month, analysis.year),
    periods: [{ month: analysis.month, year: analysis.year }],
    totals: {
      totalNet: s.totalNet,
      totalStandard: s.totalStandard,
      varianceVsStandard: s.totalVarianceVsStandard,
      standardAchievementPercentage: s.standardAchievementPercentage,
      totalSalaries: s.totalSalaries,
      totalOperatingExpenses: s.totalOperatingExpenses,
      totalGeneralExpenses: s.totalGeneralExpenses,
      finalNetAfterGeneral: s.finalNetAfterGeneral,
      siteCount: s.siteCount,
    },
    monthlyTrend: [
      {
        month: analysis.month,
        year: analysis.year,
        net: s.totalNet,
        standard: s.totalStandard,
        variance: s.totalVarianceVsStandard,
        achievementPct: s.standardAchievementPercentage,
      },
    ],
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
    bestMonth: null,
    worstMonth: null,
    sitesRepeatedlyBelow: [],
    topPressuredSites,
    previousMonthComparison: prevS
      ? {
          prevMonth: prevAnalysis!.month,
          prevYear: prevAnalysis!.year,
          prevNet: prevS.totalNet,
          netChange: round2(s.totalNet - prevS.totalNet),
          prevAchievementPercentage: prevS.standardAchievementPercentage,
          salariesChange: round2(s.totalSalaries - prevS.totalSalaries),
          operatingExpensesChange: round2(s.totalOperatingExpenses - prevS.totalOperatingExpenses),
          generalExpensesChange: round2(s.totalGeneralExpenses - prevS.totalGeneralExpenses),
        }
      : null,
    dataNotes,
  };
}

/** Context for a multi-month scope (last4/last6/year/all/custom). */
export function buildMultiMonthContext(
  multi: MultiMonthAnalysis,
  scopeLabel: string,
): AssistantAiContext {
  const t = multi.totals;

  const topPressuredSites: AssistantSiteMetric[] = [...multi.siteTrend]
    .sort((a, b) => a.variance - b.variance)
    .slice(0, MAX_SITES_IN_PROMPT)
    .map((s) => ({
      name: s.siteName,
      net: s.net,
      standard: s.standard,
      variance: s.variance,
      achievementPct: s.achievementPct,
      status:
        s.monthsBelowStandard > 0
          ? `أقل من الاستاندرد في ${s.monthsBelowStandard} من ${s.monthsPresent} شهور`
          : "ضمن الاستاندرد طوال الفترة",
    }));

  const dataNotes: string[] = [];
  if (multi.periods.length === 0) {
    dataNotes.push("لا توجد بيانات للفترة المختارة.");
  }
  if (t.standardAchievementPercentage === null) {
    dataNotes.push("نسبة تحقيق الاستاندرد غير متاحة لهذه الفترة.");
  }

  return {
    scopeLabel,
    periods: multi.periods,
    totals: {
      totalNet: t.totalNet,
      totalStandard: t.totalStandard,
      varianceVsStandard: t.totalVarianceVsStandard,
      standardAchievementPercentage: t.standardAchievementPercentage,
      totalSalaries: t.totalSalaries,
      totalOperatingExpenses: t.totalOperatingExpenses,
      totalGeneralExpenses: t.totalGeneralExpenses,
      finalNetAfterGeneral: t.finalNetAfterGeneral,
      siteCount: t.siteCount,
    },
    monthlyTrend: multi.monthlyTrend,
    bestSite: multi.bestSite
      ? { name: multi.bestSite.siteName, achievementPct: multi.bestSite.achievementPct }
      : null,
    worstSite: multi.worstSite
      ? { name: multi.worstSite.siteName, achievementPct: multi.worstSite.achievementPct }
      : null,
    biggestNegativeVarianceSite:
      topPressuredSites.length > 0 && topPressuredSites[0].variance < 0
        ? { name: topPressuredSites[0].name, variance: topPressuredSites[0].variance }
        : null,
    bestMonth: multi.bestMonth,
    worstMonth: multi.worstMonth,
    sitesRepeatedlyBelow: multi.sitesRepeatedlyBelow.map((s) => ({
      name: s.siteName,
      monthsBelowStandard: s.monthsBelowStandard,
      monthsPresent: s.monthsPresent,
    })),
    topPressuredSites,
    previousMonthComparison: null,
    dataNotes,
  };
}
