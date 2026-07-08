import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";
import { formatCurrency, periodLabel } from "@/i18n/format";

export const dynamic = "force-dynamic";

export default async function StandardsPage() {
  const { dict, locale } = await getI18n();
  const t = dict.standards;

  const history = await prisma.standardHistory.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }, { changeDate: "desc" }],
    include: {
      site: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    take: 200,
  });

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.common.site}</TableHead>
                <TableHead>{dict.common.period}</TableHead>
                <TableHead className="text-right">{t.standardValue}</TableHead>
                <TableHead>{t.changeReason}</TableHead>
                <TableHead>{t.changedBy}</TableHead>
                <TableHead>{t.date}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {t.none}
                  </TableCell>
                </TableRow>
              ) : (
                history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.site.name}</TableCell>
                    <TableCell>{periodLabel(h.month, h.year, locale)}</TableCell>
                    <TableCell className="num font-medium">{formatCurrency(Number(h.standardValue), locale)}</TableCell>
                    <TableCell className="text-muted-foreground">{h.changeReason ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{h.createdBy?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{h.changeDate.toISOString().slice(0, 10)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
