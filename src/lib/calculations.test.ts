import { describe, it, expect } from "vitest";
import {
  collectionAfter14,
  vat14Value,
  net,
  varianceVsStandard,
  standardAchievementPercentage,
  netMarginPercentage,
  collectionGap,
  performanceStatus,
  computeBudgetMetrics,
} from "./calculations";

// Uses the real January 2026 "Nile Towers Complex" figures from the seed.
const NILE = {
  contractValue: 1_200_000,
  grossCollection: 1_368_000,
  salaries: 720_000,
  operatingExpenses: 380_000,
  standard: 250_000,
};

describe("core formulas", () => {
  it("collection_after_14 = gross / 1.14", () => {
    expect(collectionAfter14(1_368_000)).toBeCloseTo(1_200_000, 2);
  });

  it("vat_14_value = gross - collection_after_14", () => {
    expect(vat14Value(1_368_000)).toBeCloseTo(168_000, 2);
  });

  it("net = gross - salaries - operating_expenses", () => {
    expect(net(1_368_000, 720_000, 380_000)).toBe(268_000);
  });

  it("variance_vs_standard = net - standard", () => {
    expect(varianceVsStandard(268_000, 250_000)).toBe(18_000);
  });

  it("standard_achievement_percentage = net / standard * 100", () => {
    expect(standardAchievementPercentage(268_000, 250_000)).toBeCloseTo(107.2, 3);
  });

  it("standard achievement is null when standard is 0 (no divide-by-zero)", () => {
    expect(standardAchievementPercentage(268_000, 0)).toBeNull();
  });

  it("net_margin_percentage = net / gross * 100", () => {
    expect(netMarginPercentage(268_000, 1_368_000)).toBeCloseTo(19.5906, 3);
  });

  it("collection_gap = collection_after_14 - contract (supporting metric)", () => {
    expect(collectionGap(1_200_000, 1_200_000)).toBe(0);
  });
});

describe("performance status thresholds", () => {
  it("buckets by achievement %", () => {
    expect(performanceStatus(120)).toBe("ABOVE_STANDARD");
    expect(performanceStatus(100)).toBe("ABOVE_STANDARD");
    expect(performanceStatus(92)).toBe("NEAR_STANDARD");
    expect(performanceStatus(80)).toBe("BELOW_STANDARD");
    expect(performanceStatus(67)).toBe("CRITICAL");
    expect(performanceStatus(null)).toBe("CRITICAL");
  });
});

describe("computeBudgetMetrics (deterministic, no AI)", () => {
  it("produces the full metric set for Nile Towers, Jan 2026", () => {
    const m = computeBudgetMetrics(NILE);
    expect(m.collectionAfter14).toBeCloseTo(1_200_000, 2);
    expect(m.vat14Value).toBeCloseTo(168_000, 2);
    expect(m.net).toBe(268_000);
    expect(m.varianceVsStandard).toBe(18_000);
    expect(m.standardAchievementPercentage).toBeCloseTo(107.2, 3);
    expect(m.collectionGap).toBeCloseTo(0, 2); // rounded to 0.00 on store
    expect(m.status).toBe("ABOVE_STANDARD");
  });

  it("is deterministic — same input always yields the same output", () => {
    expect(computeBudgetMetrics(NILE)).toEqual(computeBudgetMetrics(NILE));
  });
});
