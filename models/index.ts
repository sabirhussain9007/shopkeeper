import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
};

const schemaOptions = { timestamps: true };

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "manager", "cashier"], required: true, index: true },
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
    name: { type: String, required: true, trim: true, unique: true },
    description: String,
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    ...auditFields,
  },
  schemaOptions,
);

const supplierSchema = new Schema(
  {
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
    productName: { type: String, required: true, trim: true, index: "text" },
    sku: { type: String, required: true, unique: true, uppercase: true, index: true },
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

productSchema.index({ productName: "text", sku: "text", barcode: "text", brand: "text" });

const saleItemSchema = new Schema(
  {
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
    invoiceNumber: { type: String, required: true, unique: true, index: true },
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

saleSchema.index({ createdAt: -1, status: 1 });

const purchaseItemSchema = new Schema(
  {
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
    ...auditFields,
  },
  schemaOptions,
);

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
