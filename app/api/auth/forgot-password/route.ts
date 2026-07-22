import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { passwordResetEmail } from "@/lib/email";
import { connectDb } from "@/lib/db";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { User } from "@/models";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limited = rateLimit(`forgot:${ip}`, 5, 15 * 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const { email } = (await req.json()) as { email?: string };
  await connectDb();
  const user = email ? await User.findOne({ email: email.toLowerCase(), status: "active" }) : null;
  const token = randomBytes(32).toString("hex");

  if (user) {
    user.resetTokenHash = tokenHash(token);
    user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    try {
      await passwordResetEmail(user.email, token);
    } catch {
      // Still return generic success to avoid account enumeration.
    }
  }

  return NextResponse.json({
    message: "If the account exists, password reset instructions have been sent.",
    resetToken: process.env.NODE_ENV === "production" ? undefined : token,
  });
}
