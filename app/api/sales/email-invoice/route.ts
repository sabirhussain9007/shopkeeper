import { NextResponse, type NextRequest } from "next/server";
import { invoiceEmail } from "@/lib/email";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { currency } from "@/lib/utils";
import { Sale } from "@/models";

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("reports:read");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const { saleId, email } = (await req.json()) as { saleId?: string; email?: string };
  if (!saleId || !email) return NextResponse.json({ error: "saleId and email required" }, { status: 422 });

  await connectDb();
  const sale = await Sale.findOne(withShopFilter(allowed.session.user.shopId!, { _id: saleId })).lean();
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  await invoiceEmail(email, sale.invoiceNumber, currency(sale.grandTotal));
  return NextResponse.json({ message: "Invoice email sent." });
}
