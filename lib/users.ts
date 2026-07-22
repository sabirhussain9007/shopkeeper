import { createHash, randomBytes } from "node:crypto";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { verifyEmailMessage } from "@/lib/email";
import { getRolePermissionsForShop } from "@/lib/settings";
import { withShopFilter } from "@/lib/tenant";
import { User } from "@/models";
import { shopRoles, type ShopRole } from "@/types";

export type SafeUser = {
  _id: string;
  name: string;
  email: string;
  role: ShopRole;
  status: "active" | "inactive";
  lastLoginAt?: Date;
  profileImage?: string;
  emailVerified?: boolean;
};

function toSafeUser(user: {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: ShopRole;
  status: "active" | "inactive";
  lastLoginAt?: Date | null;
  profileImage?: string;
  emailVerified?: boolean;
}) {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt ?? undefined,
    profileImage: user.profileImage,
    emailVerified: user.emailVerified,
  };
}

function emailVerifyToken() {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { token, hash, expires };
}

export async function listUsers(page = 1, limit = 20, q?: string, shopId?: string) {
  await connectDb();
  const filter: Record<string, unknown> = withShopFilter(shopId, { deletedAt: { $exists: false }, role: { $ne: "super_admin" } });
  if (q) filter.$or = [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }];
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(filter).select("-passwordHash -resetTokenHash -resetTokenExpiresAt -emailVerifyTokenHash").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return {
    items: items.map((u) => toSafeUser(u as Parameters<typeof toSafeUser>[0])),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function createUser(
  input: { name: string; email: string; password: string; role: ShopRole; status?: "active" | "inactive" },
  actorId: string,
  shopId: string,
) {
  if (!input.password || input.password.length < 8) {
    return { ok: false as const, status: 422, error: "Password must be at least 8 characters." };
  }
  if (!shopRoles.includes(input.role)) {
    return { ok: false as const, status: 422, error: "Invalid role." };
  }
  await connectDb();
  const email = input.email.toLowerCase();
  if (await User.exists({ email, deletedAt: { $exists: false } })) {
    return { ok: false as const, status: 409, error: "Email already in use." };
  }
  const permissions = await getRolePermissionsForShop(input.role, shopId);
  const verify = emailVerifyToken();
  const user = await User.create({
    shopId,
    name: input.name.trim(),
    email,
    passwordHash: await bcrypt.hash(input.password, 12),
    role: input.role,
    permissions,
    status: input.status ?? "active",
    emailVerified: false,
    emailVerifyTokenHash: verify.hash,
    emailVerifyExpiresAt: verify.expires,
    createdBy: actorId,
    updatedBy: actorId,
  });
  await verifyEmailMessage(email, verify.token).catch(() => undefined);
  return { ok: true as const, user: toSafeUser(user as Parameters<typeof toSafeUser>[0]) };
}

export async function updateUser(
  userId: string,
  input: Partial<{ name: string; email: string; password: string; role: ShopRole; status: "active" | "inactive"; profileImage: string }>,
  actorId: string,
  shopId: string,
) {
  await connectDb();
  const user = await User.findOne(withShopFilter(shopId, { _id: userId, deletedAt: { $exists: false } }));
  if (!user) return { ok: false as const, status: 404, error: "User not found." };
  if (userId === actorId && input.status === "inactive") {
    return { ok: false as const, status: 400, error: "You cannot deactivate your own account." };
  }
  if (user.role === "admin" && input.role && input.role !== "admin") {
    const adminCount = await User.countDocuments(withShopFilter(shopId, { role: "admin", status: "active", deletedAt: { $exists: false } }));
    if (adminCount <= 1) return { ok: false as const, status: 400, error: "At least one active admin is required." };
  }
  if (input.name) user.name = input.name;
  if (input.profileImage !== undefined) user.profileImage = input.profileImage;
  if (input.email) {
    const email = input.email.toLowerCase();
    const duplicate = await User.findOne({ email, _id: { $ne: userId }, deletedAt: { $exists: false } });
    if (duplicate) return { ok: false as const, status: 409, error: "Email already in use." };
    user.email = email;
    user.emailVerified = false;
  }
  if (input.password) user.passwordHash = await bcrypt.hash(input.password, 12);
  if (input.role) {
    user.role = input.role;
    user.permissions = await getRolePermissionsForShop(input.role, shopId);
  }
  if (input.status) user.status = input.status;
  user.updatedBy = new Types.ObjectId(actorId);
  await user.save();
  return { ok: true as const, user: toSafeUser(user as Parameters<typeof toSafeUser>[0]) };
}

export async function deactivateUser(userId: string, actorId: string, shopId: string) {
  if (userId === actorId) return { ok: false as const, status: 400, error: "You cannot deactivate your own account." };
  await connectDb();
  const user = await User.findOne(withShopFilter(shopId, { _id: userId, deletedAt: { $exists: false } }));
  if (!user) return { ok: false as const, status: 404, error: "User not found." };
  if (user.role === "admin") {
    const adminCount = await User.countDocuments(withShopFilter(shopId, { role: "admin", status: "active", deletedAt: { $exists: false } }));
    if (adminCount <= 1) return { ok: false as const, status: 400, error: "At least one active admin is required." };
  }
  user.status = "inactive";
  user.deletedAt = new Date();
  user.deletedBy = new Types.ObjectId(actorId);
  user.updatedBy = new Types.ObjectId(actorId);
  await user.save();
  return { ok: true as const };
}

export async function resendVerificationEmail(userId: string, shopId: string) {
  await connectDb();
  const user = await User.findOne(withShopFilter(shopId, { _id: userId, deletedAt: { $exists: false } }));
  if (!user) return { ok: false as const, status: 404, error: "User not found." };
  if (user.emailVerified) return { ok: false as const, status: 400, error: "Email already verified." };
  const verify = emailVerifyToken();
  user.emailVerifyTokenHash = verify.hash;
  user.emailVerifyExpiresAt = verify.expires;
  await user.save();
  await verifyEmailMessage(user.email, verify.token);
  return { ok: true as const };
}
