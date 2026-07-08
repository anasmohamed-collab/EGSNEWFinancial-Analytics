import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMonthlyAnalysis, previousPeriod } from "@/lib/analytics";
import { generateMonthlyExecutiveExplanation } from "@/lib/services/aiExecutiveAnalysisService";
import { buildExecutiveAiInput } from "@/lib/ai/executiveInput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/executive-summary?month=MM&year=YYYY
 *
 * Loads the ALREADY-CALCULATED monthly analysis from the DB, builds a read-only
 * metrics summary, and asks the AI service to explain it (Arabic). The AI never
 * sees or changes raw data — only computed figures. Returns a graceful result
 * when AI is disabled/unavailable.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const month = Number(url.searchParams.get("month"));
  const year = Number(url.searchParams.get("year"));
  if (!Number.isInteger(month) || !Number.isInteger(year) || month < 1 || month > 12) {
    return NextResponse.json({ error: "month and year are required" }, { status: 400 });
  }

  const analysis = await getMonthlyAnalysis(month, year);
  if (!analysis.hasData) {
    return NextResponse.json({
      enabled: false,
      source: "disabled",
      explanation: null,
      message: "لا توجد بيانات لهذا الشهر.",
    });
  }

  // Previous-month comparison (if available).
  const prev = previousPeriod(month, year);
  const prevAnalysis = await getMonthlyAnalysis(prev.month, prev.year);

  const input = buildExecutiveAiInput(analysis, prevAnalysis);

  const result = await generateMonthlyExecutiveExplanation(input);
  return NextResponse.json(result);
}
