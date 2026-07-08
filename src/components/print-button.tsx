"use client";

import Link from "next/link";
import { Printer, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

/** Print toolbar for the executive report — hidden when printing. */
export function PrintButton() {
  const { dict } = useI18n();
  return (
    <div className="print:hidden mb-6 flex items-center justify-between">
      <Link href="/executive">
        <Button variant="ghost" size="sm">
          <ArrowRight className="h-4 w-4" />
          {dict.common.back}
        </Button>
      </Link>
      <Button onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        {dict.common.print} / {dict.common.exportPdf}
      </Button>
    </div>
  );
}
