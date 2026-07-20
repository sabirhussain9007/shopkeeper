import { Types } from "mongoose";
import type { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { getClientDeviceInfo, type ClientDeviceInfo } from "@/lib/request-meta";
import { ActivityLog, Shop } from "@/models";
import type { Role } from "@/types";

export type LogActivityInput = {
  shopId?: string | null;
  shopName?: string | null;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  module?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  browser?: string;
  device?: string;
  userAgent?: string;
  req?: NextRequest | Request | null;
};

const MODULE_BY_ENTITY: Record<string, string> = {
  user: "Auth",
  auth: "Auth",
  product: "Inventory",
  category: "Inventory",
  supplier: "Inventory",
  purchase: "Inventory",
  sale: "POS",
  customer: "Customers",
  ledger: "Customers",
  employee: "Employees",
  attendance: "Attendance",
  salary: "Salaries",
  expense: "Expenses",
  setting: "Settings",
  shop: "Subscription",
};

export function moduleFromAction(action: string, entity?: string | null) {
  if (entity && MODULE_BY_ENTITY[entity]) return MODULE_BY_ENTITY[entity];
  const prefix = action.split(".")[0];
  if (prefix && MODULE_BY_ENTITY[prefix]) return MODULE_BY_ENTITY[prefix];
  if (action.startsWith("auth.")) return "Auth";
  return entity ? entity.charAt(0).toUpperCase() + entity.slice(1) : "System";
}

export async function logActivity(input: LogActivityInput) {
  try {
    await connectDb();
    const deviceInfo: ClientDeviceInfo = input.req
      ? getClientDeviceInfo(input.req)
      : {
          ip: input.ip ?? "",
          browser: input.browser ?? "",
          device: input.device ?? "",
          userAgent: input.userAgent ?? "",
        };

    let shopName = input.shopName ?? "";
    if (!shopName && input.shopId) {
      const shop = await Shop.findById(input.shopId).select("name").lean();
      shopName = shop?.name ?? "";
    }

    await ActivityLog.create({
      shopId: input.shopId ? new Types.ObjectId(input.shopId) : undefined,
      shopName,
      userId: input.userId ? new Types.ObjectId(input.userId) : undefined,
      userName: input.userName ?? "",
      userEmail: input.userEmail ?? "",
      userRole: input.userRole ?? "",
      module: input.module || moduleFromAction(input.action, input.entity),
      action: input.action,
      entity: input.entity ?? "",
      entityId: input.entityId ?? "",
      description: input.description,
      metadata: input.metadata ?? {},
      ip: input.ip || deviceInfo.ip || "",
      browser: input.browser || deviceInfo.browser || "",
      device: input.device || deviceInfo.device || "",
      userAgent: input.userAgent || deviceInfo.userAgent || "",
    });
  } catch {
    // Never block business flows on audit failures.
  }
}

export async function logActivityFromSession(
  session: {
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      role?: Role | string;
      shopId?: string | null;
    };
  } | null,
  input: Omit<LogActivityInput, "userId" | "userName" | "userEmail" | "userRole" | "shopId"> & {
    shopId?: string | null;
  },
  req?: NextRequest | Request | null,
) {
  if (!session?.user) {
    await logActivity({ ...input, req });
    return;
  }
  await logActivity({
    ...input,
    shopId: input.shopId ?? session.user.shopId,
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    userRole: session.user.role,
    req,
  });
}

export async function listActivityLogs(
  shopId: string,
  params: {
    q?: string;
    page?: number;
    limit?: number;
    action?: string;
    module?: string;
    userId?: string;
    from?: string;
    to?: string;
  },
) {
  await connectDb();
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const filter: Record<string, unknown> = { shopId: new Types.ObjectId(shopId) };
  if (params.action) filter.action = params.action;
  if (params.module) filter.module = params.module;
  if (params.userId && Types.ObjectId.isValid(params.userId)) filter.userId = new Types.ObjectId(params.userId);
  if (params.from || params.to) {
    const createdAt: Record<string, Date> = {};
    if (params.from) createdAt.$gte = new Date(params.from);
    if (params.to) {
      const end = new Date(params.to);
      end.setHours(23, 59, 59, 999);
      createdAt.$lte = end;
    }
    filter.createdAt = createdAt;
  }
  if (params.q) {
    filter.$or = [
      { description: { $regex: params.q, $options: "i" } },
      { action: { $regex: params.q, $options: "i" } },
      { userName: { $regex: params.q, $options: "i" } },
      { module: { $regex: params.q, $options: "i" } },
      { entity: { $regex: params.q, $options: "i" } },
      { ip: { $regex: params.q, $options: "i" } },
    ];
  }
  const skip = (page - 1) * limit;
  const [items, total, users, modules, actions] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ActivityLog.countDocuments(filter),
    ActivityLog.aggregate([
      { $match: { shopId: new Types.ObjectId(shopId) } },
      { $group: { _id: { userId: "$userId", userName: "$userName" } } },
      { $sort: { "_id.userName": 1 } },
      { $limit: 100 },
    ]),
    ActivityLog.distinct("module", { shopId: new Types.ObjectId(shopId) }),
    ActivityLog.distinct("action", { shopId: new Types.ObjectId(shopId) }),
  ]);
  return {
    items,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    filters: {
      users: users
        .filter((u) => u._id?.userId)
        .map((u) => ({ id: String(u._id.userId), name: u._id.userName || "User" })),
      modules: (modules as string[]).filter(Boolean).sort(),
      actions: (actions as string[]).filter(Boolean).sort(),
    },
  };
}
