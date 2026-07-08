/**
 * i18n configuration.
 * Arabic is the DEFAULT and priority language; English is supported as a
 * secondary option. Direction is derived from the locale.
 */
export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ar";

export const LOCALE_COOKIE = "egs_locale";

/** Text direction per locale. */
export const DIR: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

/** Native language names for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
