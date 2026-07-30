import crypto from "crypto";
import { appBaseUrl } from "@/lib/payments/app-base-url";
import { SHOP_PLANS, type ShopPlanId } from "@/lib/saas";

export function isEasyPaisaGatewayConfigured() {
  return Boolean(process.env.EASYPAISA_STORE_ID?.trim() && process.env.EASYPAISA_HASH_KEY?.trim());
}

function easypaisaCheckoutUrl() {
  if (process.env.EASYPAISA_CHECKOUT_URL?.trim()) return process.env.EASYPAISA_CHECKOUT_URL.trim();
  return process.env.EASYPAISA_SANDBOX === "true"
    ? "https://easypaystg.easypaisa.com.pk/easypay/Index.jsf"
    : "https://easypay.easypaisa.com.pk/easypay/Index.jsf";
}

function pkcs5Pad(text: string, blockSize = 16) {
  const pad = blockSize - (text.length % blockSize);
  return text + String.fromCharCode(pad).repeat(pad);
}

function easypaisaMerchantHash(fields: Record<string, string>, hashKey: string) {
  const sortedKeys = Object.keys(fields).sort();
  const payload = sortedKeys.map((key) => `${key}=${fields[key]}`).join("&");
  const padded = pkcs5Pad(payload);
  const key = Buffer.from(hashKey, "utf8").subarray(0, 16);
  const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded, "utf8"), cipher.final()]).toString("base64");
}

type EasyPaisaCheckoutParams = {
  shopId: string;
  plan: ShopPlanId;
  orderRef: string;
  mobile?: string;
  email?: string;
};

export function createEasyPaisaCheckout(params: EasyPaisaCheckoutParams) {
  const storeId = process.env.EASYPAISA_STORE_ID?.trim();
  const hashKey = process.env.EASYPAISA_HASH_KEY?.trim();
  if (!storeId || !hashKey) {
    throw new Error("EasyPaisa gateway is not configured.");
  }

  const plan = SHOP_PLANS[params.plan];
  const hashFields = {
    amount: `${plan.amount}.0`,
    autoRedirect: "1",
    emailAddr: params.email ?? "",
    expiryDate: "",
    mobileNum: params.mobile ?? "",
    orderRefNum: params.orderRef,
    paymentMethod: "InitialRequest",
    postBackURL: `${appBaseUrl()}/api/shops/wallet/return/easypaisa?shopId=${encodeURIComponent(params.shopId)}`,
    storeId,
  };

  return {
    actionUrl: easypaisaCheckoutUrl(),
    fields: {
      ...hashFields,
      merchantHashedReq: easypaisaMerchantHash(hashFields, hashKey),
    },
  };
}
