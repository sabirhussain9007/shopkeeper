import { Product } from "@/models";
import { productSchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: Product,
  schema: productSchema,
  permission: "inventory:write",
  searchFields: ["productName","sku","barcode","brand"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
