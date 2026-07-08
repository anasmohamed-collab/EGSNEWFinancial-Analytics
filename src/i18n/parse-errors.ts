/**
 * Maps structured parser issues (codes + params) from the parser service into
 * localized, human-readable messages using the active dictionary. Keeps the
 * parser itself free of any UI/locale concerns.
 */
import type { Dictionary } from "./index";
import type {
  ParseIssue,
  ParseIssueCode,
  FieldKey,
} from "@/lib/services/excelBudgetParserService";

const CODE_TO_KEY: Record<ParseIssueCode, keyof Dictionary["upload"]["errors"]> = {
  NO_WORKSHEET: "noWorksheet",
  NO_DATA_ROWS: "noDataRows",
  NO_HEADER_ROW: "noHeaderRow",
  MISSING_COLUMNS: "missingColumns",
  ROW_MISSING_SITE: "rowMissingSite",
  ROW_INVALID_NUMBER: "rowInvalidNumber",
  NO_VALID_ROWS: "noValidRows",
  NET_MISMATCH: "netMismatch",
  STANDARD_MISSING: "standardMissing",
  STANDARD_COLUMN_MISSING: "standardColumnMissing",
  PROCESSING_ERROR: "processingError",
};

export function localizeParseIssue(dict: Dictionary, issue: ParseIssue): string {
  const template = dict.upload.errors[CODE_TO_KEY[issue.code]];
  const fieldNames = (keys?: FieldKey[]) =>
    (keys ?? []).map((k) => dict.upload.fields[k]).join("، ");

  return template
    .replaceAll("{row}", String(issue.row ?? ""))
    .replaceAll("{site}", issue.site ?? "")
    .replaceAll("{columns}", fieldNames(issue.columns))
    .replaceAll("{fields}", fieldNames(issue.fields))
    .replaceAll("{detected}", (issue.detected ?? []).join("، "));
}

/** Localize a list of issues, most-relevant (errors first) preserved. */
export function localizeParseIssues(dict: Dictionary, issues: ParseIssue[]): string[] {
  return issues.map((i) => localizeParseIssue(dict, i));
}
