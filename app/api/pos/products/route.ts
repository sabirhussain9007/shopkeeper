import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { Product } from "@/models";
import { paginationSchema } from "@/schemas/domain";

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("pos:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  await connectDb();
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const params = paginationSchema.parse(query);

  const filter: Record<string, unknown> = {
    deletedAt: { $exists: false },
    status: "active",
    quantity: { $gt: 0 },
  };

  if (params.q) {
    filter.$or = [
      { productName: { $regex: params.q, $options: "i" } },
      { sku: { $regex: params.q, $options: "i" } },
      { barcode: { $regex: params.q, $options: "i" } },
    ];
  }

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ productName: 1 }).skip(skip).limit(params.limit).lean(),
    Product.countDocuments(filter),
  ]);

  return NextResponse.json({ items, total, page: params.page, pages: Math.ceil(total / params.limit) });
}
