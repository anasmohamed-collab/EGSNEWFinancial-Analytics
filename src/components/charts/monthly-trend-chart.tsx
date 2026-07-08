"use client";

import {
  CartesianGrid,
  Line,
  ComposedChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { useI18n } from "@/i18n/provider";
import { formatCompact, formatCurrency, monthName } from "@/i18n/format";

interface Datum {
  month: number;
  year: number;
  net: number;
  standard: number;
}

/** Monthly net trend (bars) with the standard target overlaid as a line. */
export function MonthlyTrendChart({ data }: { data: Datum[] }) {
  const { dict, locale, dir } = useI18n();
  const chartData = data.map((d) => ({
    label: `${monthName(d.month, locale)} ${String(d.year).slice(2)}`,
    net: Math.round(d.net),
    standard: Math.round(d.standard),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="label"
          reversed={dir === "rtl"}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          orientation={dir === "rtl" ? "right" : "left"}
          tickFormatter={(v) => formatCompact(v)}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <Tooltip
          formatter={(value: number, name) => [formatCurrency(value, locale), name]}
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="net" name={dict.metrics.net} fill="hsl(222 47% 40%)" radius={[3, 3, 0, 0]} barSize={36} />
        <Line dataKey="standard" name={dict.metrics.standard} stroke="hsl(0 72% 51%)" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
