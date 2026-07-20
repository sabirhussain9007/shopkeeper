import { SettingsManager } from "@/features/settings/settings-manager";
import { requirePermission } from "@/lib/rbac";
import type { ShopRole } from "@/types";

export default async function SettingsPage() {
  const session = await requirePermission("settings:write");
  return <SettingsManager currentRole={(session.user.role as ShopRole) || "admin"} />;
}
