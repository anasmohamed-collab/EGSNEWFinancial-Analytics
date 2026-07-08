import { prisma } from "./prisma";
import { computeBudgetMetrics, round2 } from "./calculations";
import type { ParsedSiteRow } from "./excel";

/**
 * Find or create a Site by name (case-insensitive). New sites picked up from an
 * uploaded sheet are created inactive-free (active) with the sheet client name.
 */
async function upsertSiteByName(
  name: string,
  clientName: string | null,
): Promise<{ id: string; defaultStandard: number }> {
  const existing = await prisma.site.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, defaultStandard: true, clientName: true },
  });
  if (existing) {
    // Backfill client name if we now have one and it was empty.
    if (clientName && !existing.clientName) {
      await prisma.site.update({
        where: { id: existing.id },
        data: { clientName },
      });
    }
    return { id: existing.id, defaultStandard: Number(existing.defaultStandard) };
  }
  const created = await prisma.site.create({
    data: { name, clientName: clientName ?? undefined },
    select: { id: true, defaultStandard: true },
  });
  return { id: created.id, defaultStandard: Number(created.defaultStandard) };
}

/**
 * Resolve the standard target for a site/month/year.
 * Priority:
 *   1. Most recent standards_history record for the site/month/year.
 *   2. The standard supplied in the sheet (recorded to history as its origin).
 *   3. The site's default standard.
 */
async function resolveStandard(params: {
  siteId: string;
  month: number;
  year: number;
  sheetStandard: number | null;
  siteDefault: number;
  userId: string | null;
}): Promise<number> {
  const { siteId, month, year, sheetStandard, siteDefault, userId } = params;

  const history = await prisma.standardHistory.findFirst({
    where: { siteId, month, year },
    orderBy: { changeDate: "desc" },
    select: { standardValue: true },
  });
  if (history) return Number(history.standardValue);

  if (sheetStandard !== null && sheetStandard > 0) {
    // First time we see a standard for this site/month — record its origin.
    await prisma.standardHistory.create({
      data: {
        siteId,
        month,
        year,
        standardValue: round2(sheetStandard),
        changeReason: "Imported from uploaded Excel sheet",
        createdById: userId ?? undefined,
      },
    });
    return sheetStandard;
  }

  return siteDefault;
}

/**
 * Write normalized MonthlySiteBudget rows for a processed upload, then refresh
 * the monthly summary. Returns the number of site rows written.
 */
export async function processParsedRows(params: {
  uploadedFileId: string;
  month: number;
  year: number;
  rows: ParsedSiteRow[];
  userId: string | null;
}): Promise<{ siteCount: number }> {
  const { uploadedFileId, month, year, rows, userId } = params;

  for (const row of rows) {
    const site = await upsertSiteByName(row.siteName, row.clientName);
    const standard = await resolveStandard({
      siteId: site.id,
      month,
      year,
      sheetStandard: row.standard,
      siteDefault: site.defaultStandard,
      userId,
    });

    const m = computeBudgetMetrics({
      contractValue: row.contractValue,
      grossCollection: row.grossCollection,
      salaries: row.salaries,
      operatingExpenses: row.operatingExpenses,
      standard,
    });

    await prisma.monthlySiteBudget.upsert({
      where: { siteId_year_month: { siteId: site.id, year, month } },
      create: {
        siteId: site.id,
        uploadedFileId,
        month,
        year,
        contractValue: round2(m.contractValue),
        grossCollection: round2(m.grossCollection),
        salaries: round2(m.salaries),
        operatingExpenses: round2(m.operatingExpenses),
        standard: round2(m.standard),
        collectionAfter14: round2(m.collectionAfter14),
        vat14Value: round2(m.vat14Value),
        net: round2(m.net),
        varianceVsStandard: round2(m.varianceVsStandard),
        standardAchievementPercentage:
          m.standardAchievementPercentage === null
            ? null
            : round2(m.standardAchievementPercentage),
        netMarginPercentage:
          m.netMarginPercentage === null ? null : round2(m.netMarginPercentage),
        collectionGap: round2(m.collectionGap),
        status: m.status,
      },
      update: {
        uploadedFileId,
        contractValue: round2(m.contractValue),
        grossCollection: round2(m.grossCollection),
        salaries: round2(m.salaries),
        operatingExpenses: round2(m.operatingExpenses),
        standard: round2(m.standard),
        collectionAfter14: round2(m.collectionAfter14),
        vat14Value: round2(m.vat14Value),
        net: round2(m.net),
        varianceVsStandard: round2(m.varianceVsStandard),
        standardAchievementPercentage:
          m.standardAchievementPercentage === null
            ? null
            : round2(m.standardAchievementPercentage),
        netMarginPercentage:
          m.netMarginPercentage === null ? null : round2(m.netMarginPercentage),
        collectionGap: round2(m.collectionGap),
        status: m.status,
      },
    });
  }

  await recomputeMonthlySummary(month, year);
  return { siteCount: rows.length };
}

/**
 * Recompute (or create) the company-level monthly summary from the normalized
 * site budgets plus general expenses. Site-level standard comparison stays on
 * totalNet (BEFORE general expenses) per the business rule; finalNetAfterGeneral
 * subtracts general expenses for reporting.
 */
export async function recomputeMonthlySummary(
  month: number,
  year: number,
): Promise<void> {
  const budgets = await prisma.monthlySiteBudget.findMany({
    where: { month, year },
  });

  const totals = budgets.reduce(
    (acc, b) => {
      acc.totalContractValue += Number(b.contractValue);
      acc.totalGrossCollection += Number(b.grossCollection);
      acc.totalCollectionAfter14 += Number(b.collectionAfter14);
      acc.totalSalaries += Number(b.salaries);
      acc.totalOperatingExpenses += Number(b.operatingExpenses);
      acc.totalNet += Number(b.net);
      acc.totalStandard += Number(b.standard);
      acc.totalVarianceVsStandard += Number(b.varianceVsStandard);
      return acc;
    },
    {
      totalContractValue: 0,
      totalGrossCollection: 0,
      totalCollectionAfter14: 0,
      totalSalaries: 0,
      totalOperatingExpenses: 0,
      totalNet: 0,
      totalStandard: 0,
      totalVarianceVsStandard: 0,
    },
  );

  const generalAgg = await prisma.expenseItem.aggregate({
    where: { month, year },
    _sum: { amount: true },
  });
  const totalGeneralExpenses = Number(generalAgg._sum.amount ?? 0);

  const standardAchievementPercentage = totals.totalStandard
    ? round2((totals.totalNet / totals.totalStandard) * 100)
    : null;

  await prisma.monthlySummary.upsert({
    where: { year_month: { year, month } },
    create: {
      month,
      year,
      totalContractValue: round2(totals.totalContractValue),
      totalGrossCollection: round2(totals.totalGrossCollection),
      totalCollectionAfter14: round2(totals.totalCollectionAfter14),
      totalSalaries: round2(totals.totalSalaries),
      totalOperatingExpenses: round2(totals.totalOperatingExpenses),
      totalNet: round2(totals.totalNet),
      totalStandard: round2(totals.totalStandard),
      totalVarianceVsStandard: round2(totals.totalVarianceVsStandard),
      standardAchievementPercentage,
      totalGeneralExpenses: round2(totalGeneralExpenses),
      finalNetAfterGeneral: round2(totals.totalNet - totalGeneralExpenses),
      siteCount: budgets.length,
    },
    update: {
      totalContractValue: round2(totals.totalContractValue),
      totalGrossCollection: round2(totals.totalGrossCollection),
      totalCollectionAfter14: round2(totals.totalCollectionAfter14),
      totalSalaries: round2(totals.totalSalaries),
      totalOperatingExpenses: round2(totals.totalOperatingExpenses),
      totalNet: round2(totals.totalNet),
      totalStandard: round2(totals.totalStandard),
      totalVarianceVsStandard: round2(totals.totalVarianceVsStandard),
      standardAchievementPercentage,
      totalGeneralExpenses: round2(totalGeneralExpenses),
      finalNetAfterGeneral: round2(totals.totalNet - totalGeneralExpenses),
      siteCount: budgets.length,
    },
  });
}
