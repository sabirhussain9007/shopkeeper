import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { Customer } from "@/models";

export async function GET() {
  const allowed = await requireApiPermission("pos:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  await connectDb();
  const items = await Customer.find({ deletedAt: { $exists: false }, status: "active" })
    .sort({ name: 1 })
    .select("name phone creditLimit currentBalance")
    .lean();

  return NextResponse.json({ items });
}
