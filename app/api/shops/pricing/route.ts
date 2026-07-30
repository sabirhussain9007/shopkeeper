import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { isEasyPaisaGatewayConfigured } from "@/lib/payments/easypaisa-gateway";
import { isJazzCashConfigured } from "@/lib/payments/jazzcash";
import { resolvePlatformPaymentAccounts } from "@/lib/payment-env";
import { SHOP_PLANS } from "@/lib/saas";

export async function GET() {
  const paymentConfig = resolvePlatformPaymentAccounts();

  return NextResponse.json({
    plans: Object.values(SHOP_PLANS),
    paymentAccounts: paymentConfig.ok ? paymentConfig.accounts : null,
    paymentConfigError: paymentConfig.ok ? undefined : paymentConfig.error,
    stripeEnabled: isStripeConfigured(),
    walletGateways: {
      easypaisa: isEasyPaisaGatewayConfigured(),
      jazzcash: isJazzCashConfigured(),
    },
  });
}
