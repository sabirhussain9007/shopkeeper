import { EmployeeProfile } from "@/features/employees/employee-profile";
import { requirePermission } from "@/lib/rbac";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("employees:write");
  const { id } = await params;
  return <EmployeeProfile employeeId={id} />;
}
