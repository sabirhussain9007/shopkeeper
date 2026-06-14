import { Product } from "@/models";
import { productSchema } from "@/schemas/domain";
import { crudHandlers } from "@/lib/crud";

const handlers = crudHandlers({
  model: Product,
  schema: productSchema,
  permission: "inventory:write",
  searchFields: ["productName","sku","barcode","brand"],
});

export const GET = handlers.GET;
export const POST = handlers.POST;
