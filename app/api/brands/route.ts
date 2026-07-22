import { Brand } from "@/models";
import { brandSchema } from "@/schemas/domain";
import { crudHandlers } from "@/lib/crud";

const handlers = crudHandlers({
  model: Brand,
  schema: brandSchema,
  permission: "inventory:write",
  searchFields: ["name", "description"],
  activityEntity: "brand",
});

export const GET = handlers.GET;
export const POST = handlers.POST;
