import { Coupon } from "@/models";
import { couponSchema } from "@/schemas/domain";
import { crudHandlers } from "@/lib/crud";

const handlers = crudHandlers({
  model: Coupon,
  schema: couponSchema,
  permission: "pos:write",
  searchFields: ["code"],
  activityEntity: "coupon",
});

export const GET = handlers.GET;
export const POST = handlers.POST;
