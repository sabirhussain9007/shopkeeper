import { CustomersManager } from "@/features/customers/customers-manager";
import { requirePermission } from "@/lib/rbac";

export default async function CustomersPage() {
  await requirePermission("ledger:write");
  return <CustomersManager />;
}
