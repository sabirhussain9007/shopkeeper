import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { constructStripeEvent } from "@/lib/payments/stripe";
import { activateShopAfterGatewayPayment } from "@/lib/shops";
import type { ShopPlanId } from "@/lib/saas";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await req.text();
  let event;
  try {
    event = constructStripeEvent(payload, signature);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook signature." },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const shopId = session.metadata?.shopId ?? session.client_reference_id;
    if (!shopId) {
      return NextResponse.json({ error: "Missing shop id in session." }, { status: 422 });
    }

    await connectDb();
    const plan = (session.metadata?.plan as ShopPlanId | undefined) ?? undefined;
    const result = await activateShopAfterGatewayPayment(shopId, session.id, session, plan);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
  }

  return NextResponse.json({ received: true });
}
