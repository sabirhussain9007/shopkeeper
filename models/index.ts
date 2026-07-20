import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
};

const schemaOptions = { timestamps: true };

const shopRef = { type: Schema.Types.ObjectId, ref: "Shop", index: true };

const shopSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    ownerName: { type: String, required: true, trim: true },
    ownerEmail: { type: String, required: true, lowercase: true, index: true },
    ownerPhone: { type: String, trim: true },
    plan: { type: String, enum: ["monthly", "yearly"], required: true },
    planAmount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["easypaisa", "jazzcash", "bank"], required: true },
    paymentReference: { type: String, required: true, trim: true, index: true },
    paymentStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    status: { type: String, enum: ["pending", "active", "expired", "suspended", "rejected"], default: "pending", index: true },
    gatewayTxnId: String,
    gatewayResponse: { type: Schema.Types.Mixed },
    paidAt: Date,
    startsAt: Date,
    expiresAt: { type: Date, index: true },
    approvedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: String,
    notes: String,
    ...auditFields,
  },
  schemaOptions,
);

const userSchema = new Schema(
  {
    shopId: shopRef,
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["super_admin", "admin", "manager", "cashier"], required: true, index: true },
    permissions: [{ type: String }],
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    lastLoginAt: Date,
    resetTokenHash: String,
    resetTokenExpiresAt: Date,
    ...auditFields,
  },
  schemaOptions,
);

const roleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    permissions: [{ type: String, required: true }],
    description: String,
    ...auditFields,
  },
  schemaOptions,
);

const categorySchema = new Schema(
  {
    shopId: shopRef,
    name: { type: String, required: true, trim: true },
    description: String,
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    ...auditFields,
  },
  schemaOptions,
);
categorySchema.index({ shopId: 1, name: 1 }, { unique: true });

const supplierSchema = new Schema(
  {
    shopId: shopRef,
    supplierName: { type: String, required: true, trim: true, index: "text" },
    contactPerson: String,
    phone: { type: String, required: true, index: true },
    address: String,
    notes: String,
    openingBalance: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    ...auditFields,
  },
  schemaOptions,
);

const customerSchema = new Schema(
  {
    shopId: shopRef,
    name: { type: String, required: true, trim: true, index: "text" },
    phone: { type: String, required: true, index: true },
    address: String,
    creditLimit: { type: Number, default: 0 },
    openingBalance: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0, index: true },
    notes: String,
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    ...auditFields,
  },
  schemaOptions,
);

customerSchema.pre("save", function () {
  if (this.isNew && (this.currentBalance === 0 || this.currentBalance == null) && this.openingBalance) {
    this.currentBalance = this.openingBalance;
  }
});

const productSchema = new Schema(
  {
    shopId: shopRef,
    productName: { type: String, required: true, trim: true, index: "text" },
    sku: { type: String, required: true, uppercase: true, index: true },
    barcode: { type: String, index: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", index: true },
    brand: String,
    unit: { type: String, default: "pcs" },
    purchasePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0 },
    quantity: { type: Number, default: 0, min: 0, index: true },
    reorderLevel: { type: Number, default: 5, index: true },
    supplier: { type: Schema.Types.ObjectId, ref: "Supplier", index: true },
    productImage: String,
    description: String,
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    ...auditFields,
  },
  schemaOptions,
);
productSchema.index({ shopId: 1, sku: 1 }, { unique: true });
productSchema.index({ productName: "text", sku: "text", barcode: "text", brand: "text" });

const saleItemSchema = new Schema(
  {
    shopId: shopRef,
    sale: { type: Schema.Types.ObjectId, ref: "Sale", index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    name: String,
    sku: String,
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    purchasePrice: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
    ...auditFields,
  },
  schemaOptions,
);

const saleSchema = new Schema(
  {
    shopId: shopRef,
    invoiceNumber: { type: String, required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", index: true },
    cashier: { type: Schema.Types.ObjectId, ref: "User", index: true },
    subtotal: Number,
    discountType: { type: String, enum: ["flat", "percentage"], default: "flat" },
    discountValue: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true, index: true },
    paidAmount: { type: Number, default: 0 },
    changeDue: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ["cash", "credit", "split"], required: true, index: true },
    status: { type: String, enum: ["draft", "held", "completed", "void", "refunded"], default: "completed", index: true },
    notes: String,
    ...auditFields,
  },
  schemaOptions,
);
saleSchema.index({ shopId: 1, invoiceNumber: 1 }, { unique: true });
saleSchema.index({ createdAt: -1, status: 1 });

const purchaseItemSchema = new Schema(
  {
    shopId: shopRef,
    purchase: { type: Schema.Types.ObjectId, ref: "Purchase", index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    name: String,
    quantity: Number,
    cost: Number,
    taxRate: Number,
    lineTotal: Number,
    ...auditFields,
  },
  schemaOptions,
);

const purchaseSchema = new Schema(
  {
    shopId: shopRef,
    supplier: { type: Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    subtotal: Number,
    taxes: Number,
    grandTotal: Number,
    paidAmount: Number,
    status: { type: String, enum: ["ordered", "received", "cancelled"], default: "ordered", index: true },
    ...auditFields,
  },
  schemaOptions,
);

const ledgerEntrySchema = new Schema(
  {
    shopId: shopRef,
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    sale: { type: Schema.Types.ObjectId, ref: "Sale", index: true },
    type: { type: String, enum: ["credit_sale", "payment_received", "adjustment"], required: true, index: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    description: { type: String, required: true },
    entryDate: { type: Date, default: Date.now, index: true },
    ...auditFields,
  },
  schemaOptions,
);
ledgerEntrySchema.index({ customer: 1, entryDate: -1 });

const stockAdjustmentSchema = new Schema(
  {
    shopId: shopRef,
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    type: { type: String, enum: ["increase", "decrease", "manual"], required: true },
    quantity: Number,
    previousQuantity: Number,
    newQuantity: Number,
    reason: String,
    ...auditFields,
  },
  schemaOptions,
);

const settingSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", unique: true, sparse: true, index: true },
    appName: { type: String, default: "Shopkeeper" },
    appTagline: { type: String, default: "Retail Command" },
    dashboardTitle: { type: String, default: "Enterprise Retail Management" },
    businessName: { type: String, required: true },
    address: String,
    phone: String,
    email: String,
    gstVatNumber: String,
    ntn: String,
    logo: String,
    currency: { type: String, default: "PKR" },
    taxRate: { type: Number, default: 0 },
    receiptSize: { type: String, enum: ["58mm", "80mm", "a4"], default: "80mm" },
    receiptLogoAlign: { type: String, enum: ["left", "center", "right"], default: "center" },
    receiptHeader: String,
    receiptFooter: String,
    thankYouMessage: String,
    managerRoutes: [{ type: String }],
    cashierRoutes: [{ type: String }],
    ...auditFields,
  },
  schemaOptions,
);

const employeeSchemaDef = new Schema(
  {
    shopId: shopRef,
    employeeId: { type: String, required: true, index: true },
    fullName: { type: String, required: true, trim: true, index: true },
    profileImage: String,
    cnic: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: String,
    dateOfBirth: Date,
    joiningDate: { type: Date, required: true },
    department: { type: String, required: true, trim: true, index: true },
    designation: { type: String, required: true, trim: true },
    salary: { type: Number, default: 0 },
    employmentType: { type: String, enum: ["full_time", "part_time", "contract", "intern"], default: "full_time" },
    shift: { type: String, enum: ["morning", "evening", "night", "flexible"], default: "morning" },
    emergencyContact: String,
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    notes: String,
    ...auditFields,
  },
  schemaOptions,
);
employeeSchemaDef.index({ shopId: 1, employeeId: 1 }, { unique: true });
employeeSchemaDef.index({ shopId: 1, cnic: 1 }, { unique: true });

const attendanceSchemaDef = new Schema(
  {
    shopId: shopRef,
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    date: { type: Date, required: true, index: true },
    checkIn: String,
    checkOut: String,
    status: {
      type: String,
      enum: ["present", "absent", "half_day", "leave", "late", "early_leave"],
      default: "present",
      index: true,
    },
    notes: String,
    ...auditFields,
  },
  schemaOptions,
);
attendanceSchemaDef.index({ shopId: 1, employee: 1, date: 1 }, { unique: true });

const salarySchemaDef = new Schema(
  {
    shopId: shopRef,
    employee: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    year: { type: Number, required: true, index: true },
    basicSalary: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    allowance: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    advanceSalary: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending", index: true },
    paidAt: Date,
    notes: String,
    ...auditFields,
  },
  schemaOptions,
);
salarySchemaDef.index({ shopId: 1, employee: 1, month: 1, year: 1 }, { unique: true });

const expenseSchemaDef = new Schema(
  {
    shopId: shopRef,
    category: {
      type: String,
      enum: ["rent", "electricity", "transportation", "internet", "salary", "water", "gas", "maintenance", "marketing", "miscellaneous"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    expenseDate: { type: Date, required: true, index: true },
    paymentMethod: { type: String, enum: ["cash", "bank", "easypaisa", "jazzcash", "other"], default: "cash" },
    reference: String,
    notes: String,
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    ...auditFields,
  },
  schemaOptions,
);

const activityLogSchema = new Schema(
  {
    shopId: shopRef,
    shopName: { type: String, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    userName: String,
    userEmail: String,
    userRole: { type: String, index: true },
    module: { type: String, index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, index: true },
    entityId: String,
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    ip: String,
    browser: String,
    device: String,
    userAgent: String,
  },
  schemaOptions,
);
activityLogSchema.index({ shopId: 1, createdAt: -1 });
activityLogSchema.index({ shopId: 1, module: 1, createdAt: -1 });
activityLogSchema.index({ shopId: 1, userId: 1, createdAt: -1 });
activityLogSchema.index({ shopId: 1, action: 1, createdAt: -1 });

const notificationSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    audience: { type: String, enum: ["shop", "super_admin", "user"], default: "shop", index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ["info", "warning", "danger", "success"], default: "info" },
    category: { type: String, default: "general", index: true },
    readAt: Date,
    metadata: { type: Schema.Types.Mixed },
  },
  schemaOptions,
);
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ audience: 1, createdAt: -1 });

export const Shop = (models.Shop as Model<InferSchemaType<typeof shopSchema>>) || model("Shop", shopSchema);
export const User = (models.User as Model<InferSchemaType<typeof userSchema>>) || model("User", userSchema);
export const RoleModel = (models.Role as Model<InferSchemaType<typeof roleSchema>>) || model("Role", roleSchema);
export const Product = (models.Product as Model<InferSchemaType<typeof productSchema>>) || model("Product", productSchema);
export const Category = (models.Category as Model<InferSchemaType<typeof categorySchema>>) || model("Category", categorySchema);
export const Customer = (models.Customer as Model<InferSchemaType<typeof customerSchema>>) || model("Customer", customerSchema);
export const Supplier = (models.Supplier as Model<InferSchemaType<typeof supplierSchema>>) || model("Supplier", supplierSchema);
export const Sale = (models.Sale as Model<InferSchemaType<typeof saleSchema>>) || model("Sale", saleSchema);
export const SaleItem = (models.SaleItem as Model<InferSchemaType<typeof saleItemSchema>>) || model("SaleItem", saleItemSchema);
export const Purchase = (models.Purchase as Model<InferSchemaType<typeof purchaseSchema>>) || model("Purchase", purchaseSchema);
export const PurchaseItem = (models.PurchaseItem as Model<InferSchemaType<typeof purchaseItemSchema>>) || model("PurchaseItem", purchaseItemSchema);
export const LedgerEntry = (models.LedgerEntry as Model<InferSchemaType<typeof ledgerEntrySchema>>) || model("LedgerEntry", ledgerEntrySchema);
export const StockAdjustment = (models.StockAdjustment as Model<InferSchemaType<typeof stockAdjustmentSchema>>) || model("StockAdjustment", stockAdjustmentSchema);
export const Setting = (models.Setting as Model<InferSchemaType<typeof settingSchema>>) || model("Setting", settingSchema);
export const Employee = (models.Employee as Model<InferSchemaType<typeof employeeSchemaDef>>) || model("Employee", employeeSchemaDef);
export const Attendance = (models.Attendance as Model<InferSchemaType<typeof attendanceSchemaDef>>) || model("Attendance", attendanceSchemaDef);
export const Salary = (models.Salary as Model<InferSchemaType<typeof salarySchemaDef>>) || model("Salary", salarySchemaDef);
export const Expense = (models.Expense as Model<InferSchemaType<typeof expenseSchemaDef>>) || model("Expense", expenseSchemaDef);
export const ActivityLog = (models.ActivityLog as Model<InferSchemaType<typeof activityLogSchema>>) || model("ActivityLog", activityLogSchema);
export const Notification = (models.Notification as Model<InferSchemaType<typeof notificationSchema>>) || model("Notification", notificationSchema);
