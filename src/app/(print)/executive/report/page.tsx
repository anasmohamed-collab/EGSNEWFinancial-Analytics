import { PrintButton } from "@/components/print-button";
import {
  getLatestPeriod,
  getMonthlyAnalysis,
  recommendationKey,
} from "@/lib/analytics";
import { getI18n } from "@/i18n/server";
import {
  formatCurrency,
  formatPercent,
  formatSigned,
  formatDate,
  periodLabel,
} from "@/i18n/format";

export const dynamic = "force-dynamic";

export default async function ExecutiveReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const { dict, locale } = await getI18n();
  const latest = await getLatestPeriod();
  const month = Number(params.month) || latest?.month || new Date().getMonth() + 1;
  const year = Number(params.year) || latest?.year || new Date().getFullYear();

  const a = await getMonthlyAnalysis(month, year);
  const { summary, highlights } = a;
  const recKey = recommendationKey(summary.standardAchievementPercentage);
  const worst = highlights.biggestNegativeVariance;
  const hasDeviation = !!worst && worst.varianceVsStandard < 0;

  const kpis: { label: string; value: string }[] = [
    { label: dict.metrics.totalNet, value: formatCurrency(summary.totalNet, locale) },
    { label: dict.metrics.totalStandard, value: formatCurrency(summary.totalStandard, locale) },
    { label: dict.metrics.variance, value: formatSigned(summary.totalVarianceVsStandard, locale) },
    { label: dict.metrics.achievement, value: formatPercent(summary.standardAchievementPercentage) },
    { label: dict.metrics.finalNet, value: formatCurrency(summary.finalNetAfterGeneral, locale) },
    { label: dict.metrics.generalExpenses, value: formatCurrency(summary.totalGeneralExpenses, locale) },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PrintButton />

      <article className="rounded-lg border border-gray-300 bg-white p-8 print:border-0 print:p-0">
        {/* Header */}
        <header className="mb-6 border-b border-gray-300 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{dict.common.companyName}</h1>
              <p className="text-lg font-semibold text-gray-700">{dict.report.title}</p>
            </div>
            <div className="text-sm text-gray-600">
              <p>
                {dict.common.period}: <span className="font-medium">{periodLabel(month, year, locale)}</span>
              </p>
              <p>
                {dict.report.generatedOn}: {formatDate(new Date(), locale)}
              </p>
              <p>
                {dict.report.preparedFor}: {dict.report.board}
              </p>
            </div>
          </div>
        </header>

        {!a.hasData ? (
          <p className="py-10 text-center text-gray-500">{dict.common.noData}</p>
        ) : (
          <>
            {/* KPI grid */}
            <section className="mb-6">
              <h2 className="mb-3 text-base font-bold">{dict.report.summary}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {kpis.map((k) => (
                  <div key={k.label} className="rounded-md border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">{k.label}</p>
                    <p className="mt-1 text-lg font-bold tabular-nums">{k.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Best / worst / deviation / recommendation */}
            <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ReportRow label={dict.executive.bestSite} value={highlights.bestSite?.siteName ?? "—"} />
              <ReportRow label={dict.executive.worstSite} value={highlights.worstSite?.siteName ?? "—"} />
              <ReportRow
                label={dict.executive.deviationReason}
                value={
                  hasDeviation
                    ? `${worst!.siteName} (${formatSigned(worst!.varianceVsStandard, locale)})`
                    : dict.executive.noDeviation
                }
                full
              />
            </section>

            <section className="mb-6 rounded-md border-2 border-gray-800 p-4">
              <p className="text-sm font-bold">{dict.executive.recommendation}</p>
              <p className="mt-1 leading-relaxed">{dict.executive.recommendations[recKey]}</p>
            </section>

            {/* Site summary table */}
            <section>
              <h2 className="mb-2 text-base font-bold">{dict.dashboard.siteBreakdown}</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-400 text-gray-600">
                    <th className="p-2 text-start">{dict.table.site}</th>
                    <th className="p-2 text-start">{dict.table.net}</th>
                    <th className="p-2 text-start">{dict.table.standard}</th>
                    <th className="p-2 text-start">{dict.table.variance}</th>
                    <th className="p-2 text-start">{dict.table.achievement}</th>
                    <th className="p-2 text-start">{dict.table.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {a.sites.map((s) => (
                    <tr key={s.id} className="border-b border-gray-200">
                      <td className="p-2 font-medium">{s.siteName}</td>
                      <td className="p-2 tabular-nums">{formatCurrency(s.net, locale)}</td>
                      <td className="p-2 tabular-nums">{formatCurrency(s.standard, locale)}</td>
                      <td className="p-2 tabular-nums">{formatSigned(s.varianceVsStandard, locale)}</td>
                      <td className="p-2 tabular-nums">{formatPercent(s.standardAchievementPercentage)}</td>
                      <td className="p-2">{dict.status[s.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </article>
    </div>
  );
}

function ReportRow({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
