import { InventoryManager } from "@/features/inventory/inventory-manager";
import { requirePermission } from "@/lib/rbac";

export default async function InventoryPage() {
  await requirePermission("inventory:write");
  return <InventoryManager />;
}
