/**
 * Seed / demo data for Eagles Budget CRM.
 *
 * Creates:
 *   - a default ADMIN user (credentials from .env)
 *   - 7 security sites with client + type + default standard
 *   - 4 monthly uploads (Oct 2025 .. Jan 2026) with raw + normalized data,
 *     modelled on a real January 2026 budget sheet structure
 *   - standards history, general expenses, and recomputed monthly summaries
 *   - a physical sample .xlsx for the January 2026 sheet under storage/uploads
 *
 * Run with:  npm run db:seed
 */
import { PrismaClient, Prisma, Role } from "@prisma/client";
import * as XLSX from "xlsx";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hash } from "bcryptjs";
import { processParsedRows } from "../src/lib/processing";
import type { ParsedSiteRow } from "../src/lib/excel";

const prisma = new PrismaClient();

const SHEET_HEADERS = [
  "Site Name",
  "Client",
  "Contract Value",
  "Gross Collection",
  "Salaries",
  "Operating Expenses",
  "Standard",
] as const;

interface SiteSpec {
  name: string;
  clientName: string;
  siteType: string;
  defaultStandard: number;
  // January 2026 baseline figures.
  contractValue: number;
  grossCollection: number;
  salaries: number;
  operatingExpenses: number;
  standard: number;
}

const SITES: SiteSpec[] = [
  { name: "Nile Towers Complex", clientName: "Nile Real Estate", siteType: "Commercial", defaultStandard: 250000, contractValue: 1200000, grossCollection: 1368000, salaries: 720000, operatingExpenses: 380000, standard: 250000 },
  { name: "Cairo Festival Mall", clientName: "CFC Management", siteType: "Retail", defaultStandard: 180000, contractValue: 900000, grossCollection: 1026000, salaries: 560000, operatingExpenses: 300000, standard: 180000 },
  { name: "Smart Village HQ", clientName: "Smart Village Co.", siteType: "Commercial", defaultStandard: 320000, contractValue: 1500000, grossCollection: 1710000, salaries: 900000, operatingExpenses: 460000, standard: 320000 },
  { name: "New Capital Admin", clientName: "New Admin Capital Authority", siteType: "Government", defaultStandard: 150000, contractValue: 800000, grossCollection: 912000, salaries: 520000, operatingExpenses: 280000, standard: 150000 },
  { name: "Alexandria Port Terminal", clientName: "Alexandria Port Authority", siteType: "Industrial", defaultStandard: 200000, contractValue: 1100000, grossCollection: 1254000, salaries: 700000, operatingExpenses: 420000, standard: 200000 },
  { name: "Maadi Medical Center", clientName: "Maadi Health Group", siteType: "Healthcare", defaultStandard: 110000, contractValue: 600000, grossCollection: 684000, salaries: 360000, operatingExpenses: 190000, standard: 110000 },
  { name: "Sheikh Zayed Residence", clientName: "Zayed Homes", siteType: "Residential", defaultStandard: 100000, contractValue: 500000, grossCollection: 570000, salaries: 320000, operatingExpenses: 170000, standard: 100000 },
];

// Months to seed, oldest first. factor scales the revenue/cost figures to
// create a realistic upward trend into January 2026.
const PERIODS = [
  { month: 10, year: 2025, factor: 0.9 },
  { month: 11, year: 2025, factor: 0.94 },
  { month: 12, year: 2025, factor: 0.97 },
  { month: 1, year: 2026, factor: 1.0 },
];

function round(n: number) {
  return Math.round(n);
}

function buildRowsForPeriod(factor: number): {
  parsed: ParsedSiteRow[];
  rawRows: Record<string, unknown>[];
} {
  const parsed: ParsedSiteRow[] = [];
  const rawRows: Record<string, unknown>[] = [];

  SITES.forEach((s, i) => {
    const contractValue = round(s.contractValue * factor);
    const grossCollection = round(s.grossCollection * factor);
    const salaries = round(s.salaries * factor);
    const operatingExpenses = round(s.operatingExpenses * factor);
    const standard = s.standard; // standard is a fixed target, not scaled

    parsed.push({
      siteName: s.name,
      clientName: s.clientName,
      contractValue,
      grossCollection,
      salaries,
      operatingExpenses,
      standard,
      sourceRow: i + 2,
    });

    rawRows.push({
      "Site Name": s.name,
      Client: s.clientName,
      "Contract Value": contractValue,
      "Gross Collection": grossCollection,
      Salaries: salaries,
      "Operating Expenses": operatingExpenses,
      Standard: standard,
    });
  });

  return { parsed, rawRows };
}

function writeSampleWorkbook(
  rawRows: Record<string, unknown>[],
  filePath: string,
): number {
  const ws = XLSX.utils.json_to_sheet(rawRows, { header: [...SHEET_HEADERS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Budget");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  writeFileSync(filePath, buf);
  return buf.length;
}

async function main() {
  console.log("🌱 Seeding Eagles Budget CRM...");

  // --- Clean slate (dependency order) ---
  await prisma.monthlySiteBudget.deleteMany();
  await prisma.monthlySummary.deleteMany();
  await prisma.standardHistory.deleteMany();
  await prisma.expenseItem.deleteMany();
  await prisma.uploadedFile.deleteMany();
  await prisma.site.deleteMany();
  await prisma.user.deleteMany();

  // --- Admin user ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@eaglesgroup.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      name: "Eagles Admin",
      passwordHash: await hash(adminPassword, 10),
      role: Role.ADMIN,
    },
  });
  console.log(`   ✓ Admin user: ${adminEmail} / ${adminPassword}`);

  // --- Sites ---
  for (const s of SITES) {
    await prisma.site.create({
      data: {
        name: s.name,
        clientName: s.clientName,
        siteType: s.siteType,
        defaultStandard: s.defaultStandard,
        isActive: true,
      },
    });
  }
  console.log(`   ✓ ${SITES.length} sites created`);

  // --- Uploads + normalized data per period ---
  const uploadDir = process.env.UPLOAD_DIR ?? "./storage/uploads";
  mkdirSync(uploadDir, { recursive: true });

  for (const p of PERIODS) {
    const { parsed, rawRows } = buildRowsForPeriod(p.factor);
    const fileName = `budget-${p.year}-${String(p.month).padStart(2, "0")}.xlsx`;
    const storedPath = join(uploadDir, fileName);
    const fileSize = writeSampleWorkbook(rawRows, storedPath);

    const file = await prisma.uploadedFile.create({
      data: {
        originalName: fileName,
        storedPath,
        fileSize,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        month: p.month,
        year: p.year,
        status: "PROCESSED",
        rawRows: rawRows as unknown as Prisma.InputJsonValue,
        rowCount: rawRows.length,
        uploadedById: admin.id,
        processedAt: new Date(),
      },
    });

    await processParsedRows({
      uploadedFileId: file.id,
      month: p.month,
      year: p.year,
      rows: parsed,
      userId: admin.id,
    });

    console.log(`   ✓ ${p.year}-${String(p.month).padStart(2, "0")}: ${parsed.length} sites processed → ${fileName}`);
  }

  // --- General expenses (company-level) for the two most recent months ---
  const generalExpenses = [
    { category: "Office Salaries", description: "HQ administrative staff", amount: 120000, type: "RECURRING" as const },
    { category: "Rent", description: "Head office lease", amount: 45000, type: "RECURRING" as const },
    { category: "Uniforms", description: "Guard uniforms restock", amount: 25000, type: "ONE_TIME" as const },
    { category: "Equipment", description: "Radios & metal detectors", amount: 30000, type: "ONE_TIME" as const },
    { category: "Transportation", description: "Fleet fuel & maintenance", amount: 20000, type: "RECURRING" as const },
    { category: "Administration", description: "Software & licensing", amount: 15000, type: "RECURRING" as const },
  ];

  for (const period of [{ month: 12, year: 2025 }, { month: 1, year: 2026 }]) {
    for (const e of generalExpenses) {
      await prisma.expenseItem.create({
        data: { ...e, month: period.month, year: period.year, createdById: admin.id },
      });
    }
  }
  console.log("   ✓ General expenses added for Dec 2025 & Jan 2026");

  // Recompute summaries so general expenses flow into finalNetAfterGeneral.
  const { recomputeMonthlySummary } = await import("../src/lib/processing");
  await recomputeMonthlySummary(12, 2025);
  await recomputeMonthlySummary(1, 2026);

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
