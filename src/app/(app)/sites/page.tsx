import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency } from "@/i18n/format";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const { dict, locale } = await getI18n();
  const t = dict.sites;

  const sites = await prisma.site.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { budgets: true } } },
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
                <TableHead>{t.client}</TableHead>
                <TableHead>{t.type}</TableHead>
                <TableHead className="text-right">{t.defaultStandard}</TableHead>
                <TableHead className="text-right">{t.monthsOfData}</TableHead>
                <TableHead>{dict.table.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.name}
                    {s.notes && <div className="text-xs text-muted-foreground">{s.notes}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.clientName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.siteType ?? "—"}</TableCell>
                  <TableCell className="num">{formatCurrency(Number(s.defaultStandard), locale)}</TableCell>
                  <TableCell className="num">{s._count.budgets}</TableCell>
                  <TableCell>
                    {s.isActive ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {t.active}
                      </Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground">{t.inactive}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
