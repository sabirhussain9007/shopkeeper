import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Product } from "@/models";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const { id } = await params;
  const source = await Product.findOne(withShopFilter(allowed.session.user.shopId, { _id: id })).lean();
  if (!source) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  const clone = await Product.create({
    ...source,
    _id: undefined,
    shopId: allowed.session.user.shopId,
    sku: `${source.sku}-COPY-${Date.now().toString().slice(-4)}`,
    barcode: "",
    productName: `${source.productName} Copy`,
    createdBy: allowed.session.user.id,
    createdAt: undefined,
    updatedAt: undefined,
  });
  return NextResponse.json(clone, { status: 201 });
}
