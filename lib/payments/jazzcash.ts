import crypto from "crypto";
import { appBaseUrl } from "@/lib/payments/app-base-url";
import { SHOP_PLANS, type ShopPlanId } from "@/lib/saas";

export function isJazzCashConfigured() {
  return Boolean(
    process.env.JAZZCASH_MERCHANT_ID?.trim() &&
      process.env.JAZZCASH_PASSWORD?.trim() &&
      process.env.JAZZCASH_INTEGRITY_SALT?.trim(),
  );
}

function jazzCashBaseUrl() {
  if (process.env.JAZZCASH_GATEWAY_URL?.trim()) return process.env.JAZZCASH_GATEWAY_URL.trim().replace(/\/$/, "");
  return process.env.JAZZCASH_SANDBOX === "true"
    ? "https://sandbox.jazzcash.com.pk"
    : "https://payments.jazzcash.com.pk";
}

function formatTxnDateTime(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function jazzCashSecureHash(params: Record<string, string>, salt: string) {
  const sorted = Object.keys(params)
    .filter((key) => key.startsWith("pp_") && params[key] !== "")
    .sort();
  const payload = sorted.map((key) => params[key]).join("&");
  return crypto.createHmac("sha256", salt).update(payload).digest("hex");
}

export function verifyJazzCashSecureHash(params: Record<string, string>, salt: string, secureHash: string) {
  const expected = jazzCashSecureHash(params, salt);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(secureHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

type JazzCashCheckoutParams = {
  shopId: string;
  plan: ShopPlanId;
  shopName: string;
  txnRef: string;
};

export function createJazzCashCheckout(params: JazzCashCheckoutParams) {
  const merchantId = process.env.JAZZCASH_MERCHANT_ID?.trim();
  const password = process.env.JAZZCASH_PASSWORD?.trim();
  const salt = process.env.JAZZCASH_INTEGRITY_SALT?.trim();
  if (!merchantId || !password || !salt) {
    throw new Error("JazzCash gateway is not configured.");
  }

  const plan = SHOP_PLANS[params.plan];
  const txnDateTime = formatTxnDateTime();
  const expiryDateTime = formatTxnDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const fields: Record<string, string> = {
    pp_Amount: String(plan.amount * 100),
    pp_BillReference: params.txnRef,
    pp_Description: `Shopkeeper ${plan.label} — ${params.shopName}`.slice(0, 200),
    pp_Language: "EN",
    pp_MerchantID: merchantId,
    pp_Password: password,
    pp_ReturnURL: `${appBaseUrl()}/api/shops/wallet/return/jazzcash`,
    pp_SubMerchantID: "",
    pp_TxnCurrency: "PKR",
    pp_TxnDateTime: txnDateTime,
    pp_TxnExpiryDateTime: expiryDateTime,
    pp_TxnRefNo: params.txnRef,
    pp_Version: "2.0",
    ppmpf_1: params.shopId,
    ppmpf_2: "",
    ppmpf_3: "",
    ppmpf_4: "",
    ppmpf_5: "",
  };

  return {
    actionUrl: `${jazzCashBaseUrl()}/ApplicationAPI/API/2.0/Purchase/SecuredHashPost`,
    fields: {
      ...fields,
      pp_SecureHash: jazzCashSecureHash(fields, salt),
    },
  };
}

export function isJazzCashSuccessResponse(responseCode?: string) {
  return responseCode === "000" || responseCode === "121";
}
