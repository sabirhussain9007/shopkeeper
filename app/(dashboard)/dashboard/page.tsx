import { SummaryDashboard } from "@/components/dashboard/summary-dashboard";
import { requirePermission } from "@/lib/rbac";
import { getDashboardSummary } from "@/lib/summary";

export default async function DashboardPage() {
  await requirePermission("dashboard:read");
  const summary = await getDashboardSummary();
  return <SummaryDashboard summary={summary} />;
}
