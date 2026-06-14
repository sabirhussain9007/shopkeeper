import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { Setting } from "@/models";

export async function GET() {
  const allowed = await requireApiPermission("pos:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  await connectDb();
  const setting = await Setting.findOne({ deletedAt: { $exists: false } }).sort({ updatedAt: -1 }).lean();

  return NextResponse.json({
    businessName: setting?.businessName ?? "Shopkeeper",
    logo: setting?.logo ?? "",
    address: setting?.address ?? "",
    phone: setting?.phone ?? "",
    email: setting?.email ?? "",
    gstVatNumber: setting?.gstVatNumber ?? "",
    ntn: setting?.ntn ?? "",
    receiptSize: setting?.receiptSize ?? "80mm",
    receiptLogoAlign: setting?.receiptLogoAlign ?? "center",
    receiptHeader: setting?.receiptHeader ?? "",
    receiptFooter: setting?.receiptFooter ?? "",
    thankYouMessage: setting?.thankYouMessage ?? "Thank you for shopping with us.",
  });
}
