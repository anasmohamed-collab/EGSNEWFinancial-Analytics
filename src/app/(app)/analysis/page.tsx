import { PageHeader } from "@/components/page-header";
import { PresetSelector } from "@/components/preset-selector";
import { StatCard } from "@/components/stat-card";
import { MonthlyTrendChart } from "@/components/charts/monthly-trend-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getMultiMonthAnalysis, type MultiMonthPreset } from "@/lib/analytics";
import { getI18n } from "@/i18n/server";
import { formatCurrency, formatPercent, formatSigned, periodLabel } from "@/i18n/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VALID: MultiMonthPreset[] = ["all", "last4", "last6", "last12", "year", "custom"];

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>;
}) {
  const params = await searchParams;
  const { dict, locale } = await getI18n();
  const preset = (VALID.includes(params.preset as MultiMonthPreset)
    ? params.preset
    : "last4") as MultiMonthPreset;

  const a = await getMultiMonthAnalysis({ preset });
  const { totals } = a;

  const rangeLabel =
    a.periods.length > 0
      ? `${periodLabel(a.periods[0].month, a.periods[0].year, locale)} — ${periodLabel(
          a.periods[a.periods.length - 1].month,
          a.periods[a.periods.length - 1].year,
          locale,
        )}`
      : dict.common.noData;

  return (
    <div>
      <PageHeader
        title={dict.analysis.title}
        description={`${dict.analysis.description} ${a.periods.length} ${dict.analysis.months} · ${rangeLabel}`}
      >
        <PresetSelector active={preset} />
      </PageHeader>

      {a.periods.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {dict.analysis.noDataHint}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={dict.metrics.totalNet} value={formatCurrency(totals.totalNet, locale)} emphasis />
            <StatCard label={dict.metrics.totalStandard} value={formatCurrency(totals.totalStandard, locale)} />
            <StatCard
              label={dict.analysis.overallVariance}
              value={formatSigned(totals.totalVarianceVsStandard, locale)}
              tone={totals.totalVarianceVsStandard >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label={dict.metrics.achievement}
              value={formatPercent(totals.standardAchievementPercentage)}
              tone={
                (totals.standardAchievementPercentage ?? 0) >= 100
                  ? "positive"
                  : (totals.standardAchievementPercentage ?? 0) >= 90
                    ? "warning"
                    : "negative"
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MiniHighlight
              label={dict.analysis.bestMonth}
              value={a.bestMonth ? periodLabel(a.bestMonth.month, a.bestMonth.year, locale) : "—"}
              sub={a.bestMonth ? formatPercent(a.bestMonth.achievementPct) : ""}
            />
            <MiniHighlight
              label={dict.analysis.worstMonth}
              value={a.worstMonth ? periodLabel(a.worstMonth.month, a.worstMonth.year, locale) : "—"}
              sub={a.worstMonth ? formatPercent(a.worstMonth.achievementPct) : ""}
            />
            <MiniHighlight label={dict.analysis.bestSite} value={a.bestSite?.siteName ?? "—"} sub={a.bestSite ? formatPercent(a.bestSite.achievementPct) : ""} />
            <MiniHighlight label={dict.analysis.worstSite} value={a.worstSite?.siteName ?? "—"} sub={a.worstSite ? formatPercent(a.worstSite.achievementPct) : ""} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{dict.analysis.monthlyTrend}</CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyTrendChart data={a.monthlyTrend} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{dict.analysis.sitePerformance}</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{dict.table.site}</TableHead>
                      <TableHead className="text-right">{dict.table.net}</TableHead>
                      <TableHead className="text-right">{dict.table.standard}</TableHead>
                      <TableHead className="text-right">{dict.table.variance}</TableHead>
                      <TableHead className="text-right">{dict.table.achievement}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {a.siteTrend.map((s) => (
                      <TableRow key={s.siteId}>
                        <TableCell className="font-medium">{s.siteName}</TableCell>
                        <TableCell className="num">{formatCurrency(s.net, locale)}</TableCell>
                        <TableCell className="num">{formatCurrency(s.standard, locale)}</TableCell>
                        <TableCell
                          className={cn(
                            "num font-medium",
                            s.variance >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400",
                          )}
                        >
                          {formatSigned(s.variance, locale)}
                        </TableCell>
                        <TableCell className="num">{formatPercent(s.achievementPct)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{dict.analysis.repeatedlyBelow}</CardTitle>
              </CardHeader>
              <CardContent>
                {a.sitesRepeatedlyBelow.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {dict.analysis.noRepeatedly}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {a.sitesRepeatedlyBelow.map((s) => (
                      <li key={s.siteId} className="flex items-center justify-between">
                        <span className="font-medium">{s.siteName}</span>
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                          {s.monthsBelowStandard} {dict.common.of} {s.monthsPresent} {dict.analysis.monthsBelow}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniHighlight({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 truncate font-semibold">{value}</p>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
