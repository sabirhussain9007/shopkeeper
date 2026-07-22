"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NotificationCenter } from "@/components/saas/notification-center";
import { TableLoader } from "@/components/ui/loader";
import { cn, formatPakistanDate } from "@/lib/utils";

type ShopRow = {
  _id: string;
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  plan: "monthly" | "yearly";
  planLabel?: string;
  planAmount: number;
  paymentMethod: string;
  paymentReference: string;
  paymentStatus: string;
  status: string;
  startsAt?: string;
  expiresAt?: string;
  remainingDays?: number;
  createdAt?: string;
  rejectionReason?: string;
};

type MonitorStats = {
  totalShops: number;
  activePlans: number;
  expiredPlans: number;
  expiringIn3Days: number;
  renewedThisMonth: number;
};

const EXPIRY_FILTERS: Array<{ label: string; value: string }> = [
  { label: "All", value: "" },
  { label: "Expired", value: "expired" },
  { label: "Expiring Today", value: "today" },
  { label: "1 Day Left", value: "1" },
  { label: "2 Days Left", value: "2" },
  { label: "3 Days Left", value: "3" },
  { label: "Active", value: "active" },
  { label: "Expiring in 3 Days", value: "expiring_3" },
];

function formatDate(value?: string) {
  return formatPakistanDate(value);
}

export function SuperAdminShops() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("");
  const [confirm, setConfirm] = useState<{ id: string; action: "approve" | "reject" | "suspend"; name: string } | null>(null);

  const statsQuery = useQuery({
    queryKey: ["super-admin-shop-stats"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/shops?stats=1");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json() as Promise<MonitorStats>;
    },
  });

  const shopsQuery = useQuery({
    queryKey: ["super-admin-shops", q, status, expiryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (expiryFilter) params.set("expiryFilter", expiryFilter);
      const res = await fetch(`/api/super-admin/shops?${params.toString()}`);
      const data = (await res.json()) as { items?: ShopRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load shops");
      return data.items ?? [];
    },
  });

  const shops = shopsQuery.data ?? [];
  const stats = statsQuery.data ?? null;
  const loading = shopsQuery.isLoading;

  async function runAction() {
    if (!confirm) return;
    const res = await fetch(`/api/super-admin/shops/${confirm.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: confirm.action }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Action failed");
      return;
    }
    toast.success(`Shop ${confirm.action}d`);
    setConfirm(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["super-admin-shops"] }),
      queryClient.invalidateQueries({ queryKey: ["super-admin-shop-stats"] }),
    ]);
  }

  const statCards: Array<{ label: string; value: number }> = [
    { label: "Total Shops", value: stats?.totalShops ?? 0 },
    { label: "Active Plans", value: stats?.activePlans ?? 0 },
    { label: "Expired Plans", value: stats?.expiredPlans ?? 0 },
    { label: "Expiring in 3 Days", value: stats?.expiringIn3Days ?? 0 },
    { label: "Renewed This Month", value: stats?.renewedThisMonth ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">Subscription alerts and shop approvals</p>
        <NotificationCenter audience="super_admin" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shops..." className="max-w-xs" />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
        >
          {EXPIRY_FILTERS.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void shopsQuery.refetch();
            void statsQuery.refetch();
          }}
        >
          Refresh
        </Button>
      </div>

      {shopsQuery.isError ? (
        <p className="text-sm text-red-600">{shopsQuery.error instanceof Error ? shopsQuery.error.message : "Failed to load shops"}</p>
      ) : null}

      <div className="responsive-table-shell responsive-table-shell--2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-[var(--panel)] text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Shop Name</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Current Plan</th>
              <th className="px-4 py-3">Start Date</th>
              <th className="px-4 py-3">Expiry Date</th>
              <th className="px-4 py-3">Remaining Days</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoader colSpan={8} label="Loading shops..." />
            ) : shops.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  No shops found.
                </td>
              </tr>
            ) : (
              shops.map((shop) => {
                const remaining = shop.remainingDays;
                const warning = typeof remaining === "number" && remaining <= 3;
                return (
                  <tr key={shop._id} className={cn("border-b border-zinc-100 align-top", warning && "bg-amber-50/80")}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">{shop.name}</p>
                      <p className="text-xs text-zinc-500">{shop.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{shop.ownerName}</p>
                      <p className="text-xs text-zinc-500">{shop.ownerEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="capitalize">{shop.planLabel ?? shop.plan}</p>
                      <p className="text-xs text-zinc-500">Rs. {shop.planAmount}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{formatDate(shop.startsAt)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{formatDate(shop.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex font-semibold", warning ? "animate-pulse text-amber-700" : "text-zinc-700")}>
                        {typeof remaining === "number" ? remaining : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                          shop.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : shop.status === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {shop.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        {shop.status === "pending" && (
                          <>
                            <Button size="sm" onClick={() => setConfirm({ id: shop._id, action: "approve", name: shop.name })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setConfirm({ id: shop._id, action: "reject", name: shop.name })}>
                              Reject
                            </Button>
                          </>
                        )}
                        {shop.status === "active" && (
                          <Button size="sm" variant="secondary" onClick={() => setConfirm({ id: shop._id, action: "suspend", name: shop.name })}>
                            Suspend
                          </Button>
                        )}
                        {(shop.status === "expired" || shop.status === "suspended") && (
                          <Button size="sm" onClick={() => setConfirm({ id: shop._id, action: "approve", name: shop.name })}>
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm ? `${confirm.action} ${confirm.name}?` : ""}
        description={
          confirm?.action === "approve"
            ? "This will verify payment and activate the shop for the selected plan duration."
            : confirm?.action === "reject"
              ? "The shop will be marked rejected and the owner cannot use the system."
              : "The shop will be suspended until reactivated."
        }
        confirmLabel={confirm?.action === "approve" ? "Approve" : confirm?.action === "reject" ? "Reject" : "Suspend"}
        onConfirm={() => void runAction()}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      />
    </div>
  );
}
