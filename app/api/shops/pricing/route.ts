import { NextResponse } from "next/server";
import { getPlatformPaymentAccounts, SHOP_PLANS } from "@/lib/saas";

export async function GET() {
  try {
    return NextResponse.json({
      plans: Object.values(SHOP_PLANS),
      paymentAccounts: getPlatformPaymentAccounts(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid payment configuration." },
      { status: 500 },
    );
  }
}
