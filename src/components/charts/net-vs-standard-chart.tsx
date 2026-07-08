"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/i18n/provider";
import { formatCompact, formatCurrency } from "@/i18n/format";

interface Datum {
  siteName: string;
  net: number;
  standard: number;
}

/** Grouped bar: Net vs Standard by site. Bars over standard are green. */
export function NetVsStandardChart({ data }: { data: Datum[] }) {
  const { dict, locale, dir } = useI18n();
  const chartData = data.map((d) => ({
    name: d.siteName.length > 16 ? d.siteName.slice(0, 15) + "…" : d.siteName,
    fullName: d.siteName,
    net: Math.round(d.net),
    standard: Math.round(d.standard),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="name"
          angle={-30}
          textAnchor="end"
          interval={0}
          height={60}
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
          labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName ?? _label}
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="standard" name={dict.metrics.standard} fill="hsl(var(--muted-foreground))" opacity={0.35} radius={[3, 3, 0, 0]} />
        <Bar dataKey="net" name={dict.metrics.net} radius={[3, 3, 0, 0]}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.net >= d.standard ? "hsl(152 60% 40%)" : "hsl(0 72% 51%)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
