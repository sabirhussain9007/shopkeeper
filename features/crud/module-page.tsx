"use client";

import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/card";

type Column = { key: string; label: string };

export function ModulePage({ title, description, columns, actions }: { title: string; description: string; columns: Column[]; actions: string[] }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">{description}</p>
        </div>
        <Button><Plus className="h-4 w-4" />New</Button>
      </div>
      <Surface>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
            <Input className="pl-9" placeholder={`Search ${title.toLowerCase()}`} />
          </div>
          <Button variant="secondary">Filter</Button>
          <Button variant="ghost">Export PDF</Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <tr>{columns.map((column) => <th key={column.key} className="px-4 py-3 font-medium">{column.label}</th>)}<th className="px-4 py-3 text-right font-medium">Actions</th></tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-zinc-500">
                  No records yet. Use New to create the first production record.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {actions.map((action) => <span key={action} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{action}</span>)}
        </div>
      </Surface>
    </div>
  );
}
