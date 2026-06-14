import { CategoriesManager } from "@/features/categories/categories-manager";
import { requirePermission } from "@/lib/rbac";

export default async function CategoriesPage() {
  await requirePermission("inventory:write");
  return <CategoriesManager />;
}
