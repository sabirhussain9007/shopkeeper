import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createUser, listUsers } from "@/lib/users";
import { requireApiPermission } from "@/lib/rbac";
import { shopRoles } from "@/types";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(shopRoles),
  status: z.enum(["active", "inactive"]).default("active"),
});

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("users:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 20);
  const q = searchParams.get("q") ?? undefined;
  const data = await listUsers(page, limit, q, allowed.session.user.shopId!);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("users:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const result = await createUser(parsed.data, allowed.session.user.id, allowed.session.user.shopId!);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.user, { status: 201 });
}
