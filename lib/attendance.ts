import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { Attendance, Employee } from "@/models";
import type { AttendanceInput } from "@/types";

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export async function upsertAttendance(
  shopId: string,
  userId: string,
  input: AttendanceInput,
  actor?: { name?: string | null; email?: string | null; role?: string | null },
) {
  await connectDb();
  const date = dayStart(new Date(input.date));
  const employee = await Employee.findOne({
    _id: input.employee,
    shopId: new Types.ObjectId(shopId),
    deletedAt: { $exists: false },
  });
  if (!employee) return { ok: false as const, status: 404, error: "Employee not found." };

  const updated = await Attendance.findOneAndUpdate(
    { shopId: new Types.ObjectId(shopId), employee: employee._id, date },
    {
      $set: {
        checkIn: input.checkIn ?? "",
        checkOut: input.checkOut ?? "",
        status: input.status,
        notes: input.notes ?? "",
        updatedBy: userId,
      },
      $setOnInsert: {
        shopId: new Types.ObjectId(shopId),
        employee: employee._id,
        date,
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
    action: "attendance.updated",
    entity: "attendance",
    entityId: String(updated?._id),
    description: `Attendance updated for ${employee.fullName} (${input.status})`,
  });

  return { ok: true as const, data: updated };
}

export async function getAttendanceDashboard(shopId: string, now = new Date()) {
  await connectDb();
  const shopOid = new Types.ObjectId(shopId);
  const today = dayStart(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeEmployees = await Employee.countDocuments({ shopId: shopOid, status: "active", deletedAt: { $exists: false } });

  const [todayRows, monthRows] = await Promise.all([
    Attendance.find({ shopId: shopOid, date: today, deletedAt: { $exists: false } }).lean(),
    Attendance.find({
      shopId: shopOid,
      date: { $gte: monthStart, $lte: now },
      deletedAt: { $exists: false },
    }).lean(),
  ]);

  const todayPresent = todayRows.filter((r) => ["present", "late", "early_leave", "half_day"].includes(r.status)).length;
  const todayAbsent = todayRows.filter((r) => r.status === "absent").length;
  const todayLeave = todayRows.filter((r) => r.status === "leave").length;
  const todayLate = todayRows.filter((r) => r.status === "late").length;

  const monthPresent = monthRows.filter((r) => ["present", "late", "early_leave", "half_day"].includes(r.status)).length;
  const monthLeave = monthRows.filter((r) => r.status === "leave").length;
  const monthLate = monthRows.filter((r) => r.status === "late").length;
  const expected = Math.max(activeEmployees * Math.max(1, now.getDate()), 1);
  const percentage = Math.round((monthPresent / expected) * 100);

  return {
    activeEmployees,
    today: {
      present: todayPresent,
      absent: todayAbsent || Math.max(activeEmployees - todayRows.length, 0),
      leave: todayLeave,
      late: todayLate,
      marked: todayRows.length,
    },
    month: {
      present: monthPresent,
      leave: monthLeave,
      late: monthLate,
      percentage,
    },
  };
}
