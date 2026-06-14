import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models";
import { signupSchema } from "@/schemas/domain";
import { rolePermissions, type Role } from "@/types";

export async function POST(req: NextRequest) {
  const parsed = signupSchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  await connectDb();

  const email = parsed.data.email.toLowerCase();
  const adminExists = await User.exists({ role: "admin", status: "active", deletedAt: { $exists: false } });
  if (adminExists) {
    return NextResponse.json(
      { error: "An admin account already exists. Only an admin can add users from Settings > Users." },
      { status: 403 },
    );
  }

  const existingUser = await User.exists({ email });

  if (existingUser) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const role: Role = "admin";
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await User.create({
    name: parsed.data.name,
    email,
    passwordHash,
    role,
    permissions: rolePermissions[role],
    status: "active",
  });

  return NextResponse.json(
    {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    { status: 201 },
  );
}
