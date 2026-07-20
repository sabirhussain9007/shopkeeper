import { redirect } from "next/navigation";
import { ActivityLogs } from "@/features/activity/activity-logs";
import { getRoleLandingPath } from "@/lib/access";
import { requirePermission } from "@/lib/rbac";

export default async function ActivityPage() {
  const session = await requirePermission("activity:read");
  if (session.user.role !== "admin") {
    redirect(getRoleLandingPath(session.user.role));
  }
  return <ActivityLogs />;
}
