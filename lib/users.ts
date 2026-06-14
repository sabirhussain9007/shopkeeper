import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models";
import { roles, rolePermissions, type Role } from "@/types";

export type SafeUser = {
  _id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "inactive";
  lastLoginAt?: Date;
};

function toSafeUser(user: { _id: Types.ObjectId; name: string; email: string; role: Role; status: "active" | "inactive"; lastLoginAt?: Date | null }) {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt ?? undefined,
  };
}

export async function listUsers(page = 1, limit = 20, q?: string) {
  await connectDb();
  const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
  if (q) filter.$or = [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }];
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(filter).select("-passwordHash -resetTokenHash -resetTokenExpiresAt").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return {
    items: items.map((u) => toSafeUser(u as Parameters<typeof toSafeUser>[0])),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function createUser(input: { name: string; email: string; password: string; role: Role; status?: "active" | "inactive" }, actorId: string) {
  if (!input.password || input.password.length < 8) {
    return { ok: false as const, status: 422, error: "Password must be at least 8 characters." };
  }
  if (!roles.includes(input.role)) {
    return { ok: false as const, status: 422, error: "Invalid role." };
  }
  await connectDb();
  const email = input.email.toLowerCase();
  if (await User.exists({ email, deletedAt: { $exists: false } })) {
    return { ok: false as const, status: 409, error: "Email already in use." };
  }
  const user = await User.create({
    name: input.name.trim(),
    email,
    passwordHash: await bcrypt.hash(input.password, 12),
    role: input.role,
    permissions: rolePermissions[input.role],
    status: input.status ?? "active",
    createdBy: actorId,
    updatedBy: actorId,
  });
  return { ok: true as const, user: toSafeUser(user as Parameters<typeof toSafeUser>[0]) };
}

export async function updateUser(
  userId: string,
  input: Partial<{ name: string; email: string; password: string; role: Role; status: "active" | "inactive" }>,
  actorId: string,
) {
  await connectDb();
  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } });
  if (!user) return { ok: false as const, status: 404, error: "User not found." };
  if (userId === actorId && input.status === "inactive") {
    return { ok: false as const, status: 400, error: "You cannot deactivate your own account." };
  }
  if (user.role === "admin" && input.role && input.role !== "admin") {
    const adminCount = await User.countDocuments({ role: "admin", status: "active", deletedAt: { $exists: false } });
    if (adminCount <= 1) return { ok: false as const, status: 400, error: "At least one active admin is required." };
  }
  if (input.name) user.name = input.name;
  if (input.email) {
    const email = input.email.toLowerCase();
    const duplicate = await User.findOne({ email, _id: { $ne: userId }, deletedAt: { $exists: false } });
    if (duplicate) return { ok: false as const, status: 409, error: "Email already in use." };
    user.email = email;
  }
  if (input.password) user.passwordHash = await bcrypt.hash(input.password, 12);
  if (input.role) {
    user.role = input.role;
    user.permissions = rolePermissions[input.role];
  }
  if (input.status) user.status = input.status;
  user.updatedBy = new Types.ObjectId(actorId);
  await user.save();
  return { ok: true as const, user: toSafeUser(user as Parameters<typeof toSafeUser>[0]) };
}

export async function deactivateUser(userId: string, actorId: string) {
  if (userId === actorId) return { ok: false as const, status: 400, error: "You cannot deactivate your own account." };
  await connectDb();
  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } });
  if (!user) return { ok: false as const, status: 404, error: "User not found." };
  if (user.role === "admin") {
    const adminCount = await User.countDocuments({ role: "admin", status: "active", deletedAt: { $exists: false } });
    if (adminCount <= 1) return { ok: false as const, status: 400, error: "At least one active admin is required." };
  }
  user.status = "inactive";
  user.deletedAt = new Date();
  user.deletedBy = new Types.ObjectId(actorId);
  user.updatedBy = new Types.ObjectId(actorId);
  await user.save();
  return { ok: true as const };
}
