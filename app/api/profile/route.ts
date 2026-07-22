import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { resendVerificationEmail, updateUser } from "@/lib/users";
import { User } from "@/models";

const profileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  profileImage: z.string().max(2_500_000).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDb();
  const user = await User.findById(session.user.id).select("name email role profileImage emailVerified").lean();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.shopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = profileSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  const result = await updateUser(session.user.id, parsed.data, session.user.id, session.user.shopId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.user);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.shopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { action?: string };
  if (body.action === "resend-verification") {
    const result = await resendVerificationEmail(session.user.id, session.user.shopId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ message: "Verification email sent." });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
