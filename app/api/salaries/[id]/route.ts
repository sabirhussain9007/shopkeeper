import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { computeNetSalary } from "@/lib/salaries";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Salary } from "@/models";
import { salarySchema } from "@/schemas/domain";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("salaries:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const payload = salarySchema.partial().safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: payload.error.flatten().fieldErrors }, { status: 422 });
  }
  const { id } = await params;
  const existing = await Salary.findOne(withShopFilter(allowed.session.user.shopId, { _id: id, deletedAt: { $exists: false } }));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const merged = {
    basicSalary: payload.data.basicSalary ?? existing.basicSalary,
    bonus: payload.data.bonus ?? existing.bonus,
    overtime: payload.data.overtime ?? existing.overtime,
    allowance: payload.data.allowance ?? existing.allowance,
    deductions: payload.data.deductions ?? existing.deductions,
    advanceSalary: payload.data.advanceSalary ?? existing.advanceSalary,
    tax: payload.data.tax ?? existing.tax,
  };
  const netSalary = computeNetSalary(merged);
  const paymentStatus = payload.data.paymentStatus ?? existing.paymentStatus;

  Object.assign(existing, payload.data, {
    netSalary,
    paidAt: paymentStatus === "paid" ? existing.paidAt ?? new Date() : null,
    updatedBy: allowed.session.user.id,
  });
  await existing.save();

  if (paymentStatus === "paid") {
    await logActivity({
      shopId: allowed.session.user.shopId,
      userId: allowed.session.user.id,
      userName: allowed.session.user.name,
      userEmail: allowed.session.user.email,
      userRole: allowed.session.user.role,
      action: "salary.paid",
      entity: "salary",
      entityId: id,
      description: `Salary marked paid — Rs. ${netSalary}`,
    });
  }

  return NextResponse.json(existing);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("salaries:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const { id } = await params;
  const deleted = await Salary.findOneAndUpdate(
    withShopFilter(allowed.session.user.shopId, { _id: id, deletedAt: { $exists: false } }),
    { $set: { deletedAt: new Date(), deletedBy: allowed.session.user.id } },
    { new: true },
  );
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
