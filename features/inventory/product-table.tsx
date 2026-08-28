"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableLoader } from "@/components/ui/loader";
import { isRecordDeleted } from "@/lib/soft-delete";
import { currency, percentage } from "@/lib/utils";
import { profitInfo, resourceId, type Product } from "./inventory-utils";

const COLUMNS = ["Product", "SKU", "Qty", "Purchase", "Selling", "Profit", "Vendor", "Status"];
const COL_SPAN = COLUMNS.length + 1;

type ProductTableProps = {
  items: Product[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  vendorNameById: Map<string, string>;
  onEdit: (item: Product) => void;
  onDelete: (item: Product) => void;
  onRestore: (item: Product) => void;
};

export function ProductTable({
  items,
  isLoading,
  isError,
  error,
  onRetry,
  vendorNameById,
  onEdit,
  onDelete,
  onRestore,
}: ProductTableProps) {
  return (
    <div className="responsive-table-shell responsive-table-shell--lg">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} className="px-4 py-3 font-medium">
                {column}
              </th>
            ))}
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && items.length === 0 ? (
            <TableLoader colSpan={COL_SPAN} label="Loading products..." />
          ) : isError ? (
            <tr>
              <td colSpan={COL_SPAN} className="px-4 py-12 text-center text-zinc-500">
                <p>{error instanceof Error ? error.message : "Unable to load products."}</p>
                <Button className="mt-3" size="sm" variant="secondary" onClick={onRetry}>
                  Retry
                </Button>
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={COL_SPAN} className="px-4 py-12 text-center text-zinc-500">
                No products found. Add your first product.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <ProductRow
                key={resourceId(item._id)}
                item={item}
                vendorNameById={vendorNameById}
                onEdit={onEdit}
                onDelete={onDelete}
                onRestore={onRestore}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

type ProductRowProps = Pick<ProductTableProps, "vendorNameById" | "onEdit" | "onDelete" | "onRestore"> & { item: Product };

function ProductRow({ item, vendorNameById, onEdit, onDelete, onRestore }: ProductRowProps) {
  const { profit: lineProfit, margin } = profitInfo(item.purchasePrice, item.sellingPrice);
  const lowStock = item.quantity <= item.reorderLevel;
  const deleted = isRecordDeleted(item);

  return (
    <tr className="border-t border-zinc-100 hover:bg-emerald-50/60">
      <td className="px-4 py-3">
        <div className={`font-medium ${deleted ? "text-zinc-400 line-through" : ""}`}>{item.productName}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {deleted ? <Badge variant="warning">Deleted</Badge> : null}
          {!deleted && lowStock ? <Badge variant="warning">Low stock</Badge> : null}
        </div>
      </td>
      <td className="px-4 py-3 text-zinc-500">{item.sku}</td>
      <td className="px-4 py-3">{item.quantity}</td>
      <td className="px-4 py-3">{currency(item.purchasePrice)}</td>
      <td className="px-4 py-3">{currency(item.sellingPrice)}</td>
      <td className="px-4 py-3">
        <div>{currency(lineProfit)}</div>
        <div className="text-xs text-zinc-500">{percentage(margin)}</div>
      </td>
      <td className="px-4 py-3 text-zinc-500">{item.supplier ? vendorNameById.get(resourceId(item.supplier)) ?? "—" : "—"}</td>
      <td className="px-4 py-3">
        <Badge variant={item.status === "active" ? "success" : "default"}>{item.status}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          {deleted ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => onRestore(item)}>
                Restore
              </Button>
              <Button size="sm" variant="danger" onClick={() => onDelete(item)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => onEdit(item)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="danger" onClick={() => onDelete(item)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
