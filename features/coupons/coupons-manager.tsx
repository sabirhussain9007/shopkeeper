"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { DataToolbar, PaginationBar } from "@/components/crud/data-toolbar";
import { TableLoader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCrud } from "@/hooks/use-crud";
import { currency } from "@/lib/utils";
import { couponSchema } from "@/schemas/domain";

type Coupon = z.infer<typeof couponSchema> & { _id: string; usedCount?: number };
const formSchema = couponSchema;
type FormValues = z.input<typeof formSchema>;
const emptyValues: FormValues = { code: "", type: "flat", value: 0, minOrder: 0, maxUses: 0, status: "active" };

export function CouponsManager() {
  const { list, create, update, remove, setParams } = useCrud<z.infer<typeof couponSchema>, Coupon>("coupons");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });

  const onSearch = useCallback((q: string) => setParams((p) => ({ ...p, q, page: 1 })), [setParams]);
  const items = list.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-zinc-950">Coupons</h2>
          <p className="mt-2 text-zinc-600">Create discount codes for POS checkout.</p>
        </div>
        <Button onClick={() => { setEditing(null); form.reset(emptyValues); setDialogOpen(true); }}><Plus className="h-4 w-4" />New Coupon</Button>
      </div>
      <Surface>
        <DataToolbar placeholder="Search coupons" onSearch={onSearch} />
        <div className="responsive-table-shell">
          <table className="w-full text-sm text-zinc-950">
            <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
              <tr><th className="px-4 py-3 text-left">Code</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Used</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {list.isLoading ? <TableLoader colSpan={6} /> : items.map((item) => (
                <tr key={item._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                  <td className="px-4 py-3 font-mono font-medium">{item.code}</td>
                  <td className="px-4 py-3 capitalize">{item.type}</td>
                  <td className="px-4 py-3">{item.type === "percentage" ? `${item.value}%` : currency(item.value)}</td>
                  <td className="px-4 py-3">{item.usedCount ?? 0}{item.maxUses ? ` / ${item.maxUses}` : ""}</td>
                  <td className="px-4 py-3"><Badge variant={item.status === "active" ? "success" : "default"}>{item.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(item); form.reset(item); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar page={list.data?.page ?? 1} pages={list.data?.pages ?? 1} total={list.data?.total ?? 0} onPageChange={(page) => setParams((p) => ({ ...p, page }))} />
      </Surface>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent title={editing ? "Edit coupon" : "New coupon"}>
          <form onSubmit={form.handleSubmit(async (values) => {
            const payload = formSchema.parse(values);
            if (editing) await update.mutateAsync({ id: editing._id, input: payload });
            else await create.mutateAsync(payload);
            toast.success("Saved.");
            setDialogOpen(false);
          })} className="space-y-4">
            <div><Label>Code</Label><Input className="mt-1.5 uppercase" {...form.register("code")} /></div>
            <div><Label>Type</Label><Select className="mt-1.5" {...form.register("type")}><option value="flat">Flat</option><option value="percentage">Percentage</option></Select></div>
            <div><Label>Value</Label><Input type="number" min={0} className="mt-1.5" {...form.register("value", { valueAsNumber: true })} /></div>
            <div><Label>Min order</Label><Input type="number" min={0} className="mt-1.5" {...form.register("minOrder", { valueAsNumber: true })} /></div>
            <div><Label>Max uses (0 = unlimited)</Label><Input type="number" min={0} className="mt-1.5" {...form.register("maxUses", { valueAsNumber: true })} /></div>
            <Button type="submit">Save</Button>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete coupon?" description="This coupon will be removed and can no longer be used at checkout." onConfirm={async () => { if (deleteTarget) { await remove.mutateAsync(deleteTarget._id); setDeleteTarget(null); } }} />
    </div>
  );
}
