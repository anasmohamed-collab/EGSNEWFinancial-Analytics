"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";
import { MONTH_VALUES } from "@/lib/constants";
import { useI18n } from "@/i18n/provider";
import { monthName } from "@/i18n/format";

interface PeriodSelectorProps {
  month: number;
  year: number;
  availablePeriods: { month: number; year: number }[];
  /** Base path to push to (defaults to /dashboard). */
  basePath?: string;
}

export function PeriodSelector({
  month,
  year,
  availablePeriods,
  basePath = "/dashboard",
}: PeriodSelectorProps) {
  const router = useRouter();
  const { locale } = useI18n();

  const years = Array.from(new Set(availablePeriods.map((p) => p.year))).sort(
    (a, b) => b - a,
  );
  const monthsForYear = availablePeriods
    .filter((p) => p.year === year)
    .map((p) => p.month);
  const monthOptions = MONTH_VALUES.filter(
    (m) => monthsForYear.length === 0 || monthsForYear.includes(m),
  );

  function go(nextMonth: number, nextYear: number) {
    router.push(`${basePath}?month=${nextMonth}&year=${nextYear}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="month"
        value={month}
        onChange={(e) => go(Number(e.target.value), year)}
        className="w-40"
      >
        {monthOptions.map((m) => (
          <option key={m} value={m}>
            {monthName(m, locale)}
          </option>
        ))}
      </Select>
      <Select
        aria-label="year"
        value={year}
        onChange={(e) => {
          const ny = Number(e.target.value);
          const monthsForNewYear = availablePeriods
            .filter((p) => p.year === ny)
            .map((p) => p.month);
          const nm = monthsForNewYear.includes(month)
            ? month
            : Math.max(...monthsForNewYear);
          go(nm, ny);
        }}
        className="w-28"
      >
        {(years.length ? years : [year]).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  );
}
