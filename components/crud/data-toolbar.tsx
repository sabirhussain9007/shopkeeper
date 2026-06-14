"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type DataToolbarProps = {
  placeholder: string;
  status?: string;
  onSearch: (q: string) => void;
  onStatusChange?: (status: string) => void;
  actions?: React.ReactNode;
};

export function DataToolbar({ placeholder, status, onSearch, onStatusChange, actions }: DataToolbarProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
        <Input className="pl-9" placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {onStatusChange ? (
        <Select value={status ?? ""} onChange={(e) => onStatusChange(e.target.value)}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      ) : null}
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}

export function PaginationBar({
  page,
  pages,
  total,
  onPageChange,
}: {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
      <span>{total} record{total === 1 ? "" : "s"}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <span>
          Page {page} of {Math.max(pages, 1)}
        </span>
        <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
