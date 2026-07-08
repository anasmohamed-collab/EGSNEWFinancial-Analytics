/**
 * excelBudgetParserService
 * -------------------------------------------------------------------------
 * Reusable, deterministic parser for monthly security-site budget workbooks.
 *
 * Responsibilities:
 *   - Read the first worksheet of an .xlsx/.xls buffer.
 *   - Locate the header row even when the sheet has title rows, blank rows,
 *     or notes above the table (header-row detection, not "row 1 = header").
 *   - Map columns from tolerant Arabic OR English header aliases.
 *   - Extract one normalized row per security site.
 *   - Skip totals / notes / blank rows safely without breaking.
 *   - Return STRUCTURED issues (codes + params) — NOT display strings — so the
 *     caller can localize them (see src/i18n/parse-errors.ts).
 *
 * This module does NOT compute financial results and does NOT touch the DB.
 * All money math is done deterministically in src/lib/calculations.ts.
 * This module must stay free of "@/..." alias imports so it is unit-testable.
 */
import * as XLSX from "xlsx";

export type ParseSeverity = "error" | "warning";

export type ParseIssueCode =
  | "NO_WORKSHEET"
  | "NO_DATA_ROWS"
  | "NO_HEADER_ROW"
  | "MISSING_COLUMNS"
  | "ROW_MISSING_SITE"
  | "ROW_INVALID_NUMBER"
  | "NO_VALID_ROWS"
  | "NET_MISMATCH"
  | "STANDARD_MISSING"
  | "STANDARD_COLUMN_MISSING"
  | "PROCESSING_ERROR";

/** Logical column keys used across the app. */
export type FieldKey =
  | "siteName"
  | "clientName"
  | "contractValue"
  | "grossCollection"
  | "salaries"
  | "operatingExpenses"
  | "net"
  | "standard";

export interface ParseIssue {
  severity: ParseSeverity;
  code: ParseIssueCode;
  /** 1-based source-sheet row, when relevant. */
  row?: number;
  site?: string;
  /** Logical field keys (for MISSING_COLUMNS / ROW_INVALID_NUMBER). */
  columns?: FieldKey[];
  fields?: FieldKey[];
  /** Original header strings detected in the sheet (for diagnostics). */
  detected?: string[];
}

export interface ParsedSiteRow {
  siteName: string;
  clientName: string | null;
  contractValue: number;
  grossCollection: number;
  salaries: number;
  operatingExpenses: number;
  /** Standard from the sheet, or null when the sheet omits it (fallback later). */
  standard: number | null;
  /** Net as written in the sheet, if a Net column exists (for cross-check only). */
  sheetNet: number | null;
  /** 1-based row number in the source sheet. */
  sourceRow: number;
}

export interface ParseResult {
  rows: ParsedSiteRow[];
  /** Raw rows exactly as read from the data region (audit / reprocessing). */
  rawRows: Record<string, unknown>[];
  issues: ParseIssue[];
  columnMap: Record<FieldKey, number | null>;
  /** 1-based index of the detected header row, or null. */
  headerRow: number | null;
}

/** Accepted header aliases per logical field (Arabic + English, normalized). */
const FIELD_ALIASES: Record<FieldKey, string[]> = {
  siteName: [
    "اسم الموقع", "الموقع", "المشروع", "اسم المشروع", "الموقع المشروع", "الوحده",
    "site name", "site", "project", "project name", "location", "unit",
  ],
  clientName: [
    "العميل", "اسم العميل", "جهه التعاقد", "الجهه",
    "client", "client name", "customer", "customer name",
  ],
  contractValue: [
    "التعاقد", "قيمه التعاقد", "قيمه العقد", "العقد", "قيمه التعاقد الشهري",
    "contract value", "contract", "contract amount", "contract val",
  ],
  grossCollection: [
    "التحصيل", "اجمالي التحصيل", "المتحصلات", "التحصيلات", "اجمالي التحصيلات", "المحصل",
    "gross collection", "collection", "gross collections", "collections", "gross",
    "revenue", "total collection",
  ],
  salaries: [
    "المرتبات", "الرواتب", "الاجور", "اجور",
    "salaries", "salary", "wages", "payroll",
  ],
  operatingExpenses: [
    "مصاريف التشغيل", "مصروفات التشغيل", "المصاريف التشغيليه", "المصروفات التشغيليه",
    "التشغيل", "مصاريف تشغيليه", "المصروفات",
    "operating expenses", "operating expense", "opex", "expenses", "operating",
    "operation expenses", "operational expenses",
  ],
  net: [
    "الصافي", "صافي", "صافي الربح", "الصافي الفعلي",
    "net", "net profit", "actual net",
  ],
  standard: [
    "الاستاندرد", "الاستاندارد", "الاستندر", "المستهدف", "الهدف", "الاستاندرد الشهري",
    "standard", "target", "standard target", "std", "budget target",
  ],
};

/** Columns that MUST be present for a sheet to be processable. */
const HARD_REQUIRED: FieldKey[] = [
  "siteName",
  "grossCollection",
  "salaries",
  "operatingExpenses",
];

/**
 * Site-name prefixes that indicate a totals / summary row to skip.
 * NOTE: no `\b` — a word boundary requires a `\w` character, and Arabic letters
 * are not `\w`, so `\b` never matches after Arabic text. We require a space or
 * end-of-string instead.
 */
const TOTAL_MARKERS =
  /^(الاجمالي|اجمالي|الاجماليه|المجموع|مجموع|اجمالي المواقع|total|totals|grand total|sum|subtotal)(\s|$)/i;

/** Normalize a header/site string for matching (light Arabic normalization). */
export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/ـ/g, "") // tatweel
    .replace(/[ً-ْ]/g, "") // Arabic diacritics
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .replace(/[%()\/\\.,:؛_\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse a possibly-messy numeric cell. Returns NaN when unparsable. */
export function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return NaN;
  if (typeof value === "number") return value;
  let s = String(value).trim();
  if (s === "" || s === "-" || s === "—") return NaN;
  // Convert Arabic-Indic digits to Latin.
  s = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
       .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  // Parentheses denote negatives: (1,234) -> -1234
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[^0-9.\-]/g, "");
  if (s === "" || s === "-" || s === ".") return NaN;
  const n = Number(s);
  if (Number.isNaN(n)) return NaN;
  return negative ? -n : n;
}

function matchField(normalizedCells: string[], aliases: string[]): number | null {
  // Exact normalized match first.
  for (let i = 0; i < normalizedCells.length; i++) {
    if (aliases.includes(normalizedCells[i])) return i;
  }
  // Then "contains" match (e.g. "اسم الموقع / الفرع").
  for (let i = 0; i < normalizedCells.length; i++) {
    const cell = normalizedCells[i];
    if (cell && aliases.some((a) => cell.includes(a))) return i;
  }
  return null;
}

/** Score a candidate header row by how many hard-required fields it contains. */
function buildColumnMapForRow(row: unknown[]): {
  map: Record<FieldKey, number | null>;
  hardMatches: number;
} {
  const normalized = row.map((c) => normalizeHeader(c));
  const map = {} as Record<FieldKey, number | null>;
  let hardMatches = 0;
  (Object.keys(FIELD_ALIASES) as FieldKey[]).forEach((field) => {
    const idx = matchField(normalized, FIELD_ALIASES[field]);
    map[field] = idx;
    if (idx !== null && HARD_REQUIRED.includes(field)) hardMatches++;
  });
  return { map, hardMatches };
}

/**
 * Detect the header row: scan the first ~25 rows and pick the first row that
 * has a site-name column AND at least two money columns.
 */
function detectHeaderRow(rows: unknown[][]): {
  headerIndex: number;
  map: Record<FieldKey, number | null>;
} | null {
  const limit = Math.min(rows.length, 25);
  for (let i = 0; i < limit; i++) {
    const { map, hardMatches } = buildColumnMapForRow(rows[i]);
    if (map.siteName !== null && hardMatches >= 3) {
      return { headerIndex: i, map };
    }
  }
  return null;
}

function isBlankRow(row: unknown[]): boolean {
  return row.every((c) => c === null || c === undefined || String(c).trim() === "");
}

/**
 * Parse a workbook buffer into normalized site rows + structured issues.
 */
export function parseBudgetWorkbook(buffer: ArrayBuffer | Buffer): ParseResult {
  const emptyMap = (): Record<FieldKey, number | null> => ({
    siteName: null, clientName: null, contractValue: null, grossCollection: null,
    salaries: null, operatingExpenses: null, net: null, standard: null,
  });

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], rawRows: [], issues: [{ severity: "error", code: "NO_WORKSHEET" }], columnMap: emptyMap(), headerRow: null };
  }

  const sheet = workbook.Sheets[sheetName];
  // Keep blank rows so array indices stay aligned with real sheet row numbers
  // (accurate "Row {n}" messages). Blank rows are skipped in the data loop.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: true,
    defval: null,
    raw: true,
  });
  if (aoa.length === 0) {
    return { rows: [], rawRows: [], issues: [{ severity: "error", code: "NO_DATA_ROWS" }], columnMap: emptyMap(), headerRow: null };
  }

  const detected = detectHeaderRow(aoa);
  if (!detected) {
    return { rows: [], rawRows: [], issues: [{ severity: "error", code: "NO_HEADER_ROW" }], columnMap: emptyMap(), headerRow: null };
  }

  const { headerIndex, map } = detected;
  const headerCells = aoa[headerIndex].map((c) => String(c ?? "").trim());
  const issues: ParseIssue[] = [];

  // Validate required columns exist.
  const missing = HARD_REQUIRED.filter((f) => map[f] === null);
  if (missing.length > 0) {
    issues.push({
      severity: "error",
      code: "MISSING_COLUMNS",
      columns: missing,
      detected: headerCells.filter(Boolean),
    });
    return { rows: [], rawRows: [], issues, columnMap: map, headerRow: headerIndex + 1 };
  }

  const dataRows = aoa.slice(headerIndex + 1);
  const rawRows: Record<string, unknown>[] = [];
  const rows: ParsedSiteRow[] = [];

  dataRows.forEach((row, i) => {
    const sourceRow = headerIndex + 1 + i + 1; // 1-based sheet row
    if (isBlankRow(row)) return;

    // Preserve the raw row for audit, keyed by header labels.
    const rawObj: Record<string, unknown> = {};
    headerCells.forEach((h, ci) => {
      if (h) rawObj[h] = row[ci] ?? null;
    });
    rawRows.push(rawObj);

    const siteName = String(row[map.siteName as number] ?? "").trim();

    // Skip totals / summary rows safely.
    if (TOTAL_MARKERS.test(normalizeHeader(siteName))) return;

    const gross = parseNumber(row[map.grossCollection as number]);
    const salaries = parseNumber(row[map.salaries as number]);
    const opex = parseNumber(row[map.operatingExpenses as number]);

    if (!siteName) {
      // A row with numbers but no site name is a data problem; a fully-empty-ish
      // row is just noise. Only flag when it carries figures.
      if (![gross, salaries, opex].every(Number.isNaN)) {
        issues.push({ severity: "warning", code: "ROW_MISSING_SITE", row: sourceRow });
      }
      return;
    }

    // A labelled row with NO figures at all is a section header / note — skip
    // it safely rather than treating it as an invalid data row.
    if ([gross, salaries, opex].every(Number.isNaN)) return;

    // Required numeric validation (partial rows: some figures present, some bad).
    const invalid: FieldKey[] = [];
    if (Number.isNaN(gross)) invalid.push("grossCollection");
    if (Number.isNaN(salaries)) invalid.push("salaries");
    if (Number.isNaN(opex)) invalid.push("operatingExpenses");
    if (invalid.length > 0) {
      issues.push({ severity: "error", code: "ROW_INVALID_NUMBER", row: sourceRow, site: siteName, fields: invalid });
      return;
    }

    const contractRaw = map.contractValue !== null ? parseNumber(row[map.contractValue]) : NaN;
    const standardRaw = map.standard !== null ? parseNumber(row[map.standard]) : NaN;
    const netRaw = map.net !== null ? parseNumber(row[map.net]) : NaN;

    // Cross-check sheet Net vs deterministic Net (gross - salaries - opex).
    const sheetNet = Number.isNaN(netRaw) ? null : netRaw;
    if (sheetNet !== null && Math.abs(sheetNet - (gross - salaries - opex)) > 1) {
      issues.push({ severity: "warning", code: "NET_MISMATCH", row: sourceRow, site: siteName });
    }

    // Standard present as a column but empty for this row → warn + fallback.
    if (map.standard !== null && Number.isNaN(standardRaw)) {
      issues.push({ severity: "warning", code: "STANDARD_MISSING", row: sourceRow, site: siteName });
    }

    rows.push({
      siteName,
      clientName: map.clientName !== null ? String(row[map.clientName] ?? "").trim() || null : null,
      contractValue: Number.isNaN(contractRaw) ? 0 : contractRaw,
      grossCollection: gross,
      salaries,
      operatingExpenses: opex,
      standard: Number.isNaN(standardRaw) ? null : standardRaw,
      sheetNet,
      sourceRow,
    });
  });

  // No Standard column at all → single file-level warning (fallback is used).
  if (map.standard === null && rows.length > 0) {
    issues.push({ severity: "warning", code: "STANDARD_COLUMN_MISSING" });
  }

  if (rows.length === 0 && !issues.some((i) => i.severity === "error")) {
    issues.push({ severity: "error", code: "NO_VALID_ROWS" });
  }

  return { rows, rawRows, issues, columnMap: map, headerRow: headerIndex + 1 };
}

/** Service facade (named per the project requirement). */
export const excelBudgetParserService = {
  parse: parseBudgetWorkbook,
  normalizeHeader,
  parseNumber,
};
