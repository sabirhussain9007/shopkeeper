import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/rbac";
import { getActiveSettings } from "@/lib/settings";

export async function GET() {
  const allowed = await requireApiPermission("pos:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const setting = await getActiveSettings(allowed.session.user.shopId);

  return NextResponse.json({
    businessName: setting.businessName ?? "Shopkeeper",
    logo: setting.logo ?? "",
    address: setting.address ?? "",
    phone: setting.phone ?? "",
    email: setting.email ?? "",
    gstVatNumber: setting.gstVatNumber ?? "",
    ntn: setting.ntn ?? "",
    receiptSize: setting.receiptSize ?? "80mm",
    receiptLogoAlign: setting.receiptLogoAlign ?? "center",
    receiptHeader: setting.receiptHeader ?? "",
    receiptFooter: setting.receiptFooter ?? "",
    thankYouMessage: setting.thankYouMessage ?? "Thank you for shopping with us.",
  });
}
