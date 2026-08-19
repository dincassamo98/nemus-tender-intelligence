"use client";

import { signOut, useSession } from "next-auth/react";
import { RefreshButton } from "@/components/refresh-button";
import { Button } from "@/components/ui/button";

export function Topbar() {
  const { data: session } = useSession();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div />
      <div className="flex items-center gap-3">
        <RefreshButton />
        {session?.user ? (
          <div className="flex items-center gap-2 pl-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
              {session.user.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <span className="hidden text-sm text-foreground sm:inline">{session.user.name}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
              Sair
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
