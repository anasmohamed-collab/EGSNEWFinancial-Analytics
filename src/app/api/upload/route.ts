import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBudgetWorkbook } from "@/lib/excel";
import { processParsedRows } from "@/lib/processing";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXT = [".xlsx", ".xls"];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.role === "VIEWER") {
    return NextResponse.json(
      { error: "Viewers cannot upload sheets." },
      { status: 403 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  const month = Number(form.get("month"));
  const year = Number(form.get("year"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Select a valid month." }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Select a valid year." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 10 MB." }, { status: 400 });
  }
  const lower = file.name.toLowerCase();
  if (!ALLOWED_EXT.some((ext) => lower.endsWith(ext))) {
    return NextResponse.json(
      { error: "Only .xlsx or .xls files are accepted." },
      { status: 400 },
    );
  }

  // Persist the original file to disk.
  const uploadDir = process.env.UPLOAD_DIR ?? "./storage/uploads";
  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  const storedName = `${year}-${String(month).padStart(2, "0")}-${randomUUID()}.xlsx`;
  const storedPath = join(uploadDir, storedName);
  await writeFile(storedPath, buffer);

  // Register the upload (raw).
  const uploaded = await prisma.uploadedFile.create({
    data: {
      originalName: file.name,
      storedPath,
      fileSize: file.size,
      mimeType: file.type || null,
      month,
      year,
      status: "UPLOADED",
      uploadedById: session.id,
    },
  });

  // Parse + validate.
  const result = parseBudgetWorkbook(buffer);

  if (result.errors.length > 0 && result.rows.length === 0) {
    await prisma.uploadedFile.update({
      where: { id: uploaded.id },
      data: {
        status: "FAILED",
        rawRows: result.rawRows.length
          ? (result.rawRows as unknown as Prisma.InputJsonValue)
          : undefined,
        rowCount: result.rawRows.length,
        errorLog: result.errors.join("\n"),
      },
    });
    return NextResponse.json(
      {
        error: "The sheet could not be processed.",
        fileId: uploaded.id,
        validationErrors: result.errors,
        columnMap: result.columnMap,
      },
      { status: 422 },
    );
  }

  // Normalize.
  try {
    const { siteCount } = await processParsedRows({
      uploadedFileId: uploaded.id,
      month,
      year,
      rows: result.rows,
      userId: session.id,
    });

    await prisma.uploadedFile.update({
      where: { id: uploaded.id },
      data: {
        status: "PROCESSED",
        rawRows: result.rawRows as unknown as Prisma.InputJsonValue,
        rowCount: result.rows.length,
        errorLog: result.errors.length ? result.errors.join("\n") : null,
        processedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      fileId: uploaded.id,
      month,
      year,
      siteCount,
      warnings: result.errors, // row-level skips, if any
    });
  } catch (err) {
    await prisma.uploadedFile.update({
      where: { id: uploaded.id },
      data: {
        status: "FAILED",
        errorLog: `Processing error: ${(err as Error).message}`,
      },
    });
    return NextResponse.json(
      { error: "Failed while normalizing data.", fileId: uploaded.id },
      { status: 500 },
    );
  }
}
