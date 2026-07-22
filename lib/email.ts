type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/** Sends email via SMTP webhook or logs in development. */
export async function sendEmail(payload: EmailPayload) {
  const webhook = process.env.EMAIL_WEBHOOK_URL;
  if (webhook) {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "noreply@shopkeeper.local",
        ...payload,
      }),
    });
    if (!res.ok) throw new Error("Email delivery failed");
    return { ok: true as const };
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[email:dev]", payload);
  }
  return { ok: true as const, dev: process.env.NODE_ENV !== "production" };
}

export function passwordResetEmail(to: string, token: string) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = `${appUrl}/reset-password?token=${token}`;
  return sendEmail({
    to,
    subject: "Reset your Shopkeeper password",
    html: `<p>Click to reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 30 minutes.</p>`,
    text: `Reset your password: ${link}`,
  });
}

export function verifyEmailMessage(to: string, token: string) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = `${appUrl}/api/auth/verify-email?token=${token}`;
  return sendEmail({
    to,
    subject: "Verify your Shopkeeper email",
    html: `<p>Verify your email:</p><p><a href="${link}">${link}</a></p>`,
    text: `Verify your email: ${link}`,
  });
}

export function invoiceEmail(to: string, invoiceNumber: string, total: string) {
  return sendEmail({
    to,
    subject: `Invoice ${invoiceNumber}`,
    html: `<p>Your invoice <strong>${invoiceNumber}</strong> for <strong>${total}</strong> is ready.</p><p>Sign in to Shopkeeper to view and print it.</p>`,
    text: `Invoice ${invoiceNumber} for ${total}. Sign in to Shopkeeper to view.`,
  });
}
