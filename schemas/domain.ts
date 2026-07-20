import { z } from "zod";
import { permissions, shopRoles } from "@/types";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const money = z.coerce.number().min(0);
const phone = z.string().min(5).max(30);
const status = z.enum(["active", "inactive"]);

export const paginationSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: status.optional(),
});

export const userSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).optional(),
  role: z.enum(shopRoles),
  permissions: z.array(z.enum(permissions)).default([]),
  status: status.default("active"),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8),
});

export const signupSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email().toLowerCase(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const createShopSchema = z
  .object({
    shopName: z.string().min(2).max(160),
    ownerName: z.string().min(2).max(120),
    ownerEmail: z.string().email().toLowerCase(),
    ownerPhone: z.string().min(5).max(30).optional().default(""),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    plan: z.enum(["monthly", "yearly"]),
    paymentMethod: z.enum(["easypaisa", "jazzcash", "bank"]),
    paymentReference: z.string().min(3).max(120),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const categorySchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().default(""),
  status: status.default("active"),
});

export const supplierSchema = z.object({
  supplierName: z.string().min(2).max(160),
  contactPerson: z.string().max(120).optional().default(""),
  phone,
  address: z.string().max(500).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
  openingBalance: money.default(0),
  status: status.default("active"),
});

export const customerSchema = z.object({
  name: z.string().min(2).max(160),
  phone,
  address: z.string().max(500).optional().default(""),
  creditLimit: money.default(0),
  openingBalance: z.coerce.number().default(0),
  notes: z.string().max(1000).optional().default(""),
  status: status.default("active"),
});

export const productSchema = z.object({
  productName: z.string().min(2).max(180),
  sku: z.string().min(2).max(80).toUpperCase(),
  barcode: z.string().max(80).optional().default(""),
  category: objectId.optional(),
  brand: z.string().max(120).optional().default(""),
  unit: z.string().min(1).max(40).default("pcs"),
  purchasePrice: money,
  sellingPrice: money,
  taxRate: z.coerce.number().min(0).max(100).default(0),
  quantity: z.coerce.number().min(0).default(0),
  reorderLevel: z.coerce.number().min(0).default(5),
  supplier: objectId.optional(),
  productImage: z.string().url().optional().or(z.literal("")).default(""),
  description: z.string().max(1000).optional().default(""),
  status: status.default("active"),
});

export const stockAdjustmentSchema = z.object({
  product: objectId,
  type: z.enum(["increase", "decrease", "manual"]),
  quantity: z.coerce.number().positive(),
  previousQuantity: z.coerce.number().min(0),
  newQuantity: z.coerce.number().min(0),
  reason: z.string().min(3).max(500),
});

const saleItemSchema = z.object({
  product: objectId,
  name: z.string(),
  sku: z.string(),
  quantity: z.coerce.number().positive(),
  unitPrice: money,
  purchasePrice: money.default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  discount: money.default(0),
  lineTotal: money,
});

export const saleSchema = z.object({
  invoiceNumber: z.string().min(3),
  customer: objectId.optional(),
  cashier: objectId.optional(),
  items: z.array(saleItemSchema).min(1),
  subtotal: money,
  discountType: z.enum(["flat", "percentage"]).default("flat"),
  discountValue: money.default(0),
  taxTotal: money.default(0),
  grandTotal: money,
  paidAmount: money.default(0),
  changeDue: z.coerce.number().default(0),
  paymentMethod: z.enum(["cash", "credit", "split"]),
  status: z.enum(["draft", "held", "completed", "void", "refunded"]).default("completed"),
  notes: z.string().max(1000).optional().default(""),
});

const purchaseItemSchema = z.object({
  product: objectId,
  name: z.string(),
  quantity: z.coerce.number().positive(),
  cost: money,
  taxRate: z.coerce.number().min(0).max(100).default(0),
  lineTotal: money,
});

export const purchaseSchema = z.object({
  supplier: objectId,
  products: z.array(purchaseItemSchema).min(1),
  subtotal: money,
  taxes: money.default(0),
  grandTotal: money,
  paidAmount: money.default(0),
  status: z.enum(["ordered", "received", "cancelled"]).default("ordered"),
});

export const ledgerEntrySchema = z.object({
  customer: objectId,
  sale: objectId.optional(),
  type: z.enum(["credit_sale", "payment_received", "adjustment"]),
  debit: money.default(0),
  credit: money.default(0),
  balance: z.coerce.number(),
  description: z.string().min(2).max(500),
  entryDate: z.coerce.date().default(() => new Date()),
});

export const settingsSchema = z.object({
  appName: z.string().min(2).max(80).default("Shopkeeper"),
  appTagline: z.string().min(2).max(120).default("Retail Command"),
  dashboardTitle: z.string().min(2).max(160).default("Enterprise Retail Management"),
  businessName: z.string().min(2).max(160),
  address: z.string().max(500).default(""),
  phone: z
    .string()
    .max(30)
    .regex(/^[+\d\s().-]*$/, "Phone can only contain numbers, spaces, +, -, parentheses, and dots.")
    .default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  gstVatNumber: z.string().max(80).default(""),
  ntn: z.string().max(80).default(""),
  logo: z
    .string()
    .max(2_500_000)
    .refine((value) => value === "" || value.startsWith("data:image/") || z.string().url().safeParse(value).success, "Logo must be a URL or uploaded image.")
    .default(""),
  currency: z.string().min(3).max(3).default("PKR"),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  receiptSize: z.enum(["58mm", "80mm", "a4"]).default("80mm"),
  receiptLogoAlign: z.enum(["left", "center", "right"]).default("center"),
  receiptHeader: z.string().max(500).default(""),
  receiptFooter: z.string().max(500).default(""),
  thankYouMessage: z.string().max(200).default("Thank you for shopping with us."),
  managerRoutes: z
    .array(
      z.enum([
        "dashboard",
        "inventory",
        "categories",
        "customers",
        "suppliers",
        "pos",
        "ledger",
        "sales",
        "purchases",
        "employees",
        "attendance",
        "salaries",
        "expenses",
        "activity",
        "reports",
        "settings",
      ]),
    )
    .default([
      "dashboard",
      "inventory",
      "categories",
      "customers",
      "suppliers",
      "pos",
      "ledger",
      "sales",
      "purchases",
      "employees",
      "attendance",
      "salaries",
      "expenses",
      "reports",
    ]),
  cashierRoutes: z
    .array(
      z.enum([
        "dashboard",
        "inventory",
        "categories",
        "customers",
        "suppliers",
        "pos",
        "ledger",
        "sales",
        "purchases",
        "employees",
        "attendance",
        "salaries",
        "expenses",
        "activity",
        "reports",
        "settings",
      ]),
    )
    .default(["pos", "sales"]),
});

export const expenseCategories = [
  "rent",
  "electricity",
  "transportation",
  "internet",
  "salary",
  "water",
  "gas",
  "maintenance",
  "marketing",
  "miscellaneous",
] as const;

export const employeeSchema = z.object({
  fullName: z.string().min(2).max(160),
  profileImage: z.string().max(2_500_000).optional().default(""),
  cnic: z.string().min(5).max(20),
  phone,
  email: z.string().email().toLowerCase().optional().or(z.literal("")).default(""),
  address: z.string().max(500).optional().default(""),
  dateOfBirth: z.coerce.date().optional().nullable(),
  joiningDate: z.coerce.date(),
  department: z.string().min(2).max(120),
  designation: z.string().min(2).max(120),
  salary: money.default(0),
  employmentType: z.enum(["full_time", "part_time", "contract", "intern"]).default("full_time"),
  shift: z.enum(["morning", "evening", "night", "flexible"]).default("morning"),
  emergencyContact: z.string().max(120).optional().default(""),
  status: status.default("active"),
  notes: z.string().max(1000).optional().default(""),
});

export const attendanceSchema = z.object({
  employee: objectId,
  date: z.coerce.date(),
  checkIn: z.string().max(10).optional().default(""),
  checkOut: z.string().max(10).optional().default(""),
  status: z.enum(["present", "absent", "half_day", "leave", "late", "early_leave"]).default("present"),
  notes: z.string().max(500).optional().default(""),
});

export const salarySchema = z.object({
  employee: objectId,
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  basicSalary: money.default(0),
  bonus: money.default(0),
  overtime: money.default(0),
  allowance: money.default(0),
  deductions: money.default(0),
  advanceSalary: money.default(0),
  tax: money.default(0),
  paymentStatus: z.enum(["pending", "paid"]).default("pending"),
  notes: z.string().max(500).optional().default(""),
});

export const expenseSchema = z.object({
  category: z.enum(expenseCategories),
  title: z.string().min(2).max(160),
  amount: money,
  expenseDate: z.coerce.date().default(() => new Date()),
  paymentMethod: z.enum(["cash", "bank", "easypaisa", "jazzcash", "other"]).default("cash"),
  reference: z.string().max(120).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
  status: status.default("active"),
});
