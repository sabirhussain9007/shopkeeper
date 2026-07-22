import { z } from "zod";

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
  PAYMENT_BANK_NAME: paymentBankNameSchema,
  PAYMENT_BANK_TITLE: paymentBankTitleSchema,
  PAYMENT_BANK_ACCOUNT: paymentBankAccountSchema,
});

export type PaymentEnvInput = z.infer<typeof paymentEnvSchema>;

export type PlatformPaymentAccounts = {
  bank: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
  };
};

function readPaymentEnvRaw() {
  return {
    PAYMENT_BANK_NAME: process.env.PAYMENT_BANK_NAME?.trim() ?? "",
    PAYMENT_BANK_TITLE: process.env.PAYMENT_BANK_TITLE?.trim() ?? "",
    PAYMENT_BANK_ACCOUNT: process.env.PAYMENT_BANK_ACCOUNT?.trim() ?? "",
  };
}

function formatPaymentEnvError(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

export function validatePaymentEnv(input: PaymentEnvInput) {
  return paymentEnvSchema.safeParse(input);
}

/** Platform bank account for shop subscription payments. Requires PAYMENT_BANK_* env vars. */
export function getValidatedPlatformPaymentAccounts(): PlatformPaymentAccounts {
  const raw = readPaymentEnvRaw();
  const parsed = paymentEnvSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Payment environment is not configured. Set PAYMENT_BANK_NAME, PAYMENT_BANK_TITLE, and PAYMENT_BANK_ACCOUNT. ${formatPaymentEnvError(parsed.error)}`,
    );
  }

  return {
    bank: {
      bankName: parsed.data.PAYMENT_BANK_NAME,
      accountTitle: parsed.data.PAYMENT_BANK_TITLE,
      accountNumber: parsed.data.PAYMENT_BANK_ACCOUNT,
    },
  };
}
