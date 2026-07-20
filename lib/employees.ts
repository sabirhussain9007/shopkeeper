import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { withShopFilter } from "@/lib/tenant";
import { Employee } from "@/models";
import type { EmployeeInput } from "@/types";

async function nextEmployeeId(shopId: string) {
  const count = await Employee.countDocuments({ shopId: new Types.ObjectId(shopId) });
  return `EMP-${String(count + 1).padStart(4, "0")}`;
}

export async function createEmployee(
  shopId: string,
  userId: string,
  input: EmployeeInput,
  actor?: { name?: string | null; email?: string | null; role?: string | null },
) {
  await connectDb();
  const employeeId = await nextEmployeeId(shopId);
  const created = await Employee.create({
    ...input,
    employeeId,
    shopId,
    createdBy: userId,
  });
  await logActivity({
    shopId,
    userId,
    userName: actor?.name,
    userEmail: actor?.email,
    userRole: actor?.role,
    action: "employee.created",
    entity: "employee",
    entityId: String(created._id),
    description: `Employee added: ${created.fullName} (${created.employeeId})`,
  });
  return created;
}

export async function getEmployeeStats(shopId: string) {
  await connectDb();
  const base = withShopFilter(shopId, { deletedAt: { $exists: false } });
  const [total, active, inactive, salaryAgg] = await Promise.all([
    Employee.countDocuments(base),
    Employee.countDocuments({ ...base, status: "active" }),
    Employee.countDocuments({ ...base, status: "inactive" }),
    Employee.aggregate([
      { $match: { shopId: new Types.ObjectId(shopId), deletedAt: { $exists: false }, status: "active" } },
      { $group: { _id: null, total: { $sum: "$salary" } } },
    ]),
  ]);
  return {
    total,
    active,
    inactive,
    monthlySalaryCommitment: salaryAgg[0]?.total ?? 0,
  };
}
