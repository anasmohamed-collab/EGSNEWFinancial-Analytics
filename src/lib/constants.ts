import type { PerformanceStatus } from "./calculations";
import type { Dictionary } from "@/i18n";

/** Month values 1..12 for iteration; display names come from i18n/format. */
export const MONTH_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * Presentation colors for each performance status. Labels are resolved from
 * the dictionary (dict.status[...]) so they localize; only colors live here.
 */
export const STATUS_META: Record<
  PerformanceStatus,
  { badgeClass: string; dot: string }
> = {
  ABOVE_STANDARD: {
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  NEAR_STANDARD: {
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  BELOW_STANDARD: {
    badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  CRITICAL: {
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    dot: "bg-red-500",
  },
};

export function statusLabel(dict: Dictionary, status: PerformanceStatus): string {
  return dict.status[status];
}

export const EXPENSE_CATEGORIES = [
  "Office Salaries",
  "Uniforms",
  "Equipment",
  "Rent",
  "Administration",
  "Transportation",
  "Utilities",
  "Other",
] as const;

export const SITE_TYPES = [
  "Commercial",
  "Residential",
  "Industrial",
  "Government",
  "Retail",
  "Healthcare",
  "Education",
  "Other",
] as const;

/** Navigation. `key` indexes dict.nav; the Executive board is first (default). */
export const NAV_ITEMS = [
  { href: "/executive", key: "executive", icon: "Crown" },
  { href: "/dashboard", key: "dashboard", icon: "LayoutDashboard" },
  { href: "/analysis", key: "analysis", icon: "TrendingUp" },
  { href: "/upload", key: "upload", icon: "Upload" },
  { href: "/sites", key: "sites", icon: "Building2" },
  { href: "/standards", key: "standards", icon: "Target" },
  { href: "/expenses", key: "expenses", icon: "Receipt" },
  { href: "/reports", key: "reports", icon: "FileText" },
] as const;
