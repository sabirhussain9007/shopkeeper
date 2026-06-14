import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  const { token, password } = (await req.json()) as { token?: string; password?: string };
  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: "A valid token and password are required." }, { status: 422 });
  }

  await connectDb();
  const user = await User.findOne({
    resetTokenHash: tokenHash(token),
    resetTokenExpiresAt: { $gt: new Date() },
    status: "active",
  });

  if (!user) return NextResponse.json({ error: "Reset token is invalid or expired." }, { status: 400 });

  user.passwordHash = await bcrypt.hash(password, 12);
  user.resetTokenHash = undefined;
  user.resetTokenExpiresAt = undefined;
  await user.save();

  return NextResponse.json({ ok: true });
}
