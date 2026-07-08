import { describe, it, expect, vi } from "vitest";
import {
  generateMonthlyExecutiveExplanation,
  buildDeterministicFallback,
} from "./aiExecutiveAnalysisService";
import { buildExecutivePrompt, type ExecutiveAiInput } from "../ai/prompt";

// Real January 2026 figures (from the seed) — already calculated by the backend.
const INPUT: ExecutiveAiInput = {
  month: 1,
  year: 2026,
  totalNet: 1_244_000,
  totalStandard: 1_310_000,
  varianceVsStandard: -66_000,
  standardAchievementPercentage: 94.96,
  finalNetAfterGeneralExpenses: 989_000,
  bestSite: { name: "Smart Village HQ", achievementPct: 109.38 },
  worstSite: { name: "Alexandria Port Terminal", achievementPct: 67 },
  biggestNegativeVarianceSite: { name: "Alexandria Port Terminal", variance: -66_000 },
  previousMonthComparison: null,
  topSitesSummary: [
    { name: "Alexandria Port Terminal", net: 134_000, standard: 200_000, variance: -66_000, achievementPct: 67, status: "CRITICAL" },
  ],
};

const CONFIG = { apiKey: "test-key", baseUrl: "https://example.test/v1", model: "m" };

function okResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response;
}

describe("generateMonthlyExecutiveExplanation", () => {
  it("AI disabled → returns 'disabled' and never calls NVIDIA", async () => {
    const fetchSpy = vi.fn();
    const r = await generateMonthlyExecutiveExplanation(INPUT, {
      enabled: false,
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    expect(r.source).toBe("disabled");
    expect(r.enabled).toBe(false);
    expect(r.explanation).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("missing API key (config null) → 'disabled', no network call", async () => {
    const fetchSpy = vi.fn();
    const r = await generateMonthlyExecutiveExplanation(INPUT, {
      enabled: true,
      config: null,
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    expect(r.source).toBe("disabled");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("success → parses valid Arabic JSON, clamps arrays to 3, calls the right URL", async () => {
    const content = JSON.stringify({
      executiveSummary: "ملخص",
      keyInsight: "ملاحظة",
      mainProblem: "ضغط",
      topThreeProblems: ["1", "2", "3", "4"],
      topThreeRecommendations: ["أ", "ب"],
      riskLevel: "مرتفع",
      boardMessage: "رسالة",
    });
    const fetchImpl = vi.fn(async () => okResponse(content));
    const r = await generateMonthlyExecutiveExplanation(INPUT, {
      enabled: true,
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.source).toBe("ai");
    expect(r.explanation?.executiveSummary).toBe("ملخص");
    expect(r.explanation?.topThreeProblems).toHaveLength(3);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.anything(),
    );
  });

  it("API returns non-200 → deterministic fallback", async () => {
    const fetchImpl = vi.fn(
      async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response,
    );
    const r = await generateMonthlyExecutiveExplanation(INPUT, {
      enabled: true,
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.source).toBe("fallback");
    expect(r.explanation).not.toBeNull();
    expect(r.explanation!.executiveSummary.length).toBeGreaterThan(0);
  });

  it("fetch throws → deterministic fallback", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    });
    const r = await generateMonthlyExecutiveExplanation(INPUT, {
      enabled: true,
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.source).toBe("fallback");
    expect(r.explanation).not.toBeNull();
  });

  it("AI returns invalid JSON → deterministic fallback", async () => {
    const fetchImpl = vi.fn(async () => okResponse("this is not json"));
    const r = await generateMonthlyExecutiveExplanation(INPUT, {
      enabled: true,
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.source).toBe("fallback");
  });
});

describe("buildExecutivePrompt", () => {
  it("includes ONLY the provided metrics + safety rules", () => {
    const { system, user } = buildExecutivePrompt(INPUT);
    // provided numbers are present
    expect(user).toContain("1244000");
    expect(user).toContain('"totalStandard": 1310000');
    expect(user).toContain("Alexandria Port Terminal");
    // safety instructions present
    expect(system).toContain("لا تخترع"); // do not invent numbers
    expect(system).toContain("لا تُجرِ أي عملية حسابية"); // do not calculate
    expect(system).toContain("بالعربية فقط"); // Arabic only
  });
});

describe("buildDeterministicFallback", () => {
  it("derives Arabic text only from the provided numbers", () => {
    const f = buildDeterministicFallback(INPUT);
    expect(f.riskLevel).toBe("متوسط"); // 94.96% → >=90
    expect(f.executiveSummary).toContain("أقل من الاستاندرد"); // negative variance
    expect(f.topThreeRecommendations.length).toBeGreaterThan(0);
    expect(f.mainProblem).toContain("Alexandria Port Terminal");
  });
});
