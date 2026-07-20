import { EmployeesManager } from "@/features/employees/employees-manager";
import { requirePermission } from "@/lib/rbac";

export default async function EmployeesPage() {
  await requirePermission("employees:write");
  return <EmployeesManager />;
}
