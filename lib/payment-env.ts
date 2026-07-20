import { z } from "zod";
import { MOBILE_ERROR, isValidPakistanMobile, normalizePakistanMobile } from "@/lib/pakistan-validators";

const paymentMobileSchema = z
  .string()
  .trim()
  .min(1, "Payment mobile number is required")
  .refine(isValidPakistanMobile, MOBILE_ERROR)
  .transform(normalizePakistanMobile);

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

export const paymentEnvSchema = z.object({
  PAYMENT_EASYPAISA: paymentMobileSchema,
  PAYMENT_JAZZCASH: paymentMobileSchema,
  PAYMENT_BANK_NAME: paymentBankNameSchema,
  PAYMENT_BANK_TITLE: paymentBankTitleSchema,
  PAYMENT_BANK_ACCOUNT: paymentBankAccountSchema,
});

export type PaymentEnvInput = z.infer<typeof paymentEnvSchema>;

export type PlatformPaymentAccounts = {
  easypaisa: string;
  jazzcash: string;
  bank: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
  };
};

const DEV_DEFAULTS: PlatformPaymentAccounts = {
  easypaisa: "03001234567",
  jazzcash: "03007654321",
  bank: {
    bankName: "HBL",
    accountTitle: "Shopkeeper SaaS",
    accountNumber: "00000000000000",
  },
};

function readPaymentEnvRaw() {
  return {
    PAYMENT_EASYPAISA: process.env.PAYMENT_EASYPAISA?.trim() ?? "",
    PAYMENT_JAZZCASH: process.env.PAYMENT_JAZZCASH?.trim() ?? "",
    PAYMENT_BANK_NAME: process.env.PAYMENT_BANK_NAME?.trim() ?? "",
    PAYMENT_BANK_TITLE: process.env.PAYMENT_BANK_TITLE?.trim() ?? "",
    PAYMENT_BANK_ACCOUNT: process.env.PAYMENT_BANK_ACCOUNT?.trim() ?? "",
  };
}

function envIsConfigured(raw: ReturnType<typeof readPaymentEnvRaw>) {
  return Object.values(raw).some(Boolean);
}

function formatPaymentEnvError(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

export function validatePaymentEnv(input: PaymentEnvInput) {
  return paymentEnvSchema.safeParse(input);
}

/** Validates platform payment env vars when set; uses dev defaults only when all are empty. */
export function getValidatedPlatformPaymentAccounts(): PlatformPaymentAccounts {
  const raw = readPaymentEnvRaw();

  if (!envIsConfigured(raw)) {
    return DEV_DEFAULTS;
  }

  const parsed = paymentEnvSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid payment environment configuration: ${formatPaymentEnvError(parsed.error)}`);
  }

  return {
    easypaisa: parsed.data.PAYMENT_EASYPAISA,
    jazzcash: parsed.data.PAYMENT_JAZZCASH,
    bank: {
      bankName: parsed.data.PAYMENT_BANK_NAME,
      accountTitle: parsed.data.PAYMENT_BANK_TITLE,
      accountNumber: parsed.data.PAYMENT_BANK_ACCOUNT,
    },
  };
}
