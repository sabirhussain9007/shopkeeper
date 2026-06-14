import { Supplier } from "@/models";
import { supplierSchema } from "@/schemas/domain";
import { crudHandlers } from "@/lib/crud";

const handlers = crudHandlers({
  model: Supplier,
  schema: supplierSchema,
  permission: "inventory:write",
  searchFields: ["supplierName","phone","contactPerson"],
});

export const GET = handlers.GET;
export const POST = handlers.POST;
