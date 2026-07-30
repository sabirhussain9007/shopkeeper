import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { activateShopAfterGatewayPayment } from "@/lib/shops";
import { isJazzCashSuccessResponse, verifyJazzCashSecureHash } from "@/lib/payments/jazzcash";

async function readGatewayPayload(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await req.json()) as Record<string, string>;
    return Object.fromEntries(Object.entries(json).map(([key, value]) => [key, String(value)]));
  }

  const form = await req.formData();
  const payload: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    payload[key] = String(value);
  }
  return payload;
}

export async function POST(req: NextRequest) {
  const payload = await readGatewayPayload(req);
  const shopId = payload.ppmpf_1;
  const responseCode = payload.pp_ResponseCode;
  const txnRef = payload.pp_TxnRefNo ?? payload.pp_RetreivalReferenceNo ?? "jazzcash";
  const secureHash = payload.pp_SecureHash;

  if (!shopId) {
    return NextResponse.redirect(new URL("/create-shop?payment=failed", req.url));
  }

  const salt = process.env.JAZZCASH_INTEGRITY_SALT?.trim();
  if (salt && secureHash) {
    const verifyFields = { ...payload };
    delete verifyFields.pp_SecureHash;
    if (!verifyJazzCashSecureHash(verifyFields, salt, secureHash)) {
      return NextResponse.redirect(new URL(`/create-shop/pay?shopId=${shopId}&provider=jazzcash&payment=invalid`, req.url));
    }
  }

  if (isJazzCashSuccessResponse(responseCode)) {
    await connectDb();
    const result = await activateShopAfterGatewayPayment(shopId, txnRef, payload);
    if (result.ok) {
      return NextResponse.redirect(new URL(`/create-shop/success?shopId=${shopId}&provider=jazzcash&paid=1`, req.url));
    }
  }

  return NextResponse.redirect(new URL(`/create-shop/pay?shopId=${shopId}&provider=jazzcash&payment=failed`, req.url));
}

export async function GET(req: NextRequest) {
  return POST(req);
}
