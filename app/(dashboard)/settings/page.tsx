import { SettingsManager } from "@/features/settings/settings-manager";
import { requirePermission } from "@/lib/rbac";

export default async function SettingsPage() {
  await requirePermission("settings:write");
  return <SettingsManager />;
}
