import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  parseBudgetWorkbook,
  parseNumber,
  type FieldKey,
} from "./excelBudgetParserService";

/** Build an .xlsx buffer from an array-of-arrays sheet. */
function makeWorkbook(aoa: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Budget");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// A realistic Arabic sheet: a title row, a blank row, THEN the header row,
// two site rows, a totals row, and a trailing notes row.
const ARABIC_SHEET: unknown[][] = [
  ["ميزانية شهر يناير 2026", null, null, null, null, null, null],
  [],
  ["اسم الموقع", "العميل", "التعاقد", "التحصيل", "المرتبات", "مصاريف التشغيل", "الاستاندرد"],
  ["برج النيل", "شركة النيل", 1_200_000, 1_368_000, 720_000, 380_000, 250_000],
  ["مول القاهرة", "إدارة المول", 900_000, 1_026_000, 560_000, 300_000, 180_000],
  ["الإجمالي", null, 2_100_000, 2_394_000, 1_280_000, 680_000, 430_000],
  ["ملاحظات: تم اعتماد الموازنة من الإدارة المالية", null, null, null, null, null, null],
];

describe("excelBudgetParserService — Arabic sheet with noise", () => {
  const result = parseBudgetWorkbook(makeWorkbook(ARABIC_SHEET));

  it("detects the header row below title/blank rows", () => {
    expect(result.headerRow).toBe(3); // 1-based
  });

  it("extracts exactly the two site rows (skips title, blank, totals, notes)", () => {
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.siteName)).toEqual(["برج النيل", "مول القاهرة"]);
  });

  it("maps Arabic headers to the correct numeric fields", () => {
    const nile = result.rows[0];
    expect(nile.contractValue).toBe(1_200_000);
    expect(nile.grossCollection).toBe(1_368_000);
    expect(nile.salaries).toBe(720_000);
    expect(nile.operatingExpenses).toBe(380_000);
    expect(nile.standard).toBe(250_000);
  });

  it("does not raise blocking errors on a clean sheet", () => {
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("keeps raw rows for audit (including the totals/notes rows)", () => {
    expect(result.rawRows.length).toBeGreaterThanOrEqual(2);
  });
});

describe("excelBudgetParserService — validation", () => {
  it("reports MISSING_COLUMNS when a required column is absent", () => {
    // No salaries column.
    const sheet: unknown[][] = [
      ["اسم الموقع", "التحصيل", "مصاريف التشغيل", "الاستاندرد"],
      ["برج النيل", 1_368_000, 380_000, 250_000],
    ];
    const result = parseBudgetWorkbook(makeWorkbook(sheet));
    const missing = result.issues.find((i) => i.code === "MISSING_COLUMNS");
    expect(missing).toBeDefined();
    expect(missing?.columns).toContain<FieldKey>("salaries");
    expect(result.rows).toHaveLength(0);
  });

  it("warns (does not fail) when the Standard column is missing entirely", () => {
    const sheet: unknown[][] = [
      ["اسم الموقع", "التحصيل", "المرتبات", "مصاريف التشغيل"],
      ["برج النيل", 1_368_000, 720_000, 380_000],
    ];
    const result = parseBudgetWorkbook(makeWorkbook(sheet));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].standard).toBeNull();
    expect(result.issues.some((i) => i.code === "STANDARD_COLUMN_MISSING")).toBe(true);
  });

  it("flags a row with a non-numeric required value", () => {
    const sheet: unknown[][] = [
      ["اسم الموقع", "التحصيل", "المرتبات", "مصاريف التشغيل", "الاستاندرد"],
      ["برج النيل", "غير متاح", 720_000, 380_000, 250_000],
    ];
    const result = parseBudgetWorkbook(makeWorkbook(sheet));
    expect(result.issues.some((i) => i.code === "ROW_INVALID_NUMBER")).toBe(true);
    expect(result.rows).toHaveLength(0);
  });

  it("warns on NET mismatch when a Net column disagrees with computed net", () => {
    const sheet: unknown[][] = [
      ["اسم الموقع", "التحصيل", "المرتبات", "مصاريف التشغيل", "الصافي", "الاستاندرد"],
      // computed net = 1,368,000 - 720,000 - 380,000 = 268,000; sheet says 999,999
      ["برج النيل", 1_368_000, 720_000, 380_000, 999_999, 250_000],
    ];
    const result = parseBudgetWorkbook(makeWorkbook(sheet));
    expect(result.rows).toHaveLength(1);
    expect(result.issues.some((i) => i.code === "NET_MISMATCH")).toBe(true);
  });
});

describe("parseNumber", () => {
  it("handles commas, currency, parentheses and Arabic-Indic digits", () => {
    expect(parseNumber("1,368,000")).toBe(1_368_000);
    expect(parseNumber("1,200,000 ج.م")).toBe(1_200_000);
    expect(parseNumber("(50,000)")).toBe(-50_000);
    expect(parseNumber("١٣٦٨٠٠٠")).toBe(1_368_000);
    expect(Number.isNaN(parseNumber("—"))).toBe(true);
  });
});
