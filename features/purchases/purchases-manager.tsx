"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, PackageCheck, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Surface } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PaginationBar } from "@/components/crud/data-toolbar";
import { BlockLoader, TableLoader } from "@/components/ui/loader";
import { useCrud } from "@/hooks/use-crud";
import { currency } from "@/lib/utils";
import type { ProductInput, SupplierInput } from "@/types";

type Supplier = SupplierInput & { _id: string; supplierName: string };
type Product = ProductInput & { _id: string; productName: string };
type Purchase = {
  _id: string;
  supplier?: { supplierName: string; phone?: string };
  grandTotal: number;
  paidAmount: number;
  status: string;
  createdAt?: string;
};
type LineItem = { productId: string; name: string; quantity: number; cost: number; taxRate: number };

function statusVariant(status: string) {
  if (status === "received") return "success" as const;
  if (status === "ordered") return "warning" as const;
  return "default" as const;
}

export function PurchasesManager() {
  const queryClient = useQueryClient();
  const suppliersCrud = useCrud<SupplierInput, Supplier>("suppliers", { limit: 100 });
  const productsCrud = useCrud<ProductInput, Product>("products", { limit: 100 });

  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0);
  const [deleteLineIndex, setDeleteLineIndex] = useState<number | null>(null);

  const purchases = useQuery({
    queryKey: ["purchases", page],
    queryFn: async () => {
      const response = await fetch(`/api/purchases?page=${page}&limit=20`);
      if (!response.ok) throw new Error("Unable to load purchases");
      return response.json() as Promise<{ items: Purchase[]; total: number; pages: number; page: number }>;
    },
  });

  const detail = useQuery({
    queryKey: ["purchase-detail", selectedId],
    enabled: !!selectedId && detailOpen,
    queryFn: async () => {
      const response = await fetch(`/api/purchases/${selectedId}/detail`);
      if (!response.ok) throw new Error("Unable to load purchase");
      return response.json();
    },
  });

  const suppliers = suppliersCrud.list.data?.items ?? [];
  const products = productsCrud.list.data?.items ?? [];

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.cost, 0);
  const taxes = lines.reduce((sum, l) => sum + (l.quantity * l.cost * l.taxRate) / 100, 0);
  const grandTotal = subtotal + taxes;

  const addLine = () => {
    const product = products.find((p) => p._id === selectedProduct);
    if (!product || qty <= 0 || cost < 0) {
      toast.error("Select a product with valid quantity and cost.");
      return;
    }
    setLines((prev) => [
      ...prev,
      { productId: product._id, name: product.productName, quantity: qty, cost, taxRate: product.taxRate },
    ]);
    setSelectedProduct("");
    setQty(1);
    setCost(0);
  };

  const createPurchase = async () => {
    if (!supplierId || lines.length === 0) {
      toast.error("Select a supplier and add at least one product.");
      return;
    }
    const response = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier: supplierId,
        products: lines.map((l) => ({
          product: l.productId,
          name: l.name,
          quantity: l.quantity,
          cost: l.cost,
          taxRate: l.taxRate,
          lineTotal: l.quantity * l.cost + (l.quantity * l.cost * l.taxRate) / 100,
        })),
        subtotal,
        taxes,
        grandTotal,
        paidAmount,
        status: "ordered",
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error ?? "Unable to create purchase order.");
      return;
    }
    toast.success("Purchase order created.");
    setCreateOpen(false);
    setLines([]);
    setSupplierId("");
    setPaidAmount(0);
    queryClient.invalidateQueries({ queryKey: ["purchases"] });
  };

  const receiveGoods = async (id: string) => {
    const response = await fetch(`/api/purchases/${id}/receive`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error ?? "Unable to receive goods.");
      return;
    }
    toast.success("Goods received. Stock updated.");
    queryClient.invalidateQueries({ queryKey: ["purchases"] });
    productsCrud.list.refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Purchases</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Create purchase orders and receive goods into inventory.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Purchase Order
        </Button>
      </div>

      <Surface>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchases.isLoading ? (
                <TableLoader colSpan={6} label="Loading purchases..." />
              ) : (purchases.data?.items ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-500">No purchase orders yet.</td></tr>
              ) : (
                purchases.data!.items.map((po) => (
                  <tr key={po._id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3 font-medium">{po.supplier?.supplierName ?? "—"}</td>
                    <td className="px-4 py-3">{currency(po.grandTotal)}</td>
                    <td className="px-4 py-3">{currency(po.paidAmount ?? 0)}</td>
                    <td className="px-4 py-3"><Badge variant={statusVariant(po.status)}>{po.status}</Badge></td>
                    <td className="px-4 py-3 text-zinc-500">{po.createdAt ? new Date(po.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedId(po._id); setDetailOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {po.status === "ordered" ? (
                          <Button size="sm" variant="secondary" onClick={() => void receiveGoods(po._id)}>
                            <PackageCheck className="h-4 w-4" />
                            Receive
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={purchases.data?.page ?? page}
          pages={purchases.data?.pages ?? 1}
          total={purchases.data?.total ?? 0}
          onPageChange={setPage}
        />
      </Surface>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="New Purchase Order" description="Add products and create an ordered purchase." className="max-w-2xl">
          <div className="space-y-4">
            <div>
              <Label>Supplier</Label>
              <Select className="mt-1.5" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Select supplier</option>
                {suppliers.map((s) => <option key={s._id} value={s._id}>{s.supplierName}</option>)}
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <Label>Product</Label>
                <Select className="mt-1.5" value={selectedProduct} onChange={(e) => {
                  setSelectedProduct(e.target.value);
                  const p = products.find((x) => x._id === e.target.value);
                  if (p) setCost(p.purchasePrice);
                }}>
                  <option value="">Select product</option>
                  {products.map((p) => <option key={p._id} value={p._id}>{p.productName}</option>)}
                </Select>
              </div>
              <div><Label>Qty</Label><Input className="mt-1.5" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
              <div><Label>Cost</Label><Input className="mt-1.5" type="number" min={0} value={cost} onChange={(e) => setCost(Number(e.target.value))} /></div>
            </div>
            <Button variant="secondary" onClick={addLine}>Add Line Item</Button>
            {lines.length > 0 ? (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
                {lines.map((line, index) => (
                  <div key={`${line.productId}-${index}`} className="flex items-center justify-between border-b p-3 last:border-0 dark:border-zinc-800">
                    <span>{line.name} x{line.quantity} @ {currency(line.cost)}</span>
                    <Button size="sm" variant="danger" onClick={() => setDeleteLineIndex(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Paid Amount</Label><Input className="mt-1.5" type="number" min={0} value={paidAmount || ""} onChange={(e) => setPaidAmount(Number(e.target.value))} /></div>
              <div className="flex items-end justify-end text-lg font-semibold">Total: {currency(grandTotal)}</div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => void createPurchase()}>Create PO</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent title="Purchase Details">
          {detail.data ? (
            <div className="space-y-3 text-sm">
              <div>Supplier: {detail.data.purchase.supplier?.supplierName}</div>
              <div>Status: {detail.data.purchase.status}</div>
              <div>Total: {currency(detail.data.purchase.grandTotal)}</div>
              {detail.data.items.map((item: { _id: string; name: string; quantity: number; cost: number }) => (
                <div key={item._id} className="flex justify-between border-b py-2 dark:border-zinc-800">
                  <span>{item.name}</span>
                  <span>{item.quantity} x {currency(item.cost)}</span>
                </div>
              ))}
            </div>
          ) : <BlockLoader label="Loading..." />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteLineIndex !== null}
        title="Remove Line Item"
        description={`Remove "${deleteLineIndex !== null ? lines[deleteLineIndex]?.name ?? "this item" : "this item"}" from the purchase order?`}
        confirmLabel="Remove"
        onOpenChange={(open) => {
          if (!open) setDeleteLineIndex(null);
        }}
        onConfirm={() => {
          if (deleteLineIndex === null) return;
          setLines((prev) => prev.filter((_, i) => i !== deleteLineIndex));
          setDeleteLineIndex(null);
        }}
      />
    </div>
  );
}
