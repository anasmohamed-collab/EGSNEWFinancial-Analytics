/**
 * excel.ts
 * -------------------------------------------------------------------------
 * Parse an uploaded monthly budget workbook into normalized site rows.
 *
 * Expected sheet shape (one row per security site):
 *
 *   Site Name | Client | Contract Value | Gross Collection | Salaries |
 *   Operating Expenses | Standard
 *
 * Header matching is tolerant: case-insensitive, ignores punctuation and
 * extra spaces, and accepts common aliases. Numeric cells may contain commas,
 * currency symbols, or parentheses for negatives.
 *
 * NOTE ON THE 14%: per the business rule, if the 14% value already appears as
 * an operating expense in the sheet, it is left inside `operatingExpenses` and
 * therefore already affects net. We read Operating Expenses exactly as given.
 */
import * as XLSX from "xlsx";

export interface ParsedSiteRow {
  siteName: string;
  clientName: string | null;
  contractValue: number;
  grossCollection: number;
  salaries: number;
  operatingExpenses: number;
  /** Standard as read from the sheet (may be 0 / null if the sheet omits it). */
  standard: number | null;
  /** 1-based row number in the source sheet, for error messages. */
  sourceRow: number;
}

export interface ParseResult {
  rows: ParsedSiteRow[];
  /** Raw rows exactly as read (array of objects keyed by original headers). */
  rawRows: Record<string, unknown>[];
  errors: string[];
  /** Which source column was matched to each logical field (for diagnostics). */
  columnMap: Record<string, string | null>;
}

/** Logical fields and their accepted header aliases (normalized form). */
const FIELD_ALIASES: Record<string, string[]> = {
  siteName: ["site name", "site", "project", "project name", "location", "unit"],
  clientName: ["client", "client name", "customer", "customer name"],
  contractValue: ["contract value", "contract", "contract amount", "contract val"],
  grossCollection: [
    "gross collection",
    "collection",
    "gross collections",
    "collections",
    "gross",
    "revenue",
    "total collection",
  ],
  salaries: ["salaries", "salary", "wages", "payroll"],
  operatingExpenses: [
    "operating expenses",
    "operating expense",
    "opex",
    "expenses",
    "operating",
    "operation expenses",
    "operational expenses",
  ],
  standard: ["standard", "target", "standard target", "std", "budget target"],
};

const REQUIRED_FIELDS = [
  "siteName",
  "contractValue",
  "grossCollection",
  "salaries",
  "operatingExpenses",
] as const;

/** Normalize a header string for matching. */
function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .toLowerCase()
    .replace(/[%()\/\\.,:_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse a possibly-messy numeric cell into a number. Returns NaN if unparsable. */
export function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return NaN;
  if (typeof value === "number") return value;
  let s = String(value).trim();
  if (s === "" || s === "-" || s === "—") return NaN;
  // Parentheses denote negatives: (1,234) -> -1234
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  // Strip everything except digits, dot and minus.
  s = s.replace(/[^0-9.\-]/g, "");
  if (s === "" || s === "-" || s === ".") return NaN;
  const n = Number(s);
  if (Number.isNaN(n)) return NaN;
  return negative ? -n : n;
}

/**
 * Build a map from logical field -> actual header string present in the sheet.
 */
function buildColumnMap(headers: string[]): Record<string, string | null> {
  const normalizedToOriginal = new Map<string, string>();
  for (const h of headers) {
    normalizedToOriginal.set(normalizeHeader(h), h);
  }

  const map: Record<string, string | null> = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    let matched: string | null = null;
    // Exact normalized match first.
    for (const alias of aliases) {
      if (normalizedToOriginal.has(alias)) {
        matched = normalizedToOriginal.get(alias)!;
        break;
      }
    }
    // Fallback: contains match (e.g. "site name (branch)").
    if (!matched) {
      for (const [norm, original] of normalizedToOriginal) {
        if (aliases.some((a) => norm.includes(a))) {
          matched = original;
          break;
        }
      }
    }
    map[field] = matched;
  }
  return map;
}

/**
 * Parse a workbook buffer. Reads the first worksheet.
 */
export function parseBudgetWorkbook(buffer: ArrayBuffer | Buffer): ParseResult {
  const errors: string[] = [];
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      rawRows: [],
      errors: ["The workbook contains no worksheets."],
      columnMap: {},
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });

  if (rawRows.length === 0) {
    return {
      rows: [],
      rawRows: [],
      errors: [`Worksheet "${sheetName}" has no data rows.`],
      columnMap: {},
    };
  }

  const headers = Object.keys(rawRows[0]);
  const columnMap = buildColumnMap(headers);

  // Validate required columns exist.
  const missingColumns = REQUIRED_FIELDS.filter((f) => !columnMap[f]);
  if (missingColumns.length > 0) {
    errors.push(
      `Missing required column(s): ${missingColumns.join(", ")}. ` +
        `Detected headers: ${headers.join(", ")}.`,
    );
    return { rows: [], rawRows, errors, columnMap };
  }

  const rows: ParsedSiteRow[] = [];
  rawRows.forEach((raw, i) => {
    const sourceRow = i + 2; // +1 for header, +1 for 1-based
    const siteName = String(raw[columnMap.siteName!] ?? "").trim();

    // Skip fully blank rows and obvious total/footer rows.
    const isBlank = Object.values(raw).every(
      (v) => v === null || String(v).trim() === "",
    );
    if (isBlank) return;
    if (/^(total|totals|grand total|sum)\b/i.test(siteName)) return;

    if (!siteName) {
      errors.push(`Row ${sourceRow}: missing Site Name — row skipped.`);
      return;
    }

    const contractValue = parseNumber(raw[columnMap.contractValue!]);
    const grossCollection = parseNumber(raw[columnMap.grossCollection!]);
    const salaries = parseNumber(raw[columnMap.salaries!]);
    const operatingExpenses = parseNumber(raw[columnMap.operatingExpenses!]);
    const standardRaw = columnMap.standard
      ? parseNumber(raw[columnMap.standard])
      : NaN;

    const rowErrors: string[] = [];
    if (Number.isNaN(grossCollection))
      rowErrors.push("Gross Collection is not a valid number");
    if (Number.isNaN(salaries)) rowErrors.push("Salaries is not a valid number");
    if (Number.isNaN(operatingExpenses))
      rowErrors.push("Operating Expenses is not a valid number");

    if (rowErrors.length > 0) {
      errors.push(`Row ${sourceRow} ("${siteName}"): ${rowErrors.join("; ")}.`);
      return;
    }

    rows.push({
      siteName,
      clientName: columnMap.clientName
        ? String(raw[columnMap.clientName] ?? "").trim() || null
        : null,
      contractValue: Number.isNaN(contractValue) ? 0 : contractValue,
      grossCollection,
      salaries,
      operatingExpenses,
      standard: Number.isNaN(standardRaw) ? null : standardRaw,
      sourceRow,
    });
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No valid site rows were found in the sheet.");
  }

  return { rows, rawRows, errors, columnMap };
}
