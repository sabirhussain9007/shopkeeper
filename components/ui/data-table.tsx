import { cn } from "@/lib/utils";
import type { HTMLAttributes, TableHTMLAttributes } from "react";

/** Light table styling — matches app panel theme, no dark/black backgrounds */
export const dataTableWrapperClass = "overflow-hidden rounded-xl border border-zinc-200 bg-white";
export const dataTableClass = "w-full text-left text-sm";
export const dataTableHeadClass = "border-b border-zinc-100 bg-[var(--panel)] text-zinc-600";
export const dataTableHeadCompactClass =
  "border-b border-zinc-100 bg-[var(--panel)] text-left text-xs uppercase tracking-wide text-zinc-500";
export const dataTableBodyClass = "bg-white";
export const dataTableRowClass = "border-t border-zinc-100 transition hover:bg-emerald-50/60";

export function DataTable({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn(dataTableClass, className)} {...props} />;
}

export function DataTableHead({
  className,
  compact,
  ...props
}: HTMLAttributes<HTMLTableSectionElement> & { compact?: boolean }) {
  return <thead className={cn(compact ? dataTableHeadCompactClass : dataTableHeadClass, className)} {...props} />;
}

export function DataTableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn(dataTableBodyClass, className)} {...props} />;
}
