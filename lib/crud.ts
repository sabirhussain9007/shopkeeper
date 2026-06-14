import { NextResponse, type NextRequest } from "next/server";
import type { Model } from "mongoose";
import type { z } from "zod";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { paginationSchema } from "@/schemas/domain";
import type { Permission } from "@/types";

type CrudConfig = {
  model: Model<unknown>;
  schema: z.ZodTypeAny;
  permission: Permission;
  searchFields: string[];
};

export function crudHandlers(config: CrudConfig) {
  return {
    async GET(req: NextRequest) {
      const allowed = await requireApiPermission(config.permission);
      if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
      await connectDb();
      const query = Object.fromEntries(req.nextUrl.searchParams.entries());
      const params = paginationSchema.parse(query);
      const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
      if (params.status) filter.status = params.status;
      if (params.q) {
        filter.$or = config.searchFields.map((field) => ({ [field]: { $regex: params.q, $options: "i" } }));
      }
      const skip = (params.page - 1) * params.limit;
      const [items, total] = await Promise.all([
        config.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.limit).lean(),
        config.model.countDocuments(filter),
      ]);
      return NextResponse.json({ items, total, page: params.page, pages: Math.ceil(total / params.limit) });
    },
    async POST(req: NextRequest) {
      const allowed = await requireApiPermission(config.permission);
      if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
      await connectDb();
      const payload = config.schema.safeParse(await req.json());
      if (!payload.success) return NextResponse.json({ error: "Validation failed", fieldErrors: payload.error.flatten().fieldErrors }, { status: 422 });
      const created = await config.model.create({ ...(payload.data as object), createdBy: allowed.session.user.id });
      return NextResponse.json(created, { status: 201 });
    },
  };
}

export function crudItemHandlers(config: CrudConfig) {
  return {
    async GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
      const allowed = await requireApiPermission(config.permission);
      if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
      await connectDb();
      const { id } = await params;
      const item = await config.model.findOne({ _id: id, deletedAt: { $exists: false } }).lean();
      if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(item);
    },
    async PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
      const allowed = await requireApiPermission(config.permission);
      if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
      await connectDb();
      const body = await req.json();
      const partialSchema =
        "partial" in config.schema && typeof config.schema.partial === "function"
          ? (config.schema as z.ZodObject<z.ZodRawShape>).partial()
          : config.schema;
      const payload = partialSchema.safeParse(body);
      if (!payload.success) return NextResponse.json({ error: "Validation failed", fieldErrors: payload.error.flatten().fieldErrors }, { status: 422 });
      const { id } = await params;
      const updated = await config.model.findOneAndUpdate({ _id: id, deletedAt: { $exists: false } }, { $set: { ...(payload.data as object), updatedBy: allowed.session.user.id } }, { new: true });
      if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(updated);
    },
    async DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
      const allowed = await requireApiPermission(config.permission);
      if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
      await connectDb();
      const { id } = await params;
      const deleted = await config.model.findOneAndUpdate({ _id: id, deletedAt: { $exists: false } }, { $set: { deletedAt: new Date(), deletedBy: allowed.session.user.id } }, { new: true });
      if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    },
  };
}
