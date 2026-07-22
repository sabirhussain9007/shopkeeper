import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Product, StockTransfer, Warehouse } from "@/models";
import { stockTransferSchema } from "@/schemas/domain";

export async function GET() {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const items = await StockTransfer.find(withShopFilter(allowed.session.user.shopId!, { deletedAt: { $exists: false } }))
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("product", "productName sku")
    .lean();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const parsed = stockTransferSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  await connectDb();
  const shopId = allowed.session.user.shopId!;
  const product = await Product.findOne(withShopFilter(shopId, { _id: parsed.data.product }));
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (product.quantity < parsed.data.quantity) {
    return NextResponse.json({ error: "Insufficient stock for transfer." }, { status: 409 });
  }
  const [fromWh, toWh] = await Promise.all([
    Warehouse.findOne(withShopFilter(shopId, { _id: parsed.data.fromWarehouse })),
    Warehouse.findOne(withShopFilter(shopId, { _id: parsed.data.toWarehouse })),
  ]);
  if (!fromWh || !toWh) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

  await StockTransfer.create({ ...parsed.data, shopId, status: "completed", createdBy: allowed.session.user.id });
  return NextResponse.json({ ok: true }, { status: 201 });
}
