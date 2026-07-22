import { shopAccountTypeLabel } from "@/lib/bank-labels";
import type { BankAccountInput } from "@/types";

export type ShopPaymentAccount = BankAccountInput & { _id: string };

export const SHOP_ACCOUNT_PAYMENT_PREFIX = "account:";

export function isShopAccountPaymentMethod(method: string) {
  return method === "bank" || method === "easypaisa" || method === "jazzcash";
}

export function paymentMethodForAccount(account: Pick<ShopPaymentAccount, "accountType">) {
  return account.accountType ?? "bank";
}

export function formatShopPaymentAccountLabel(account: ShopPaymentAccount) {
  const type = shopAccountTypeLabel(account.accountType);
  return `${type} · ${account.name} · ${account.accountNumber}`;
}

export function encodeAccountPaymentValue(accountId: string) {
  return `${SHOP_ACCOUNT_PAYMENT_PREFIX}${accountId}`;
}

export function decodeAccountPaymentValue(value: string): string | null {
  if (!value.startsWith(SHOP_ACCOUNT_PAYMENT_PREFIX)) return null;
  const accountId = value.slice(SHOP_ACCOUNT_PAYMENT_PREFIX.length);
  return accountId || null;
}

export function isAccountPaymentValue(value: string) {
  return value.startsWith(SHOP_ACCOUNT_PAYMENT_PREFIX);
}

export type ResolvedPaymentSelection = {
  paymentMethod: string;
  bankName: string;
  accountId?: string;
  isAccount: boolean;
};

export function resolvePaymentSelection(value: string, accounts: ShopPaymentAccount[]): ResolvedPaymentSelection {
  const accountId = decodeAccountPaymentValue(value);
  if (accountId) {
    const account = accounts.find((item) => item._id === accountId);
    if (account) {
      return {
        paymentMethod: paymentMethodForAccount(account),
        bankName: account.name,
        accountId,
        isAccount: true,
      };
    }
  }
  return { paymentMethod: value, bankName: "", isAccount: false };
}

export function findAccountPaymentValue(
  accounts: ShopPaymentAccount[],
  paymentMethod: string,
  bankName?: string,
) {
  if (!isShopAccountPaymentMethod(paymentMethod)) return null;
  const normalizedBank = bankName?.trim().toLowerCase();
  const match = accounts.find((account) => {
    if (paymentMethodForAccount(account) !== paymentMethod) return false;
    if (!normalizedBank) return true;
    return account.name.trim().toLowerCase() === normalizedBank;
  });
  return match ? encodeAccountPaymentValue(match._id) : null;
}

export const STANDARD_BASE_PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
] as const;

const BASE_PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  cheque: "Cheque",
  credit: "Credit",
  split: "Split",
  other: "Other",
};

export function paymentSelectionLabel(value: string, accounts: ShopPaymentAccount[]) {
  const resolved = resolvePaymentSelection(value, accounts);
  if (resolved.isAccount) {
    const account = accounts.find((item) => item._id === resolved.accountId);
    return account ? formatShopPaymentAccountLabel(account) : resolved.bankName;
  }
  return BASE_PAYMENT_LABELS[resolved.paymentMethod] ?? resolved.paymentMethod;
}
