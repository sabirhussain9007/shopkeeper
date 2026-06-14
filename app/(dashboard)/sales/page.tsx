import { SalesManager } from "@/features/sales/sales-manager";
import { requirePermission } from "@/lib/rbac";

export default async function SalesPage() {
  await requirePermission("reports:read");
  return <SalesManager />;
}
