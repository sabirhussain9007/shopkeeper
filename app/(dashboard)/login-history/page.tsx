import { LoginHistory } from "@/features/activity/login-history";
import { requirePermission } from "@/lib/rbac";

export default async function LoginHistoryPage() {
  await requirePermission("activity:read");
  return <LoginHistory />;
}
