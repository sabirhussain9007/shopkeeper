import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?verify=missing", req.url));

  await connectDb();
  const user = await User.findOne({
    emailVerifyTokenHash: tokenHash(token),
    emailVerifyExpiresAt: { $gt: new Date() },
  });
  if (!user) return NextResponse.redirect(new URL("/login?verify=invalid", req.url));

  user.emailVerified = true;
  user.emailVerifyTokenHash = undefined;
  user.emailVerifyExpiresAt = undefined;
  await user.save();

  return NextResponse.redirect(new URL("/login?verified=1", req.url));
}
