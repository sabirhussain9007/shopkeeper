import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import {
  DEFAULT_CASHIER_ROUTES,
  DEFAULT_MANAGER_ROUTES,
  permissionsFromRoutes,
  sanitizeNavRoutes,
  type NavRouteId,
} from "@/lib/nav-access";
import { withShopFilter } from "@/lib/tenant";
import { Setting, User } from "@/models";
import { settingsSchema } from "@/schemas/domain";
import type { Permission, SettingsInput, ShopRole } from "@/types";
import { rolePermissions } from "@/types";

export const defaultSettings: SettingsInput = {
  appName: "Shopkeeper",
  appTagline: "Retail Command",
  dashboardTitle: "Enterprise Retail Management",
  businessName: "Shopkeeper",
  address: "",
  phone: "",
  email: "",
  gstVatNumber: "",
  ntn: "",
  logo: "",
  currency: "PKR",
  taxRate: 0,
  taxLabel: "Tax",
  taxInclusive: false,
  showTaxOnReceipt: true,
  receiptTitle: "Sales Receipt",
  receiptSize: "80mm",
  receiptLogoAlign: "center",
  receiptHeader: "",
  receiptFooter: "",
  thankYouMessage: "Thank you for shopping with us.",
  showReceiptLogo: true,
  showReceiptBarcode: true,
  showCashierOnReceipt: true,
  showCustomerOnReceipt: true,
  showSkuOnReceipt: false,
  showTaxNumbersOnReceipt: true,
  showEmailOnReceipt: false,
  autoPrintReceipt: false,
  timezone: "Asia/Karachi",
  language: "en",
  theme: "light",
  managerRoutes: [...DEFAULT_MANAGER_ROUTES],
  cashierRoutes: [...DEFAULT_CASHIER_ROUTES],
};

function withRouteDefaults(settings: SettingsInput & { _id: string | null }) {
  return {
    ...settings,
    managerRoutes: sanitizeNavRoutes(settings.managerRoutes, DEFAULT_MANAGER_ROUTES),
    cashierRoutes: sanitizeNavRoutes(settings.cashierRoutes, DEFAULT_CASHIER_ROUTES),
  };
}

export async function getActiveSettings(shopId?: string | null) {
  await connectDb();
  const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
  if (shopId) filter.shopId = shopId;
  const setting = await Setting.findOne(filter).sort({ updatedAt: -1 }).lean();
  if (!setting) return withRouteDefaults({ ...defaultSettings, _id: null as string | null });
  const { _id, ...rest } = setting;
  const merged = {
    ...defaultSettings,
    ...Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, value ?? undefined])),
    _id: _id.toString(),
  } as SettingsInput & { _id: string };
  const settings = withRouteDefaults(merged);
  if (settings.phone === defaultSettings.thankYouMessage) settings.phone = "";
  return settings;
}

export async function getRoleNavRoutes(role: ShopRole, shopId?: string | null): Promise<NavRouteId[]> {
  if (role === "admin") return [...DEFAULT_MANAGER_ROUTES, "activity", "settings"];
  const settings = await getActiveSettings(shopId);
  return role === "manager" ? settings.managerRoutes : settings.cashierRoutes;
}

export async function getRolePermissionsForShop(role: ShopRole, shopId?: string | null): Promise<Permission[]> {
  if (role === "admin") return rolePermissions.admin;
  const routes = await getRoleNavRoutes(role, shopId);
  return permissionsFromRoutes(routes);
}

async function syncRoleUserPermissions(shopId: string, role: "manager" | "cashier", routes: NavRouteId[]) {
  const permissions = permissionsFromRoutes(routes);
  await User.updateMany(withShopFilter(shopId, { role, deletedAt: { $exists: false } }), { $set: { permissions } });
}

export async function upsertSettings(input: SettingsInput, userId: string, shopId?: string | null, options?: { allowRoleAccessEdit?: boolean }) {
  const parsed = settingsSchema.parse(input);
  const managerRoutes = sanitizeNavRoutes(parsed.managerRoutes, DEFAULT_MANAGER_ROUTES);
  const cashierRoutes = sanitizeNavRoutes(parsed.cashierRoutes, DEFAULT_CASHIER_ROUTES);

  await connectDb();
  const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
  if (shopId) filter.shopId = shopId;
  const existing = await Setting.findOne(filter).sort({ updatedAt: -1 });

  const payload = {
    ...parsed,
    managerRoutes: options?.allowRoleAccessEdit === false && existing ? (existing.managerRoutes as NavRouteId[] | undefined) ?? managerRoutes : managerRoutes,
    cashierRoutes: options?.allowRoleAccessEdit === false && existing ? (existing.cashierRoutes as NavRouteId[] | undefined) ?? cashierRoutes : cashierRoutes,
  };

  if (existing) {
    Object.assign(existing, payload, { updatedBy: new Types.ObjectId(userId) });
    await existing.save();
    if (shopId && options?.allowRoleAccessEdit !== false) {
      await syncRoleUserPermissions(shopId, "manager", sanitizeNavRoutes(existing.managerRoutes, DEFAULT_MANAGER_ROUTES));
      await syncRoleUserPermissions(shopId, "cashier", sanitizeNavRoutes(existing.cashierRoutes, DEFAULT_CASHIER_ROUTES));
    }
    return existing;
  }

  const created = await Setting.create({ ...payload, shopId: shopId || undefined, createdBy: userId, updatedBy: userId });
  if (shopId && options?.allowRoleAccessEdit !== false) {
    await syncRoleUserPermissions(shopId, "manager", managerRoutes);
    await syncRoleUserPermissions(shopId, "cashier", cashierRoutes);
  }
  return created;
}
