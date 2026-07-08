"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Executive UX rule: detailed accounting tables are hidden by default and
 * revealed via a "عرض التفاصيل" button.
 */
export function DetailsToggle({
  children,
  defaultOpen = false,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { dict } = useI18n();

  return (
    <div>
      <Button variant="outline" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {open ? dict.common.hideDetails : dict.common.viewDetails}
      </Button>
      <div className={cn("mt-4", !open && "hidden")}>{children}</div>
    </div>
  );
}
