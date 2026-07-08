/**
 * monthlyAnalysisService
 * -------------------------------------------------------------------------
 * Orchestrates a real monthly upload end-to-end and exposes the monthly
 * analysis read model.
 *
 * Upload lifecycle (status transitions recorded on uploaded_files):
 *   UPLOADED  (تم الرفع)      → file saved to disk + registered
 *   PROCESSING (جاري التحليل) → parsed OK, normalizing into the DB
 *   PROCESSED (تم التحليل)     → monthly_site_budgets + summary written
 *   FAILED    (فشل التحليل)    → parse/validation/normalize failure
 *
 * All financial math is deterministic (src/lib/calculations.ts). No AI, no
 * randomness — the same sheet always yields the same numbers.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { processParsedRows } from "../processing";
import { getMonthlyAnalysis } from "../analytics";
import {
  parseBudgetWorkbook,
  type ParseIssue,
} from "./excelBudgetParserService";

export interface ProcessUploadInput {
  buffer: Buffer;
  originalName: string;
  storedPath: string;
  fileSize: number;
  mimeType: string | null;
  month: number;
  year: number;
  userId: string | null;
}

export interface ProcessUploadOutcome {
  fileId: string;
  status: "PROCESSED" | "FAILED";
  siteCount: number;
  errorIssues: ParseIssue[];
  warningIssues: ParseIssue[];
}

/**
 * Register + parse + validate + normalize an uploaded workbook. Returns the
 * outcome with structured issues (localize them in the caller).
 */
export async function processUploadedWorkbook(
  input: ProcessUploadInput,
): Promise<ProcessUploadOutcome> {
  const { buffer, month, year, userId } = input;

  // 1) Register the raw upload.
  const file = await prisma.uploadedFile.create({
    data: {
      originalName: input.originalName,
      storedPath: input.storedPath,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      month,
      year,
      status: "UPLOADED",
      uploadedById: userId ?? undefined,
    },
  });

  // 2) Parse + validate.
  const result = parseBudgetWorkbook(buffer);
  const errorIssues = result.issues.filter((i) => i.severity === "error");
  const warningIssues = result.issues.filter((i) => i.severity === "warning");
  const rawJson =
    result.rawRows.length > 0
      ? (result.rawRows as unknown as Prisma.InputJsonValue)
      : undefined;

  if (result.rows.length === 0) {
    await prisma.uploadedFile.update({
      where: { id: file.id },
      data: {
        status: "FAILED",
        rawRows: rawJson,
        rowCount: result.rawRows.length,
        errorLog: errorIssues.map((i) => i.code).join(", ") || "NO_VALID_ROWS",
      },
    });
    return {
      fileId: file.id,
      status: "FAILED",
      siteCount: 0,
      errorIssues: errorIssues.length
        ? errorIssues
        : [{ severity: "error", code: "NO_VALID_ROWS" }],
      warningIssues,
    };
  }

  // 3) Mark processing + persist raw rows for audit/reprocessing.
  await prisma.uploadedFile.update({
    where: { id: file.id },
    data: { status: "PROCESSING", rawRows: rawJson, rowCount: result.rows.length },
  });

  // 4) Normalize into monthly_site_budgets + refresh monthly_summaries.
  try {
    const { siteCount } = await processParsedRows({
      uploadedFileId: file.id,
      month,
      year,
      rows: result.rows,
      userId,
    });

    await prisma.uploadedFile.update({
      where: { id: file.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        errorLog: warningIssues.length
          ? warningIssues.map((i) => i.code).join(", ")
          : null,
      },
    });

    return { fileId: file.id, status: "PROCESSED", siteCount, errorIssues: [], warningIssues };
  } catch (err) {
    await prisma.uploadedFile.update({
      where: { id: file.id },
      data: {
        status: "FAILED",
        errorLog: `PROCESSING_ERROR: ${(err as Error).message}`,
      },
    });
    return {
      fileId: file.id,
      status: "FAILED",
      siteCount: 0,
      errorIssues: [{ severity: "error", code: "PROCESSING_ERROR" }],
      warningIssues,
    };
  }
}

/** The monthly analysis read model (KPIs, highlights, site table). */
export { getMonthlyAnalysis as generateMonthlyAnalysis };
