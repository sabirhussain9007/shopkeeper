import { AccountingManager } from "@/features/accounting/accounting-manager";
import { requirePermission } from "@/lib/rbac";

export default async function AccountingPage() {
  await requirePermission("reports:read");
  return <AccountingManager />;
}
