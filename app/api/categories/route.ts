import { Category } from "@/models";
import { categorySchema } from "@/schemas/domain";
import { crudHandlers } from "@/lib/crud";

const handlers = crudHandlers({
  model: Category,
  schema: categorySchema,
  permission: "inventory:write",
  searchFields: ["name"],
});

export const GET = handlers.GET;
export const POST = handlers.POST;
