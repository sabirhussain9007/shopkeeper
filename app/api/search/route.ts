import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Customer, Product, Sale, Supplier, User } from "@/models";

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("dashboard:read");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ products: [], customers: [], suppliers: [], sales: [], users: [] });

  await connectDb();
  const shopId = allowed.session.user.shopId!;
  const base = withShopFilter(shopId, { deletedAt: { $exists: false } });
  const regex = { $regex: q, $options: "i" };

  const [products, customers, suppliers, sales, users] = await Promise.all([
    Product.find({ ...base, $or: [{ productName: regex }, { sku: regex }, { barcode: regex }] }).limit(8).lean(),
    Customer.find({ ...base, $or: [{ name: regex }, { phone: regex }] }).limit(8).lean(),
    Supplier.find({ ...base, $or: [{ supplierName: regex }, { phone: regex }] }).limit(8).lean(),
    Sale.find({ ...base, invoiceNumber: regex }).limit(8).lean(),
    User.find({ ...base, $or: [{ name: regex }, { email: regex }] }).limit(8).lean(),
  ]);

  return NextResponse.json({ products, customers, suppliers, sales, users });
}
