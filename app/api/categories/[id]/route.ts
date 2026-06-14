import { Category } from "@/models";
import { categorySchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: Category,
  schema: categorySchema,
  permission: "inventory:write",
  searchFields: ["name"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
