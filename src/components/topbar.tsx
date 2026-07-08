"use client";

import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/i18n/provider";

export function Topbar({
  userName,
  userRole,
}: {
  userName: string;
  userRole: string;
}) {
  const router = useRouter();
  const { dict } = useI18n();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <LanguageSwitcher />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{userRole}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          {dict.common.signOut}
        </Button>
      </div>
    </header>
  );
}
