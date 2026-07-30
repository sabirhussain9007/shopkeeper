import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { createShopSubscriptionCheckout, getStripeClient, isStripeConfigured } from "@/lib/payments/stripe";
import { Shop } from "@/models";

const bodySchema = z.object({
  shopId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId || !isStripeConfigured()) {
    return NextResponse.json({ ok: false });
  }
  try {
    const stripe = getStripeClient();
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    return NextResponse.json({
      ok: checkoutSession.payment_status === "paid",
      status: checkoutSession.payment_status,
    });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Online payments are not configured." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  await connectDb();
  const shop = await Shop.findOne({ _id: parsed.data.shopId, deletedAt: { $exists: false } });
  if (!shop) return NextResponse.json({ error: "Shop not found." }, { status: 404 });
  if (shop.paymentStatus === "approved" && shop.status === "active" && shop.gatewayTxnId) {
    return NextResponse.json({ error: "This shop subscription is already active." }, { status: 409 });
  }

  try {
    const checkout = await createShopSubscriptionCheckout({
      shopId: String(shop._id),
      plan: shop.plan as "monthly" | "yearly",
      customerEmail: shop.ownerEmail,
      shopName: shop.name,
      mode: shop.status === "active" || shop.status === "expired" ? "renewal" : "registration",
    });
    return NextResponse.json(checkout);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start checkout." },
      { status: 500 },
    );
  }
}
