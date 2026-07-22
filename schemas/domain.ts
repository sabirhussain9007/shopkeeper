import { z } from "zod";
import {
  CNIC_ERROR,
  MOBILE_ERROR,
  BANK_ACCOUNT_ERROR,
  IBAN_ERROR,
  isValidBankAccountNumber,
  isValidCnic,
  isValidPakistanIban,
  isValidPakistanMobile,
  isValidWalletAccountNumber,
  normalizeBankAccountNumber,
  normalizeCnic,
  normalizePakistanIban,
  normalizePakistanMobile,
  normalizeWalletAccountNumber,
  WALLET_ACCOUNT_ERROR,
} from "@/lib/pakistan-validators";
import { permissions, shopRoles } from "@/types";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const optionalObjectId = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  objectId.optional(),
);
const money = z.coerce.number().min(0);
const status = z.enum(["active", "inactive"]);

export const cnicSchema = z
  .string()
  .trim()
  .min(1, "CNIC is required")
  .refine(isValidCnic, CNIC_ERROR)
  .transform(normalizeCnic);

export const pakistanMobileSchema = z
  .string()
  .trim()
  .min(1, "Mobile number is required")
  .refine(isValidPakistanMobile, MOBILE_ERROR)
  .transform(normalizePakistanMobile);

export const pakistanMobileOptionalSchema = z
  .string()
  .trim()
  .default("")
  .refine((value) => value === "" || isValidPakistanMobile(value), MOBILE_ERROR)
  .transform((value) => (value === "" ? "" : normalizePakistanMobile(value)));

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
    ownerPhone: pakistanMobileOptionalSchema,
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    plan: z.enum(["monthly", "yearly"]),
    paymentMethod: z.enum(["bank"]),
    paymentReference: z.string().min(3).max(120),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const categorySchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().default(""),
  parentId: optionalObjectId,
  icon: z.string().max(80).optional().default(""),
  image: z.string().max(2_500_000).optional().default(""),
  sortOrder: z.coerce.number().int().default(0),
  status: status.default("active"),
});

export const supplierSchema = z.object({
  supplierName: z.string().min(2).max(160),
  contactPerson: z.string().max(120).optional().default(""),
  phone: pakistanMobileSchema,
  address: z.string().max(500).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
  openingBalance: money.default(0),
  status: status.default("active"),
});

export const customerSchema = z.object({
  name: z.string().min(2).max(160),
  phone: pakistanMobileSchema,
  address: z.string().max(500).optional().default(""),
  creditLimit: money.default(0),
  openingBalance: z.coerce.number().default(0),
  groupId: objectId.optional(),
  rewardPoints: z.coerce.number().min(0).default(0),
  notes: z.string().max(1000).optional().default(""),
  status: status.default("active"),
});

export const productSchema = z.object({
  productName: z.string().min(2).max(180),
  sku: z.string().min(2).max(80).toUpperCase(),
  barcode: z.string().max(80).optional().default(""),
  category: optionalObjectId,
  brand: z.string().max(120).optional().default(""),
  brandId: optionalObjectId,
  unit: z.string().min(1).max(40).default("pcs"),
  purchasePrice: money,
  costPrice: money.default(0),
  sellingPrice: money,
  taxRate: z.coerce.number().min(0).max(100).default(0),
  quantity: z.coerce.number().min(0).default(0),
  reorderLevel: z.coerce.number().min(0).default(5),
  maxStock: z.coerce.number().min(0).default(0),
  expiryDate: z.coerce.date().optional().nullable(),
  qrCode: z.string().max(200).optional().default(""),
  warehouse: optionalObjectId,
  supplier: optionalObjectId,
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

export const buyStockSchema = z.object({
  vendorId: objectId,
  quantity: z.coerce.number().positive(),
  unitCost: money,
  paidAmount: money.default(0),
  notes: z.string().max(500).optional().default(""),
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
  paymentMethod: z.enum(["cash", "credit", "split", "card", "bank", "easypaisa", "jazzcash", "cheque"]),
  status: z.enum(["draft", "held", "completed", "void", "refunded"]).default("completed"),
  notes: z.string().max(1000).optional().default(""),
  couponCode: z.string().max(40).optional().default(""),
  pointsRedeemed: z.coerce.number().min(0).default(0),
  groupDiscount: money.default(0),
  chequeNumber: z.string().max(80).optional().default(""),
  bankName: z.string().max(120).optional().default(""),
  chequeDate: z.coerce.date().optional().nullable(),
}).superRefine((data, ctx) => {
  if ((data.paymentMethod === "bank" || data.paymentMethod === "easypaisa" || data.paymentMethod === "jazzcash") && !data.bankName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a registered payment account.", path: ["bankName"] });
  }
  if (data.paymentMethod === "easypaisa" || data.paymentMethod === "jazzcash") {
    if (!/Ref:\s*\d{4}\b/.test(data.notes ?? "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Last 4 digits are required for digital wallet payments.",
        path: ["notes"],
      });
    }
  }
  if (data.paymentMethod !== "cheque") return;
  if (!data.customer) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A customer is required for cheque payment.", path: ["customer"] });
  }
  if (!data.chequeNumber?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cheque number is required.", path: ["chequeNumber"] });
  }
  if (!data.bankName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bank name is required for cheque payment.", path: ["bankName"] });
  }
  if (!data.chequeDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cheque date is required.", path: ["chequeDate"] });
  }
});

const purchaseItemSchema = z.object({
  product: objectId,
  name: z.string(),
  quantity: z.coerce.number().positive(),
  cost: money,
  taxRate: z.coerce.number().min(0).max(100).default(0),
  discountType: z.enum(["flat", "flat_per_piece", "percentage"]).default("flat"),
  discountValue: money.default(0),
  salesTaxType: z.enum(["flat", "percentage"]).default("percentage"),
  salesTaxValue: money.default(0),
  grossAmount: money.default(0),
  netAmount: money.default(0),
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
  purchaseKind: z.enum(["order", "spot"]).default("order"),
  orderDate: z.coerce.date().optional(),
  invoiceNumber: z.string().max(80).optional().default(""),
  discountType: z.enum(["flat", "percentage"]).default("flat"),
  discountValue: money.default(0),
  salesTaxType: z.enum(["flat", "percentage"]).default("flat"),
  salesTaxValue: money.default(0),
  paymentMethod: z.enum(["cash", "cheque", "credit", "easypaisa", "jazzcash"]).default("cash"),
  chequeNumber: z.string().max(80).optional().default(""),
  chequeDate: z.coerce.date().optional().nullable(),
  bankName: z.string().max(120).optional().default(""),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === "easypaisa" || data.paymentMethod === "jazzcash") {
    const requiresWalletDetails = data.purchaseKind === "spot" || (data.paidAmount ?? 0) > 0;
    if (!requiresWalletDetails) return;
    if (!data.bankName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a registered payment account.",
        path: ["bankName"],
      });
    }
    const lastFour = data.chequeNumber?.trim() ?? "";
    if (!/^\d{4}$/.test(lastFour)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Last 4 digits are required for digital wallet payments.",
        path: ["chequeNumber"],
      });
    }
    return;
  }
  if (data.paymentMethod !== "cheque") return;
  const requiresChequeDetails = data.purchaseKind === "spot" || (data.paidAmount ?? 0) > 0;
  if (!requiresChequeDetails) return;
  if (!data.chequeNumber?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cheque number is required for cheque payment.", path: ["chequeNumber"] });
  }
  if (!data.bankName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a registered bank account for cheque payment.", path: ["bankName"] });
  }
  if (!data.chequeDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cheque date is required for cheque payment.", path: ["chequeDate"] });
  }
});

export const purchaseReceiveLineSchema = z.object({
  productId: objectId,
  receivedQuantity: z.coerce.number().min(0),
  receivedCost: money,
  discountType: z.enum(["flat", "flat_per_piece", "percentage"]).optional(),
  discountValue: money.optional(),
  salesTaxType: z.enum(["flat", "percentage"]).optional(),
  salesTaxValue: money.optional(),
});

export const purchaseReceiveSchema = z.object({
  items: z.array(purchaseReceiveLineSchema).min(1),
  paidAmount: money.optional(),
  paymentMethod: z.enum(["cash", "cheque", "credit"]).optional(),
  chequeNumber: z.string().max(80).optional().default(""),
  chequeDate: z.coerce.date().optional().nullable(),
  bankName: z.string().max(120).optional().default(""),
  advancePaid: money.optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod !== "cheque") return;
  const advancePaid = data.advancePaid ?? 0;
  const totalPaid = data.paidAmount ?? 0;
  const payOnDelivery = Math.max(totalPaid - advancePaid, 0);
  if (payOnDelivery <= 0) return;
  if (!data.chequeNumber?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cheque number is required for cheque payment.", path: ["chequeNumber"] });
  }
  if (!data.bankName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a registered bank account for cheque payment.", path: ["bankName"] });
  }
  if (!data.chequeDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cheque date is required for cheque payment.", path: ["chequeDate"] });
  }
});

export const vendorPaymentMethods = ["cash", "cheque", "bank", "card"] as const;

export const supplierLedgerPaymentSchema = z
  .object({
    supplierId: objectId,
    amount: z.coerce.number().positive("Amount must be greater than zero"),
    description: z.string().min(1).max(500),
    type: z.enum(["payment", "adjustment"]).default("payment"),
    entryDate: z.coerce.date().optional(),
    paymentMethod: z.enum(vendorPaymentMethods).default("cash"),
    reference: z.string().max(120).optional().default(""),
    bankName: z.string().max(120).optional().default(""),
    chequeDate: z.coerce.date().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== "payment") return;
    const reference = data.reference?.trim() ?? "";
    const bankName = data.bankName?.trim() ?? "";
    if (data.paymentMethod === "bank") {
      if (!reference) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Reference number is required for bank transfer", path: ["reference"] });
      }
      if (!bankName) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a registered bank account", path: ["bankName"] });
      }
      return;
    }
    if (data.paymentMethod === "cheque") {
      if (!reference) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cheque number is required", path: ["reference"] });
      }
      if (!bankName) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bank name is required for cheque", path: ["bankName"] });
      }
      if (!data.chequeDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cheque date is required", path: ["chequeDate"] });
      }
      return;
    }
    if (data.paymentMethod !== "cash" && !reference) {
      const label = data.paymentMethod === "card" ? "Card reference" : "Reference";
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is required`, path: ["reference"] });
    }
  });

const supplierLedgerRepaySchema = z.object({
  paymentMethod: z.enum(vendorPaymentMethods).default("cash"),
  reference: z.string().max(120).optional().default(""),
  bankName: z.string().max(120).optional().default(""),
  chequeDate: z.coerce.date().optional().nullable(),
  entryDate: z.coerce.date().optional(),
  description: z.string().min(1).max(500).optional(),
});

function refineVendorRepayment(data: z.infer<typeof supplierLedgerRepaySchema>, ctx: z.RefinementCtx, pathPrefix?: string) {
  const fieldPath = (key: string) => (pathPrefix ? [pathPrefix, key] : [key]);
  const reference = data.reference?.trim() ?? "";
  const bankName = data.bankName?.trim() ?? "";
  if (data.paymentMethod === "bank") {
    if (!reference) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Reference number is required for bank transfer", path: fieldPath("reference") });
    }
    if (!bankName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a registered bank account", path: fieldPath("bankName") });
    }
    return;
  }
  if (data.paymentMethod === "cheque") {
    if (!reference) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cheque number is required", path: fieldPath("reference") });
    }
    if (!bankName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bank name is required for cheque", path: fieldPath("bankName") });
    }
    if (!data.chequeDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cheque date is required", path: fieldPath("chequeDate") });
    }
    return;
  }
  if (data.paymentMethod !== "cash" && !reference) {
    const label = data.paymentMethod === "card" ? "Card reference" : "Reference";
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is required`, path: fieldPath("reference") });
  }
}

export const supplierLedgerChequeBounceSchema = z
  .object({
    supplierId: objectId,
    originalEntryId: objectId,
    entryDate: z.coerce.date().optional(),
    description: z.string().min(1).max(500).optional(),
    recordRepayment: z.boolean().default(true),
    repay: supplierLedgerRepaySchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.recordRepayment) return;
    if (!data.repay) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Repayment details are required.", path: ["repay"] });
      return;
    }
    refineVendorRepayment(data.repay, ctx, "repay");
  });

export const saleChequeBounceSchema = z
  .object({
    saleId: objectId,
    entryDate: z.coerce.date().optional(),
    description: z.string().min(1).max(500).optional(),
    recordRepayment: z.boolean().default(true),
    repay: supplierLedgerRepaySchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.recordRepayment) return;
    if (!data.repay) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Repayment details are required.", path: ["repay"] });
      return;
    }
    refineVendorRepayment(data.repay, ctx, "repay");
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

const navRouteEnum = z.enum([
  "dashboard",
  "inventory",
  "categories",
  "brands",
  "warehouses",
  "customers",
  "customer-groups",
  "coupons",
  "vendors",
  "suppliers",
  "pos",
  "ledger",
  "sales",
  "purchases",
  "spot-purchases",
  "employees",
  "attendance",
  "salaries",
  "expenses",
  "activity",
  "login-history",
  "reports",
  "settings",
  "accounting",
  "bank",
]);

export const settingsSchema = z.object({
  appName: z.string().min(2).max(80).default("Shopkeeper"),
  appTagline: z.string().min(2).max(120).default("Retail Command"),
  dashboardTitle: z.string().min(2).max(160).default("Enterprise Retail Management"),
  businessName: z.string().min(2).max(160),
  address: z.string().max(500).default(""),
  phone: pakistanMobileOptionalSchema,
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
  taxLabel: z.string().min(1).max(40).default("Tax"),
  taxInclusive: z.boolean().default(false),
  showTaxOnReceipt: z.boolean().default(true),
  receiptTitle: z.string().max(80).default("Sales Receipt"),
  receiptSize: z.enum(["58mm", "80mm", "a4"]).default("80mm"),
  receiptLogoAlign: z.enum(["left", "center", "right"]).default("center"),
  receiptHeader: z.string().max(500).default(""),
  receiptFooter: z.string().max(500).default(""),
  thankYouMessage: z.string().max(200).default("Thank you for shopping with us."),
  showReceiptLogo: z.boolean().default(true),
  showReceiptBarcode: z.boolean().default(true),
  showCashierOnReceipt: z.boolean().default(true),
  showCustomerOnReceipt: z.boolean().default(true),
  showSkuOnReceipt: z.boolean().default(false),
  showTaxNumbersOnReceipt: z.boolean().default(true),
  showEmailOnReceipt: z.boolean().default(false),
  autoPrintReceipt: z.boolean().default(false),
  timezone: z.string().max(80).default("Asia/Karachi"),
  language: z.string().max(10).default("en"),
  theme: z.enum(["light", "dark", "system"]).default("light"),
  managerRoutes: z.array(navRouteEnum).default([
    "dashboard",
    "inventory",
    "categories",
    "brands",
    "warehouses",
    "customers",
    "customer-groups",
    "coupons",
    "vendors",
    "pos",
    "ledger",
    "sales",
    "purchases",
    "spot-purchases",
    "employees",
    "attendance",
    "salaries",
    "expenses",
    "accounting",
    "bank",
    "reports",
  ]),
  cashierRoutes: z.array(navRouteEnum).default(["pos", "sales"]),
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
  cnic: cnicSchema,
  phone: pakistanMobileSchema,
  email: z.string().email().toLowerCase().optional().or(z.literal("")).default(""),
  address: z.string().max(500).optional().default(""),
  dateOfBirth: z.coerce.date().optional().nullable(),
  joiningDate: z.coerce.date(),
  department: z.string().min(2).max(120),
  designation: z.string().min(2).max(120),
  salary: money.default(0),
  employmentType: z.enum(["full_time", "part_time", "contract", "intern"]).default("full_time"),
  shift: z.enum(["morning", "evening", "night", "flexible"]).default("morning"),
  emergencyContact: pakistanMobileOptionalSchema,
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

export const expenseSchema = z
  .object({
    category: z.enum(expenseCategories),
    title: z.string().min(2).max(160),
    amount: money,
    expenseDate: z.coerce.date().default(() => new Date()),
    paymentMethod: z.enum(["cash", "bank", "other"]).default("cash"),
    bankName: z.string().max(120).optional().default(""),
    reference: z.string().max(120).optional().default(""),
    notes: z.string().max(1000).optional().default(""),
    status: status.default("active"),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod === "bank" && !data.bankName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a registered payment account.", path: ["bankName"] });
    }
  });

export const brandSchema = z.object({
  name: z.string().min(2).max(120),
  logo: z.string().max(2_500_000).optional().default(""),
  description: z.string().max(500).optional().default(""),
  status: status.default("active"),
});

export const shopAccountTypes = ["bank", "easypaisa", "jazzcash"] as const;

export const bankAccountBaseSchema = z.object({
  accountType: z.enum(shopAccountTypes).default("bank"),
  name: z.string().trim().min(2, "Display name is required.").max(120),
  accountTitle: z.string().trim().min(2, "Account title is required.").max(160),
  accountNumber: z.string().trim().min(1, "Account number is required.").max(40),
  branch: z.string().trim().max(120).optional().default(""),
  iban: z.string().trim().max(34).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  status: status.default("active"),
});

export const bankAccountFieldsSchema = bankAccountBaseSchema.superRefine((data, ctx) => {
  const isWallet = data.accountType === "easypaisa" || data.accountType === "jazzcash";
  if (isWallet) {
    if (!isValidWalletAccountNumber(data.accountNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: WALLET_ACCOUNT_ERROR,
        path: ["accountNumber"],
      });
    }
    return;
  }
  if (!isValidBankAccountNumber(data.accountNumber)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: BANK_ACCOUNT_ERROR,
      path: ["accountNumber"],
    });
  }
  const iban = normalizePakistanIban(data.iban ?? "");
  if (iban && !isValidPakistanIban(iban)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: IBAN_ERROR,
      path: ["iban"],
    });
  }
});

export const bankAccountSchema = bankAccountFieldsSchema.transform((data) => {
  const isWallet = data.accountType === "easypaisa" || data.accountType === "jazzcash";
  return {
    ...data,
    accountNumber: isWallet ? normalizeWalletAccountNumber(data.accountNumber) : normalizeBankAccountNumber(data.accountNumber),
    branch: isWallet ? "" : (data.branch ?? "").trim(),
    iban: isWallet ? "" : normalizePakistanIban(data.iban ?? ""),
    notes: (data.notes ?? "").trim(),
  };
});

export const warehouseSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(40).toUpperCase(),
  address: z.string().max(500).optional().default(""),
  phone: pakistanMobileOptionalSchema,
  isDefault: z.boolean().default(false),
  status: status.default("active"),
});

export const couponSchema = z.object({
  code: z.string().min(2).max(40).toUpperCase(),
  type: z.enum(["flat", "percentage"]).default("flat"),
  value: money,
  minOrder: money.default(0),
  maxUses: z.coerce.number().int().min(0).default(0),
  startsAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  status: status.default("active"),
});

export const customerGroupSchema = z.object({
  name: z.string().min(2).max(120),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  description: z.string().max(500).optional().default(""),
  status: status.default("active"),
});

export const accountingEntrySchema = z.object({
  book: z.enum(["cash", "bank", "income", "expense"]),
  type: z.enum(["debit", "credit"]),
  amount: money,
  reference: z.string().max(120).optional().default(""),
  description: z.string().min(2).max(500),
  entryDate: z.coerce.date().default(() => new Date()),
  bankName: z.string().max(120).optional().default(""),
  paymentMethod: z.enum(["cash", "cheque", "bank", "easypaisa", "jazzcash", "card"]).optional(),
});

export const bankDepositSchema = z
  .object({
    depositType: z.enum(["cash", "cheque"]),
    amount: money,
    bankName: z.string().min(1, "Bank name is required.").max(120),
    entryDate: z.coerce.date().optional(),
    reference: z.string().max(120).optional().default(""),
    description: z.string().max(500).optional().default(""),
    chequeDate: z.coerce.date().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.depositType === "cheque" && !data.reference?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cheque number is required.", path: ["reference"] });
    }
    if (data.depositType === "cheque" && !data.chequeDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cheque date is required.", path: ["chequeDate"] });
    }
  });

export const stockTransferSchema = z.object({
  product: objectId,
  fromWarehouse: objectId,
  toWarehouse: objectId,
  quantity: z.coerce.number().positive(),
  notes: z.string().max(500).optional().default(""),
});

export { navRouteEnum };
