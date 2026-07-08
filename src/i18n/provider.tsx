"use client";

import { createContext, useContext } from "react";
import type { Locale } from "./config";
import type { Dictionary } from "./index";

export interface I18nValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  dict: Dictionary;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  value,
  children,
}: {
  value: I18nValue;
  children: React.ReactNode;
}) {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the active locale, direction, and dictionary in a client component. */
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
