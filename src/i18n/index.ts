import ar, { type Dictionary } from "./dictionaries/ar";
import en from "./dictionaries/en";
import type { Locale } from "./config";

const DICTIONARIES: Record<Locale, Dictionary> = { ar, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? ar;
}

export type { Dictionary };
