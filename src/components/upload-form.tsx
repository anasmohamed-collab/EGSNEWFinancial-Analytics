"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MONTH_VALUES } from "@/lib/constants";
import { useI18n } from "@/i18n/provider";
import { monthName } from "@/i18n/format";

type Result = { kind: "error"; message: string; validationErrors?: string[] };

export function UploadForm() {
  const router = useRouter();
  const { dict, locale } = useI18n();
  const t = dict.upload;
  const now = new Date();
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState(2026);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const years = Array.from({ length: 8 }, (_, i) => now.getFullYear() - 5 + i);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setResult({ kind: "error", message: t.chooseFirst });
      return;
    }
    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("month", String(month));
    fd.append("year", String(year));

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setResult({
          kind: "error",
          message: data.error ?? t.networkError,
          validationErrors: data.validationErrors,
        });
      } else {
        // Success → go straight to the generated monthly analysis.
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        router.push(`/dashboard?month=${data.month}&year=${data.year}`);
        router.refresh();
      }
    } catch {
      setResult({ kind: "error", message: t.networkError });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="month">{t.month}</Label>
              <Select id="month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTH_VALUES.map((m) => (
                  <option key={m} value={m}>
                    {monthName(m, locale)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">{t.year}</Label>
              <Select id="year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">{t.fileLabel}</Label>
            <div className="flex items-center justify-center rounded-lg border border-dashed p-6">
              <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {file ? file.name : t.chooseFile}
                </span>
                <span className="text-xs text-muted-foreground">{t.fileHint}</span>
                <Input
                  id="file"
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? t.processing : t.button}
          </Button>
        </form>

        {result?.kind === "error" && (
          <div className="mt-5 flex items-start gap-3 rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">{result.message}</p>
              {result.validationErrors && result.validationErrors.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pe-5">
                  {result.validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t.requiredColumns}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
