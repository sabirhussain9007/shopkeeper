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
import { Textarea } from "@/components/ui/textarea";
import { useCrud } from "@/hooks/use-crud";
import { customerGroupSchema } from "@/schemas/domain";

type Group = z.infer<typeof customerGroupSchema> & { _id: string };
const formSchema = customerGroupSchema;
type FormValues = z.input<typeof formSchema>;
const emptyValues: FormValues = { name: "", discountPercent: 0, description: "", status: "active" };

export function CustomerGroupsManager() {
  const { list, create, update, remove, params, setParams } = useCrud<z.infer<typeof customerGroupSchema>, Group>("customer-groups");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });

  const onSearch = useCallback((q: string) => setParams((p) => ({ ...p, q, page: 1 })), [setParams]);
  const onStatusChange = useCallback((status: string) => setParams((p) => ({ ...p, status: status || undefined, page: 1 })), [setParams]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload = formSchema.parse(values);
      if (editing) {
        await update.mutateAsync({ id: editing._id, input: payload });
        toast.success("Group updated.");
      } else {
        await create.mutateAsync(payload);
        toast.success("Group created.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save group.");
    }
  });

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">Customer Groups</h2>
          <p className="mt-2 text-zinc-600">Segment customers and apply group-level discounts.</p>
        </div>
        <Button onClick={() => { setEditing(null); form.reset(emptyValues); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
          New Group
        </Button>
      </div>
      <Surface>
        <DataToolbar placeholder="Search groups" status={params.status} onSearch={onSearch} onStatusChange={onStatusChange} />
        <div className="responsive-table-shell">
          <table className="w-full text-left text-sm text-zinc-950">
            <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Discount %</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <TableLoader colSpan={4} label="Loading groups..." />
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-zinc-500">No customer groups yet.</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">{item.discountPercent}%</td>
                    <td className="px-4 py-3"><Badge variant={item.status === "active" ? "success" : "default"}>{item.status}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(item); form.reset(item); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar page={list.data?.page ?? 1} pages={list.data?.pages ?? 1} total={list.data?.total ?? 0} onPageChange={(page) => setParams((p) => ({ ...p, page }))} />
      </Surface>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent title={editing ? "Edit Group" : "New Group"}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div><Label>Name</Label><Input className="mt-1.5" {...form.register("name")} /></div>
            <div><Label>Discount %</Label><Input type="number" min={0} max={100} className="mt-1.5" {...form.register("discountPercent", { valueAsNumber: true })} /></div>
            <div><Label>Description</Label><Textarea className="mt-1.5" {...form.register("description")} /></div>
            <div><Label>Status</Label><Select className="mt-1.5" {...form.register("status")}><option value="active">Active</option><option value="inactive">Inactive</option></Select></div>
            <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete group?" description="This cannot be undone." onConfirm={async () => { if (deleteTarget) { await remove.mutateAsync(deleteTarget._id); setDeleteTarget(null); toast.success("Deleted."); } }} />
    </div>
  );
}
