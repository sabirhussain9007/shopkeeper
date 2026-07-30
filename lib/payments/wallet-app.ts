import { isEasyPaisaGatewayConfigured } from "@/lib/payments/easypaisa-gateway";
import { isJazzCashConfigured } from "@/lib/payments/jazzcash";

export type WalletProvider = "easypaisa" | "jazzcash";

export function isWalletGatewayConfigured(provider: WalletProvider) {
  return provider === "jazzcash" ? isJazzCashConfigured() : isEasyPaisaGatewayConfigured();
}

export function walletProviderLabel(provider: WalletProvider) {
  return provider === "easypaisa" ? "EasyPaisa" : "JazzCash";
}

/** Deep link / store URL to open the wallet app on mobile. */
export function getWalletAppOpenUrl(provider: WalletProvider) {
  if (typeof navigator === "undefined") {
    return provider === "easypaisa" ? "https://easypaisa.com.pk/" : "https://www.jazzcash.com.pk/";
  }

  const ua = navigator.userAgent || "";
  const android = /android/i.test(ua);
  const ios = /iphone|ipad|ipod/i.test(ua);

  if (provider === "easypaisa") {
    if (android) return "intent://#Intent;package=com.telenor.pakistan.easypaisa;scheme=easypaisa;end";
    if (ios) return "easypaisa://";
    return "https://easypaisa.com.pk/";
  }

  if (android) return "intent://#Intent;package=com.techlogix.mobilinkcustomer;scheme=jazzcash;end";
  if (ios) return "jazzcash://";
  return "https://www.jazzcash.com.pk/";
}

export function buildWalletPaymentRef(shopId: string) {
  const suffix = shopId.slice(-8).toUpperCase();
  return `SK${suffix}${Date.now().toString(36).toUpperCase()}`.slice(0, 20);
}
