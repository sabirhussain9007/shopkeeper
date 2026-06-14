import { Supplier } from "@/models";
import { supplierSchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: Supplier,
  schema: supplierSchema,
  permission: "inventory:write",
  searchFields: ["supplierName","phone","contactPerson"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
