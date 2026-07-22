import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Category } from "@/models";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const { id } = await params;
  const restored = await Category.findOneAndUpdate(
    withShopFilter(allowed.session.user.shopId, { _id: id }),
    { $unset: { deletedAt: "", deletedBy: "" }, $set: { updatedBy: allowed.session.user.id } },
    { new: true },
  );
  if (!restored) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logActivity({
    shopId: allowed.session.user.shopId!,
    userId: allowed.session.user.id,
    userName: allowed.session.user.name,
    userEmail: allowed.session.user.email,
    userRole: allowed.session.user.role,
    action: "category.restored",
    entity: "category",
    entityId: id,
    description: "Restored category",
  });
  return NextResponse.json(restored);
}
