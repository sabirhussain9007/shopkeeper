"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SuperAdminSignOut({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={cn("border border-white/15 bg-white/5 text-emerald-50 hover:bg-white/10 hover:text-white", className)}
      onClick={() => void signOut({ callbackUrl: "/" })}
    >
      Sign out
    </Button>
  );
}
