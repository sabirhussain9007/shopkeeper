import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { pakistanTodayKey } from "@/lib/datetime";
import { getExpiryWarningLabel, getRemainingDays, shouldBlinkExpiry } from "@/lib/saas";
import { Notification, Product, Shop, User } from "@/models";

export async function createNotification(input: {
  shopId?: string | null;
  userId?: string | null;
  audience?: "shop" | "super_admin" | "user";
  title: string;
  message: string;
  type?: "info" | "warning" | "danger" | "success";
  category?: string;
  metadata?: Record<string, unknown>;
}) {
  await connectDb();
  return Notification.create({
    shopId: input.shopId ? new Types.ObjectId(input.shopId) : undefined,
    userId: input.userId ? new Types.ObjectId(input.userId) : undefined,
    audience: input.audience ?? "shop",
    title: input.title,
    message: input.message,
    type: input.type ?? "info",
    category: input.category ?? "general",
    metadata: input.metadata ?? {},
  });
}

export async function listNotifications(params: {
  userId?: string | null;
  shopId?: string | null;
  audience?: "shop" | "super_admin" | "user";
  unreadOnly?: boolean;
  limit?: number;
}) {
  await connectDb();
  const filter: Record<string, unknown> = {};
  if (params.audience === "super_admin") {
    filter.audience = "super_admin";
  } else if (params.userId && params.shopId) {
    filter.$or = [
      { userId: new Types.ObjectId(params.userId) },
      { shopId: new Types.ObjectId(params.shopId), audience: "shop" },
    ];
  } else if (params.userId) {
    filter.userId = new Types.ObjectId(params.userId);
  } else if (params.shopId) {
    filter.shopId = new Types.ObjectId(params.shopId);
  }
  if (params.unreadOnly) filter.readAt = { $exists: false };

  const items = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(params.limit ?? 50)
    .lean();
  const unreadCount = await Notification.countDocuments({ ...filter, readAt: { $exists: false } });
  return { items, unreadCount };
}

export async function markNotificationRead(id: string, userId?: string | null) {
  await connectDb();
  const filter: Record<string, unknown> = { _id: id };
  if (userId) filter.userId = new Types.ObjectId(userId);
  return Notification.findOneAndUpdate(filter, { $set: { readAt: new Date() } }, { new: true });
}

export async function markAllNotificationsRead(params: { userId?: string | null; shopId?: string | null; audience?: "shop" | "super_admin" }) {
  await connectDb();
  const filter: Record<string, unknown> = { readAt: { $exists: false } };
  if (params.audience === "super_admin") filter.audience = "super_admin";
  if (params.userId) filter.userId = new Types.ObjectId(params.userId);
  if (params.shopId) filter.shopId = new Types.ObjectId(params.shopId);
  await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  return { ok: true };
}

/** Create expiry notifications for shops within 3 days (idempotent per day+level). */
export async function syncSubscriptionNotifications() {
  await connectDb();
  const shops = await Shop.find({ status: { $in: ["active", "expired"] }, expiresAt: { $exists: true } }).lean();
  const todayKey = pakistanTodayKey();

  for (const shop of shops) {
    const remaining = getRemainingDays(shop.expiresAt);
    if (!shouldBlinkExpiry(remaining) && remaining > 3) continue;

    const label = getExpiryWarningLabel(remaining);
    const category = `subscription-${remaining < 0 ? "expired" : remaining}`;
    const exists = await Notification.exists({
      shopId: shop._id,
      category,
      "metadata.day": todayKey,
    });
    if (exists) continue;

    const owners = await User.find({ shopId: shop._id, role: "admin", deletedAt: { $exists: false } }).lean();
    for (const owner of owners) {
      await createNotification({
        shopId: String(shop._id),
        userId: String(owner._id),
        audience: "user",
        title: label,
        message: `${shop.name}: ${label}. Renew to keep your shop online.`,
        type: remaining < 0 ? "danger" : "warning",
        category,
        metadata: { day: todayKey, remainingDays: remaining, shopName: shop.name },
      });
    }

    await createNotification({
      shopId: String(shop._id),
      audience: "super_admin",
      title: `${shop.name}: ${label}`,
      message: `Shop ${shop.name} package status: ${label}`,
      type: remaining < 0 ? "danger" : "warning",
      category,
      metadata: { day: todayKey, remainingDays: remaining, shopName: shop.name },
    });
  }
}

/** Notify shop about low stock and expiring products (once per day). */
export async function syncInventoryAlerts(shopId: string) {
  await connectDb();
  const todayKey = pakistanTodayKey();
  const base = { shopId, deletedAt: { $exists: false } };
  const soon = new Date();
  soon.setDate(soon.getDate() + 14);

  const [lowStock, expiring] = await Promise.all([
    Product.countDocuments({ ...base, $expr: { $lte: ["$quantity", "$reorderLevel"] } }),
    Product.countDocuments({ ...base, expiryDate: { $lte: soon, $gte: new Date() } }),
  ]);

  if (lowStock > 0) {
    const category = `low-stock-${todayKey}`;
    const exists = await Notification.exists({ shopId, category });
    if (!exists) {
      await createNotification({
        shopId,
        audience: "shop",
        title: "Low stock alert",
        message: `${lowStock} product(s) are at or below reorder level.`,
        type: "warning",
        category,
      });
    }
  }

  if (expiring > 0) {
    const category = `expiring-${todayKey}`;
    const exists = await Notification.exists({ shopId, category });
    if (!exists) {
      await createNotification({
        shopId,
        audience: "shop",
        title: "Expiring products",
        message: `${expiring} product(s) expire within 14 days.`,
        type: "warning",
        category,
      });
    }
  }
}
