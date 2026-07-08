/**
 * calculations.ts
 * -------------------------------------------------------------------------
 * The financial engine for Eagles Budget CRM.
 *
 * These are PURE functions operating on plain numbers so they can be unit
 * tested and reused on both server and client.
 *
 * BUSINESS RULES (do not change without finance sign-off):
 *
 *  - The ONLY comparison against the standard is:  Actual Net vs Standard.
 *  - "Collection after 14%" is a SUPPORTING metric compared to the CONTRACT
 *    value. It is never compared to the standard.
 *  - Net = grossCollection - salaries - operatingExpenses.
 *    If the 14% value already appears inside operatingExpenses in the source
 *    sheet, it is already reflected in net (we do NOT subtract it again).
 */

/** The VAT / withholding rate used across the system. */
export const VAT_RATE = 0.14;

/**
 * Status thresholds, expressed as standard-achievement percentage
 * (net / standard * 100). Tunable in one place.
 */
export const STATUS_THRESHOLDS = {
  ABOVE_STANDARD: 100, // >= 100%  -> ABOVE_STANDARD
  NEAR_STANDARD: 90, // >= 90%   -> NEAR_STANDARD
  BELOW_STANDARD: 70, // >= 70%   -> BELOW_STANDARD, else CRITICAL
} as const;

export type PerformanceStatus =
  | "ABOVE_STANDARD"
  | "NEAR_STANDARD"
  | "BELOW_STANDARD"
  | "CRITICAL";

/** Raw, per-site inputs taken from an uploaded monthly sheet. */
export interface BudgetInputs {
  contractValue: number;
  grossCollection: number;
  salaries: number;
  operatingExpenses: number;
  standard: number;
}

/** Fully computed per-site figures. */
export interface BudgetMetrics extends BudgetInputs {
  /** grossCollection / 1.14 */
  collectionAfter14: number;
  /** grossCollection - collectionAfter14  (== grossCollection / 1.14 * 0.14) */
  vat14Value: number;
  /** grossCollection - salaries - operatingExpenses */
  net: number;
  /** net - standard  (THE standard comparison) */
  varianceVsStandard: number;
  /** net / standard * 100 (null when standard is 0) */
  standardAchievementPercentage: number | null;
  /** net / grossCollection * 100 (null when grossCollection is 0) */
  netMarginPercentage: number | null;
  /** collectionAfter14 - contractValue (SUPPORTING metric only) */
  collectionGap: number;
  status: PerformanceStatus;
}

/** Collection after deducting the 14%.  collection_after_14 = gross / 1.14 */
export function collectionAfter14(grossCollection: number): number {
  return grossCollection / (1 + VAT_RATE);
}

/** The 14% value.  gross - (gross / 1.14)  ==  gross / 1.14 * 0.14 */
export function vat14Value(grossCollection: number): number {
  return grossCollection - collectionAfter14(grossCollection);
}

/**
 * Net.  net = gross_collection - salaries - operating_expenses.
 * The 14% is NOT subtracted here; if it exists in the sheet it is already
 * part of operatingExpenses.
 */
export function net(
  grossCollection: number,
  salaries: number,
  operatingExpenses: number,
): number {
  return grossCollection - salaries - operatingExpenses;
}

/** variance_vs_standard = net - standard  (THE standard comparison). */
export function varianceVsStandard(netValue: number, standard: number): number {
  return netValue - standard;
}

/** standard_achievement_percentage = net / standard * 100. Null if standard 0. */
export function standardAchievementPercentage(
  netValue: number,
  standard: number,
): number | null {
  if (!standard) return null;
  return (netValue / standard) * 100;
}

/** net_margin_percentage = net / gross_collection * 100. Null if gross 0. */
export function netMarginPercentage(
  netValue: number,
  grossCollection: number,
): number | null {
  if (!grossCollection) return null;
  return (netValue / grossCollection) * 100;
}

/**
 * collection_gap = collection_after_14 - contract_value.
 * SUPPORTING metric — how collections (net of 14%) compare to the contract.
 * A positive gap means we collected more than the contract value.
 */
export function collectionGap(
  collectionAfter14Value: number,
  contractValue: number,
): number {
  return collectionAfter14Value - contractValue;
}

/**
 * Bucket a site into a performance status from its standard-achievement %.
 * When there is no standard (achievement is null) we cannot judge against the
 * standard, so we treat it as CRITICAL to surface the missing target.
 */
export function performanceStatus(
  achievementPct: number | null,
): PerformanceStatus {
  if (achievementPct === null) return "CRITICAL";
  if (achievementPct >= STATUS_THRESHOLDS.ABOVE_STANDARD) return "ABOVE_STANDARD";
  if (achievementPct >= STATUS_THRESHOLDS.NEAR_STANDARD) return "NEAR_STANDARD";
  if (achievementPct >= STATUS_THRESHOLDS.BELOW_STANDARD) return "BELOW_STANDARD";
  return "CRITICAL";
}

/**
 * Compute the full metric set for a single site/month from raw inputs.
 * This is the canonical function used by the upload processor and anywhere
 * that needs consistent derived figures.
 */
export function computeBudgetMetrics(inputs: BudgetInputs): BudgetMetrics {
  const c14 = collectionAfter14(inputs.grossCollection);
  const vat = vat14Value(inputs.grossCollection);
  const netValue = net(
    inputs.grossCollection,
    inputs.salaries,
    inputs.operatingExpenses,
  );
  const variance = varianceVsStandard(netValue, inputs.standard);
  const achievement = standardAchievementPercentage(netValue, inputs.standard);
  const margin = netMarginPercentage(netValue, inputs.grossCollection);
  const gap = collectionGap(c14, inputs.contractValue);

  return {
    ...inputs,
    collectionAfter14: c14,
    vat14Value: vat,
    net: netValue,
    varianceVsStandard: variance,
    standardAchievementPercentage: achievement,
    netMarginPercentage: margin,
    collectionGap: gap,
    status: performanceStatus(achievement),
  };
}

// ---------------------------------------------------------------------------
// Aggregation across multiple sites / months
// ---------------------------------------------------------------------------

export interface PeriodTotals {
  totalContractValue: number;
  totalGrossCollection: number;
  totalCollectionAfter14: number;
  totalSalaries: number;
  totalOperatingExpenses: number;
  totalNet: number;
  totalStandard: number;
  totalVarianceVsStandard: number;
  /** totalNet / totalStandard * 100 (null when totalStandard is 0) */
  standardAchievementPercentage: number | null;
  siteCount: number;
}

/**
 * Sum a set of computed site rows into company/period totals. The standard
 * achievement % of the group is computed on the TOTALS (totalNet /
 * totalStandard), which is the correct way to aggregate the ratio.
 */
export function aggregateTotals(
  rows: Array<
    Pick<
      BudgetMetrics,
      | "contractValue"
      | "grossCollection"
      | "collectionAfter14"
      | "salaries"
      | "operatingExpenses"
      | "net"
      | "standard"
      | "varianceVsStandard"
    >
  >,
): PeriodTotals {
  const t: PeriodTotals = {
    totalContractValue: 0,
    totalGrossCollection: 0,
    totalCollectionAfter14: 0,
    totalSalaries: 0,
    totalOperatingExpenses: 0,
    totalNet: 0,
    totalStandard: 0,
    totalVarianceVsStandard: 0,
    standardAchievementPercentage: null,
    siteCount: rows.length,
  };

  for (const r of rows) {
    t.totalContractValue += r.contractValue;
    t.totalGrossCollection += r.grossCollection;
    t.totalCollectionAfter14 += r.collectionAfter14;
    t.totalSalaries += r.salaries;
    t.totalOperatingExpenses += r.operatingExpenses;
    t.totalNet += r.net;
    t.totalStandard += r.standard;
    t.totalVarianceVsStandard += r.varianceVsStandard;
  }

  t.standardAchievementPercentage = t.totalStandard
    ? (t.totalNet / t.totalStandard) * 100
    : null;

  return t;
}

/** Round to 2 decimals, guarding against floating point noise. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
