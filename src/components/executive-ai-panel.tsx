"use client";

import { useState } from "react";
import { Sparkles, AlertTriangle, Lightbulb, MessageSquare, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

interface Explanation {
  executiveSummary: string;
  keyInsight: string;
  mainProblem: string;
  topThreeProblems: string[];
  topThreeRecommendations: string[];
  riskLevel: string;
  boardMessage: string;
}

interface ApiResult {
  enabled: boolean;
  source: "ai" | "fallback" | "disabled";
  explanation: Explanation | null;
  message: string | null;
}

function riskBadgeClass(risk: string): string {
  if (/حرج|critical/i.test(risk)) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  if (/مرتفع|high/i.test(risk)) return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
  if (/متوسط|medium/i.test(risk)) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
}

export function ExecutiveAiPanel({
  month,
  year,
  aiEnabled,
}: {
  month: number;
  year: number;
  aiEnabled: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.ai;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/executive-summary?month=${month}&year=${year}`);
      if (!res.ok) {
        setError(t.error);
        return;
      }
      const data: ApiResult = await res.json();
      setResult(data);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          {t.title}
        </CardTitle>
        {aiEnabled && (
          <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? t.generating : result ? t.regenerate : t.generate}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {!aiEnabled ? (
          <p className="text-sm text-muted-foreground">{t.disabled}</p>
        ) : error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : !result ? (
          <p className="text-sm text-muted-foreground">{t.disclaimer}</p>
        ) : result.explanation ? (
          <div className="space-y-4">
            {result.source === "fallback" && result.message && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {result.message}
              </p>
            )}

            <p className="text-base font-medium leading-relaxed">
              {result.explanation.executiveSummary}
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Section label={t.keyInsight}>{result.explanation.keyInsight}</Section>
              <Section label={t.mainProblem} icon={<AlertTriangle className="h-3.5 w-3.5 text-red-500" />}>
                {result.explanation.mainProblem}
              </Section>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ListSection
                label={t.problems}
                icon={<AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                items={result.explanation.topThreeProblems}
              />
              <ListSection
                label={t.recommendations}
                icon={<Lightbulb className="h-3.5 w-3.5 text-amber-500" />}
                items={result.explanation.topThreeRecommendations}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t pt-3">
              <span className="text-xs font-medium text-muted-foreground">{t.riskLevel}:</span>
              <Badge className={riskBadgeClass(result.explanation.riskLevel)}>
                {result.explanation.riskLevel}
              </Badge>
            </div>

            <div className="rounded-md bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                {t.boardMessage}
              </div>
              <p className="mt-1 text-sm">{result.explanation.boardMessage}</p>
            </div>

            <p className="border-t pt-2 text-xs text-muted-foreground">
              {t.poweredBy} · {t.disclaimer}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{result.message ?? t.disabled}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function ListSection({
  label,
  icon,
  items,
}: {
  label: string;
  icon?: React.ReactNode;
  items: string[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <ul className={cn("mt-1 list-disc space-y-1 pe-5 text-sm")}>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
