import { Category } from "@/models";
import { categorySchema } from "@/schemas/domain";
import { crudHandlers } from "@/lib/crud";

const handlers = crudHandlers({
  model: Category,
  schema: categorySchema,
  permission: "inventory:write",
  searchFields: ["name"],
  activityEntity: "category",
  uniqueFields: [{ field: "name", caseInsensitive: true }],
  includeDeleted: true,
  listSort: { sortOrder: 1, name: 1, createdAt: 1 },
});

export const GET = handlers.GET;
export const POST = handlers.POST;
