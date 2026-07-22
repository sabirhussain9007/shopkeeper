import { CustomerGroupsManager } from "@/features/customer-groups/customer-groups-manager";
import { requirePermission } from "@/lib/rbac";

export default async function CustomerGroupsPage() {
  await requirePermission("ledger:write");
  return <CustomerGroupsManager />;
}
