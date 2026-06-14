import type { z } from "zod";
import type {
  categorySchema,
  customerSchema,
  productSchema,
  purchaseSchema,
  saleSchema,
  settingsSchema,
  supplierSchema,
  userSchema,
} from "@/schemas/domain";

export const roles = ["admin", "manager", "cashier"] as const;
export type Role = (typeof roles)[number];

export const permissions = [
  "dashboard:read",
  "inventory:write",
  "pos:write",
  "ledger:write",
  "reports:read",
  "settings:write",
  "users:write",
] as const;
export type Permission = (typeof permissions)[number];

export const rolePermissions: Record<Role, Permission[]> = {
  admin: [...permissions],
  manager: ["dashboard:read", "inventory:write", "pos:write", "ledger:write", "reports:read"],
  cashier: ["pos:write", "reports:read"],
};

export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;

export type PaymentMethod = "cash" | "credit" | "split";
export type ReceiptSize = "58mm" | "80mm" | "a4";

export type CartItem = {
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  purchasePrice: number;
  taxRate: number;
  discount: number;
  stockAvailable: number;
};

export type HeldOrder = {
  id: string;
  name: string;
  customerId?: string;
  items: CartItem[];
  discountType: "flat" | "percentage";
  discountValue: number;
  createdAt: string;
};

export type ApiResult<T> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
