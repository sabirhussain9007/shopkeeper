import { AttendanceManager } from "@/features/attendance/attendance-manager";
import { requirePermission } from "@/lib/rbac";

export default async function AttendancePage() {
  await requirePermission("attendance:write");
  return <AttendanceManager />;
}
