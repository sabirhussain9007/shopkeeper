"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, KeyRound, Pencil, Plus, Save, Trash2, Upload, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { DataToolbar, PaginationBar } from "@/components/crud/data-toolbar";
import { Receipt } from "@/components/printing/receipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Surface } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { settingsSchema } from "@/schemas/domain";
import { roles, type Role, type SettingsInput } from "@/types";

type SettingsRecord = SettingsInput & { _id: string | null };
type SafeUser = { _id: string; name: string; email: string; role: Role; status: "active" | "inactive" };

const tabs = ["Business", "Receipt & Tax", "Users", "My Account", "Backup"] as const;
type Tab = (typeof tabs)[number];

const formSchema = settingsSchema;
type FormValues = z.input<typeof formSchema>;

const userFormSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional().or(z.literal("")),
  role: z.enum(roles),
  status: z.enum(["active", "inactive"]),
});
type UserFormValues = z.infer<typeof userFormSchema>;

const emptyUser: UserFormValues = { name: "", email: "", password: "", role: "cashier", status: "active" };

export function SettingsManager() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("Business");
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<SafeUser | null>(null);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["settings-current"],
    queryFn: async () => {
      const response = await fetch("/api/settings/current");
      if (!response.ok) throw new Error("Unable to load settings");
      return response.json() as Promise<SettingsRecord>;
    },
  });

  const usersQuery = useQuery({
    queryKey: ["users", userPage, userSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(userPage), limit: "10" });
      if (userSearch) params.set("q", userSearch);
      const response = await fetch(`/api/users?${params}`);
      if (!response.ok) throw new Error("Unable to load users");
      return response.json() as Promise<{ items: SafeUser[]; total: number; pages: number; page: number }>;
    },
    enabled: tab === "Users",
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: settingsQuery.data ?? undefined,
  });

  const userForm = useForm<UserFormValues>({ resolver: zodResolver(userFormSchema), defaultValues: emptyUser });

  const saveSettings = useMutation({
    mutationFn: async (values: SettingsInput) => {
      const response = await fetch("/api/settings/current", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to save settings");
      }
      return response.json() as Promise<SettingsRecord>;
    },
    onSuccess: async (settings) => {
      queryClient.setQueryData(["settings-current"], settings);
      form.reset(settings);
      await queryClient.invalidateQueries({ queryKey: ["settings-current"] });
      queryClient.invalidateQueries({ queryKey: ["pos-settings"] });
      router.refresh();
      toast.success("Settings saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveUser = useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: UserFormValues }) => {
      const payload = { ...values };
      if (!payload.password) delete (payload as { password?: string }).password;
      const response = await fetch(id ? `/api/users/${id}` : "/api/users", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to save user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setUserDialog(false);
      toast.success("User saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeUser = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to deactivate user");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deactivated.");
      setDeleteUserTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onSettingsSubmit = form.handleSubmit((values) => saveSettings.mutate(formSchema.parse(values)));

  function openCreateUser() {
    setEditingUser(null);
    userForm.reset(emptyUser);
    setUserDialog(true);
  }

  function openEditUser(user: SafeUser) {
    setEditingUser(user);
    userForm.reset({ name: user.name, email: user.email, password: "", role: user.role, status: user.status });
    setUserDialog(true);
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: formData.get("currentPassword"),
        newPassword: formData.get("newPassword"),
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      toast.error(body.error ?? "Unable to change password");
      return;
    }
    toast.success("Password updated.");
    event.currentTarget.reset();
  }

  function exportBackup() {
    const data = settingsQuery.data;
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shopkeeper-settings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file: File) {
    try {
      const parsed = formSchema.parse(JSON.parse(await file.text()));
      await saveSettings.mutateAsync(parsed);
      form.reset(parsed);
      toast.success("Settings restored from backup.");
    } catch {
      toast.error("Invalid backup file.");
    }
  }

  async function uploadLogo(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    if (file.size > 1_500_000) {
      toast.error("Logo image must be under 1.5MB.");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Unable to read image file."));
      reader.readAsDataURL(file);
    });

    form.setValue("logo", dataUrl, { shouldDirty: true, shouldValidate: true });
    toast.success("Logo uploaded. Save settings to apply it.");
  }

  const preview = useWatch({ control: form.control });
  const receiptSize = (preview.receiptSize ?? "80mm") as "58mm" | "80mm" | "a4";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button key={item} size="sm" variant={tab === item ? "primary" : "ghost"} onClick={() => setTab(item)}>
            {item}
          </Button>
        ))}
      </div>

      {tab === "Business" || tab === "Receipt & Tax" ? (
        <form onSubmit={onSettingsSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <Surface className="space-y-4 p-6">
            {tab === "Business" ? (
              <>
                <h2 className="text-lg font-semibold">Business profile</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="appName">App name</Label>
                    <Input id="appName" {...form.register("appName")} placeholder="Shopkeeper" />
                  </div>
                  <div>
                    <Label htmlFor="appTagline">App tagline</Label>
                    <Input id="appTagline" {...form.register("appTagline")} placeholder="Retail Command" />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="dashboardTitle">Dashboard header title</Label>
                    <Input id="dashboardTitle" {...form.register("dashboardTitle")} placeholder="Enterprise Retail Management" />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="businessName">Business name</Label>
                    <Input id="businessName" {...form.register("businessName")} />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea id="address" {...form.register("address")} />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" {...form.register("phone")} />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...form.register("email")} />
                  </div>
                  <div>
                    <Label htmlFor="gstVatNumber">GST / VAT</Label>
                    <Input id="gstVatNumber" {...form.register("gstVatNumber")} />
                  </div>
                  <div>
                    <Label htmlFor="ntn">NTN</Label>
                    <Input id="ntn" {...form.register("ntn")} />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="logo">Logo URL</Label>
                    <div className="mt-1.5 grid gap-3 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800 md:grid-cols-[1fr_auto]">
                      <Input id="logo" {...form.register("logo")} placeholder="https://... or upload an image" />
                      <div className="flex gap-2">
                        <Button type="button" variant="secondary" onClick={() => logoFileRef.current?.click()}>
                          <Upload className="h-4 w-4" />
                          Upload
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => form.setValue("logo", "", { shouldDirty: true, shouldValidate: true })}>
                          Clear
                        </Button>
                      </div>
                      <input
                        ref={logoFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadLogo(file);
                          e.target.value = "";
                        }}
                      />
                      {preview.logo ? (
                        <div className="flex items-center gap-3 md:col-span-2">
                          <span className="h-14 w-14 rounded-2xl border border-zinc-200 bg-cover bg-center dark:border-zinc-800" style={{ backgroundImage: `url(${preview.logo})` }} />
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">Logo preview. Save settings to apply it to the navbar.</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Receipt & tax</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Input id="currency" maxLength={3} {...form.register("currency")} />
                  </div>
                  <div>
                    <Label htmlFor="taxRate">Default tax rate (%)</Label>
                    <Input id="taxRate" type="number" step="0.01" {...form.register("taxRate")} />
                  </div>
                  <div>
                    <Label htmlFor="receiptSize">Receipt size</Label>
                    <Select id="receiptSize" {...form.register("receiptSize")}>
                      <option value="58mm">58mm thermal</option>
                      <option value="80mm">80mm thermal</option>
                      <option value="a4">A4</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="receiptLogoAlign">Receipt logo alignment</Label>
                    <Select id="receiptLogoAlign" {...form.register("receiptLogoAlign")}>
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="receiptHeader">Receipt header</Label>
                    <Textarea id="receiptHeader" {...form.register("receiptHeader")} />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="receiptFooter">Receipt footer</Label>
                    <Textarea id="receiptFooter" {...form.register("receiptFooter")} />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="thankYouMessage">Thank you message</Label>
                    <Input id="thankYouMessage" autoComplete="off" {...form.register("thankYouMessage")} />
                  </div>
                </div>
              </>
            )}
            <Button type="submit" disabled={settingsQuery.isLoading || saveSettings.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {saveSettings.isPending ? "Saving..." : "Save settings"}
            </Button>
          </Surface>

          <Surface className={`p-6 ${receiptSize === "a4" ? "lg:col-span-2" : ""}`}>
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">Receipt preview</h3>
            <div className="flex justify-center overflow-auto rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <Receipt
                items={[
                  { productId: "1", name: "Sample Item", sku: "SKU-001", quantity: 2, unitPrice: 500, purchasePrice: 350, taxRate: Number(preview.taxRate) || 0, discount: 0, stockAvailable: 10 },
                ]}
                size={receiptSize}
                invoiceNumber="000001"
                businessName={preview.businessName || "Shopkeeper"}
                logo={preview.logo || undefined}
                logoAlign={preview.receiptLogoAlign ?? "center"}
                address={preview.address || "Shop address"}
                phone={preview.phone || "Phone number"}
                receiptHeader={preview.receiptHeader || undefined}
                receiptFooter={preview.receiptFooter || undefined}
                thankYouMessage={preview.thankYouMessage || "Thank you for shopping with us."}
                subtotal={1000}
                discount={0}
                tax={((Number(preview.taxRate) || 0) / 100) * 1000}
                grandTotal={1000 + ((Number(preview.taxRate) || 0) / 100) * 1000}
                paidAmount={1000}
                changeDue={0}
                paymentMethod="cash"
                issuedAt="13 Jun 2026, 06:30 PM"
              />
            </div>
          </Surface>
        </form>
      ) : null}

      {tab === "Users" ? (
        <Surface className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-500" />
              <div>
                <h2 className="text-lg font-semibold">User signup</h2>
                <p className="text-sm text-zinc-500">Admins can add new users after public signup is closed.</p>
              </div>
            </div>
            <Button onClick={openCreateUser}>
              <Plus className="mr-2 h-4 w-4" />
              Sign up user
            </Button>
          </div>
          <DataToolbar placeholder="Search users..." onSearch={setUserSearch} />
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(usersQuery.data?.items ?? []).map((user) => (
                  <tr key={user._id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3 capitalize">{user.role}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.status === "active" ? "success" : "default"}>{user.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEditUser(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteUserTarget(user)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={usersQuery.data?.page ?? 1}
            pages={usersQuery.data?.pages ?? 1}
            total={usersQuery.data?.total ?? 0}
            onPageChange={setUserPage}
          />
        </Surface>
      ) : null}

      {tab === "My Account" ? (
        <Surface className="max-w-lg space-y-4 p-6">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold">Change password</h2>
          </div>
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current password</Label>
              <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
            </div>
            <div>
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <Button type="submit">Update password</Button>
          </form>
        </Surface>
      ) : null}

      {tab === "Backup" ? (
        <Surface className="max-w-lg space-y-4 p-6">
          <h2 className="text-lg font-semibold">Backup & restore</h2>
          <p className="text-sm text-zinc-500">Export or import your business settings as JSON.</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="ghost" onClick={exportBackup}>
              <Download className="mr-2 h-4 w-4" />
              Export settings
            </Button>
            <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Import settings
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importBackup(file);
                e.target.value = "";
              }}
            />
          </div>
        </Surface>
      ) : null}

      <Dialog open={userDialog} onOpenChange={setUserDialog}>
        <DialogContent
          title={editingUser ? "Edit user" : "Sign up user"}
          description={editingUser ? "Update this user's access." : "Create a user account from the admin panel."}
        >
          <form
            className="space-y-4"
            onSubmit={userForm.handleSubmit((values) => {
              if (!editingUser && !values.password) {
                toast.error("Password is required for new users.");
                return;
              }
              saveUser.mutate({ id: editingUser?._id, values });
            })}
          >
            <div>
              <Label htmlFor="userName">Name</Label>
              <Input id="userName" {...userForm.register("name")} />
            </div>
            <div>
              <Label htmlFor="userEmail">Email</Label>
              <Input id="userEmail" type="email" {...userForm.register("email")} />
            </div>
            <div>
              <Label htmlFor="userPassword">{editingUser ? "New password (optional)" : "Password"}</Label>
              <Input id="userPassword" type="password" {...userForm.register("password")} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="userRole">Role</Label>
                <Select id="userRole" {...userForm.register("role")}>
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="userStatus">Status</Label>
                <Select id="userStatus" {...userForm.register("status")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={saveUser.isPending}>
              {saveUser.isPending ? "Saving..." : "Save user"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleteUserTarget}
        title="Deactivate User"
        description={`Deactivate user "${deleteUserTarget?.name ?? ""}"? They will no longer be able to sign in.`}
        confirmLabel="Deactivate"
        isPending={removeUser.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteUserTarget(null);
        }}
        onConfirm={() => {
          if (deleteUserTarget) removeUser.mutate(deleteUserTarget._id);
        }}
      />
    </div>
  );
}
