import { VendorsManager } from "@/features/vendors/vendors-manager";
import { requirePermission } from "@/lib/rbac";

export default async function VendorsPage() {
  await requirePermission("inventory:write");
  return <VendorsManager />;
}
