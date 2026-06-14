import { SuppliersManager } from "@/features/suppliers/suppliers-manager";
import { requirePermission } from "@/lib/rbac";

export default async function SuppliersPage() {
  await requirePermission("inventory:write");
  return <SuppliersManager />;
}
