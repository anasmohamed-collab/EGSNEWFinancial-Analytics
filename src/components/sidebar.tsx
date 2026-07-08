"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Crown,
  Sparkles,
  LayoutDashboard,
  TrendingUp,
  Upload,
  Building2,
  Target,
  Receipt,
  FileText,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Crown,
  Sparkles,
  LayoutDashboard,
  TrendingUp,
  Upload,
  Building2,
  Target,
  Receipt,
  FileText,
};

export function Sidebar() {
  const pathname = usePathname();
  const { dict } = useI18n();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-e bg-card md:flex">
      <div className="flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Shield className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">{dict.common.appName}</p>
          <p className="text-xs text-muted-foreground">{dict.common.tagline}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboard;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {dict.nav[item.key]}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4 text-xs text-muted-foreground">
        {dict.common.companyName}
      </div>
    </aside>
  );
}
