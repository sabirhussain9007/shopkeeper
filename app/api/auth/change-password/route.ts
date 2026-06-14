import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { User } from "@/models";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = (await req.json()) as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "Current password and a stronger new password are required." }, { status: 422 });
  }

  await connectDb();
  const user = await User.findById(session.user.id);
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  return NextResponse.json({ ok: true });
}
