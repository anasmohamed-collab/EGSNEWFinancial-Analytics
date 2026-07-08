import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getSession } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { localizeParseIssues } from "@/i18n/parse-errors";
import { processUploadedWorkbook } from "@/lib/services/monthlyAnalysisService";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXT = [".xlsx", ".xls"];

export async function POST(req: Request) {
  const { dict } = await getI18n();
  const e = dict.upload.errors;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: e.unauthorized }, { status: 401 });
  }
  if (session.role === "VIEWER") {
    return NextResponse.json({ error: e.viewerForbidden }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const month = Number(form.get("month"));
  const year = Number(form.get("year"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: e.noFile }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: e.badMonth }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: e.badYear }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: e.tooLarge }, { status: 400 });
  }
  if (!ALLOWED_EXT.some((ext) => file.name.toLowerCase().endsWith(ext))) {
    return NextResponse.json({ error: e.badType }, { status: 400 });
  }

  // Persist the original file to disk (raw, for audit / reprocessing).
  const uploadDir = process.env.UPLOAD_DIR ?? "./storage/uploads";
  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  const storedName = `${year}-${String(month).padStart(2, "0")}-${randomUUID()}.xlsx`;
  const storedPath = join(uploadDir, storedName);
  await writeFile(storedPath, buffer);

  // Register → parse → validate → normalize via the service.
  const outcome = await processUploadedWorkbook({
    buffer,
    originalName: file.name,
    storedPath,
    fileSize: file.size,
    mimeType: file.type || null,
    month,
    year,
    userId: session.id,
  });

  if (outcome.status === "FAILED") {
    return NextResponse.json(
      {
        error: dict.upload.processFailed,
        fileId: outcome.fileId,
        validationErrors: localizeParseIssues(dict, outcome.errorIssues),
        warnings: localizeParseIssues(dict, outcome.warningIssues),
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    fileId: outcome.fileId,
    month,
    year,
    siteCount: outcome.siteCount,
    warnings: localizeParseIssues(dict, outcome.warningIssues),
  });
}
