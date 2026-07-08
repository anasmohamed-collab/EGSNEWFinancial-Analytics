/**
 * Locale-aware formatting.
 *
 * DECISION: numbers use Latin (Western-Arabic) digits 0–9 even in Arabic,
 * matching Egyptian corporate finance convention (easier board readability).
 * To switch to Arabic-Indic digits, change NUMBER_LOCALE to "ar-EG".
 */
import type { Locale } from "./config";

const NUMBER_LOCALE = "en-US";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENCY_SYMBOL: Record<Locale, string> = {
  ar: "ج.م",
  en: "EGP",
};

export function monthName(month: number, locale: Locale): string {
  const arr = locale === "ar" ? MONTHS_AR : MONTHS_EN;
  return arr[month - 1] ?? String(month);
}

export function periodLabel(month: number, year: number, locale: Locale): string {
  return `${monthName(month, locale)} ${year}`;
}

/** Full date with Arabic month name and Latin digits, e.g. "8 يوليو 2026". */
export function formatDate(date: Date, locale: Locale): string {
  return `${date.getDate()} ${monthName(date.getMonth() + 1, locale)} ${date.getFullYear()}`;
}

export function currencySymbol(locale: Locale): string {
  return CURRENCY_SYMBOL[locale];
}

const intCompact = new Intl.NumberFormat(NUMBER_LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1,
});

function intFmt() {
  return new Intl.NumberFormat(NUMBER_LOCALE, { maximumFractionDigits: 0 });
}

/** Money with the locale currency label suffixed. */
export function formatCurrency(
  value: number | null | undefined,
  locale: Locale,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${intFmt().format(Math.round(value))} ${CURRENCY_SYMBOL[locale]}`;
}

/** Signed money for variances (+/−). */
export function formatSigned(
  value: number | null | undefined,
  locale: Locale,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${intFmt().format(Math.abs(Math.round(value)))} ${CURRENCY_SYMBOL[locale]}`;
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return intCompact.format(value);
}

/** Percentage with one decimal. Latin digits, trailing %. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}
