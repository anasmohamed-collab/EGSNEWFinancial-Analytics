import { PageHeader } from "@/components/page-header";
import { UploadForm } from "@/components/upload-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { periodLabel } from "@/i18n/format";
import type { UploadStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<UploadStatus, string> = {
  UPLOADED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  PROCESSED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default async function UploadPage() {
  const { dict, locale } = await getI18n();
  const t = dict.upload;

  const files = await prisma.uploadedFile.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { uploadedBy: { select: { name: true } } },
  });

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <UploadForm />
        </div>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t.recentUploads}</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {files.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">{t.noUploads}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.common.period}</TableHead>
                    <TableHead>{t.fileCol}</TableHead>
                    <TableHead className="text-right">{t.rowsCol}</TableHead>
                    <TableHead>{t.statusCol}</TableHead>
                    <TableHead>{t.uploadedByCol}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{periodLabel(f.month, f.year, locale)}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">{f.originalName}</TableCell>
                      <TableCell className="num">{f.rowCount}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLE[f.status]}>{t.statuses[f.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{f.uploadedBy?.name ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
