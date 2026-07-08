import "server-only";
import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  DIR,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "./config";
import { getDictionary, type Dictionary } from "./index";

/** Read the active locale from the cookie (defaults to Arabic). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export interface I18nContextValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  dict: Dictionary;
}

/** Resolve locale + direction + dictionary for a server component. */
export async function getI18n(): Promise<I18nContextValue> {
  const locale = await getLocale();
  return { locale, dir: DIR[locale], dict: getDictionary(locale) };
}
