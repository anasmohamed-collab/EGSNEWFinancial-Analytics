import Link from "next/link";
import { Trophy, AlertTriangle, Lightbulb, TrendingUp, TrendingDown, FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PeriodSelector } from "@/components/period-selector";
import { StatCard } from "@/components/stat-card";
import { SiteTable } from "@/components/site-table";
import { NetVsStandardChart } from "@/components/charts/net-vs-standard-chart";
import { DetailsToggle } from "@/components/details-toggle";
import { ExecutiveAiPanel } from "@/components/executive-ai-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isAiEnabled } from "@/lib/ai/config";
import {
  getAvailablePeriods,
  getLatestPeriod,
  getMonthlyAnalysis,
  previousPeriod,
  recommendationKey,
} from "@/lib/analytics";
import { getI18n } from "@/i18n/server";
import { formatCurrency, formatPercent, formatSigned, periodLabel, monthName } from "@/i18n/format";

export const dynamic = "force-dynamic";

export default async function ExecutivePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const { dict, locale } = await getI18n();
  const ex = dict.executive;

  const periods = await getAvailablePeriods();
  const latest = await getLatestPeriod();
  const month = Number(params.month) || latest?.month || new Date().getMonth() + 1;
  const year = Number(params.year) || latest?.year || new Date().getFullYear();

  const analysis = await getMonthlyAnalysis(month, year);
  const { summary, highlights } = analysis;

  // Previous-month comparison.
  const prev = previousPeriod(month, year);
  const prevAnalysis = await getMonthlyAnalysis(prev.month, prev.year);
  const netDelta = prevAnalysis.hasData
    ? summary.totalNet - prevAnalysis.summary.totalNet
    : null;

  // Recommendation + deviation reason.
  const recKey = recommendationKey(summary.standardAchievementPercentage);
  const worst = highlights.biggestNegativeVariance;
  const hasDeviation = !!worst && worst.varianceVsStandard < 0;

  return (
    <div>
      <PageHeader title={ex.title} description={ex.description}>
        <PeriodSelector month={month} year={year} availablePeriods={periods} basePath="/executive" />
        <Link href={`/executive/report?month=${month}&year=${year}`} prefetch={false}>
          <Button variant="outline">
            <FileText className="h-4 w-4" />
            {ex.viewReport}
          </Button>
        </Link>
      </PageHeader>

      {!analysis.hasData ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {dict.dashboard.noDataTitle} {monthName(month, locale)} {year}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Headline KPI row — the board essentials */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label={dict.metrics.totalNet} value={formatCurrency(summary.totalNet, locale)} emphasis />
            <StatCard label={dict.metrics.totalStandard} value={formatCurrency(summary.totalStandard, locale)} />
            <StatCard
              label={dict.metrics.variance}
              value={formatSigned(summary.totalVarianceVsStandard, locale)}
              tone={summary.totalVarianceVsStandard >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label={dict.metrics.achievement}
              value={formatPercent(summary.standardAchievementPercentage)}
              tone={
                (summary.standardAchievementPercentage ?? 0) >= 100
                  ? "positive"
                  : (summary.standardAchievementPercentage ?? 0) >= 90
                    ? "warning"
                    : "negative"
              }
            />
            <StatCard
              label={dict.metrics.finalNet}
              value={formatCurrency(summary.finalNetAfterGeneral, locale)}
              hint={
                summary.totalGeneralExpenses > 0
                  ? `− ${formatCurrency(summary.totalGeneralExpenses, locale)} ${dict.metrics.generalExpenses}`
                  : dict.dashboard.noGeneral
              }
            />
            <StatCard
              label={ex.changeVsPrevious}
              value={netDelta === null ? "—" : formatSigned(netDelta, locale)}
              tone={netDelta === null ? "default" : netDelta >= 0 ? "positive" : "negative"}
              hint={
                prevAnalysis.hasData ? periodLabel(prev.month, prev.year, locale) : dict.common.noData
              }
            />
          </div>

          {/* Best / worst site */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ExecCard
              icon={<Trophy className="h-5 w-5 text-emerald-500" />}
              title={ex.bestSite}
              main={highlights.bestSite?.siteName ?? "—"}
              sub={
                highlights.bestSite
                  ? `${formatPercent(highlights.bestSite.standardAchievementPercentage)} ${ex.ofStandard}`
                  : ""
              }
              tone="positive"
            />
            <ExecCard
              icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
              title={ex.worstSite}
              main={highlights.worstSite?.siteName ?? "—"}
              sub={
                highlights.worstSite
                  ? `${formatPercent(highlights.worstSite.standardAchievementPercentage)} ${ex.ofStandard}`
                  : ""
              }
              tone="negative"
            />
          </div>

          {/* Deviation reason + management recommendation */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  {hasDeviation ? (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  )}
                  {ex.deviationReason}
                </div>
                <p className="mt-2 text-lg font-medium">
                  {hasDeviation ? worst!.siteName : ex.noDeviation}
                </p>
                {hasDeviation && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {formatSigned(worst!.varianceVsStandard, locale)} {ex.vsStandard}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  {ex.recommendation}
                </div>
                <p className="mt-2 text-base font-medium leading-relaxed">
                  {ex.recommendations[recKey]}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* AI explanation — separate from the official numbers above. */}
          <ExecutiveAiPanel month={month} year={year} aiEnabled={isAiEnabled()} />

          {/* Details hidden by default (executive UX rule) */}
          <Card>
            <CardHeader>
              <CardTitle>{dict.dashboard.siteBreakdown}</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailsToggle>
                <div className="space-y-6">
                  <NetVsStandardChart
                    data={analysis.sites.map((s) => ({
                      siteName: s.siteName,
                      net: s.net,
                      standard: s.standard,
                    }))}
                  />
                  <div className="-mx-5">
                    <SiteTable rows={analysis.sites} />
                  </div>
                </div>
              </DetailsToggle>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ExecCard({
  icon,
  title,
  main,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  main: string;
  sub: string;
  tone: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {icon}
          {title}
        </div>
        <p className="mt-2 text-xl font-bold">{main}</p>
        <p
          className={
            tone === "positive"
              ? "text-sm text-emerald-600 dark:text-emerald-400"
              : "text-sm text-red-600 dark:text-red-400"
          }
        >
          {sub}
        </p>
      </CardContent>
    </Card>
  );
}
