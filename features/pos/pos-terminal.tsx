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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { Receipt } from "@/components/printing/receipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BarcodeScannerDialog } from "@/features/pos/barcode-scanner-dialog";
import { buildSalePayload, productToCartItem, validatePaymentReference, validateWalletLastFourDigits } from "@/features/pos/pos-utils";
import { usePosCustomers, usePosProducts, usePosSettings } from "@/features/pos/use-pos-data";
import { PaymentAccountSelect, PaymentMethodAccountSelect } from "@/components/payment/payment-method-account-select";
import { useShopPaymentAccounts } from "@/hooks/use-shop-payment-accounts";
import {
  findAccountPaymentValue,
  isAccountPaymentValue,
  isShopAccountPaymentMethod,
  resolvePaymentSelection,
} from "@/lib/payment-accounts";
import { BlockLoader } from "@/components/ui/loader";
import { currency, formatPakistanDate, formatPakistanDateInput, formatPakistanDateTime, formatPakistanTime, pakistanTodayKey } from "@/lib/utils";
import { usePosStore, usePosStoreRehydration } from "@/store/pos-store";
import type { CartItem, PaymentMethod } from "@/types";
import { isCreditPayment, requiresFullPayment } from "@/types";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank: "Bank transfer",
  cheque: "Cheque",
  easypaisa: "EasyPaisa",
  jazzcash: "JazzCash",
  credit: "Credit",
  split: "Split",
};

const POS_BASE_PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "credit", label: "Credit" },
  { value: "split", label: "Split" },
] as const;

function paymentSummaryLabel(method: PaymentMethod, bankName?: string) {
  if (bankName && isShopAccountPaymentMethod(method)) {
    return `${PAYMENT_LABELS[method]} · ${bankName}`;
  }
  return PAYMENT_LABELS[method];
}

const DENOMINATIONS = [500, 1000, 2000, 5000];

type ReceiptSnapshot = {
  items: CartItem[];
  invoiceNumber: string;
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  changeDue: number;
  paymentMethod: PaymentMethod;
  customerName?: string;
  outstandingBalance?: number;
  issuedAt: string;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string;
};

export function PosTerminal() {
  const { data: session } = useSession();
  usePosStoreRehydration();
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
  const [couponInput, setCouponInput] = useState("");
  const [couponPending, setCouponPending] = useState(false);
  const [cashCustomerName, setCashCustomerName] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentReferenceError, setPaymentReferenceError] = useState<string | null>(null);
  const [paymentSelection, setPaymentSelection] = useState("cash");
  const [selectedAccountName, setSelectedAccountName] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBankAccountId, setChequeBankAccountId] = useState("");
  const [chequeDate, setChequeDate] = useState(() => pakistanTodayKey());
  const [orderNotes, setOrderNotes] = useState("");
  const [pointsRedeemed, setPointsRedeemed] = useState(0);

  const { products, isLoading } = usePosProducts(search);
  const customersQuery = usePosCustomers();
  const settingsQuery = usePosSettings();
  const paymentAccountsQuery = useShopPaymentAccounts();
  const bankAccountsQuery = useShopPaymentAccounts({ accountType: "bank" });

  const paymentAccounts = paymentAccountsQuery.data?.items ?? [];
  const bankAccounts = bankAccountsQuery.data?.items ?? [];
  const resolvedPayment = useMemo(
    () => resolvePaymentSelection(paymentSelection, paymentAccounts),
    [paymentSelection, paymentAccounts],
  );
  const chequeBankName = useMemo(
    () => bankAccounts.find((account) => account._id === chequeBankAccountId)?.name ?? "",
    [bankAccounts, chequeBankAccountId],
  );

  const customers = customersQuery.data?.items ?? [];
  const selectedCustomer = customers.find((c) => c._id === pos.customerId);
  const groupDiscountAmount =
    selectedCustomer && "groupDiscountPercent" in selectedCustomer && selectedCustomer.groupDiscountPercent
      ? Math.round((computed.subtotal - computed.discount) * (Number(selectedCustomer.groupDiscountPercent) / 100))
      : 0;
  const grandTotal = Math.max(computed.grandTotal - groupDiscountAmount - pointsRedeemed, 0);
  const settings = settingsQuery.data ?? {
    businessName: "Shopkeeper",
    logo: "",
    address: "",
    phone: "",
    email: "",
    gstVatNumber: "",
    ntn: "",
    taxLabel: "Tax",
    showTaxOnReceipt: true,
    receiptTitle: "Sales Receipt",
    receiptSize: "80mm" as const,
    receiptLogoAlign: "center" as const,
    receiptHeader: "",
    receiptFooter: "",
    thankYouMessage: "Thank you for shopping with us.",
    showReceiptLogo: true,
    showReceiptBarcode: true,
    showCashierOnReceipt: true,
    showCustomerOnReceipt: true,
    showSkuOnReceipt: false,
    showTaxNumbersOnReceipt: true,
    showEmailOnReceipt: false,
    autoPrintReceipt: false,
  };

  const printReceipt = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: receiptSnapshot?.invoiceNumber ?? "receipt",
  });

  useEffect(() => {
    if (!receiptSnapshot || !settings.autoPrintReceipt) return;
    const timer = window.setTimeout(() => printReceipt(), 250);
    return () => window.clearTimeout(timer);
  }, [receiptSnapshot, settings.autoPrintReceipt, printReceipt]);

  const applyCoupon = useCallback(async () => {
    const code = couponInput.trim();
    if (!code) {
      pos.setCoupon(undefined, 0);
      return;
    }
    setCouponPending(true);
    try {
      const subtotal = pos.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const orderDiscount = pos.discountType === "percentage" ? (subtotal * pos.discountValue) / 100 : pos.discountValue;
      const baseTotal = subtotal - orderDiscount + pos.items.reduce((sum, item) => {
        const base = Math.max(item.quantity * item.unitPrice - item.discount, 0);
        return sum + (base * item.taxRate) / 100;
      }, 0);
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, orderTotal: baseTotal }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Invalid coupon");
      pos.setCoupon(data.code, data.discount);
      toast.success(`Coupon applied — ${currency(data.discount)} off`);
    } catch (error) {
      pos.setCoupon(undefined, 0);
      toast.error(error instanceof Error ? error.message : "Coupon failed");
    } finally {
      setCouponPending(false);
    }
  }, [couponInput, pos]);

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
    setCouponInput("");
    setPaymentReference("");
    setPaymentReferenceError(null);
    setPaymentSelection("cash");
    setSelectedAccountName("");
    setChequeNumber("");
    setChequeBankAccountId("");
    setChequeDate(pakistanTodayKey());
    setOrderNotes("");
    setPointsRedeemed(0);
  }, [pos]);

  const applyPaymentSelection = useCallback(
    (value: string) => {
      setPaymentSelection(value);
      const resolved = resolvePaymentSelection(value, paymentAccounts);
      pos.setPaymentMethod(resolved.paymentMethod as PaymentMethod);
      setSelectedAccountName(resolved.bankName);
      setPaymentReference("");
      setPaymentReferenceError(null);

      const method = resolved.paymentMethod as PaymentMethod;
      if (method === "cheque") {
        setCashCustomerName("");
        pos.setPaidAmount(pos.computed().grandTotal);
        return;
      }
      if (resolved.paymentMethod === "cash") {
        pos.setCustomer(undefined);
      } else if (!isCreditPayment(resolved.paymentMethod as PaymentMethod)) {
        pos.setCustomer(undefined);
        setCashCustomerName("");
        pos.setPaidAmount(pos.computed().grandTotal);
      } else {
        setCashCustomerName("");
      }
    },
    [paymentAccounts, pos],
  );

  useEffect(() => {
    if (paymentAccountsQuery.isLoading) return;
    if (isAccountPaymentValue(paymentSelection)) {
      const resolved = resolvePaymentSelection(paymentSelection, paymentAccounts);
      if (!resolved.isAccount && paymentSelection !== "cash") {
        setPaymentSelection("cash");
        pos.setPaymentMethod("cash");
        setSelectedAccountName("");
      }
      return;
    }
    if (pos.paymentMethod === "card" || paymentSelection === "card") {
      setPaymentSelection("cash");
      pos.setPaymentMethod("cash");
      setSelectedAccountName("");
      return;
    }
    if (isShopAccountPaymentMethod(pos.paymentMethod)) {
      const match = findAccountPaymentValue(paymentAccounts, pos.paymentMethod);
      if (match) {
        setPaymentSelection(match);
        const resolved = resolvePaymentSelection(match, paymentAccounts);
        setSelectedAccountName(resolved.bankName);
      } else {
        setPaymentSelection("cash");
        pos.setPaymentMethod("cash");
        setSelectedAccountName("");
      }
    } else {
      setPaymentSelection(pos.paymentMethod);
      setSelectedAccountName("");
    }
  }, [paymentAccounts, paymentAccountsQuery.isLoading, paymentSelection, pos, pos.paymentMethod]);

  useEffect(() => {
    if (!chequeBankAccountId && bankAccounts.length > 0) {
      setChequeBankAccountId(bankAccounts[0]._id);
    }
  }, [bankAccounts, chequeBankAccountId]);

  const cashReceiptCustomerName = cashCustomerName.trim() || "Walk-in customer";

  const cashTendered = pos.paidAmount;
  const changeDue = pos.paymentMethod === "cash" ? Math.max(cashTendered - grandTotal, 0) : 0;
  const amountDue =
    pos.paymentMethod === "cash"
      ? Math.max(grandTotal - cashTendered, 0)
      : pos.paymentMethod === "split"
        ? Math.max(grandTotal - cashTendered, 0)
        : 0;
  const creditDue = pos.paymentMethod === "credit" ? grandTotal : pos.paymentMethod === "split" ? amountDue : 0;
  const needsPaymentReference = pos.paymentMethod === "bank";
  const needsWalletLastFourDigits = pos.paymentMethod === "easypaisa" || pos.paymentMethod === "jazzcash";
  const needsChequeDetails = pos.paymentMethod === "cheque";
  const cartLineTotal = (item: (typeof pos.items)[number]) => item.quantity * item.unitPrice;

  const walkInSale =
    pos.paymentMethod === "cash" ||
    pos.paymentMethod === "easypaisa" ||
    pos.paymentMethod === "jazzcash" ||
    (requiresFullPayment(pos.paymentMethod) && pos.paymentMethod !== "cheque");

  const creditExceeded =
    selectedCustomer && creditDue > 0 && (selectedCustomer.currentBalance ?? 0) + creditDue > selectedCustomer.creditLimit;

  const payExactAmount = useCallback(() => {
    pos.setPaidAmount(grandTotal);
  }, [grandTotal, pos]);

  const clearCoupon = useCallback(() => {
    pos.setCoupon(undefined, 0);
    setCouponInput("");
    toast.success("Coupon removed.");
  }, [pos]);

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
    if (isCreditPayment(pos.paymentMethod) && creditDue > 0 && !pos.customerId) {
      toast.error("Select a customer for credit or split payment.");
      return;
    }
    if (creditExceeded) {
      toast.error("Credit limit exceeded for this customer.");
      return;
    }
    if (pos.paymentMethod === "cash" && pos.paidAmount < grandTotal) {
      toast.error("Paid amount is less than the total.");
      return;
    }
    if (requiresFullPayment(pos.paymentMethod) && pos.paidAmount < grandTotal) {
      pos.setPaidAmount(grandTotal);
    }
    if (pos.paymentMethod === "split" && pos.paidAmount <= 0) {
      toast.error("Enter the cash portion for split payment.");
      return;
    }
    if (pos.paymentMethod === "cheque") {
      if (!pos.customerId) {
        toast.error("Select a customer for cheque payment.");
        return;
      }
      if (!chequeNumber.trim()) {
        toast.error("Enter cheque number.");
        return;
      }
      if (!chequeBankName.trim()) {
        toast.error("Select the cheque bank.");
        return;
      }
      if (!chequeDate) {
        toast.error("Select cheque date.");
        return;
      }
    }
    if (resolvedPayment.isAccount && !resolvedPayment.bankName) {
      toast.error("Select a registered payment account.");
      return;
    }
    if (needsWalletLastFourDigits) {
      const refError = validateWalletLastFourDigits(paymentReference);
      if (refError) {
        setPaymentReferenceError(refError);
        toast.error(refError);
        return;
      }
    }
    if (needsPaymentReference) {
      const refError = validatePaymentReference(paymentReference);
      if (refError) {
        setPaymentReferenceError(refError);
        toast.error(refError);
        return;
      }
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
        customerId: walkInSale ? undefined : pos.customerId,
        items: pos.items,
        discountType: pos.discountType,
        discountValue: pos.discountValue,
        couponCode: pos.couponCode,
        couponDiscount: pos.couponDiscount,
        paymentMethod: pos.paymentMethod,
        paidAmount: requiresFullPayment(pos.paymentMethod) ? grandTotal : pos.paidAmount,
        orderNotes,
        paymentReference: needsPaymentReference || needsWalletLastFourDigits ? paymentReference.trim() : undefined,
        chequeNumber: pos.paymentMethod === "cheque" ? chequeNumber.trim() : undefined,
        bankName:
          pos.paymentMethod === "cheque"
            ? chequeBankName.trim()
            : resolvedPayment.bankName || selectedAccountName.trim() || undefined,
        chequeDate: pos.paymentMethod === "cheque" ? chequeDate : undefined,
        groupDiscount: groupDiscountAmount,
        pointsRedeemed,
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
        grandTotal,
        paidAmount: pos.paidAmount,
        changeDue: pos.paymentMethod === "cash" ? changeDue : computed.changeDue,
        paymentMethod: pos.paymentMethod,
        customerName: walkInSale ? cashReceiptCustomerName : selectedCustomer?.name,
        outstandingBalance: newBalance,
        issuedAt: formatPakistanDateTime(new Date()),
        chequeNumber: pos.paymentMethod === "cheque" ? chequeNumber.trim() : undefined,
        bankName:
          pos.paymentMethod === "cheque"
            ? chequeBankName.trim()
            : resolvedPayment.bankName || selectedAccountName.trim() || undefined,
        chequeDate: pos.paymentMethod === "cheque" ? formatPakistanDateInput(chequeDate) : undefined,
      });

      toast.success(`Sale completed — ${invoiceNumber}`);
      voidOrder();
      customersQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed.");
    } finally {
      setCheckoutPending(false);
    }
  }, [pos, computed, selectedCustomer, creditDue, creditExceeded, customersQuery, cashReceiptCustomerName, voidOrder, walkInSale, orderNotes, paymentReference, needsPaymentReference, needsWalletLastFourDigits, changeDue, grandTotal, groupDiscountAmount, pointsRedeemed, chequeNumber, chequeBankName, chequeDate, resolvedPayment, selectedAccountName]);

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

          <div className="rounded-2xl border border-zinc-200 bg-white">
            {isLoading ? (
              <BlockLoader label="Loading products..." />
            ) : products.length === 0 ? (
              <p className="p-8 text-center text-zinc-500">No active products in stock. Add inventory first.</p>
            ) : (
              <div className="responsive-table-shell responsive-table-shell--nested">
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

        <Surface className={`${activeScreen === "order" ? "flex" : "hidden"} flex-col text-zinc-950`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-zinc-950">Order Summary</h2>
              <p className="text-sm text-zinc-600">{pos.invoiceNumber || "New invoice"}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-right text-sm">
              <div className="text-zinc-600">Items</div>
              <div className="font-semibold text-zinc-950">{pos.items.length}</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white">
            <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
              <ShoppingCart className="h-4 w-4 text-emerald-600" />
              <span className="font-medium text-zinc-950">Cart ({pos.items.length})</span>
            </div>
            {pos.items.length === 0 ? (
              <div className="space-y-3 p-8 text-center text-zinc-600">
                <p>Cart is empty. Search, scan, or tap a product.</p>
                <Button size="sm" variant="secondary" onClick={() => setActiveScreen("products")}>
                  Add Products
                </Button>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {pos.items.map((item) => (
                  <div key={item.productId} className="flex flex-col gap-3 border-b border-zinc-100 p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-zinc-950">{item.name}</div>
                      <div className="text-sm text-zinc-600">
                        {item.sku} · {currency(item.unitPrice)} each · Stock {item.stockAvailable}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm">
                        <div className="font-semibold text-zinc-950">{currency(cartLineTotal(item))}</div>
                        <div className="text-zinc-500">Line total</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => pos.updateQuantity(item.productId, item.quantity - 1)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-medium text-zinc-950">{item.quantity}</span>
                        <Button size="sm" variant="ghost" onClick={() => pos.updateQuantity(item.productId, item.quantity + 1)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setRemoveCartItem(item)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4">
            <Label className="text-zinc-700">Customer</Label>
            {pos.paymentMethod === "cash" ? (
              <Input
                className="mt-1.5"
                placeholder="Walk-in customer"
                value={cashCustomerName}
                onChange={(e) => setCashCustomerName(e.target.value)}
              />
            ) : (
              <>
                <Select className="mt-1.5" value={pos.customerId ?? ""} onChange={(e) => pos.setCustomer(e.target.value || undefined)}>
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} — {currency(c.currentBalance ?? 0)} / {currency(c.creditLimit)}
                    </option>
                  ))}
                </Select>
                {creditExceeded ? <p className="mt-2 text-xs text-red-600">Credit limit exceeded for this sale.</p> : null}
              </>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-zinc-700">Discount Type</Label>
              <Select
                className="mt-1.5"
                value={pos.discountType}
                onChange={(e) => pos.setDiscount(e.target.value as "flat" | "percentage", pos.discountValue)}
              >
                <option value="flat">Flat</option>
                <option value="percentage">Percentage</option>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-700">Discount Value</Label>
              <Input
                className="mt-1.5"
                type="number"
                min={0}
                value={pos.discountValue || ""}
                onChange={(e) => pos.setDiscount(pos.discountType, Number(e.target.value))}
              />
            </div>
          </div>

          <div className="my-6 space-y-3 text-sm text-zinc-800">
            <div className="flex justify-between">
              <span className="text-zinc-600">Subtotal</span>
              <span className="font-medium text-zinc-950">{currency(computed.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Discount</span>
              <span className="font-medium text-zinc-950">{currency(computed.discount)}</span>
            </div>
            {pos.couponDiscount > 0 ? (
              <div className="flex justify-between text-emerald-700">
                <span>Coupon ({pos.couponCode})</span>
                <span className="font-medium">-{currency(pos.couponDiscount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-zinc-600">Tax</span>
              <span className="font-medium text-zinc-950">{currency(computed.tax)}</span>
            </div>
            {groupDiscountAmount > 0 ? (
              <div className="flex justify-between text-emerald-700">
                <span>Group discount</span>
                <span className="font-medium">-{currency(groupDiscountAmount)}</span>
              </div>
            ) : null}
            {pointsRedeemed > 0 ? (
              <div className="flex justify-between text-emerald-700">
                <span>Points redeemed</span>
                <span className="font-medium">-{currency(pointsRedeemed)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-dashed border-zinc-200 pt-3 text-xl font-semibold text-zinc-950">
              <span>Total</span>
              <span>{currency(grandTotal)}</span>
            </div>
          </div>

          <div className="mb-4 flex gap-2">
            <Input
              placeholder="Coupon code"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            />
            <Button type="button" variant="secondary" loading={couponPending} onClick={() => void applyCoupon()}>
              Apply
            </Button>
            {pos.couponCode ? (
              <Button type="button" variant="ghost" onClick={clearCoupon}>
                Clear
              </Button>
            ) : null}
          </div>

          <div>
            <Label htmlFor="pos-payment-method" className="text-zinc-700">
              Payment Method
            </Label>
            <PaymentMethodAccountSelect
              id="pos-payment-method"
              className="mt-1.5"
              value={paymentSelection}
              onChange={applyPaymentSelection}
              accounts={paymentAccounts}
              accountsLoading={paymentAccountsQuery.isLoading}
              baseMethods={[...POS_BASE_PAYMENT_METHODS]}
              emptyAccountsHint="Ask your admin to add bank accounts under Finance → Bank."
            />
          </div>

          {needsChequeDetails ? (
            <div className="mt-4 space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-950">Cheque details</p>
              {!pos.customerId ? (
                <p className="text-xs text-red-700">Select a customer above — required for cheque payment and bounce tracking.</p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pos-cheque-number">Cheque number</Label>
                  <Input
                    id="pos-cheque-number"
                    className="mt-1.5 bg-white"
                    placeholder="Cheque #"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pos-cheque-date">Cheque date</Label>
                  <Input
                    id="pos-cheque-date"
                    type="date"
                    className="mt-1.5 bg-white"
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="pos-cheque-bank">Bank</Label>
                <PaymentAccountSelect
                  id="pos-cheque-bank"
                  className="mt-1.5 bg-white"
                  value={chequeBankAccountId}
                  onChange={setChequeBankAccountId}
                  accounts={bankAccounts}
                  emptyAccountsHint="Add bank accounts under Finance → Bank to select cheque banks."
                />
              </div>
              <p className="text-xs text-amber-900">If this cheque bounces later, record repayment from Sales using a registered shop account or another cheque.</p>
            </div>
          ) : null}

          {needsWalletLastFourDigits ? (
            <div className="mt-4">
              <Label htmlFor="pos-wallet-last-four" className="text-zinc-700">
                Last 4 digits <span className="text-red-600">*</span>
              </Label>
              <Input
                id="pos-wallet-last-four"
                className="mt-1.5 font-mono tracking-widest"
                placeholder="e.g. 4829"
                inputMode="numeric"
                autoComplete="off"
                value={paymentReference}
                required
                maxLength={4}
                aria-invalid={paymentReferenceError ? true : undefined}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPaymentReference(next);
                  if (paymentReferenceError) {
                    setPaymentReferenceError(validateWalletLastFourDigits(next));
                  }
                }}
                onBlur={() => setPaymentReferenceError(validateWalletLastFourDigits(paymentReference))}
              />
              {paymentReferenceError ? (
                <p className="mt-1.5 text-xs text-red-600">{paymentReferenceError}</p>
              ) : (
                <p className="mt-1.5 text-xs text-zinc-500">
                  Required for {pos.paymentMethod === "easypaisa" ? "EasyPaisa" : "JazzCash"} — enter the last 4 digits of the transaction ID.
                </p>
              )}
            </div>
          ) : null}

          {needsPaymentReference ? (
            <div className="mt-4">
              <Label htmlFor="pos-payment-reference" className="text-zinc-700">
                Payment Reference <span className="text-red-600">*</span>
              </Label>
              <Input
                id="pos-payment-reference"
                className="mt-1.5"
                placeholder="Transaction ID, last 4 digits, or bank ref"
                value={paymentReference}
                required
                minLength={3}
                maxLength={120}
                aria-invalid={paymentReferenceError ? true : undefined}
                onChange={(e) => {
                  const next = e.target.value;
                  setPaymentReference(next);
                  if (paymentReferenceError) {
                    setPaymentReferenceError(validatePaymentReference(next));
                  }
                }}
                onBlur={() => setPaymentReferenceError(validatePaymentReference(paymentReference))}
              />
              {paymentReferenceError ? (
                <p className="mt-1.5 text-xs text-red-600">{paymentReferenceError}</p>
              ) : (
                <p className="mt-1.5 text-xs text-zinc-500">Required for shop account payments.</p>
              )}
            </div>
          ) : null}

          {pos.paymentMethod === "credit" ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              Full amount on customer account: <strong>{currency(grandTotal)}</strong>
            </div>
          ) : pos.paymentMethod === "split" ? (
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-zinc-700">Cash Portion</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={grandTotal}
                    placeholder="Cash amount"
                    value={pos.paidAmount || ""}
                    onChange={(e) => pos.setPaidAmount(Number(e.target.value))}
                  />
                  <Button type="button" variant="secondary" onClick={() => pos.setPaidAmount(grandTotal)}>
                    Full cash
                  </Button>
                </div>
              </div>
            </div>
          ) : pos.paymentMethod === "cash" ? (
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-zinc-700">Amount Received</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Paid amount"
                    value={pos.paidAmount || ""}
                    onChange={(e) => pos.setPaidAmount(Number(e.target.value))}
                  />
                  <Button type="button" variant="secondary" onClick={payExactAmount}>
                    Exact
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {DENOMINATIONS.map((amount) => (
                  <Button key={amount} size="sm" variant="ghost" onClick={() => pos.setPaidAmount(pos.paidAmount + amount)}>
                    +{currency(amount)}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Full payment via {paymentSummaryLabel(pos.paymentMethod, selectedAccountName)}: <strong>{currency(grandTotal)}</strong>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <div className="text-zinc-500">Total</div>
                <div className="font-semibold text-zinc-950">{currency(grandTotal)}</div>
              </div>
              {(pos.paymentMethod === "cash" || pos.paymentMethod === "split") && (
                <div>
                  <div className="text-zinc-500">{pos.paymentMethod === "split" ? "Cash paid" : "Received"}</div>
                  <div className="font-semibold text-zinc-950">{currency(pos.paidAmount)}</div>
                </div>
              )}
              {pos.paymentMethod === "cash" && changeDue > 0 ? (
                <div>
                  <div className="text-zinc-500">Change due</div>
                  <div className="font-semibold text-emerald-700">{currency(changeDue)}</div>
                </div>
              ) : null}
              {pos.paymentMethod === "cash" && amountDue > 0 ? (
                <div>
                  <div className="text-zinc-500">Amount due</div>
                  <div className="font-semibold text-red-600">{currency(amountDue)}</div>
                </div>
              ) : null}
              {pos.paymentMethod === "split" && creditDue > 0 ? (
                <div>
                  <div className="text-zinc-500">Credit portion</div>
                  <div className="font-semibold text-amber-700">{currency(creditDue)}</div>
                </div>
              ) : null}
              {pos.paymentMethod === "credit" ? (
                <div>
                  <div className="text-zinc-500">On account</div>
                  <div className="font-semibold text-amber-700">{currency(grandTotal)}</div>
                </div>
              ) : null}
              {resolvedPayment.isAccount && selectedAccountName ? (
                <div>
                  <div className="text-zinc-500">Payment account</div>
                  <div className="font-semibold text-zinc-950">{selectedAccountName}</div>
                </div>
              ) : null}
              {pos.paymentMethod === "cheque" ? (
                <>
                  <div>
                    <div className="text-zinc-500">Cheque #</div>
                    <div className="font-semibold text-zinc-950">{chequeNumber.trim() || "—"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Cheque date</div>
                    <div className="font-semibold text-zinc-950">{chequeDate ? formatPakistanDate(chequeDate) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Bank</div>
                    <div className="font-semibold text-zinc-950">{chequeBankName || "—"}</div>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {selectedCustomer && (selectedCustomer.rewardPoints ?? 0) > 0 ? (
            <div className="mt-4">
              <Label className="text-zinc-700">Redeem reward points (1 pt = Rs 1)</Label>
              <Input
                className="mt-1.5"
                type="number"
                min={0}
                max={Math.min(selectedCustomer.rewardPoints ?? 0, grandTotal + pointsRedeemed)}
                value={pointsRedeemed || ""}
                onChange={(e) => setPointsRedeemed(Math.min(Number(e.target.value) || 0, selectedCustomer.rewardPoints ?? 0))}
              />
            </div>
          ) : null}

          <div className="mt-4">
            <Label className="text-zinc-700">Order Notes</Label>
            <textarea
              className="mt-1.5 min-h-20 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none ring-emerald-500 focus:ring-2"
              placeholder="Optional notes for this sale"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
            />
          </div>

          <div className="mt-auto grid gap-3 pt-6">
            <Button size="lg" disabled={checkoutPending || creditExceeded} onClick={() => void onCheckout()}>
              {checkoutPending ? "Processing..." : "Checkout (F9)"}
            </Button>
            <Button variant="secondary" onClick={() => { pos.holdOrder(`Hold ${formatPakistanTime(new Date())}`); toast.success("Order held."); }}>
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
        </Surface>
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
                    <div className="text-sm text-zinc-500">{order.items.length} items · {formatPakistanDateTime(order.createdAt)}</div>
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
            email={settings.email}
            gstVatNumber={settings.gstVatNumber}
            ntn={settings.ntn}
            receiptTitle={settings.receiptTitle}
            receiptHeader={settings.receiptHeader}
            receiptFooter={settings.receiptFooter}
            thankYouMessage={settings.thankYouMessage}
            cashierName={settings.showCashierOnReceipt ? session?.user?.name ?? undefined : undefined}
            customerName={settings.showCustomerOnReceipt ? receiptSnapshot.customerName : undefined}
            subtotal={receiptSnapshot.subtotal}
            discount={receiptSnapshot.discount}
            tax={receiptSnapshot.tax}
            taxLabel={settings.taxLabel}
            grandTotal={receiptSnapshot.grandTotal}
            paidAmount={receiptSnapshot.paidAmount}
            changeDue={receiptSnapshot.changeDue}
            paymentMethod={receiptSnapshot.paymentMethod}
            outstandingBalance={receiptSnapshot.outstandingBalance}
            issuedAt={receiptSnapshot.issuedAt}
            chequeNumber={receiptSnapshot.chequeNumber}
            bankName={receiptSnapshot.bankName}
            chequeDate={receiptSnapshot.chequeDate}
            showReceiptLogo={settings.showReceiptLogo}
            showReceiptBarcode={settings.showReceiptBarcode}
            showCashier={settings.showCashierOnReceipt}
            showCustomer={settings.showCustomerOnReceipt}
            showSku={settings.showSkuOnReceipt}
            showTaxNumbers={settings.showTaxNumbersOnReceipt}
            showEmail={settings.showEmailOnReceipt}
            showTax={settings.showTaxOnReceipt}
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
