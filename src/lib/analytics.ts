import { prisma } from "./prisma";
import type { PerformanceStatus } from "./calculations";
import { round2 } from "./calculations";

const dec = (v: unknown): number => Number(v ?? 0);
const decN = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export interface SiteBudgetRow {
  id: string;
  siteId: string;
  siteName: string;
  clientName: string | null;
  month: number;
  year: number;
  contractValue: number;
  grossCollection: number;
  collectionAfter14: number;
  vat14Value: number;
  salaries: number;
  operatingExpenses: number;
  net: number;
  standard: number;
  varianceVsStandard: number;
  standardAchievementPercentage: number | null;
  netMarginPercentage: number | null;
  collectionGap: number;
  status: PerformanceStatus;
}

export interface MonthlyAnalysis {
  month: number;
  year: number;
  hasData: boolean;
  summary: {
    totalContractValue: number;
    totalGrossCollection: number;
    totalCollectionAfter14: number;
    totalSalaries: number;
    totalOperatingExpenses: number;
    totalNet: number;
    totalStandard: number;
    totalVarianceVsStandard: number;
    standardAchievementPercentage: number | null;
    totalGeneralExpenses: number;
    finalNetAfterGeneral: number;
    siteCount: number;
  };
  sites: SiteBudgetRow[];
  highlights: {
    bestSite: SiteBudgetRow | null;
    worstSite: SiteBudgetRow | null;
    biggestPositiveVariance: SiteBudgetRow | null;
    biggestNegativeVariance: SiteBudgetRow | null;
  };
}

function toRow(b: {
  id: string;
  siteId: string;
  month: number;
  year: number;
  contractValue: unknown;
  grossCollection: unknown;
  collectionAfter14: unknown;
  vat14Value: unknown;
  salaries: unknown;
  operatingExpenses: unknown;
  net: unknown;
  standard: unknown;
  varianceVsStandard: unknown;
  standardAchievementPercentage: unknown;
  netMarginPercentage: unknown;
  collectionGap: unknown;
  status: PerformanceStatus;
  site: { name: string; clientName: string | null };
}): SiteBudgetRow {
  return {
    id: b.id,
    siteId: b.siteId,
    siteName: b.site.name,
    clientName: b.site.clientName,
    month: b.month,
    year: b.year,
    contractValue: dec(b.contractValue),
    grossCollection: dec(b.grossCollection),
    collectionAfter14: dec(b.collectionAfter14),
    vat14Value: dec(b.vat14Value),
    salaries: dec(b.salaries),
    operatingExpenses: dec(b.operatingExpenses),
    net: dec(b.net),
    standard: dec(b.standard),
    varianceVsStandard: dec(b.varianceVsStandard),
    standardAchievementPercentage: decN(b.standardAchievementPercentage),
    netMarginPercentage: decN(b.netMarginPercentage),
    collectionGap: dec(b.collectionGap),
    status: b.status,
  };
}

/** Management recommendation bucket keyed into dict.executive.recommendations. */
export type RecommendationKey = "excellent" | "good" | "warning" | "critical";

export function recommendationKey(
  achievementPct: number | null,
): RecommendationKey {
  if (achievementPct === null) return "warning";
  if (achievementPct >= 100) return "excellent";
  if (achievementPct >= 90) return "good";
  if (achievementPct >= 70) return "warning";
  return "critical";
}

/** The month/year immediately before the given one. */
export function previousPeriod(month: number, year: number): {
  month: number;
  year: number;
} {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

/** Distinct (year, month) periods that have uploaded/normalized data. */
export async function getAvailablePeriods(): Promise<{ month: number; year: number }[]> {
  const rows = await prisma.monthlySiteBudget.findMany({
    distinct: ["year", "month"],
    select: { year: true, month: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  return rows;
}

/** Most recent period that has data, or null. */
export async function getLatestPeriod(): Promise<{ month: number; year: number } | null> {
  const periods = await getAvailablePeriods();
  return periods[0] ?? null;
}

const budgetInclude = {
  site: { select: { name: true, clientName: true } },
} as const;

export async function getMonthlyAnalysis(
  month: number,
  year: number,
): Promise<MonthlyAnalysis> {
  const [budgets, summary] = await Promise.all([
    prisma.monthlySiteBudget.findMany({
      where: { month, year },
      include: budgetInclude,
      orderBy: { net: "desc" },
    }),
    prisma.monthlySummary.findUnique({ where: { year_month: { year, month } } }),
  ]);

  const sites = budgets.map(toRow);
  const hasData = sites.length > 0;

  // Highlights. Best/worst by standard achievement (nulls excluded);
  // variance extremes by absolute variance.
  const withAchievement = sites.filter(
    (s) => s.standardAchievementPercentage !== null,
  );
  const bestSite =
    withAchievement.length > 0
      ? withAchievement.reduce((a, b) =>
          (b.standardAchievementPercentage ?? -Infinity) >
          (a.standardAchievementPercentage ?? -Infinity)
            ? b
            : a,
        )
      : null;
  const worstSite =
    withAchievement.length > 0
      ? withAchievement.reduce((a, b) =>
          (b.standardAchievementPercentage ?? Infinity) <
          (a.standardAchievementPercentage ?? Infinity)
            ? b
            : a,
        )
      : null;
  const biggestPositiveVariance = hasData
    ? sites.reduce((a, b) => (b.varianceVsStandard > a.varianceVsStandard ? b : a))
    : null;
  const biggestNegativeVariance = hasData
    ? sites.reduce((a, b) => (b.varianceVsStandard < a.varianceVsStandard ? b : a))
    : null;

  return {
    month,
    year,
    hasData,
    summary: summary
      ? {
          totalContractValue: dec(summary.totalContractValue),
          totalGrossCollection: dec(summary.totalGrossCollection),
          totalCollectionAfter14: dec(summary.totalCollectionAfter14),
          totalSalaries: dec(summary.totalSalaries),
          totalOperatingExpenses: dec(summary.totalOperatingExpenses),
          totalNet: dec(summary.totalNet),
          totalStandard: dec(summary.totalStandard),
          totalVarianceVsStandard: dec(summary.totalVarianceVsStandard),
          standardAchievementPercentage: decN(summary.standardAchievementPercentage),
          totalGeneralExpenses: dec(summary.totalGeneralExpenses),
          finalNetAfterGeneral: dec(summary.finalNetAfterGeneral),
          siteCount: summary.siteCount,
        }
      : emptySummary(),
    sites,
    highlights: { bestSite, worstSite, biggestPositiveVariance, biggestNegativeVariance },
  };
}

function emptySummary(): MonthlyAnalysis["summary"] {
  return {
    totalContractValue: 0,
    totalGrossCollection: 0,
    totalCollectionAfter14: 0,
    totalSalaries: 0,
    totalOperatingExpenses: 0,
    totalNet: 0,
    totalStandard: 0,
    totalVarianceVsStandard: 0,
    standardAchievementPercentage: null,
    totalGeneralExpenses: 0,
    finalNetAfterGeneral: 0,
    siteCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Multi-month analysis
// ---------------------------------------------------------------------------

export type MultiMonthPreset = "all" | "last4" | "last6" | "last12" | "year" | "custom";

export interface MultiMonthFilter {
  preset: MultiMonthPreset;
  year?: number; // for "year"
  from?: { month: number; year: number }; // for "custom"
  to?: { month: number; year: number }; // for "custom"
}

/** Ordinal for month/year to make range math easy. */
const ord = (year: number, month: number) => year * 12 + (month - 1);

export interface MultiMonthAnalysis {
  periods: { month: number; year: number }[];
  totals: MonthlyAnalysis["summary"];
  monthlyTrend: {
    month: number;
    year: number;
    net: number;
    standard: number;
    variance: number;
    achievementPct: number | null;
  }[];
  siteTrend: {
    siteId: string;
    siteName: string;
    net: number;
    standard: number;
    variance: number;
    achievementPct: number | null;
    monthsPresent: number;
    monthsBelowStandard: number;
  }[];
  sitesRepeatedlyBelow: { siteId: string; siteName: string; monthsBelowStandard: number; monthsPresent: number }[];
  bestMonth: { month: number; year: number; achievementPct: number | null } | null;
  worstMonth: { month: number; year: number; achievementPct: number | null } | null;
  bestSite: { siteId: string; siteName: string; achievementPct: number | null } | null;
  worstSite: { siteId: string; siteName: string; achievementPct: number | null } | null;
}

/** Resolve a filter into the concrete list of periods that have data. */
async function resolvePeriods(
  filter: MultiMonthFilter,
): Promise<{ month: number; year: number }[]> {
  const all = await getAvailablePeriods(); // desc
  const asc = [...all].sort((a, b) => ord(a.year, a.month) - ord(b.year, b.month));

  switch (filter.preset) {
    case "all":
      return asc;
    case "last4":
      return asc.slice(-4);
    case "last6":
      return asc.slice(-6);
    case "last12":
      return asc.slice(-12);
    case "year":
      return asc.filter((p) => p.year === filter.year);
    case "custom": {
      if (!filter.from || !filter.to) return asc;
      const lo = ord(filter.from.year, filter.from.month);
      const hi = ord(filter.to.year, filter.to.month);
      const [min, max] = lo <= hi ? [lo, hi] : [hi, lo];
      return asc.filter((p) => {
        const o = ord(p.year, p.month);
        return o >= min && o <= max;
      });
    }
    default:
      return asc;
  }
}

export async function getMultiMonthAnalysis(
  filter: MultiMonthFilter,
): Promise<MultiMonthAnalysis> {
  const periods = await resolvePeriods(filter);

  if (periods.length === 0) {
    return {
      periods: [],
      totals: emptySummary(),
      monthlyTrend: [],
      siteTrend: [],
      sitesRepeatedlyBelow: [],
      bestMonth: null,
      worstMonth: null,
      bestSite: null,
      worstSite: null,
    };
  }

  const orFilters = periods.map((p) => ({ month: p.month, year: p.year }));
  const budgets = await prisma.monthlySiteBudget.findMany({
    where: { OR: orFilters },
    include: budgetInclude,
  });
  const rows = budgets.map(toRow);

  const generalAgg = await prisma.expenseItem.aggregate({
    where: { OR: orFilters },
    _sum: { amount: true },
  });
  const totalGeneralExpenses = dec(generalAgg._sum.amount);

  // ---- Period totals ----
  const totals = rows.reduce(
    (acc, r) => {
      acc.totalContractValue += r.contractValue;
      acc.totalGrossCollection += r.grossCollection;
      acc.totalCollectionAfter14 += r.collectionAfter14;
      acc.totalSalaries += r.salaries;
      acc.totalOperatingExpenses += r.operatingExpenses;
      acc.totalNet += r.net;
      acc.totalStandard += r.standard;
      acc.totalVarianceVsStandard += r.varianceVsStandard;
      return acc;
    },
    { ...emptySummary() },
  );
  totals.siteCount = new Set(rows.map((r) => r.siteId)).size;
  totals.totalGeneralExpenses = totalGeneralExpenses;
  totals.finalNetAfterGeneral = round2(totals.totalNet - totalGeneralExpenses);
  totals.standardAchievementPercentage = totals.totalStandard
    ? round2((totals.totalNet / totals.totalStandard) * 100)
    : null;

  // ---- Monthly trend ----
  const byPeriod = new Map<string, { month: number; year: number; net: number; standard: number }>();
  for (const r of rows) {
    const key = `${r.year}-${r.month}`;
    const cur = byPeriod.get(key) ?? { month: r.month, year: r.year, net: 0, standard: 0 };
    cur.net += r.net;
    cur.standard += r.standard;
    byPeriod.set(key, cur);
  }
  const monthlyTrend = [...byPeriod.values()]
    .sort((a, b) => ord(a.year, a.month) - ord(b.year, b.month))
    .map((p) => ({
      month: p.month,
      year: p.year,
      net: round2(p.net),
      standard: round2(p.standard),
      variance: round2(p.net - p.standard),
      achievementPct: p.standard ? round2((p.net / p.standard) * 100) : null,
    }));

  // ---- Site trend ----
  const bySite = new Map<
    string,
    { siteId: string; siteName: string; net: number; standard: number; monthsPresent: number; monthsBelowStandard: number }
  >();
  for (const r of rows) {
    const cur =
      bySite.get(r.siteId) ??
      { siteId: r.siteId, siteName: r.siteName, net: 0, standard: 0, monthsPresent: 0, monthsBelowStandard: 0 };
    cur.net += r.net;
    cur.standard += r.standard;
    cur.monthsPresent += 1;
    if (r.status === "BELOW_STANDARD" || r.status === "CRITICAL") cur.monthsBelowStandard += 1;
    bySite.set(r.siteId, cur);
  }
  const siteTrend = [...bySite.values()]
    .map((s) => ({
      siteId: s.siteId,
      siteName: s.siteName,
      net: round2(s.net),
      standard: round2(s.standard),
      variance: round2(s.net - s.standard),
      achievementPct: s.standard ? round2((s.net / s.standard) * 100) : null,
      monthsPresent: s.monthsPresent,
      monthsBelowStandard: s.monthsBelowStandard,
    }))
    .sort((a, b) => b.variance - a.variance);

  const sitesRepeatedlyBelow = siteTrend
    .filter((s) => s.monthsBelowStandard >= 2)
    .sort((a, b) => b.monthsBelowStandard - a.monthsBelowStandard)
    .map((s) => ({
      siteId: s.siteId,
      siteName: s.siteName,
      monthsBelowStandard: s.monthsBelowStandard,
      monthsPresent: s.monthsPresent,
    }));

  // ---- Best / worst month & site (by achievement %) ----
  const monthsWithAch = monthlyTrend.filter((m) => m.achievementPct !== null);
  const bestMonth = monthsWithAch.length
    ? monthsWithAch.reduce((a, b) => ((b.achievementPct ?? -Infinity) > (a.achievementPct ?? -Infinity) ? b : a))
    : null;
  const worstMonth = monthsWithAch.length
    ? monthsWithAch.reduce((a, b) => ((b.achievementPct ?? Infinity) < (a.achievementPct ?? Infinity) ? b : a))
    : null;

  const sitesWithAch = siteTrend.filter((s) => s.achievementPct !== null);
  const bestSite = sitesWithAch.length
    ? sitesWithAch.reduce((a, b) => ((b.achievementPct ?? -Infinity) > (a.achievementPct ?? -Infinity) ? b : a))
    : null;
  const worstSite = sitesWithAch.length
    ? sitesWithAch.reduce((a, b) => ((b.achievementPct ?? Infinity) < (a.achievementPct ?? Infinity) ? b : a))
    : null;

  return {
    periods,
    totals,
    monthlyTrend,
    siteTrend,
    sitesRepeatedlyBelow,
    bestMonth: bestMonth ? { month: bestMonth.month, year: bestMonth.year, achievementPct: bestMonth.achievementPct } : null,
    worstMonth: worstMonth ? { month: worstMonth.month, year: worstMonth.year, achievementPct: worstMonth.achievementPct } : null,
    bestSite: bestSite ? { siteId: bestSite.siteId, siteName: bestSite.siteName, achievementPct: bestSite.achievementPct } : null,
    worstSite: worstSite ? { siteId: worstSite.siteId, siteName: worstSite.siteName, achievementPct: worstSite.achievementPct } : null,
  };
}
