"use client";

import { useSession } from "next-auth/react";
import {
  Barcode,
  Minus,
  Pause,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { Receipt } from "@/components/printing/receipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Surface } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BarcodeScannerDialog } from "@/features/pos/barcode-scanner-dialog";
import { buildSalePayload, productToCartItem } from "@/features/pos/pos-utils";
import { usePosCustomers, usePosProducts, usePosSettings } from "@/features/pos/use-pos-data";
import { BlockLoader } from "@/components/ui/loader";
import { currency } from "@/lib/utils";
import { usePosStore } from "@/store/pos-store";
import type { CartItem } from "@/types";

const DENOMINATIONS = [500, 1000, 2000, 5000];

function formatReceiptDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

type ReceiptSnapshot = {
  items: CartItem[];
  invoiceNumber: string;
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  changeDue: number;
  paymentMethod: "cash" | "credit" | "split";
  customerName?: string;
  outstandingBalance?: number;
  issuedAt: string;
};

export function PosTerminal() {
  const { data: session } = useSession();
  const pos = usePosStore();
  const computed = pos.computed();
  const searchRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState<"products" | "order">("products");
  const [cartQuantities, setCartQuantities] = useState<Record<string, string>>({});
  const [removeCartItem, setRemoveCartItem] = useState<CartItem | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [receiptSnapshot, setReceiptSnapshot] = useState<ReceiptSnapshot | null>(null);
  const [cashCustomerName, setCashCustomerName] = useState("");

  const { products, isLoading } = usePosProducts(search);
  const customersQuery = usePosCustomers();
  const settingsQuery = usePosSettings();

  const customers = customersQuery.data?.items ?? [];
  const selectedCustomer = customers.find((c) => c._id === pos.customerId);
  const settings = settingsQuery.data ?? { businessName: "Shopkeeper", logo: "", address: "", phone: "", receiptSize: "80mm" as const, receiptLogoAlign: "center" as const, receiptHeader: "", receiptFooter: "", thankYouMessage: "Thank you for shopping with us." };

  const printReceipt = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: receiptSnapshot?.invoiceNumber ?? "receipt",
  });

  useEffect(() => {
    usePosStore.getState().ensureInvoiceNumber();
  }, []);

  const addProductByCode = useCallback(
    (code: string) => {
      const normalized = code.trim().toLowerCase();
      const product = products.find(
        (p) => p.barcode?.toLowerCase() === normalized || p.sku.toLowerCase() === normalized || p._id === code,
      );
      if (!product) {
        toast.error("No product found for that barcode or SKU.");
        return;
      }
      if (product.quantity <= 0) {
        toast.error(`${product.productName} is out of stock.`);
        return;
      }
      pos.addItem(productToCartItem(product));
      toast.success(`Added ${product.productName}`);
    },
    [products, pos],
  );

  const voidOrder = useCallback(() => {
    pos.voidOrder();
    setCashCustomerName("");
  }, [pos]);

  const setPaymentMethod = useCallback(
    (method: "cash" | "credit" | "split") => {
      pos.setPaymentMethod(method);
      if (method === "cash") {
        pos.setCustomer(undefined);
      } else {
        setCashCustomerName("");
      }
    },
    [pos],
  );

  const cashReceiptCustomerName = cashCustomerName.trim() || "Walk-in customer";

  const creditDue =
    pos.paymentMethod === "credit" ? computed.grandTotal : pos.paymentMethod === "split" ? Math.max(computed.grandTotal - pos.paidAmount, 0) : 0;

  const creditExceeded =
    selectedCustomer && creditDue > 0 && (selectedCustomer.currentBalance ?? 0) + creditDue > selectedCustomer.creditLimit;

  const addProductToCart = useCallback(
    (product: (typeof products)[number]) => {
      if (product.quantity <= 0) {
        toast.error(`${product.productName} is out of stock.`);
        return;
      }

      const requestedQuantity = Number(cartQuantities[product._id] ?? 1);
      const quantity = Math.max(1, Math.min(Math.trunc(requestedQuantity) || 1, product.quantity));
      pos.addItem({ ...productToCartItem(product), quantity });
      toast.success(`Added ${quantity} x ${product.productName}`);
    },
    [cartQuantities, pos],
  );

  const onCheckout = useCallback(async () => {
    if (pos.items.length === 0) {
      toast.error("Cart is empty.");
      return;
    }
    if ((pos.paymentMethod === "credit" || pos.paymentMethod === "split") && creditDue > 0 && !pos.customerId) {
      toast.error("Select a customer for credit or split payment.");
      return;
    }
    if (creditExceeded) {
      toast.error("Credit limit exceeded for this customer.");
      return;
    }
    if (pos.paymentMethod === "cash" && pos.paidAmount < computed.grandTotal) {
      toast.error("Paid amount is less than the total.");
      return;
    }
    if (pos.paymentMethod === "split" && pos.paidAmount <= 0) {
      toast.error("Enter the cash portion for split payment.");
      return;
    }

    pos.ensureInvoiceNumber();
    const invoiceNumber = usePosStore.getState().invoiceNumber;
    if (!invoiceNumber) {
      toast.error("Invoice number is not ready. Please try again.");
      return;
    }

    setCheckoutPending(true);
    try {
      const payload = buildSalePayload({
        invoiceNumber,
        customerId: pos.paymentMethod === "cash" ? undefined : pos.customerId,
        items: pos.items,
        discountType: pos.discountType,
        discountValue: pos.discountValue,
        paymentMethod: pos.paymentMethod,
        paidAmount: pos.paidAmount,
      });

      const response = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Checkout failed");

      const newBalance =
        selectedCustomer && creditDue > 0 ? (selectedCustomer.currentBalance ?? 0) + creditDue : undefined;

      setReceiptSnapshot({
        items: [...pos.items],
        invoiceNumber,
        subtotal: computed.subtotal,
        discount: computed.discount,
        tax: computed.tax,
        grandTotal: computed.grandTotal,
        paidAmount: pos.paidAmount,
        changeDue: computed.changeDue,
        paymentMethod: pos.paymentMethod,
        customerName: pos.paymentMethod === "cash" ? cashReceiptCustomerName : selectedCustomer?.name,
        outstandingBalance: newBalance,
        issuedAt: formatReceiptDateTime(),
      });

      toast.success(`Sale completed — ${invoiceNumber}`);
      voidOrder();
      customersQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed.");
    } finally {
      setCheckoutPending(false);
    }
  }, [pos, computed, selectedCustomer, creditDue, creditExceeded, customersQuery, cashReceiptCustomerName, voidOrder]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "F9") {
        event.preventDefault();
        void onCheckout();
      }
      if (event.key === "Escape") {
        voidOrder();
        toast.message("Order voided.");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCheckout, voidOrder]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">{activeScreen === "products" ? "Point of Sale" : "Order Summary"}</h2>
          <p className="text-sm text-zinc-500">F2 search · F9 checkout · Esc void</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pos.heldOrders.length > 0 ? (
            <Button variant="secondary" onClick={() => setHeldOpen(true)}>
              <Pause className="h-4 w-4" />
              Held ({pos.heldOrders.length})
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => { voidOrder(); toast.message("Order voided."); }}>
            <RotateCcw className="h-4 w-4" />
            Void
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant={activeScreen === "products" ? "primary" : "secondary"} onClick={() => setActiveScreen("products")}>
          Point of Sale
        </Button>
        <Button variant={activeScreen === "order" ? "primary" : "secondary"} onClick={() => setActiveScreen("order")}>
          Order Summary ({pos.items.length})
        </Button>
      </div>

      <div className="min-h-[calc(100vh-12rem)]">
        <Surface className={`${activeScreen === "products" ? "block" : "hidden"} space-y-5`}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
              <Input
                ref={searchRef}
                className="pl-9"
                placeholder="Search products by name, SKU, or barcode"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) addProductByCode(search);
                }}
              />
            </div>
            <Button variant="secondary" onClick={() => setScannerOpen(true)}>
              <Barcode className="h-4 w-4" />
              Scan
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {isLoading ? (
              <BlockLoader label="Loading products..." />
            ) : products.length === 0 ? (
              <p className="p-8 text-center text-zinc-500">No active products in stock. Add inventory first.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="border-b border-zinc-100 bg-[var(--panel)] text-left text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Stock</th>
                      <th className="px-4 py-3 font-medium">Qty</th>
                      <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {products.map((product) => (
                      <tr key={product._id} className="transition hover:bg-emerald-50/60">
                        <td className="whitespace-nowrap px-4 py-3 font-medium">{product.productName}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{product.sku}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-600 dark:text-emerald-400">{currency(product.sellingPrice)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge variant={product.quantity <= product.reorderLevel ? "warning" : "default"}>Qty {product.quantity}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Input
                            className="h-9 w-20 bg-white text-zinc-900"
                            type="number"
                            min={1}
                            max={product.quantity}
                            placeholder="1"
                            value={cartQuantities[product._id] ?? ""}
                            onChange={(event) =>
                              setCartQuantities((current) => ({
                                ...current,
                                [product._id]: event.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Button
                            size="sm"
                            disabled={product.quantity <= 0}
                            onClick={() => addProductToCart(product)}
                          >
                            Add to Cart
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </Surface>

        <Card className={`${activeScreen === "order" ? "flex" : "hidden"} flex-col`}>
          <h2 className="text-2xl font-semibold">Order Summary</h2>
          <p className="text-sm text-zinc-400">{pos.invoiceNumber}</p>

          <div className="mt-4 rounded-2xl border border-zinc-700/80">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
              <ShoppingCart className="h-4 w-4 text-emerald-500" />
              <span className="font-medium">Cart ({pos.items.length})</span>
            </div>
            {pos.items.length === 0 ? (
              <div className="space-y-3 p-8 text-center text-zinc-500">
                <p>Cart is empty. Search, scan, or tap a product.</p>
                <Button size="sm" variant="secondary" onClick={() => setActiveScreen("products")}>
                  Add Products
                </Button>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {pos.items.map((item) => (
                  <div key={item.productId} className="flex flex-col gap-3 border-b border-zinc-800 p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-zinc-500">
                        {item.sku} · {currency(item.unitPrice)} · Stock {item.stockAvailable}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => pos.updateQuantity(item.productId, item.quantity - 1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button size="sm" variant="ghost" onClick={() => pos.updateQuantity(item.productId, item.quantity + 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setRemoveCartItem(item)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4">
            <Label>Customer</Label>
            {pos.paymentMethod === "cash" ? (
              <Input
                className="mt-1.5 bg-zinc-800 text-white"
                placeholder="Walk-in customer"
                value={cashCustomerName}
                onChange={(e) => setCashCustomerName(e.target.value)}
              />
            ) : (
              <>
                <Select className="mt-1.5 bg-zinc-800 text-white" value={pos.customerId ?? ""} onChange={(e) => pos.setCustomer(e.target.value || undefined)}>
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} — {currency(c.currentBalance ?? 0)} / {currency(c.creditLimit)}
                    </option>
                  ))}
                </Select>
                {creditExceeded ? <p className="mt-2 text-xs text-red-400">Credit limit exceeded for this sale.</p> : null}
              </>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <Label>Discount Type</Label>
              <Select
                className="mt-1.5 bg-zinc-800 text-white"
                value={pos.discountType}
                onChange={(e) => pos.setDiscount(e.target.value as "flat" | "percentage", pos.discountValue)}
              >
                <option value="flat">Flat</option>
                <option value="percentage">Percentage</option>
              </Select>
            </div>
            <div>
              <Label>Discount Value</Label>
              <Input
                className="mt-1.5 bg-zinc-800 text-white"
                type="number"
                min={0}
                value={pos.discountValue || ""}
                onChange={(e) => pos.setDiscount(pos.discountType, Number(e.target.value))}
              />
            </div>
          </div>

          <div className="my-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{currency(computed.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>{currency(computed.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{currency(computed.tax)}</span>
            </div>
            <div className="flex justify-between border-t border-dashed border-zinc-700 pt-3 text-xl font-semibold">
              <span>Total</span>
              <span>{currency(computed.grandTotal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["cash", "credit", "split"] as const).map((method) => (
              <Button key={method} size="sm" variant={pos.paymentMethod === method ? "primary" : "secondary"} onClick={() => setPaymentMethod(method)}>
                {method}
              </Button>
            ))}
          </div>

          {pos.paymentMethod !== "credit" ? (
            <>
              <Input
                className="mt-4 bg-zinc-800 text-white"
                type="number"
                min={0}
                placeholder={pos.paymentMethod === "split" ? "Cash portion" : "Paid amount"}
                value={pos.paidAmount || ""}
                onChange={(e) => pos.setPaidAmount(Number(e.target.value))}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {DENOMINATIONS.map((amount) => (
                  <Button key={amount} size="sm" variant="ghost" className="text-zinc-300" onClick={() => pos.setPaidAmount(pos.paidAmount + amount)}>
                    +{currency(amount)}
                  </Button>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-zinc-800 p-4 text-sm">
                Change Due: <strong>{currency(computed.changeDue)}</strong>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-xl bg-zinc-800 p-4 text-sm">Full amount on customer account: <strong>{currency(computed.grandTotal)}</strong></div>
          )}

          {pos.paymentMethod === "split" && creditDue > 0 ? (
            <div className="mt-2 text-xs text-zinc-400">Credit portion: {currency(creditDue)}</div>
          ) : null}

          <div className="mt-auto grid gap-3 pt-6">
            <Button size="lg" disabled={checkoutPending || creditExceeded} onClick={() => void onCheckout()}>
              {checkoutPending ? "Processing..." : "Checkout (F9)"}
            </Button>
            <Button variant="secondary" onClick={() => { pos.holdOrder(`Hold ${new Date().toLocaleTimeString()}`); toast.success("Order held."); }}>
              <Pause className="h-4 w-4" />
              Hold Order
            </Button>
            {receiptSnapshot ? (
              <Button variant="ghost" onClick={() => printReceipt()}>
                <Printer className="h-4 w-4" />
                Print Last Receipt
              </Button>
            ) : null}
          </div>
        </Card>
      </div>

      <BarcodeScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={addProductByCode} />

      <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
        <DialogContent title="Held Orders" description="Resume a parked order to continue checkout.">
          {pos.heldOrders.length === 0 ? (
            <p className="text-sm text-zinc-500">No held orders.</p>
          ) : (
            <div className="space-y-3">
              {pos.heldOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div>
                    <div className="font-medium">{order.name}</div>
                    <div className="text-sm text-zinc-500">{order.items.length} items · {new Date(order.createdAt).toLocaleString()}</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      pos.resumeOrder(order.id);
                      setHeldOpen(false);
                      toast.success("Order resumed.");
                    }}
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {receiptSnapshot ? (
        <div className="hidden">
          <Receipt
            ref={receiptRef}
            items={receiptSnapshot.items}
            size={settings.receiptSize}
            invoiceNumber={receiptSnapshot.invoiceNumber}
            businessName={settings.businessName}
            logo={settings.logo}
            logoAlign={settings.receiptLogoAlign}
            address={settings.address}
            phone={settings.phone}
            receiptHeader={settings.receiptHeader}
            receiptFooter={settings.receiptFooter}
            thankYouMessage={settings.thankYouMessage}
            cashierName={session?.user?.name ?? undefined}
            customerName={receiptSnapshot.customerName}
            subtotal={receiptSnapshot.subtotal}
            discount={receiptSnapshot.discount}
            tax={receiptSnapshot.tax}
            grandTotal={receiptSnapshot.grandTotal}
            paidAmount={receiptSnapshot.paidAmount}
            changeDue={receiptSnapshot.changeDue}
            paymentMethod={receiptSnapshot.paymentMethod}
            outstandingBalance={receiptSnapshot.outstandingBalance}
            issuedAt={receiptSnapshot.issuedAt}
          />
        </div>
      ) : null}
      <ConfirmDialog
        open={!!removeCartItem}
        title="Remove Cart Item"
        description={`Remove "${removeCartItem?.name ?? ""}" from the cart?`}
        confirmLabel="Remove"
        onOpenChange={(open) => {
          if (!open) setRemoveCartItem(null);
        }}
        onConfirm={() => {
          if (!removeCartItem) return;
          pos.removeItem(removeCartItem.productId);
          setRemoveCartItem(null);
        }}
      />
    </div>
  );
}
