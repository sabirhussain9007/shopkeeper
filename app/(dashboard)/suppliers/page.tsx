import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";

export default async function SuppliersPage() {
  await requirePermission("inventory:write");
  redirect("/vendors");
}
