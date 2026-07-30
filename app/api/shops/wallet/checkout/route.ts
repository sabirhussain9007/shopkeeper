import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { createEasyPaisaCheckout, isEasyPaisaGatewayConfigured } from "@/lib/payments/easypaisa-gateway";
import { createJazzCashCheckout, isJazzCashConfigured } from "@/lib/payments/jazzcash";
import { buildWalletPaymentRef, isWalletGatewayConfigured, type WalletProvider } from "@/lib/payments/wallet-app";
import { resolvePlatformPaymentAccounts } from "@/lib/payment-env";
import { Shop } from "@/models";

const bodySchema = z.object({
  shopId: z.string().min(1),
  provider: z.enum(["easypaisa", "jazzcash"]),
});

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get("shopId");
  const provider = req.nextUrl.searchParams.get("provider") as WalletProvider | null;
  if (!shopId || !provider) {
    return NextResponse.json({ error: "shopId and provider are required." }, { status: 422 });
  }

  await connectDb();
  const shop = await Shop.findOne({ _id: shopId, deletedAt: { $exists: false } });
  if (!shop) return NextResponse.json({ error: "Shop not found." }, { status: 404 });

  const accounts = resolvePlatformPaymentAccounts();
  const account =
    provider === "easypaisa"
      ? accounts.ok
        ? accounts.accounts.easypaisa
        : null
      : accounts.ok
        ? accounts.accounts.jazzcash
        : null;

  return NextResponse.json({
    shopId: String(shop._id),
    shopName: shop.name,
    plan: shop.plan,
    planAmount: shop.planAmount,
    provider,
    gatewayConfigured: isWalletGatewayConfigured(provider),
    account,
  });
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const { shopId, provider } = parsed.data;
  if (!isWalletGatewayConfigured(provider)) {
    return NextResponse.json({ error: `${provider} online gateway is not configured.` }, { status: 503 });
  }

  await connectDb();
  const shop = await Shop.findOne({ _id: shopId, deletedAt: { $exists: false } });
  if (!shop) return NextResponse.json({ error: "Shop not found." }, { status: 404 });

  const txnRef = buildWalletPaymentRef(String(shop._id));
  shop.paymentMethod = provider;
  shop.paymentReference = `${provider.toUpperCase()}_PENDING`;
  await shop.save();

  try {
    if (provider === "jazzcash" && isJazzCashConfigured()) {
      const checkout = createJazzCashCheckout({
        shopId: String(shop._id),
        plan: shop.plan as "monthly" | "yearly",
        shopName: shop.name,
        txnRef,
      });
      return NextResponse.json({ type: "gateway", ...checkout });
    }

    if (provider === "easypaisa" && isEasyPaisaGatewayConfigured()) {
      const checkout = createEasyPaisaCheckout({
        shopId: String(shop._id),
        plan: shop.plan as "monthly" | "yearly",
        orderRef: txnRef,
        mobile: shop.ownerPhone || undefined,
        email: shop.ownerEmail,
      });
      return NextResponse.json({ type: "gateway", ...checkout });
    }

    return NextResponse.json({ error: "Wallet gateway is not configured." }, { status: 503 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start wallet checkout." },
      { status: 500 },
    );
  }
}
