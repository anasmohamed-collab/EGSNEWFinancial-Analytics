import { PrintButton } from "@/components/print-button";
import {
  getLatestPeriod,
  getMonthlyAnalysis,
  previousPeriod,
  recommendationKey,
} from "@/lib/analytics";
import { buildExecutiveAiInput } from "@/lib/ai/executiveInput";
import { buildDeterministicFallback } from "@/lib/services/aiExecutiveAnalysisService";
import { getI18n } from "@/i18n/server";
import {
  formatCurrency,
  formatPercent,
  formatSigned,
  formatDate,
  periodLabel,
} from "@/i18n/format";

export const dynamic = "force-dynamic";

/**
 * تقرير مجلس الإدارة — printable board report.
 * Page 1 is the board summary: verdict vs standard, headline KPIs, best/worst
 * site, main deviation reason, top-3 problems / recommendations (deterministic,
 * built ONLY from the already-calculated figures — no AI call), and a simple
 * net-vs-standard chart. Detailed tables are moved to an appendix page.
 */
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
  const aboveStandard = summary.totalVarianceVsStandard >= 0;

  // Deterministic top-3 problems/recommendations from the computed figures
  // (same builder used as the AI fallback — no AI call, no new math).
  const prev = previousPeriod(month, year);
  const prevAnalysis = a.hasData ? await getMonthlyAnalysis(prev.month, prev.year) : null;
  const narrative = a.hasData
    ? buildDeterministicFallback(buildExecutiveAiInput(a, prevAnalysis))
    : null;

  const kpis: { label: string; value: string }[] = [
    { label: dict.metrics.totalNet, value: formatCurrency(summary.totalNet, locale) },
    { label: dict.metrics.totalStandard, value: formatCurrency(summary.totalStandard, locale) },
    { label: dict.metrics.variance, value: formatSigned(summary.totalVarianceVsStandard, locale) },
    { label: dict.metrics.achievement, value: formatPercent(summary.standardAchievementPercentage) },
    { label: dict.metrics.finalNet, value: formatCurrency(summary.finalNetAfterGeneral, locale) },
    { label: dict.metrics.generalExpenses, value: formatCurrency(summary.totalGeneralExpenses, locale) },
  ];

  // Simple print-friendly chart data: top sites by net, bars relative to max.
  const chartSites = [...a.sites].sort((x, y) => y.net - x.net).slice(0, 8);
  const chartMax = Math.max(1, ...chartSites.flatMap((s) => [s.net, s.standard]));

  return (
    <div className="mx-auto max-w-3xl">
      <PrintButton />

      <article className="rounded-lg border border-gray-300 bg-white p-8 print:border-0 print:p-0">
        {/* Header */}
        <header className="mb-6 border-b border-gray-300 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{dict.common.companyName}</h1>
              <p className="text-lg font-semibold text-gray-700">{dict.report.boardTitle}</p>
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
            {/* Verdict: above/below standard */}
            <section
              className={`mb-6 rounded-md border-2 p-4 text-center ${
                aboveStandard ? "border-emerald-700 bg-emerald-50" : "border-red-700 bg-red-50"
              }`}
            >
              <p className={`text-xl font-bold ${aboveStandard ? "text-emerald-800" : "text-red-800"}`}>
                {aboveStandard ? dict.report.verdictAbove : dict.report.verdictBelow}
              </p>
              <p className="mt-1 text-sm text-gray-700">
                {dict.metrics.variance}: {formatSigned(summary.totalVarianceVsStandard, locale)} ·{" "}
                {dict.metrics.achievement}: {formatPercent(summary.standardAchievementPercentage)}
              </p>
            </section>

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

            {/* Best / worst / deviation */}
            <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ReportRow
                label={dict.executive.bestSite}
                value={
                  highlights.bestSite
                    ? `${highlights.bestSite.siteName} (${formatPercent(highlights.bestSite.standardAchievementPercentage)})`
                    : "—"
                }
              />
              <ReportRow
                label={dict.executive.worstSite}
                value={
                  highlights.worstSite
                    ? `${highlights.worstSite.siteName} (${formatPercent(highlights.worstSite.standardAchievementPercentage)})`
                    : "—"
                }
              />
              <ReportRow
                label={dict.report.mainDeviationReason}
                value={
                  hasDeviation
                    ? `${worst!.siteName} (${formatSigned(worst!.varianceVsStandard, locale)})`
                    : dict.executive.noDeviation
                }
                full
              />
            </section>

            {/* Top 3 problems / recommendations (deterministic) */}
            {narrative && (
              <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-gray-200 p-4">
                  <p className="text-sm font-bold">{dict.report.topProblems}</p>
                  <ol className="mt-2 list-decimal space-y-1 pe-5 text-sm leading-relaxed">
                    {narrative.topThreeProblems.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ol>
                </div>
                <div className="rounded-md border border-gray-200 p-4">
                  <p className="text-sm font-bold">{dict.report.topRecommendations}</p>
                  <ol className="mt-2 list-decimal space-y-1 pe-5 text-sm leading-relaxed">
                    {narrative.topThreeRecommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ol>
                </div>
              </section>
            )}

            {/* Management recommendation */}
            <section className="mb-6 rounded-md border-2 border-gray-800 p-4">
              <p className="text-sm font-bold">{dict.executive.recommendation}</p>
              <p className="mt-1 leading-relaxed">{dict.executive.recommendations[recKey]}</p>
            </section>

            {/* Simple net vs standard chart (print-friendly HTML bars) */}
            <section className="mb-6">
              <h2 className="mb-3 text-base font-bold">{dict.report.chartTitle}</h2>
              <div className="space-y-2">
                {chartSites.map((s) => (
                  <div key={s.id} className="text-xs">
                    <p className="mb-0.5 font-medium">{s.siteName}</p>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <div className="h-3 flex-1 rounded-sm bg-gray-100">
                          <div
                            className="h-3 rounded-sm bg-gray-800"
                            style={{ width: `${Math.max(1, Math.round((s.net / chartMax) * 100))}%` }}
                          />
                        </div>
                        <span className="w-28 shrink-0 tabular-nums text-gray-700">
                          {dict.metrics.net}: {formatCurrency(s.net, locale)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 flex-1 rounded-sm bg-gray-100">
                          <div
                            className="h-3 rounded-sm border border-gray-500 bg-gray-300"
                            style={{ width: `${Math.max(1, Math.round((s.standard / chartMax) * 100))}%` }}
                          />
                        </div>
                        <span className="w-28 shrink-0 tabular-nums text-gray-500">
                          {dict.metrics.standard}: {formatCurrency(s.standard, locale)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Appendix: detailed table on its own printed page */}
            <section className="break-before-page border-t border-gray-300 pt-6">
              <h2 className="mb-1 text-base font-bold">{dict.report.appendix}</h2>
              <p className="mb-3 text-xs text-gray-500">{dict.report.appendixNote}</p>
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
