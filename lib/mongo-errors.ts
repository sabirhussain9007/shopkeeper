type MongoDuplicateKeyError = {
  code: 11000;
  keyPattern?: Record<string, number>;
  keyValue?: Record<string, unknown>;
};

const FIELD_LABELS: Record<string, string> = {
  name: "name",
  sku: "SKU",
  supplierName: "supplier name",
  code: "code",
  invoiceNumber: "invoice number",
  employeeId: "employee ID",
  cnic: "CNIC",
  email: "email",
  slug: "slug",
};

export function isMongoDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

export function duplicateKeyMessage(error: MongoDuplicateKeyError, entity?: string) {
  const pattern = error.keyPattern ?? {};
  const fields = Object.keys(pattern).filter((field) => field !== "shopId");
  const field = fields[0];
  const value = field ? error.keyValue?.[field] : undefined;
  const label = field ? (FIELD_LABELS[field] ?? field) : "value";
  const entityLabel = entity ? entity.replace(/_/g, " ") : "record";

  if (value !== undefined && value !== null && String(value).length > 0) {
    return `A ${entityLabel} with this ${label} already exists (${String(value)}).`;
  }

  return `A ${entityLabel} with this ${label} already exists.`;
}

export function duplicateFieldMessage(field: string, value: string, entity?: string) {
  const label = FIELD_LABELS[field] ?? field;
  const entityLabel = entity ? entity.replace(/_/g, " ") : "record";
  return `A ${entityLabel} with this ${label} already exists (${value}).`;
}

export function duplicateKeyField(error: MongoDuplicateKeyError) {
  const fields = Object.keys(error.keyPattern ?? {}).filter((field) => field !== "shopId");
  return fields[0];
}
