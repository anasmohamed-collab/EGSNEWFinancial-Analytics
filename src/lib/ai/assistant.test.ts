import { describe, it, expect } from "vitest";
import {
  classifyQuestion,
  detectScopeHint,
  parseAssistantAnswer,
  buildAssistantPrompt,
  OUT_OF_SCOPE_MESSAGE,
} from "./assistant";
import { SAMPLE_CONTEXT } from "./assistant.fixtures";

describe("classifyQuestion — the management sample questions", () => {
  const cases: [string, string][] = [
    ["هل شهر يناير كان كويس؟", "monthly_summary"],
    ["إيه سبب ضعف الشهر؟", "deviation_reason"],
    ["أنهي موقع عامل أكبر خسارة؟", "best_worst_site"],
    ["مين أفضل موقع الشهر ده؟", "best_worst_site"],
    ["قارن لي آخر 4 شهور ببساطة", "comparison"],
    ["هل الأداء بيتحسن ولا بيتراجع؟", "trend_direction"],
    ["إيه أهم 3 توصيات للإدارة؟", "recommendations"],
    ["هل في موقع متكرر تحت الاستاندرد؟", "repeated_below"],
    ["إيه المصروف اللي زاد بشكل غير طبيعي؟", "expense_movement"],
    ["لخص التقرير لمجلس الإدارة", "board_summary"],
    ["لخص الشهر", "monthly_summary"],
  ];
  for (const [q, expected] of cases) {
    it(`"${q}" → ${expected}`, () => {
      expect(classifyQuestion(q)).toBe(expected);
    });
  }

  it("non-financial questions → out_of_scope", () => {
    expect(classifyQuestion("مين كسب ماتش الأهلي امبارح؟")).toBe("out_of_scope");
    expect(classifyQuestion("اكتب لي قصيدة")).toBe("out_of_scope");
    expect(classifyQuestion("")).toBe("out_of_scope");
  });
});

describe("detectScopeHint", () => {
  it("detects last4 / last6 / year from the question text", () => {
    expect(detectScopeHint("قارن لي آخر 4 شهور ببساطة")).toBe("last4");
    expect(detectScopeHint("قارن آخر ٤ شهور")).toBe("last4");
    expect(detectScopeHint("إزاي أداء آخر 6 شهور؟")).toBe("last6");
    expect(detectScopeHint("لخص السنة كاملة")).toBe("year");
    expect(detectScopeHint("هل شهر يناير كان كويس؟")).toBeNull();
  });
});

describe("parseAssistantAnswer — text-only contract", () => {
  it("parses a valid Arabic JSON answer", () => {
    const a = parseAssistantAnswer(
      JSON.stringify({
        shortAnswer: "الشهر أقل من الاستاندرد.",
        evidence: "الفرق −66,000.",
        meaning: "متابعة مطلوبة.",
        recommendation: "مراجعة الموقع الأضعف.",
      }),
    );
    expect(a?.shortAnswer).toBe("الشهر أقل من الاستاندرد.");
  });

  it("rejects answers where the model tries to return numbers instead of text", () => {
    // The AI cannot inject numeric fields — non-string shortAnswer fails validation.
    expect(parseAssistantAnswer(JSON.stringify({ shortAnswer: 1_500_000 }))).toBeNull();
    expect(parseAssistantAnswer(JSON.stringify({ totalNet: 999 }))).toBeNull();
  });

  it("rejects non-JSON output", () => {
    expect(parseAssistantAnswer("not json at all")).toBeNull();
    expect(parseAssistantAnswer("")).toBeNull();
  });
});

describe("buildAssistantPrompt — safe context only", () => {
  it("includes only the structured pre-computed metrics and the safety rules", () => {
    const { system, user } = buildAssistantPrompt("لخص الشهر", "monthly_summary", SAMPLE_CONTEXT);
    // Pre-computed numbers are present.
    expect(user).toContain("1244000");
    expect(user).toContain('"totalStandard": 1310000');
    expect(user).toContain("Alexandria Port Terminal");
    // Missing-data notes are forwarded.
    expect(user).toContain("لا توجد بيانات للشهر السابق للمقارنة.");
    // Safety instructions.
    expect(system).toContain("لا تخترع");
    expect(system).toContain("لا تُجرِ أي عملية حسابية");
    expect(system).toContain(OUT_OF_SCOPE_MESSAGE);
  });

  it("never embeds provider secrets in the prompt", () => {
    const prevKey = process.env.NVIDIA_API_KEY;
    process.env.NVIDIA_API_KEY = "nvapi-super-secret-key";
    try {
      const { system, user } = buildAssistantPrompt("لخص الشهر", "monthly_summary", SAMPLE_CONTEXT);
      expect(system).not.toContain("nvapi");
      expect(user).not.toContain("nvapi");
      expect(user).not.toContain("NVIDIA_API_KEY");
    } finally {
      if (prevKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = prevKey;
    }
  });
});
