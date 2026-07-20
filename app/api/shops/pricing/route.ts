import { NextResponse } from "next/server";
import { getPlatformPaymentAccounts, SHOP_PLANS } from "@/lib/saas";

export async function GET() {
  return NextResponse.json({
    plans: Object.values(SHOP_PLANS),
    paymentAccounts: getPlatformPaymentAccounts(),
  });
}
