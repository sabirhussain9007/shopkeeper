import { BankManager } from "@/features/bank/bank-manager";
import { requirePermission } from "@/lib/rbac";

export default async function BankPage() {
  await requirePermission("reports:read");
  return <BankManager />;
}