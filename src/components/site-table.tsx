"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/i18n/provider";
import { formatCurrency, formatPercent, formatSigned } from "@/i18n/format";
import { cn } from "@/lib/utils";
import type { SiteBudgetRow } from "@/lib/analytics";

/** Full site-level monthly breakdown with every requested metric column. */
export function SiteTable({ rows }: { rows: SiteBudgetRow[] }) {
  const { dict, locale } = useI18n();
  const t = dict.table;

  const totals = rows.reduce(
    (a, r) => {
      a.contractValue += r.contractValue;
      a.grossCollection += r.grossCollection;
      a.collectionAfter14 += r.collectionAfter14;
      a.vat14Value += r.vat14Value;
      a.salaries += r.salaries;
      a.operatingExpenses += r.operatingExpenses;
      a.net += r.net;
      a.standard += r.standard;
      a.varianceVsStandard += r.varianceVsStandard;
      a.collectionGap += r.collectionGap;
      return a;
    },
    {
      contractValue: 0,
      grossCollection: 0,
      collectionAfter14: 0,
      vat14Value: 0,
      salaries: 0,
      operatingExpenses: 0,
      net: 0,
      standard: 0,
      varianceVsStandard: 0,
      collectionGap: 0,
    },
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky start-0 bg-muted/50">{t.site}</TableHead>
          <TableHead className="text-right">{t.contract}</TableHead>
          <TableHead className="text-right">{t.gross}</TableHead>
          <TableHead className="text-right">{t.collAfter14}</TableHead>
          <TableHead className="text-right">{t.vat14}</TableHead>
          <TableHead className="text-right">{t.salaries}</TableHead>
          <TableHead className="text-right">{t.opex}</TableHead>
          <TableHead className="text-right">{t.net}</TableHead>
          <TableHead className="text-right">{t.standard}</TableHead>
          <TableHead className="text-right">{t.variance}</TableHead>
          <TableHead className="text-right">{t.achievement}</TableHead>
          <TableHead className="text-right">{t.netMargin}</TableHead>
          <TableHead className="text-right">{t.collGap}</TableHead>
          <TableHead>{t.status}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="sticky start-0 bg-card font-medium">
              <div>{r.siteName}</div>
              {r.clientName && (
                <div className="text-xs text-muted-foreground">{r.clientName}</div>
              )}
            </TableCell>
            <TableCell className="num">{formatCurrency(r.contractValue, locale)}</TableCell>
            <TableCell className="num">{formatCurrency(r.grossCollection, locale)}</TableCell>
            <TableCell className="num">{formatCurrency(r.collectionAfter14, locale)}</TableCell>
            <TableCell className="num text-muted-foreground">{formatCurrency(r.vat14Value, locale)}</TableCell>
            <TableCell className="num">{formatCurrency(r.salaries, locale)}</TableCell>
            <TableCell className="num">{formatCurrency(r.operatingExpenses, locale)}</TableCell>
            <TableCell className="num font-semibold">{formatCurrency(r.net, locale)}</TableCell>
            <TableCell className="num">{formatCurrency(r.standard, locale)}</TableCell>
            <TableCell
              className={cn(
                "num font-medium",
                r.varianceVsStandard >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {formatSigned(r.varianceVsStandard, locale)}
            </TableCell>
            <TableCell className="num">{formatPercent(r.standardAchievementPercentage)}</TableCell>
            <TableCell className="num text-muted-foreground">{formatPercent(r.netMarginPercentage)}</TableCell>
            <TableCell
              className={cn(
                "num",
                r.collectionGap >= 0 ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400",
              )}
            >
              {formatSigned(r.collectionGap, locale)}
            </TableCell>
            <TableCell>
              <StatusBadge status={r.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      {rows.length > 0 && (
        <TableFooter>
          <TableRow>
            <TableCell className="sticky start-0 bg-muted/50 font-semibold">{dict.common.total}</TableCell>
            <TableCell className="num">{formatCurrency(totals.contractValue, locale)}</TableCell>
            <TableCell className="num">{formatCurrency(totals.grossCollection, locale)}</TableCell>
            <TableCell className="num">{formatCurrency(totals.collectionAfter14, locale)}</TableCell>
            <TableCell className="num">{formatCurrency(totals.vat14Value, locale)}</TableCell>
            <TableCell className="num">{formatCurrency(totals.salaries, locale)}</TableCell>
            <TableCell className="num">{formatCurrency(totals.operatingExpenses, locale)}</TableCell>
            <TableCell className="num font-semibold">{formatCurrency(totals.net, locale)}</TableCell>
            <TableCell className="num">{formatCurrency(totals.standard, locale)}</TableCell>
            <TableCell
              className={cn(
                "num font-semibold",
                totals.varianceVsStandard >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {formatSigned(totals.varianceVsStandard, locale)}
            </TableCell>
            <TableCell className="num">
              {formatPercent(totals.standard ? (totals.net / totals.standard) * 100 : null)}
            </TableCell>
            <TableCell className="num">
              {formatPercent(
                totals.grossCollection ? (totals.net / totals.grossCollection) * 100 : null,
              )}
            </TableCell>
            <TableCell className="num">{formatSigned(totals.collectionGap, locale)}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
