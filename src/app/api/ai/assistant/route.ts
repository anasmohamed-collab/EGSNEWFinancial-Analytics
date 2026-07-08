import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  getLatestPeriod,
  getMonthlyAnalysis,
  getMultiMonthAnalysis,
  previousPeriod,
  type MultiMonthFilter,
} from "@/lib/analytics";
import { detectScopeHint, type AssistantAiContext, type AssistantScope } from "@/lib/ai/assistant";
import { buildMonthContext, buildMultiMonthContext } from "@/lib/ai/assistantContext";
import { answerManagementQuestion } from "@/lib/services/aiAssistantService";
import { getI18n } from "@/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const periodSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

const bodySchema = z.object({
  question: z.string().trim().min(1).max(500),
  scope: z.object({
    kind: z.enum(["month", "last4", "last6", "year", "all", "custom"]),
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(2000).max(2100).optional(),
    from: periodSchema.optional(),
    to: periodSchema.optional(),
  }),
});

/**
 * POST /api/ai/assistant  { question, scope }
 *
 * Loads the ALREADY-CALCULATED analysis for the requested scope, builds a
 * read-only structured context, and asks the assistant service to answer the
 * Arabic management question. The AI never sees raw data or secrets — only
 * computed figures. Returns a graceful result when AI is disabled/unavailable.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    parsedBody = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const { question } = parsedBody;
  let scope: AssistantScope = parsedBody.scope;

  // If the question itself names a period ("قارن آخر 4 شهور"), honor it.
  const hint = detectScopeHint(question);
  if (hint && hint !== scope.kind) {
    scope = { kind: hint, year: scope.year };
  }

  const { dict } = await getI18n();
  const context = await buildContextForScope(scope, dict.assistant.scopes);
  if (!context) {
    return NextResponse.json({
      enabled: false,
      source: "no_data",
      category: null,
      answer: null,
      message: dict.assistant.noData,
    });
  }

  const result = await answerManagementQuestion(question, context);
  return NextResponse.json(result);
}

async function buildContextForScope(
  scope: AssistantScope,
  scopeLabels: { month: string; last4: string; last6: string; year: string; custom: string; all: string },
): Promise<AssistantAiContext | null> {
  if (scope.kind === "month") {
    const latest = await getLatestPeriod();
    const month = scope.month ?? latest?.month;
    const year = scope.year ?? latest?.year;
    if (!month || !year) return null;
    const analysis = await getMonthlyAnalysis(month, year);
    if (!analysis.hasData) return null;
    const prev = previousPeriod(month, year);
    const prevAnalysis = await getMonthlyAnalysis(prev.month, prev.year);
    return buildMonthContext(analysis, prevAnalysis);
  }

  let filter: MultiMonthFilter;
  let label: string;
  switch (scope.kind) {
    case "last4":
      filter = { preset: "last4" };
      label = scopeLabels.last4;
      break;
    case "last6":
      filter = { preset: "last6" };
      label = scopeLabels.last6;
      break;
    case "year": {
      const latest = await getLatestPeriod();
      const year = scope.year ?? latest?.year;
      if (!year) return null;
      filter = { preset: "year", year };
      label = `${scopeLabels.year} ${year}`;
      break;
    }
    case "custom":
      if (!scope.from || !scope.to) return null;
      filter = { preset: "custom", from: scope.from, to: scope.to };
      label = scopeLabels.custom;
      break;
    case "all":
    default:
      filter = { preset: "all" };
      label = scopeLabels.all;
      break;
  }

  const multi = await getMultiMonthAnalysis(filter);
  if (multi.periods.length === 0) return null;
  return buildMultiMonthContext(multi, label);
}
