import { WarehousesManager } from "@/features/warehouses/warehouses-manager";
import { requirePermission } from "@/lib/rbac";

export default async function WarehousesPage() {
  await requirePermission("inventory:write");
  return <WarehousesManager />;
}
