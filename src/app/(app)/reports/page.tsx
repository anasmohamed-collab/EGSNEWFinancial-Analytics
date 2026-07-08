import Link from "next/link";
import { FileSpreadsheet, FileText, Download, Crown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAvailablePeriods, getLatestPeriod } from "@/lib/analytics";
import { getI18n } from "@/i18n/server";
import { periodLabel } from "@/i18n/format";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { dict, locale } = await getI18n();
  const t = dict.reports;
  const periods = await getAvailablePeriods();
  const latest = await getLatestPeriod();

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.monthlyExport}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {periods.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noPeriods}</p>
            ) : (
              periods.map((p) => (
                <div key={`${p.year}-${p.month}`} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium">{periodLabel(p.month, p.year, locale)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/executive/report?month=${p.month}&year=${p.year}`} prefetch={false}>
                      <Button variant="ghost" size="sm">
                        <Crown className="h-4 w-4" />
                        {t.executiveReport}
                      </Button>
                    </Link>
                    <Link href={`/api/reports/monthly?month=${p.month}&year=${p.year}`} prefetch={false}>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                        {dict.common.exportExcel}
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.catalogue}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {[
                { label: t.types.executive, status: t.live },
                { label: t.types.monthly, status: t.live },
                { label: t.types.multiMonth, status: t.roadmap },
                { label: t.types.site, status: t.roadmap },
                { label: t.types.variance, status: t.roadmap },
                { label: t.types.expense, status: t.roadmap },
                { label: t.types.collection, status: t.roadmap },
              ].map((r) => (
                <li key={r.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {r.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.status}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {latest && (
        <p className="mt-6 text-xs text-muted-foreground">
          {t.latestData}: {periodLabel(latest.month, latest.year, locale)}.
        </p>
      )}
    </div>
  );
}
