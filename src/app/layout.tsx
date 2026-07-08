import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/i18n/provider";
import { getI18n } from "@/i18n/server";

export const metadata: Metadata = {
  title: "نظام إيجلز للموازنات والتحليل المالي",
  description:
    "تحليل الموازنات الشهرية لمواقع الأمن — الصافي الفعلي مقابل الاستاندرد لمجموعة إيجلز للأمن.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { locale, dir, dict } = await getI18n();

  return (
    <html lang={locale} dir={dir}>
      <body className="antialiased">
        <I18nProvider value={{ locale, dir, dict }}>{children}</I18nProvider>
      </body>
    </html>
  );
}
