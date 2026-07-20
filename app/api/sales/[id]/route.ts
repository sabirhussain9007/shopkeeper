import { NextResponse, type NextRequest } from "next/server";
import { logActivityFromSession } from "@/lib/activity";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Sale } from "@/models";
import { saleSchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: Sale,
  schema: saleSchema,
  permission: "pos:write",
  searchFields: ["invoiceNumber", "notes"],
  activityEntity: "sale",
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("pos:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const { id } = await ctx.params;
  const deleted = await Sale.findOneAndUpdate(
    withShopFilter(allowed.session.user.shopId, { _id: id, deletedAt: { $exists: false } }),
    { $set: { deletedAt: new Date(), deletedBy: allowed.session.user.id } },
    { new: true },
  );
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logActivityFromSession(
    allowed.session,
    {
      action: "sale.deleted",
      entity: "sale",
      entityId: id,
      module: "POS",
      description: `Sale deleted: ${deleted.invoiceNumber}`,
    },
    req,
  );
  return NextResponse.json({ ok: true });
}
