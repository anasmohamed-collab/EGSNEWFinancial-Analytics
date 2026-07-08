"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { LOCALE_COOKIE, LOCALE_NAMES, type Locale } from "@/i18n/config";

/** Toggle between Arabic (default) and English by setting the locale cookie. */
export function LanguageSwitcher() {
  const router = useRouter();
  const { locale } = useI18n();
  const next: Locale = locale === "ar" ? "en" : "ar";

  function switchTo() {
    // 1 year, root path.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={switchTo} title={LOCALE_NAMES[next]}>
      <Languages className="h-4 w-4" />
      {LOCALE_NAMES[next]}
    </Button>
  );
}
