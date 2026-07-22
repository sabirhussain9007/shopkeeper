import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { StockAdjustment } from "@/models";
import { paginationSchema } from "@/schemas/domain";

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const shopId = allowed.session.user.shopId!;
  const params = paginationSchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  const filter = withShopFilter(shopId, { deletedAt: { $exists: false } });
  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    StockAdjustment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.limit).populate("product", "productName sku").lean(),
    StockAdjustment.countDocuments(filter),
  ]);
  return NextResponse.json({ items, total, page: params.page, pages: Math.ceil(total / params.limit) });
}
