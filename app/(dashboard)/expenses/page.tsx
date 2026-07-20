import { ExpensesManager } from "@/features/expenses/expenses-manager";
import { requirePermission } from "@/lib/rbac";

export default async function ExpensesPage() {
  await requirePermission("expenses:write");
  return <ExpensesManager />;
}
