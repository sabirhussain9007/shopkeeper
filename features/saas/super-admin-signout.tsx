"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SuperAdminSignOut() {
  return (
    <Button type="button" size="sm" variant="secondary" onClick={() => void signOut({ callbackUrl: "/" })}>
      Sign out
    </Button>
  );
}
