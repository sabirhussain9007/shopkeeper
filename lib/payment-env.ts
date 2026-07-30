import { z } from "zod";
import {
  isValidPakistanMobile,
  isValidWalletAccountNumber,
  normalizePakistanMobile,
  normalizeWalletAccountNumber,
  WALLET_ACCOUNT_ERROR,
  formatPakistanMobileDisplay,
} from "@/lib/pakistan-validators";

export const paymentBankNameSchema = z
  .string()
  .trim()
  .min(2, "Bank name must be at least 2 characters")
  .max(80, "Bank name is too long")
  .regex(/^[a-zA-Z0-9\s.&()-]+$/, "Bank name contains invalid characters");

export const paymentBankTitleSchema = z
  .string()
  .trim()
  .min(2, "Account title must be at least 2 characters")
  .max(120, "Account title is too long");

export const paymentBankAccountSchema = z
  .string()
  .trim()
  .regex(/^\d{10,24}$/, "Bank account must be 10–24 digits");

const walletAccountSchema = z
  .string()
  .trim()
  .refine((value) => isValidWalletAccountNumber(value), WALLET_ACCOUNT_ERROR);

export const paymentEnvSchema = z.object({
  PAYMENT_EASYPAISA: walletAccountSchema,
  PAYMENT_JAZZCASH: walletAccountSchema,
  PAYMENT_BANK_NAME: paymentBankNameSchema,
  PAYMENT_BANK_TITLE: paymentBankTitleSchema,
  PAYMENT_BANK_ACCOUNT: paymentBankAccountSchema,
});

export type PaymentEnvInput = z.infer<typeof paymentEnvSchema>;

export type PlatformPaymentAccounts = {
  easypaisa: {
    accountNumber: string;
    accountTitle: string;
    displayNumber: string;
  };
  jazzcash: {
    accountNumber: string;
    accountTitle: string;
    displayNumber: string;
  };
  bank: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
  };
};

function normalizeWalletEnvValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isValidWalletAccountNumber(trimmed)) {
    return isValidPakistanMobile(trimmed) ? normalizePakistanMobile(trimmed) : normalizeWalletAccountNumber(trimmed);
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 5) return digits;
  return trimmed;
}

function readPaymentEnvRaw() {
  return {
    PAYMENT_EASYPAISA: normalizeWalletEnvValue(process.env.PAYMENT_EASYPAISA ?? ""),
    PAYMENT_JAZZCASH: normalizeWalletEnvValue(process.env.PAYMENT_JAZZCASH ?? ""),
    PAYMENT_BANK_NAME: process.env.PAYMENT_BANK_NAME?.trim() ?? "",
    PAYMENT_BANK_TITLE: process.env.PAYMENT_BANK_TITLE?.trim() ?? "",
    PAYMENT_BANK_ACCOUNT: process.env.PAYMENT_BANK_ACCOUNT?.replace(/\D/g, "") ?? "",
  };
}

function formatWalletDisplay(value: string) {
  const formatted = formatPakistanMobileDisplay(value);
  return formatted || value;
}

function formatPaymentEnvError(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

export function validatePaymentEnv(input: PaymentEnvInput) {
  return paymentEnvSchema.safeParse(input);
}

export type PlatformPaymentConfigResult =
  | { ok: true; accounts: PlatformPaymentAccounts }
  | { ok: false; error: string };

/** Returns accounts or a validation error — does not throw. */
export function resolvePlatformPaymentAccounts(): PlatformPaymentConfigResult {
  const raw = readPaymentEnvRaw();
  const parsed = paymentEnvSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Payment accounts are not configured correctly. Update PAYMENT_EASYPAISA, PAYMENT_JAZZCASH, PAYMENT_BANK_NAME, PAYMENT_BANK_TITLE, and PAYMENT_BANK_ACCOUNT in your environment. ${formatPaymentEnvError(parsed.error)}`,
    };
  }

  const accountTitle = parsed.data.PAYMENT_BANK_TITLE;

  return {
    ok: true,
    accounts: {
      easypaisa: {
        accountNumber: parsed.data.PAYMENT_EASYPAISA,
        accountTitle,
        displayNumber: formatWalletDisplay(parsed.data.PAYMENT_EASYPAISA),
      },
      jazzcash: {
        accountNumber: parsed.data.PAYMENT_JAZZCASH,
        accountTitle,
        displayNumber: formatWalletDisplay(parsed.data.PAYMENT_JAZZCASH),
      },
      bank: {
        bankName: parsed.data.PAYMENT_BANK_NAME,
        accountTitle,
        accountNumber: parsed.data.PAYMENT_BANK_ACCOUNT,
      },
    },
  };
}

/** Platform payment accounts for shop subscription payments. */
export function getValidatedPlatformPaymentAccounts(): PlatformPaymentAccounts {
  const result = resolvePlatformPaymentAccounts();
  if (!result.ok) throw new Error(result.error);
  return result.accounts;
}
