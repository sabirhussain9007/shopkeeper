import type { z } from "zod";
import type {
  attendanceSchema,
  categorySchema,
  customerSchema,
  employeeSchema,
  expenseSchema,
  productSchema,
  purchaseSchema,
  salarySchema,
  saleSchema,
  settingsSchema,
  supplierSchema,
  userSchema,
} from "@/schemas/domain";

export const roles = ["super_admin", "admin", "manager", "cashier"] as const;
export type Role = (typeof roles)[number];

export const shopRoles = ["admin", "manager", "cashier"] as const;
export type ShopRole = (typeof shopRoles)[number];

export const permissions = [
  "dashboard:read",
  "inventory:write",
  "pos:write",
  "ledger:write",
  "reports:read",
  "settings:write",
  "users:write",
  "shops:manage",
  "employees:write",
  "attendance:write",
  "salaries:write",
  "expenses:write",
  "activity:read",
] as const;
export type Permission = (typeof permissions)[number];

export const rolePermissions: Record<Role, Permission[]> = {
  super_admin: ["shops:manage"],
  admin: [
    "dashboard:read",
    "inventory:write",
    "pos:write",
    "ledger:write",
    "reports:read",
    "settings:write",
    "users:write",
    "employees:write",
    "attendance:write",
    "salaries:write",
    "expenses:write",
    "activity:read",
  ],
  manager: [
    "dashboard:read",
    "inventory:write",
    "pos:write",
    "ledger:write",
    "reports:read",
    "employees:write",
    "attendance:write",
    "salaries:write",
    "expenses:write",
  ],
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
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type SalaryInput = z.infer<typeof salarySchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;

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
