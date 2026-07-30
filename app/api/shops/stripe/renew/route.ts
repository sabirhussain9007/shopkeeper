import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { createShopSubscriptionCheckout, getStripeClient, isStripeConfigured } from "@/lib/payments/stripe";
import { Shop } from "@/models";

const bodySchema = z.object({
  plan: z.enum(["monthly", "yearly"]).optional(),
});

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Online payments are not configured." }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.shopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  await connectDb();
  const shop = await Shop.findById(session.user.shopId);
  if (!shop) return NextResponse.json({ error: "Shop not found." }, { status: 404 });

  if (parsed.data.plan) {
    shop.plan = parsed.data.plan;
    shop.planAmount = parsed.data.plan === "yearly" ? 11000 : 1000;
    shop.paymentStatus = "pending";
    shop.paymentReference = "STRIPE_PENDING";
    shop.paymentMethod = "stripe";
    await shop.save();
  }

  try {
    const checkout = await createShopSubscriptionCheckout({
      shopId: String(shop._id),
      plan: shop.plan as "monthly" | "yearly",
      customerEmail: shop.ownerEmail,
      shopName: shop.name,
      mode: "renewal",
    });
    return NextResponse.json(checkout);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start checkout." },
      { status: 500 },
    );
  }
}

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
