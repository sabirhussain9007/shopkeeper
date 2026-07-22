"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { TableLoader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IbanInput, MobileInput, bindBankAccountField, bindIbanField, bindMobileField } from "@/components/ui/pakistan-fields";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCrud } from "@/hooks/use-crud";
import { formatPakistanIbanInput, formatPakistanMobileDisplay } from "@/lib/pakistan-validators";
import { shopAccountTypeLabel } from "@/lib/bank-labels";
import { bankAccountFieldsSchema, bankAccountSchema } from "@/schemas/domain";
import type { BankAccountInput } from "@/types";

type BankAccount = BankAccountInput & { _id: string };

const formSchema = bankAccountFieldsSchema;
type FormValues = z.input<typeof formSchema>;

const emptyValues: FormValues = {
  accountType: "bank",
  name: "",
  accountTitle: "",
  accountNumber: "",
  branch: "",
  iban: "",
  notes: "",
  status: "active",
};

const ACCOUNT_TYPE_OPTIONS = [
  { value: "bank", label: "Bank account" },
  { value: "easypaisa", label: "EasyPaisa" },
  { value: "jazzcash", label: "JazzCash" },
] as const;

export function BankAccountsPanel() {
  const queryClient = useQueryClient();
  const { list, create, update, remove } = useCrud<BankAccountInput, BankAccount>("bank-accounts", { limit: 100, status: "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });
  const accountType = form.watch("accountType") ?? "bank";
  const isWallet = accountType === "easypaisa" || accountType === "jazzcash";

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (item: BankAccount) => {
    setEditing(item);
    form.reset({
      accountType: item.accountType ?? "bank",
      name: item.name,
      accountTitle: item.accountTitle,
      accountNumber: item.accountNumber,
      branch: item.branch ?? "",
      iban: item.iban ? formatPakistanIbanInput(item.iban) : "",
      notes: item.notes ?? "",
      status: item.status,
    });
    setDialogOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload = bankAccountSchema.parse(values);
      if (editing) {
        await update.mutateAsync({ id: editing._id, input: payload });
        toast.success("Bank account updated.");
      } else {
        await create.mutateAsync(payload);
        toast.success("Bank account added.");
      }
      setDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save bank account.");
    }
  });

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget._id);
      toast.success("Bank account removed.");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete bank account.");
    }
  };

  const items = list.data?.items ?? [];

  return (
    <Surface className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-950">Bank accounts</h3>
          <p className="text-sm text-zinc-500">Register bank and digital accounts for deposits, payments, and transfers.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add bank account
        </Button>
      </div>

      <div className="responsive-table-shell">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Account title</th>
              <th className="px-4 py-3 font-medium">Account number</th>
              <th className="px-4 py-3 font-medium">Branch / IBAN</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading ? (
              <TableLoader colSpan={7} label="Loading bank accounts..." />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                  No accounts yet. Add the bank and digital accounts your shop uses.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const wallet = item.accountType === "easypaisa" || item.accountType === "jazzcash";
                return (
                <tr key={item._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                  <td className="px-4 py-3">
                    <Badge variant="default">{shopAccountTypeLabel(item.accountType)}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3">{item.accountTitle}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {wallet ? formatPakistanMobileDisplay(item.accountNumber) : item.accountNumber}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {wallet ? "—" : [item.branch, item.iban].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={item.status === "active" ? "success" : "default"}>{item.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(item)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent title={editing ? "Edit account" : "Add bank account"} description="This account appears when recording deposits and bank payments.">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="account-type">Account type</Label>
              <Select
                id="account-type"
                className="mt-1.5"
                {...form.register("accountType")}
                disabled={!!editing}
              >
                {ACCOUNT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <FieldError message={form.formState.errors.accountType?.message} />
            </div>
            <div>
              <Label htmlFor="bank-name">Display name / label</Label>
              <Input
                id="bank-name"
                className="mt-1.5"
                placeholder={isWallet ? "e.g. Shop EasyPaisa" : "e.g. HBL Main Branch"}
                {...form.register("name")}
              />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="account-title">Account title</Label>
                <Input id="account-title" className="mt-1.5" {...form.register("accountTitle")} />
                <FieldError message={form.formState.errors.accountTitle?.message} />
              </div>
              <div>
                <Label htmlFor="account-number">{isWallet ? "Mobile / merchant ID" : "Account number"}</Label>
                {isWallet ? (
                  <MobileInput
                    id="account-number"
                    className="mt-1.5 font-mono"
                    {...bindMobileField(form.register, "accountNumber")}
                  />
                ) : (
                  <Input
                    id="account-number"
                    className="mt-1.5 font-mono"
                    inputMode="numeric"
                    maxLength={20}
                    placeholder="6–20 digits"
                    {...bindBankAccountField(form.register, "accountNumber")}
                  />
                )}
                <FieldError message={form.formState.errors.accountNumber?.message} />
              </div>
            </div>
            {!isWallet ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="branch">Branch</Label>
                  <Input id="branch" className="mt-1.5" {...form.register("branch")} />
                  <FieldError message={form.formState.errors.branch?.message} />
                </div>
                <div>
                  <Label htmlFor="iban">IBAN (optional)</Label>
                  <IbanInput id="iban" className="mt-1.5 font-mono" {...bindIbanField(form.register, "iban")} />
                  <FieldError message={form.formState.errors.iban?.message} />
                </div>
              </div>
            ) : null}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" className="mt-1.5" {...form.register("notes")} />
              <FieldError message={form.formState.errors.notes?.message} />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" className="mt-1.5" {...form.register("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={create.isPending || update.isPending}>
                {editing ? "Save changes" : "Add account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove bank account"
        description={`Remove "${deleteTarget?.name ?? ""}"? Existing transactions keep their account name.`}
        confirmLabel="Remove"
        confirmVariant="danger"
        isPending={remove.isPending}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={onDelete}
      />
    </Surface>
  );
}
