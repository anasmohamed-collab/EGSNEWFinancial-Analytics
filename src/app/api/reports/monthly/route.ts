import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { getMonthlyAnalysis } from "@/lib/analytics";
import { getI18n } from "@/i18n/server";
import { periodLabel } from "@/i18n/format";

export const runtime = "nodejs";

/**
 * GET /api/reports/monthly?month=1&year=2026
 * Returns a localized .xlsx workbook of the monthly report (summary + sites).
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { dict, locale } = await getI18n();
  const url = new URL(req.url);
  const month = Number(url.searchParams.get("month"));
  const year = Number(url.searchParams.get("year"));
  if (!month || !year) {
    return NextResponse.json({ error: "month and year are required." }, { status: 400 });
  }

  const a = await getMonthlyAnalysis(month, year);
  if (!a.hasData) {
    return NextResponse.json(
      { error: `${dict.common.noData}: ${periodLabel(month, year, locale)}` },
      { status: 404 },
    );
  }

  const m = dict.metrics;
  const tbl = dict.table;
  const wb = XLSX.utils.book_new();

  // --- Site breakdown sheet ---
  const siteRows = a.sites.map((s) => ({
    [tbl.site]: s.siteName,
    [dict.common.client]: s.clientName ?? "",
    [m.contractValue]: s.contractValue,
    [m.grossCollections]: s.grossCollection,
    [m.collectionAfter14]: Math.round(s.collectionAfter14),
    [m.vat14]: Math.round(s.vat14Value),
    [m.salaries]: s.salaries,
    [m.operatingExpenses]: s.operatingExpenses,
    [m.net]: s.net,
    [m.standard]: s.standard,
    [m.variance]: s.varianceVsStandard,
    [tbl.achievement]: s.standardAchievementPercentage,
    [m.netMargin]: s.netMarginPercentage,
    [m.collectionGap]: Math.round(s.collectionGap),
    [tbl.status]: dict.status[s.status],
  }));
  const wsSites = XLSX.utils.json_to_sheet(siteRows);
  XLSX.utils.book_append_sheet(wb, wsSites, dict.metrics.sites);

  // --- Summary sheet ---
  const s = a.summary;
  const summaryRows: (string | number | null)[][] = [
    [dict.common.appNameFull, ""],
    [dict.common.period, periodLabel(month, year, locale)],
    ["", ""],
    [m.contractValue, s.totalContractValue],
    [m.grossCollections, s.totalGrossCollection],
    [m.collectionAfter14, s.totalCollectionAfter14],
    [m.salaries, s.totalSalaries],
    [m.operatingExpenses, s.totalOperatingExpenses],
    [m.totalNet, s.totalNet],
    [m.totalStandard, s.totalStandard],
    [m.variance, s.totalVarianceVsStandard],
    [m.achievement, s.standardAchievementPercentage],
    [m.generalExpenses, s.totalGeneralExpenses],
    [m.finalNet, s.finalNetAfterGeneral],
    [m.sites, s.siteCount],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, dict.report.summary);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const filename = `eagles-monthly-${year}-${String(month).padStart(2, "0")}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
