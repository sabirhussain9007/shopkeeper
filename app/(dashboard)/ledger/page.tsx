import { LedgerManager } from "@/features/ledger/ledger-manager";
import { requirePermission } from "@/lib/rbac";

export default async function LedgerPage() {
  await requirePermission("ledger:write");
  return <LedgerManager />;
}
