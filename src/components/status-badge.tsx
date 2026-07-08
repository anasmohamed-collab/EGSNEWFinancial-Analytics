"use client";

import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/constants";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { PerformanceStatus } from "@/lib/calculations";

export function StatusBadge({ status }: { status: PerformanceStatus }) {
  const { dict } = useI18n();
  const meta = STATUS_META[status];
  return (
    <Badge className={cn(meta.badgeClass, "gap-1.5")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {dict.status[status]}
    </Badge>
  );
}
