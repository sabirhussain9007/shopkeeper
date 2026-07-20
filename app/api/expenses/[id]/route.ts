import { Expense } from "@/models";
import { expenseSchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: Expense,
  schema: expenseSchema,
  permission: "expenses:write",
  searchFields: ["title", "category", "reference", "notes"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
