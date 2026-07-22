import { PurchasesManager } from "@/features/purchases/purchases-manager";
import { requirePermission } from "@/lib/rbac";

export default async function SpotPurchasesPage() {
  await requirePermission("inventory:write");
  return <PurchasesManager variant="spot" />;
}
