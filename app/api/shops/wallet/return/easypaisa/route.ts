import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { activateShopAfterGatewayPayment } from "@/lib/shops";

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

function isEasyPaisaSuccess(payload: Record<string, string>) {
  const status = (payload.status ?? payload.responseCode ?? payload.ResponseCode ?? "").toLowerCase();
  return status === "0000" || status === "success" || status === "paid";
}

export async function POST(req: NextRequest) {
  const payload = await readGatewayPayload(req);
  const shopId = req.nextUrl.searchParams.get("shopId") ?? payload.orderRefNum?.replace(/\D/g, "").slice(0, 24);
  const txnRef = payload.orderRefNum ?? payload.transactionRef ?? payload.pp_TxnRefNo ?? "easypaisa";

  if (!shopId) {
    return NextResponse.redirect(new URL("/create-shop?payment=failed", req.url));
  }

  if (isEasyPaisaSuccess(payload)) {
    await connectDb();
    const result = await activateShopAfterGatewayPayment(shopId, txnRef, payload);
    if (result.ok) {
      return NextResponse.redirect(new URL(`/create-shop/success?shopId=${shopId}&provider=easypaisa&paid=1`, req.url));
    }
  }

  return NextResponse.redirect(new URL(`/create-shop/pay?shopId=${shopId}&provider=easypaisa&payment=failed`, req.url));
}

export async function GET(req: NextRequest) {
  return POST(req);
}
