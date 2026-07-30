import { NextResponse, type NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { connectDb } from "@/lib/db";
import { crudItemHandlers } from "@/lib/crud";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Product } from "@/models";
import { productSchema } from "@/schemas/domain";

const handlers = crudItemHandlers({
  model: Product,
  schema: productSchema,
  permission: "inventory:write",
  searchFields: ["productName", "sku", "barcode", "brand"],
  activityEntity: "product",
  uniqueFields: [{ field: "sku" }],
  includeDeleted: true,
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const { id } = await params;
  const shopId = allowed.session.user.shopId!;
  const existing = await Product.findOne(withShopFilter(shopId, { _id: id }));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.deletedAt) {
    await Product.findOneAndDelete(withShopFilter(shopId, { _id: id }));
    await logActivity({
      shopId,
      userId: allowed.session.user.id,
      userName: allowed.session.user.name,
      userEmail: allowed.session.user.email,
      userRole: allowed.session.user.role,
      action: "product.deleted",
      entity: "product",
      entityId: id,
      description: `Permanently deleted product: ${existing.productName}`,
      req,
    });
    return NextResponse.json({ ok: true, permanent: true });
  }

  await Product.findOneAndUpdate(withShopFilter(shopId, { _id: id }), {
    $set: {
      deletedAt: new Date(),
      deletedBy: allowed.session.user.id,
      updatedBy: allowed.session.user.id,
    },
  });
  await logActivity({
    shopId,
    userId: allowed.session.user.id,
    userName: allowed.session.user.name,
    userEmail: allowed.session.user.email,
    userRole: allowed.session.user.role,
    action: "product.deleted",
    entity: "product",
    entityId: id,
    description: `Soft-deleted product: ${existing.productName}`,
    req,
  });
  return NextResponse.json({ ok: true, permanent: false });
}
