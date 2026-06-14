import { Sale } from "@/models";
import { saleSchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: Sale,
  schema: saleSchema,
  permission: "pos:write",
  searchFields: ["invoiceNumber","notes"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
