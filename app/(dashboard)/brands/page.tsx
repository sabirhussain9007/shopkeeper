import { BrandsManager } from "@/features/brands/brands-manager";
import { requirePermission } from "@/lib/rbac";

export default async function BrandsPage() {
  await requirePermission("inventory:write");
  return <BrandsManager />;
}
