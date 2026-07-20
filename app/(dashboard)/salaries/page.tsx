import { SalariesManager } from "@/features/salaries/salaries-manager";
import { requirePermission } from "@/lib/rbac";

export default async function SalariesPage() {
  await requirePermission("salaries:write");
  return <SalariesManager />;
}
