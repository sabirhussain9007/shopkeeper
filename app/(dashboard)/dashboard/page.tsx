import { SummaryDashboard } from "@/components/dashboard/summary-dashboard";
import { requirePermission } from "@/lib/rbac";
import { getDashboardSummary } from "@/lib/summary";

export default async function DashboardPage() {
  const session = await requirePermission("dashboard:read");
  const summary = await getDashboardSummary(session.user.shopId!);
  return <SummaryDashboard summary={summary} />;
}
