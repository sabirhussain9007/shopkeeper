import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Employee } from "@/models";
import { employeeSchema } from "@/schemas/domain";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("employees:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const { id } = await params;
  const item = await Employee.findOne(withShopFilter(allowed.session.user.shopId, { _id: id, deletedAt: { $exists: false } })).lean();
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("employees:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const payload = employeeSchema.partial().safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: payload.error.flatten().fieldErrors }, { status: 422 });
  }
  const { id } = await params;
  const updated = await Employee.findOneAndUpdate(
    withShopFilter(allowed.session.user.shopId, { _id: id, deletedAt: { $exists: false } }),
    { $set: { ...payload.data, updatedBy: allowed.session.user.id } },
    { new: true },
  );
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logActivity({
    shopId: allowed.session.user.shopId,
    userId: allowed.session.user.id,
    userName: allowed.session.user.name,
    userEmail: allowed.session.user.email,
    userRole: allowed.session.user.role,
    action: "employee.updated",
    entity: "employee",
    entityId: id,
    description: `Employee updated: ${updated.fullName}`,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("employees:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const { id } = await params;
  const deleted = await Employee.findOneAndUpdate(
    withShopFilter(allowed.session.user.shopId, { _id: id, deletedAt: { $exists: false } }),
    { $set: { deletedAt: new Date(), deletedBy: allowed.session.user.id } },
    { new: true },
  );
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logActivity({
    shopId: allowed.session.user.shopId,
    userId: allowed.session.user.id,
    userName: allowed.session.user.name,
    userEmail: allowed.session.user.email,
    userRole: allowed.session.user.role,
    action: "employee.deleted",
    entity: "employee",
    entityId: id,
    description: `Employee deleted: ${deleted.fullName}`,
  });
  return NextResponse.json({ ok: true });
}
