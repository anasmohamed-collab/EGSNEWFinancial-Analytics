import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Number / currency / date formatting now lives in `@/i18n/format` because it
// is locale-aware (Arabic-first). Import from there.
