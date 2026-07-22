import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { Product } from "@/models";
import { productSchema } from "@/schemas/domain";

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const { rows } = (await req.json()) as { rows?: Record<string, string>[] };
  if (!rows?.length) return NextResponse.json({ error: "No rows to import." }, { status: 422 });

  await connectDb();
  const shopId = allowed.session.user.shopId!;
  let created = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const parsed = productSchema.safeParse({
      productName: row.productName ?? row.name,
      sku: row.sku,
      barcode: row.barcode ?? "",
      brand: row.brand ?? "",
      unit: row.unit ?? "pcs",
      purchasePrice: row.purchasePrice ?? row.cost ?? 0,
      sellingPrice: row.sellingPrice ?? row.price ?? 0,
      taxRate: row.taxRate ?? 0,
      quantity: row.quantity ?? row.stock ?? 0,
      reorderLevel: row.reorderLevel ?? 5,
      description: row.description ?? "",
      status: "active",
    });
    if (!parsed.success) {
      errors.push(`Row ${i + 1}: validation failed`);
      continue;
    }
    try {
      await Product.create({ ...parsed.data, shopId, createdBy: allowed.session.user.id });
      created += 1;
    } catch {
      errors.push(`Row ${i + 1}: duplicate SKU or save error`);
    }
  }

  return NextResponse.json({ created, errors, total: rows.length });
}
