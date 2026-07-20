import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { Employee, Salary } from "@/models";
import type { SalaryInput } from "@/types";

export function computeNetSalary(parts: {
  basicSalary: number;
  bonus: number;
  overtime: number;
  allowance: number;
  deductions: number;
  advanceSalary: number;
  tax: number;
}) {
  return Math.max(
    0,
    parts.basicSalary + parts.bonus + parts.overtime + parts.allowance - parts.deductions - parts.advanceSalary - parts.tax,
  );
}

export async function upsertSalary(
  shopId: string,
  userId: string,
  input: SalaryInput,
  actor?: { name?: string | null; email?: string | null; role?: string | null },
) {
  await connectDb();
  const employee = await Employee.findOne({
    _id: input.employee,
    shopId: new Types.ObjectId(shopId),
    deletedAt: { $exists: false },
  });
  if (!employee) return { ok: false as const, status: 404, error: "Employee not found." };

  const netSalary = computeNetSalary(input);
  const paidAt = input.paymentStatus === "paid" ? new Date() : undefined;

  const record = await Salary.findOneAndUpdate(
    {
      shopId: new Types.ObjectId(shopId),
      employee: employee._id,
      month: input.month,
      year: input.year,
      deletedAt: { $exists: false },
    },
    {
      $set: {
        ...input,
        netSalary,
        paidAt: input.paymentStatus === "paid" ? paidAt : null,
        updatedBy: userId,
      },
      $setOnInsert: {
        shopId: new Types.ObjectId(shopId),
        createdBy: userId,
      },
    },
    { upsert: true, new: true },
  );

  await logActivity({
    shopId,
    userId,
    userName: actor?.name,
    userEmail: actor?.email,
    userRole: actor?.role,
    action: input.paymentStatus === "paid" ? "salary.paid" : "salary.generated",
    entity: "salary",
    entityId: String(record?._id),
    description: `Salary ${input.paymentStatus} for ${employee.fullName} (${input.month}/${input.year}) — Rs. ${netSalary}`,
  });

  return { ok: true as const, data: record };
}

export async function getSalaryDashboard(shopId: string, now = new Date()) {
  await connectDb();
  const shopOid = new Types.ObjectId(shopId);
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const rows = await Salary.find({
    shopId: shopOid,
    month,
    year,
    deletedAt: { $exists: false },
  }).lean();

  const paid = rows.filter((r) => r.paymentStatus === "paid").reduce((s, r) => s + (r.netSalary ?? 0), 0);
  const pending = rows.filter((r) => r.paymentStatus === "pending").reduce((s, r) => s + (r.netSalary ?? 0), 0);
  const expense = rows.reduce((s, r) => s + (r.netSalary ?? 0), 0);

  return {
    month,
    year,
    totalPaid: paid,
    totalPending: pending,
    monthlyExpense: expense,
    count: rows.length,
  };
}

export async function generateMonthlySalaries(
  shopId: string,
  userId: string,
  month: number,
  year: number,
  actor?: { name?: string | null; email?: string | null; role?: string | null },
) {
  await connectDb();
  const employees = await Employee.find({
    shopId: new Types.ObjectId(shopId),
    status: "active",
    deletedAt: { $exists: false },
  }).lean();

  const created = [];
  for (const employee of employees) {
    const result = await upsertSalary(
      shopId,
      userId,
      {
        employee: String(employee._id),
        month,
        year,
        basicSalary: employee.salary ?? 0,
        bonus: 0,
        overtime: 0,
        allowance: 0,
        deductions: 0,
        advanceSalary: 0,
        tax: 0,
        paymentStatus: "pending",
        notes: "",
      },
      actor,
    );
    if (result.ok) created.push(result.data);
  }
  return created;
}
