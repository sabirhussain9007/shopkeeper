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

const ACTION_VERB_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  restored: "Restored",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
  login: "Signed in",
  logout: "Signed out",
  bounced: "Bounced",
  received: "Received",
  paid: "Paid",
};

const ACTION_ENTITY_LABELS: Record<string, string> = {
  product: "product",
  category: "category",
  supplier: "supplier",
  purchase: "purchase",
  sale: "sale",
  customer: "customer",
  employee: "employee",
  expense: "expense",
  salary: "salary",
  setting: "settings",
  shop: "shop",
  user: "user",
  auth: "account",
};

export function moduleFromAction(action: string, entity?: string | null) {
  if (entity && MODULE_BY_ENTITY[entity]) return MODULE_BY_ENTITY[entity];
  const prefix = action.split(".")[0];
  if (prefix && MODULE_BY_ENTITY[prefix]) return MODULE_BY_ENTITY[prefix];
  if (action.startsWith("auth.")) return "Auth";
  return entity ? entity.charAt(0).toUpperCase() + entity.slice(1) : "System";
}

/** Human-readable label for activity action codes (e.g. product.created). */
export function formatActivityActionLabel(action: string) {
  const parts = action.split(".").filter(Boolean);
  if (parts.length === 0) return action;
  if (action.startsWith("auth.")) {
    return ACTION_VERB_LABELS[parts[1] ?? ""] ?? action.replace(/\./g, " ");
  }
  const [entity, verb] = parts;
  const verbLabel = ACTION_VERB_LABELS[verb ?? ""] ?? verb?.replace(/_/g, " ") ?? "";
  const entityLabel = ACTION_ENTITY_LABELS[entity ?? ""] ?? entity?.replace(/_/g, " ") ?? "";
  if (verbLabel && entityLabel) return `${verbLabel} ${entityLabel}`;
  return action.replace(/\./g, " · ").replace(/_/g, " ");
}
