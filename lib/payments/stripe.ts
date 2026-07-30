import Stripe from "stripe";
import { appBaseUrl } from "@/lib/payments/app-base-url";
import { SHOP_PLANS, type ShopPlanId } from "@/lib/saas";

let stripeClient: Stripe | null = null;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secret);
  }
  return stripeClient;
}

type CheckoutParams = {
  shopId: string;
  plan: ShopPlanId;
  customerEmail: string;
  shopName: string;
  mode: "registration" | "renewal";
};

export async function createShopSubscriptionCheckout(params: CheckoutParams) {
  const stripe = getStripeClient();
  const plan = SHOP_PLANS[params.plan];
  const successUrl =
    params.mode === "registration"
      ? `${appBaseUrl()}/create-shop/success?shopId=${params.shopId}&session_id={CHECKOUT_SESSION_ID}`
      : `${appBaseUrl()}/shop-status?paid=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    params.mode === "registration"
      ? `${appBaseUrl()}/create-shop?cancelled=1`
      : `${appBaseUrl()}/shop-status?cancelled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.customerEmail,
    client_reference_id: params.shopId,
    metadata: {
      shopId: params.shopId,
      plan: params.plan,
      mode: params.mode,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "pkr",
          unit_amount: plan.amount * 100,
          product_data: {
            name: `Shopkeeper ${plan.label}`,
            description: `${params.shopName} — ${plan.description}`,
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error("Unable to create Stripe checkout session.");
  }

  return { sessionId: session.id, url: session.url };
}

export function constructStripeEvent(payload: string | Buffer, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("Stripe webhook secret is not configured.");
  }
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
