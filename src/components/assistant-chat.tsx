"use client";

import { useRef, useState } from "react";
import { Sparkles, SendHorizontal, RefreshCw, BarChart3, Lightbulb, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useI18n } from "@/i18n/provider";
import { monthName } from "@/i18n/format";
import { cn } from "@/lib/utils";

type ScopeKind = "month" | "last4" | "last6" | "year" | "all" | "custom";

interface Answer {
  shortAnswer: string;
  evidence: string;
  meaning: string;
  recommendation: string;
}

interface ApiResult {
  enabled: boolean;
  source: "ai" | "fallback" | "disabled" | "out_of_scope" | "no_data";
  category: string | null;
  answer: Answer | null;
  message: string | null;
}

interface ChatEntry {
  question: string;
  scopeLabel: string;
  result: ApiResult | null;
  error: boolean;
}

export function AssistantChat({
  aiEnabled,
  availablePeriods,
  defaultMonth,
  defaultYear,
}: {
  aiEnabled: boolean;
  availablePeriods: { month: number; year: number }[];
  defaultMonth: number;
  defaultYear: number;
}) {
  const { dict, locale } = useI18n();
  const t = dict.assistant;

  const [kind, setKind] = useState<ScopeKind>("month");
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [from, setFrom] = useState({ month: defaultMonth, year: defaultYear });
  const [to, setTo] = useState({ month: defaultMonth, year: defaultYear });
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const years = Array.from(new Set(availablePeriods.map((p) => p.year))).sort((a, b) => b - a);

  function scopeLabel(): string {
    if (kind === "month") return `${monthName(month, locale)} ${year}`;
    if (kind === "year") return `${t.scopes.year} ${year}`;
    if (kind === "custom")
      return `${monthName(from.month, locale)} ${from.year} ← ${monthName(to.month, locale)} ${to.year}`;
    return t.scopes[kind];
  }

  async function ask(q: string) {
    const text = q.trim();
    if (!text || loading) return;
    setQuestion("");
    setLoading(true);
    const entry: ChatEntry = { question: text, scopeLabel: scopeLabel(), result: null, error: false };
    setEntries((prev) => [...prev, entry]);

    const scope =
      kind === "month"
        ? { kind, month, year }
        : kind === "year"
          ? { kind, year }
          : kind === "custom"
            ? { kind, from, to }
            : { kind };

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, scope }),
      });
      if (!res.ok) throw new Error("bad status");
      const data: ApiResult = await res.json();
      setEntries((prev) =>
        prev.map((e, i) => (i === prev.length - 1 ? { ...e, result: data } : e)),
      );
    } catch {
      setEntries((prev) =>
        prev.map((e, i) => (i === prev.length - 1 ? { ...e, error: true } : e)),
      );
    } finally {
      setLoading(false);
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    }
  }

  if (!aiEnabled) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {t.disabled}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Scope selector */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <span className="text-sm font-medium text-muted-foreground">{t.scope}:</span>
          <Select
            aria-label={t.scope}
            value={kind}
            onChange={(e) => setKind(e.target.value as ScopeKind)}
            className="w-40"
          >
            {(["month", "last4", "last6", "year", "all", "custom"] as const).map((k) => (
              <option key={k} value={k}>
                {t.scopes[k]}
              </option>
            ))}
          </Select>

          {kind === "month" && (
            <>
              <Select aria-label={dict.common.month} value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-32">
                {Array.from(new Set(availablePeriods.filter((p) => p.year === year).map((p) => p.month)))
                  .sort((a, b) => a - b)
                  .map((m) => (
                    <option key={m} value={m}>
                      {monthName(m, locale)}
                    </option>
                  ))}
              </Select>
              <Select aria-label={dict.common.year} value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24">
                {(years.length ? years : [year]).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </>
          )}

          {kind === "year" && (
            <Select aria-label={dict.common.year} value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24">
              {(years.length ? years : [year]).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}

          {kind === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{t.from}</span>
              <PeriodPick value={from} onChange={setFrom} periods={availablePeriods} locale={locale} />
              <span className="text-sm text-muted-foreground">{t.to}</span>
              <PeriodPick value={to} onChange={setTo} periods={availablePeriods} locale={locale} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation */}
      <div className="space-y-4">
        {entries.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.empty}</p>
        )}

        {entries.map((entry, idx) => (
          <div key={idx} className="space-y-2">
            {/* User bubble */}
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-ss-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                <p>{entry.question}</p>
                <p className="mt-1 text-xs opacity-70">{entry.scopeLabel}</p>
              </div>
            </div>

            {/* Assistant answer */}
            <div className="flex justify-end">
              <div className="w-full max-w-[92%]">
                {entry.error ? (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {t.error}
                  </p>
                ) : !entry.result ? (
                  <p className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    {t.thinking}
                  </p>
                ) : entry.result.answer ? (
                  <AnswerCard result={entry.result} t={t} />
                ) : (
                  <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {entry.result.message ?? t.error}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={listEndRef} />
      </div>

      {/* Suggested questions */}
      <div className="flex flex-wrap gap-2">
        <span className="py-1 text-xs font-medium text-muted-foreground">{t.suggested}:</span>
        {t.suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ask(s)}
            disabled={loading}
            className={cn(
              "rounded-full border bg-card px-3 py-1 text-xs transition-colors",
              "hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex items-center gap-2"
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t.inputPlaceholder}
          className="flex-1"
          maxLength={500}
        />
        <Button type="submit" disabled={loading || !question.trim()}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          {t.send}
        </Button>
      </form>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        {t.disclaimer}
      </p>
    </div>
  );
}

function AnswerCard({
  result,
  t,
}: {
  result: ApiResult;
  t: {
    shortAnswer: string;
    evidence: string;
    meaning: string;
    recommendation: string;
    fallbackNote: string;
  };
}) {
  const a = result.answer!;
  return (
    <Card className="border-primary/20">
      <CardContent className="space-y-3 p-4">
        {result.source === "fallback" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {t.fallbackNote}
          </p>
        )}
        <p className="text-base font-medium leading-relaxed">{a.shortAnswer}</p>
        {a.evidence && <AnswerSection icon={<BarChart3 className="h-3.5 w-3.5" />} label={t.evidence} text={a.evidence} />}
        {a.meaning && <AnswerSection icon={<MessageSquare className="h-3.5 w-3.5" />} label={t.meaning} text={a.meaning} />}
        {a.recommendation && (
          <AnswerSection icon={<Lightbulb className="h-3.5 w-3.5 text-amber-500" />} label={t.recommendation} text={a.recommendation} />
        )}
      </CardContent>
    </Card>
  );
}

function AnswerSection({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-0.5 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function PeriodPick({
  value,
  onChange,
  periods,
  locale,
}: {
  value: { month: number; year: number };
  onChange: (v: { month: number; year: number }) => void;
  periods: { month: number; year: number }[];
  locale: "ar" | "en";
}) {
  const years = Array.from(new Set(periods.map((p) => p.year))).sort((a, b) => b - a);
  const months = Array.from(
    new Set(periods.filter((p) => p.year === value.year).map((p) => p.month)),
  ).sort((a, b) => a - b);
  return (
    <div className="flex items-center gap-1.5">
      <Select
        aria-label="month"
        value={value.month}
        onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
        className="w-32"
      >
        {(months.length ? months : [value.month]).map((m) => (
          <option key={m} value={m}>
            {monthName(m, locale)}
          </option>
        ))}
      </Select>
      <Select
        aria-label="year"
        value={value.year}
        onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
        className="w-24"
      >
        {(years.length ? years : [value.year]).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  );
}
