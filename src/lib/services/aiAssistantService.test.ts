import { describe, it, expect, vi } from "vitest";
import { answerManagementQuestion, buildAssistantFallback } from "./aiAssistantService";
import { ASSISTANT_DISABLED_MESSAGE, OUT_OF_SCOPE_MESSAGE } from "../ai/assistant";
import { SAMPLE_CONTEXT } from "../ai/assistant.fixtures";

const CONFIG = { apiKey: "test-key", baseUrl: "https://example.test/v1", model: "m" };

function okResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response;
}

describe("answerManagementQuestion", () => {
  it("AI disabled → exact Arabic disabled message, never calls NVIDIA", async () => {
    const fetchSpy = vi.fn();
    const r = await answerManagementQuestion("لخص الشهر", SAMPLE_CONTEXT, {
      enabled: false,
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    expect(r.source).toBe("disabled");
    expect(r.enabled).toBe(false);
    expect(r.message).toBe(ASSISTANT_DISABLED_MESSAGE);
    expect(r.answer).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("missing API key (config null) → disabled, no network call", async () => {
    const fetchSpy = vi.fn();
    const r = await answerManagementQuestion("لخص الشهر", SAMPLE_CONTEXT, {
      enabled: true,
      config: null,
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    expect(r.source).toBe("disabled");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("out-of-scope question → fixed Arabic message, NO provider call even when enabled", async () => {
    const fetchSpy = vi.fn();
    const r = await answerManagementQuestion("مين كسب ماتش الأهلي امبارح؟", SAMPLE_CONTEXT, {
      enabled: true,
      config: CONFIG,
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    expect(r.source).toBe("out_of_scope");
    expect(r.message).toBe(OUT_OF_SCOPE_MESSAGE);
    expect(r.answer).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("success → parses the structured Arabic answer and calls the right URL", async () => {
    const content = JSON.stringify({
      shortAnswer: "الشهر أقل من الاستاندرد.",
      evidence: "الفرق −66,000 ونسبة التحقيق 95.0%.",
      meaning: "متابعة إدارية مطلوبة.",
      recommendation: "مراجعة موقع الإسكندرية.",
    });
    const fetchImpl = vi.fn(async () => okResponse(content));
    const r = await answerManagementQuestion("هل شهر يناير كان كويس؟", SAMPLE_CONTEXT, {
      enabled: true,
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.source).toBe("ai");
    expect(r.category).toBe("monthly_summary");
    expect(r.answer?.shortAnswer).toBe("الشهر أقل من الاستاندرد.");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.anything(),
    );
  });

  it("the request body contains only structured metrics — no secrets", async () => {
    const fetchImpl = vi.fn(async () => okResponse("{}"));
    await answerManagementQuestion("لخص الشهر", SAMPLE_CONTEXT, {
      enabled: true,
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = String(init.body);
    // Pre-computed metrics are in the prompt…
    expect(body).toContain("1244000");
    expect(body).toContain("Alexandria Port Terminal");
    // …but the key appears only in the Authorization header, never the body.
    expect(body).not.toContain("test-key");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
  });

  it("API returns non-200 → deterministic Arabic fallback", async () => {
    const fetchImpl = vi.fn(
      async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response,
    );
    const r = await answerManagementQuestion("إيه سبب ضعف الشهر؟", SAMPLE_CONTEXT, {
      enabled: true,
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.source).toBe("fallback");
    expect(r.answer).not.toBeNull();
    expect(r.answer!.shortAnswer).toContain("Alexandria Port Terminal");
  });

  it("fetch throws → deterministic fallback", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    });
    const r = await answerManagementQuestion("لخص الشهر", SAMPLE_CONTEXT, {
      enabled: true,
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.source).toBe("fallback");
    expect(r.answer!.shortAnswer.length).toBeGreaterThan(0);
  });

  it("AI tries to answer with numbers instead of text → rejected, fallback used", async () => {
    // A response whose fields are numeric fails the text-only schema, so the
    // model can never push numbers into the app.
    const fetchImpl = vi.fn(async () => okResponse(JSON.stringify({ shortAnswer: 123456 })));
    const r = await answerManagementQuestion("لخص الشهر", SAMPLE_CONTEXT, {
      enabled: true,
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.source).toBe("fallback");
    expect(typeof r.answer!.shortAnswer).toBe("string");
  });
});

describe("buildAssistantFallback — deterministic Arabic from computed numbers only", () => {
  it("best/worst site answer names both sites", () => {
    const a = buildAssistantFallback("best_worst_site", SAMPLE_CONTEXT);
    expect(a.shortAnswer).toContain("Smart Village HQ");
    expect(a.shortAnswer).toContain("Alexandria Port Terminal");
  });

  it("repeated-below answer lists the repeated sites", () => {
    const a = buildAssistantFallback("repeated_below", SAMPLE_CONTEXT);
    expect(a.shortAnswer).toContain("Alexandria Port Terminal");
    expect(a.shortAnswer).toContain("3");
  });

  it("summary mentions being below standard and includes the data notes", () => {
    const a = buildAssistantFallback("monthly_summary", SAMPLE_CONTEXT);
    expect(a.shortAnswer).toContain("أقل من الاستاندرد");
    expect(a.shortAnswer).toContain("لا توجد بيانات للشهر السابق للمقارنة.");
    expect(a.evidence).toContain("95.0%");
  });

  it("expense answer reports no comparison when previous month is missing", () => {
    const a = buildAssistantFallback("expense_movement", SAMPLE_CONTEXT);
    expect(a.shortAnswer).toContain("لا تتوفر مقارنة مصروفات");
  });
});
