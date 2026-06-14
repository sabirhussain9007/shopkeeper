import { PurchasesManager } from "@/features/purchases/purchases-manager";
import { requirePermission } from "@/lib/rbac";

export default async function PurchasesPage() {
  await requirePermission("inventory:write");
  return <PurchasesManager />;
}
