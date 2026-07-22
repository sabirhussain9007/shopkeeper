"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PaginationBar } from "@/components/crud/data-toolbar";
import { TableLoader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatClientIpForDisplay } from "@/lib/request-meta";
import { formatPakistanDateTime } from "@/lib/utils";

type ActivityLog = {
  _id: string;
  createdAt?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  shopName?: string;
  module?: string;
  action: string;
  entity?: string;
  description: string;
  ip?: string;
  browser?: string;
  device?: string;
};

type FilterOptions = {
  users: Array<{ id: string; name: string }>;
  modules: string[];
  actions: string[];
};

export function ActivityLogs() {
  const [params, setParams] = useState<{
    q?: string;
    page: number;
    limit: number;
    userId?: string;
    module?: string;
    action?: string;
    from?: string;
    to?: string;
  }>({ page: 1, limit: 20 });

  const queryString = useMemo(() => {
    const search = new URLSearchParams();
    search.set("page", String(params.page));
    search.set("limit", String(params.limit));
    if (params.q) search.set("q", params.q);
    if (params.userId) search.set("userId", params.userId);
    if (params.module) search.set("module", params.module);
    if (params.action) search.set("action", params.action);
    if (params.from) search.set("from", params.from);
    if (params.to) search.set("to", params.to);
    return search.toString();
  }, [params]);

  const list = useQuery({
    queryKey: ["activity", params],
    queryFn: async () => {
      const response = await fetch(`/api/activity?${queryString}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Unable to load activity logs");
      }
      return response.json() as Promise<{
        items: ActivityLog[];
        total: number;
        page: number;
        pages: number;
        filters: FilterOptions;
      }>;
    },
  });

  const onSearch = useCallback((q: string) => setParams((p) => ({ ...p, q, page: 1 })), []);
  const items = list.data?.items ?? [];
  const filters = list.data?.filters ?? { users: [], modules: [], actions: [] };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Activity Logs</h2>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Shop owner only. Full audit trail with user, role, module, device, and IP details.
        </p>
      </div>

      <Surface className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <Label htmlFor="activity-search">Search</Label>
            <Input
              id="activity-search"
              className="mt-1.5"
              placeholder="Search description, action, IP..."
              defaultValue={params.q ?? ""}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="filter-user">User</Label>
            <Select
              id="filter-user"
              className="mt-1.5"
              value={params.userId ?? ""}
              onChange={(e) => setParams((p) => ({ ...p, userId: e.target.value || undefined, page: 1 }))}
            >
              <option value="">All users</option>
              {filters.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filter-module">Module</Label>
            <Select
              id="filter-module"
              className="mt-1.5"
              value={params.module ?? ""}
              onChange={(e) => setParams((p) => ({ ...p, module: e.target.value || undefined, page: 1 }))}
            >
              <option value="">All modules</option>
              {filters.modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filter-action">Action</Label>
            <Select
              id="filter-action"
              className="mt-1.5"
              value={params.action ?? ""}
              onChange={(e) => setParams((p) => ({ ...p, action: e.target.value || undefined, page: 1 }))}
            >
              <option value="">All actions</option>
              {filters.actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 xl:col-span-2">
            <div>
              <Label htmlFor="filter-from">From</Label>
              <Input
                id="filter-from"
                type="date"
                className="mt-1.5"
                value={params.from ?? ""}
                onChange={(e) => setParams((p) => ({ ...p, from: e.target.value || undefined, page: 1 }))}
              />
            </div>
            <div>
              <Label htmlFor="filter-to">To</Label>
              <Input
                id="filter-to"
                type="date"
                className="mt-1.5"
                value={params.to ?? ""}
                onChange={(e) => setParams((p) => ({ ...p, to: e.target.value || undefined, page: 1 }))}
              />
            </div>
          </div>
        </div>

        <div className="responsive-table-shell responsive-table-shell--xl">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
              <tr>
                <th className="px-3 py-3 font-medium">Timestamp</th>
                <th className="px-3 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Shop</th>
                <th className="px-3 py-3 font-medium">Module</th>
                <th className="px-3 py-3 font-medium">Action</th>
                <th className="px-3 py-3 font-medium">IP</th>
                <th className="px-3 py-3 font-medium">Browser</th>
                <th className="px-3 py-3 font-medium">Device</th>
                <th className="px-3 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <TableLoader colSpan={10} label="Loading activity..." />
              ) : list.isError ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-zinc-500">
                    {list.error instanceof Error ? list.error.message : "Unable to load activity logs."}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-zinc-500">
                    No activity recorded yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                    <td className="px-3 py-3 whitespace-nowrap text-zinc-500">
                      {formatPakistanDateTime(item.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{item.userName || "System"}</div>
                      {item.userEmail ? <div className="text-xs text-zinc-500">{item.userEmail}</div> : null}
                    </td>
                    <td className="px-3 py-3">
                      {item.userRole ? <Badge variant="default">{item.userRole}</Badge> : "—"}
                    </td>
                    <td className="px-3 py-3">{item.shopName || "—"}</td>
                    <td className="px-3 py-3">{item.module || item.entity || "—"}</td>
                    <td className="px-3 py-3 font-mono text-xs">{item.action}</td>
                    <td className="px-3 py-3 font-mono text-xs">{formatClientIpForDisplay(item.ip)}</td>
                    <td className="px-3 py-3">{item.browser || "—"}</td>
                    <td className="px-3 py-3">{item.device || "—"}</td>
                    <td className="px-3 py-3 max-w-xs truncate" title={item.description}>
                      {item.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={list.data?.page ?? 1}
          pages={list.data?.pages ?? 1}
          total={list.data?.total ?? 0}
          onPageChange={(page) => setParams((p) => ({ ...p, page }))}
        />
      </Surface>
    </div>
  );
}
