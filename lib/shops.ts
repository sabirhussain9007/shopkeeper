import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { getPlanExpiry, getRemainingDays, SHOP_PLANS, slugifyShopName, type ShopPlanId, type ShopPaymentMethod } from "@/lib/saas";
import { Setting, Shop, User } from "@/models";
import { defaultSettings } from "@/lib/settings";
import { rolePermissions } from "@/types";

export type CreateShopInput = {
  shopName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  password: string;
  plan: ShopPlanId;
  paymentMethod: ShopPaymentMethod;
  paymentReference: string;
};

export async function createShopRegistration(input: CreateShopInput) {
  await connectDb();
  const email = input.ownerEmail.toLowerCase();
  if (await User.exists({ email, deletedAt: { $exists: false } })) {
    return { ok: false as const, status: 409, error: "An account with this email already exists." };
  }

  const paymentReference = input.paymentReference.trim();
  if (paymentReference.length < 3) {
    return { ok: false as const, status: 422, error: "Enter your payment receipt / transaction ID." };
  }

  let slug = slugifyShopName(input.shopName);
  const slugExists = await Shop.exists({ slug });
  if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;

  const plan = SHOP_PLANS[input.plan];
  const shop = await Shop.create({
    name: input.shopName.trim(),
    slug,
    ownerName: input.ownerName.trim(),
    ownerEmail: email,
    ownerPhone: input.ownerPhone?.trim() || "",
    plan: input.plan,
    planAmount: plan.amount,
    paymentMethod: input.paymentMethod,
    paymentReference,
    paymentStatus: "pending",
    status: "pending",
  });

  const user = await User.create({
    shopId: shop._id,
    name: input.ownerName.trim(),
    email,
    passwordHash: await bcrypt.hash(input.password, 12),
    role: "admin",
    permissions: rolePermissions.admin,
    status: "active",
  });

  await Setting.create({
    ...defaultSettings,
    businessName: input.shopName.trim(),
    email,
    phone: input.ownerPhone?.trim() || "",
    shopId: shop._id,
    createdBy: user._id,
    updatedBy: user._id,
  });

  return {
    ok: true as const,
    shop: {
      id: shop._id.toString(),
      name: shop.name,
      slug: shop.slug,
      plan: shop.plan,
      planAmount: shop.planAmount,
      status: shop.status,
      paymentStatus: shop.paymentStatus,
      paymentReference: shop.paymentReference,
    },
  };
}

export async function listShops(params?: {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
  expiryFilter?: "expired" | "today" | "1" | "2" | "3" | "active" | "expiring_3";
}) {
  await connectDb();
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
  if (params?.status) filter.status = params.status;
  if (params?.q) {
    filter.$or = [
      { name: { $regex: params.q, $options: "i" } },
      { ownerEmail: { $regex: params.q, $options: "i" } },
      { ownerName: { $regex: params.q, $options: "i" } },
      { slug: { $regex: params.q, $options: "i" } },
    ];
  }
  const skip = (page - 1) * limit;
  const [rawItems, totalAll] = await Promise.all([
    Shop.find(filter).sort({ createdAt: -1 }).lean(),
    Shop.countDocuments(filter),
  ]);

  const now = Date.now();
  await Promise.all(
    rawItems
      .filter((shop) => shop.status === "active" && shop.expiresAt && new Date(shop.expiresAt).getTime() <= now)
      .map((shop) => Shop.updateOne({ _id: shop._id }, { $set: { status: "expired" } })),
  );

  let items = rawItems.map((shop) => {
    const status =
      shop.status === "active" && shop.expiresAt && new Date(shop.expiresAt).getTime() <= now ? "expired" : shop.status;
    const remainingDays = getRemainingDays(shop.expiresAt);
    return {
      ...shop,
      _id: String(shop._id),
      status,
      remainingDays,
      planLabel: SHOP_PLANS[shop.plan as ShopPlanId]?.label ?? shop.plan,
    };
  });

  if (params?.expiryFilter === "expired") items = items.filter((s) => s.status === "expired" || s.remainingDays < 0);
  if (params?.expiryFilter === "today") items = items.filter((s) => s.remainingDays === 0);
  if (params?.expiryFilter === "1") items = items.filter((s) => s.remainingDays === 1);
  if (params?.expiryFilter === "2") items = items.filter((s) => s.remainingDays === 2);
  if (params?.expiryFilter === "3") items = items.filter((s) => s.remainingDays === 3);
  if (params?.expiryFilter === "expiring_3") items = items.filter((s) => s.remainingDays >= 0 && s.remainingDays <= 3);
  if (params?.expiryFilter === "active") items = items.filter((s) => s.status === "active" && s.remainingDays > 3);

  const total = params?.expiryFilter ? items.length : totalAll;
  const paged = items.slice(skip, skip + limit);

  return {
    items: paged,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  };
}

export async function getSubscriptionMonitorStats() {
  await connectDb();
  const shops = await Shop.find({ deletedAt: { $exists: false } }).lean();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let activePlans = 0;
  let expiredPlans = 0;
  let expiringIn3 = 0;
  let renewedThisMonth = 0;

  for (const shop of shops) {
    const remaining = getRemainingDays(shop.expiresAt);
    if (shop.status === "active" && remaining > 0) activePlans += 1;
    if (shop.status === "expired" || remaining < 0) expiredPlans += 1;
    if (remaining >= 0 && remaining <= 3) expiringIn3 += 1;
    if (shop.startsAt && new Date(shop.startsAt) >= monthStart && shop.status === "active") renewedThisMonth += 1;
  }

  return {
    totalShops: shops.length,
    activePlans,
    expiredPlans,
    expiringIn3Days: expiringIn3,
    renewedThisMonth,
  };
}

export async function approveShop(shopId: string, adminId: string) {
  await connectDb();
  const shop = await Shop.findOne({ _id: shopId, deletedAt: { $exists: false } });
  if (!shop) return { ok: false as const, status: 404, error: "Shop not found." };
  if (shop.status === "rejected") return { ok: false as const, status: 400, error: "Rejected shops cannot be approved." };

  const startsAt = new Date();
  const expiresAt = getPlanExpiry(shop.plan as ShopPlanId, startsAt);
  shop.paymentStatus = "approved";
  shop.status = "active";
  shop.startsAt = startsAt;
  shop.expiresAt = expiresAt;
  shop.approvedAt = startsAt;
  shop.approvedBy = new Types.ObjectId(adminId);
  shop.rejectionReason = undefined;
  shop.updatedBy = new Types.ObjectId(adminId);
  await shop.save();
  return { ok: true as const, shop };
}

export async function rejectShop(shopId: string, adminId: string, reason?: string) {
  await connectDb();
  const shop = await Shop.findOne({ _id: shopId, deletedAt: { $exists: false } });
  if (!shop) return { ok: false as const, status: 404, error: "Shop not found." };
  shop.paymentStatus = "rejected";
  shop.status = "rejected";
  shop.rejectionReason = reason?.trim() || "Payment could not be verified.";
  shop.updatedBy = new Types.ObjectId(adminId);
  await shop.save();
  return { ok: true as const, shop };
}

export async function suspendShop(shopId: string, adminId: string) {
  await connectDb();
  const shop = await Shop.findOne({ _id: shopId, deletedAt: { $exists: false } });
  if (!shop) return { ok: false as const, status: 404, error: "Shop not found." };
  shop.status = "suspended";
  shop.updatedBy = new Types.ObjectId(adminId);
  await shop.save();
  return { ok: true as const, shop };
}

export async function getShopById(shopId: string) {
  await connectDb();
  return Shop.findOne({ _id: shopId, deletedAt: { $exists: false } }).lean();
}
