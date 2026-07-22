import { cn } from "@/lib/utils";
import type { HTMLAttributes, TableHTMLAttributes } from "react";

/** Scrollable table container — horizontal swipe/scroll on small screens */
export const responsiveTableShellClass = "responsive-table-shell";
export const responsiveTableShellMdClass = "responsive-table-shell responsive-table-shell--md";
export const responsiveTableShellLgClass = "responsive-table-shell responsive-table-shell--lg";
export const responsiveTableShellXlClass = "responsive-table-shell responsive-table-shell--xl";
export const responsiveTableShell2xlClass = "responsive-table-shell responsive-table-shell--2xl";
export const responsiveTableShellNestedClass = "responsive-table-shell responsive-table-shell--nested";

/** @deprecated Use responsiveTableShellClass */
export const dataTableWrapperClass = responsiveTableShellClass;

export const dataTableClass = "w-full text-left text-sm";
export const dataTableHeadClass = "border-b border-zinc-100 bg-[var(--panel)] text-zinc-600";
export const dataTableHeadCompactClass =
  "border-b border-zinc-100 bg-[var(--panel)] text-left text-xs uppercase tracking-wide text-zinc-500";
export const dataTableBodyClass = "bg-white";
export const dataTableRowClass = "border-t border-zinc-100 transition hover:bg-emerald-50/60";

type DataTableShellProps = HTMLAttributes<HTMLDivElement> & {
  size?: "default" | "md" | "lg" | "xl" | "2xl" | "nested";
};

export function DataTableShell({ className, size = "default", children, ...props }: DataTableShellProps) {
  const sizeClass =
    size === "md"
      ? responsiveTableShellMdClass
      : size === "lg"
        ? responsiveTableShellLgClass
        : size === "xl"
          ? responsiveTableShellXlClass
          : size === "2xl"
            ? responsiveTableShell2xlClass
            : size === "nested"
              ? responsiveTableShellNestedClass
              : responsiveTableShellClass;

  return (
    <div className={cn(sizeClass, className)} {...props}>
      {children}
    </div>
  );
}

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
