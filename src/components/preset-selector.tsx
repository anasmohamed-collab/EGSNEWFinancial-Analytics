"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { MultiMonthPreset } from "@/lib/analytics";

const ORDER: Exclude<MultiMonthPreset, "year" | "custom">[] = [
  "last4",
  "last6",
  "last12",
  "all",
];

export function PresetSelector({ active }: { active: MultiMonthPreset }) {
  const router = useRouter();
  const { dict } = useI18n();

  return (
    <div className="inline-flex rounded-md border bg-card p-1">
      {ORDER.map((value) => (
        <button
          key={value}
          onClick={() => router.push(`/analysis?preset=${value}`)}
          className={cn(
            "rounded px-3 py-1.5 text-sm font-medium transition-colors",
            active === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {dict.analysis.presets[value]}
        </button>
      ))}
    </div>
  );
}
