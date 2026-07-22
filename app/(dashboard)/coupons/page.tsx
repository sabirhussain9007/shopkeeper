import { CouponsManager } from "@/features/coupons/coupons-manager";
import { requirePermission } from "@/lib/rbac";

export default async function CouponsPage() {
  await requirePermission("pos:write");
  return <CouponsManager />;
}
