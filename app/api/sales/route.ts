import { Sale } from "@/models";
import { saleSchema } from "@/schemas/domain";
import { crudHandlers } from "@/lib/crud";

const handlers = crudHandlers({
  model: Sale,
  schema: saleSchema,
  permission: "pos:write",
  searchFields: ["invoiceNumber","notes"],
});

export const GET = handlers.GET;
export const POST = handlers.POST;
