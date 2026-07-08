import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatCurrency, periodLabel } from "@/i18n/format";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const { dict, locale } = await getI18n();
  const t = dict.expenses;

  const items = await prisma.expenseItem.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }, { category: "asc" }],
  });

  const groups = new Map<string, { month: number; year: number; items: typeof items }>();
  for (const it of items) {
    const key = `${it.year}-${it.month}`;
    const g = groups.get(key) ?? { month: it.month, year: it.year, items: [] };
    g.items.push(it);
    groups.set(key, g);
  }

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />

      {groups.size === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">{t.none}</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {[...groups.values()].map((g) => {
            const total = g.items.reduce((s, i) => s + Number(i.amount), 0);
            return (
              <Card key={`${g.year}-${g.month}`}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>{periodLabel(g.month, g.year, locale)}</CardTitle>
                  <span className="text-sm font-semibold">{formatCurrency(total, locale)}</span>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.category}</TableHead>
                        <TableHead>{t.descriptionCol}</TableHead>
                        <TableHead>{t.type}</TableHead>
                        <TableHead className="text-right">{t.amount}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell className="font-medium">{it.category}</TableCell>
                          <TableCell className="text-muted-foreground">{it.description ?? "—"}</TableCell>
                          <TableCell>
                            <Badge className="bg-muted text-muted-foreground">
                              {it.type === "RECURRING" ? t.recurring : t.oneTime}
                            </Badge>
                          </TableCell>
                          <TableCell className="num">{formatCurrency(Number(it.amount), locale)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
