import { ReportsManager } from "@/features/reports/reports-manager";
import { requirePermission } from "@/lib/rbac";

export default async function ReportsPage() {
  await requirePermission("reports:read");
  return <ReportsManager />;
}
