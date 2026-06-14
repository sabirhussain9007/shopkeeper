import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  const { email } = (await req.json()) as { email?: string };
  await connectDb();
  const user = email ? await User.findOne({ email: email.toLowerCase(), status: "active" }) : null;
  const token = randomBytes(32).toString("hex");

  if (user) {
    user.resetTokenHash = tokenHash(token);
    user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
  }

  return NextResponse.json({
    message: "If the account exists, password reset instructions have been prepared.",
    resetToken: process.env.NODE_ENV === "production" ? undefined : token,
  });
}
