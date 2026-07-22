"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  type?: string;
  readAt?: string | null;
  createdAt?: string;
};

export function NotificationCenter({ audience }: { audience?: "super_admin" }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const enable = () => setReady(true);
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(enable, 1200);
    return () => clearTimeout(timer);
  }, []);

  const notifications = useQuery({
    queryKey: ["notifications", audience ?? "shop"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (audience) params.set("audience", audience);
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) return { items: [] as NotificationItem[], unreadCount: 0 };
      return res.json() as Promise<{ items: NotificationItem[]; unreadCount: number }>;
    },
    enabled: ready,
    refetchInterval: ready ? 60_000 : false,
  });

  const items = notifications.data?.items ?? [];
  const unreadCount = notifications.data?.unreadCount ?? 0;

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markOne(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="relative">
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} className="relative border border-white/15 bg-white/5 text-emerald-50 hover:bg-white/10 hover:text-white">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-zinc-200 bg-[var(--panel)] shadow-xl shadow-emerald-950/20">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            <button type="button" className="text-xs text-emerald-700 hover:underline" onClick={() => void markAll()}>
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-zinc-500">No notifications</p>
            ) : (
              items.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => void markOne(item._id)}
                  className={cn(
                    "block w-full border-b border-zinc-100 px-3 py-3 text-left hover:bg-white",
                    !item.readAt && "bg-emerald-50/50",
                  )}
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{item.message}</p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
