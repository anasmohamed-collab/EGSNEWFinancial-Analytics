import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Trophy, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PeriodSelector } from "@/components/period-selector";
import { StatCard } from "@/components/stat-card";
import { SiteTable } from "@/components/site-table";
import { NetVsStandardChart } from "@/components/charts/net-vs-standard-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getAvailablePeriods,
  getLatestPeriod,
  getMonthlyAnalysis,
  type SiteBudgetRow,
} from "@/lib/analytics";
import { getI18n } from "@/i18n/server";
import type { Locale } from "@/i18n/config";
import { formatCurrency, formatPercent, formatSigned, monthName } from "@/i18n/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const { dict, locale } = await getI18n();
  const periods = await getAvailablePeriods();
  const latest = await getLatestPeriod();

  const month = Number(params.month) || latest?.month || new Date().getMonth() + 1;
  const year = Number(params.year) || latest?.year || new Date().getFullYear();

  const analysis = await getMonthlyAnalysis(month, year);
  const { summary, highlights, sites } = analysis;

  return (
    <div>
      <PageHeader
        title={dict.dashboard.title}
        description={`${dict.dashboard.description} ${monthName(month, locale)} ${year} — ${dict.dashboard.netVsStandard}`}
      >
        <PeriodSelector month={month} year={year} availablePeriods={periods} />
        <Link href="/upload">
          <Button variant="outline">{dict.dashboard.uploadSheet}</Button>
        </Link>
      </PageHeader>

      {!analysis.hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-lg font-medium">
              {dict.dashboard.noDataTitle} {monthName(month, locale)} {year}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">{dict.dashboard.noDataHint}</p>
            <Link href="/upload">
              <Button>{dict.dashboard.uploadSheet}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Primary KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label={dict.metrics.totalNet}
              value={formatCurrency(summary.totalNet, locale)}
              hint={`${summary.siteCount} ${dict.metrics.sites}`}
              emphasis
            />
            <StatCard label={dict.metrics.totalStandard} value={formatCurrency(summary.totalStandard, locale)} />
            <StatCard
              label={dict.metrics.variance}
              value={formatSigned(summary.totalVarianceVsStandard, locale)}
              tone={summary.totalVarianceVsStandard >= 0 ? "positive" : "negative"}
              hint={dict.dashboard.variDef}
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
              hint={dict.dashboard.achDef}
            />
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label={dict.metrics.contractValue} value={formatCurrency(summary.totalContractValue, locale)} />
            <StatCard label={dict.metrics.grossCollections} value={formatCurrency(summary.totalGrossCollection, locale)} />
            <StatCard label={dict.metrics.collectionAfter14} value={formatCurrency(summary.totalCollectionAfter14, locale)} hint={dict.common.supportingMetric} />
            <StatCard label={dict.metrics.salaries} value={formatCurrency(summary.totalSalaries, locale)} />
            <StatCard label={dict.metrics.operatingExpenses} value={formatCurrency(summary.totalOperatingExpenses, locale)} />
            <StatCard
              label={dict.metrics.finalNet}
              value={formatCurrency(summary.finalNetAfterGeneral, locale)}
              hint={
                summary.totalGeneralExpenses > 0
                  ? `− ${formatCurrency(summary.totalGeneralExpenses, locale)} ${dict.metrics.generalExpenses}`
                  : dict.dashboard.noGeneral
              }
            />
          </div>

          {/* Chart + highlights */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{dict.dashboard.netVsStandardBySite}</CardTitle>
              </CardHeader>
              <CardContent>
                <NetVsStandardChart
                  data={sites.map((s) => ({ siteName: s.siteName, net: s.net, standard: s.standard }))}
                />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Highlight title={dict.dashboard.bestSite} site={highlights.bestSite} icon={<Trophy className="h-4 w-4 text-emerald-500" />} metric="achievement" locale={locale} vs={dict.executive.ofStandard} />
              <Highlight title={dict.dashboard.worstSite} site={highlights.worstSite} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} metric="achievement" locale={locale} vs={dict.executive.ofStandard} />
              <Highlight title={dict.dashboard.biggestPositive} site={highlights.biggestPositiveVariance} icon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />} metric="variance" locale={locale} vs={dict.executive.vsStandard} />
              <Highlight title={dict.dashboard.biggestNegative} site={highlights.biggestNegativeVariance} icon={<ArrowDownRight className="h-4 w-4 text-red-500" />} metric="variance" locale={locale} vs={dict.executive.vsStandard} />
            </div>
          </div>

          {/* Site-level table */}
          <Card>
            <CardHeader>
              <CardTitle>{dict.dashboard.siteBreakdown}</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <SiteTable rows={sites} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Highlight({
  title,
  site,
  icon,
  metric,
  locale,
  vs,
}: {
  title: string;
  site: SiteBudgetRow | null;
  icon: React.ReactNode;
  metric: "achievement" | "variance";
  locale: Locale;
  vs: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {icon}
          {title}
        </div>
        {site ? (
          <>
            <p className="mt-2 truncate font-semibold">{site.siteName}</p>
            <p className="text-sm text-muted-foreground">
              {metric === "achievement"
                ? `${formatPercent(site.standardAchievementPercentage)} ${vs}`
                : `${formatSigned(site.varianceVsStandard, locale)} ${vs}`}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">—</p>
        )}
      </CardContent>
    </Card>
  );
}
