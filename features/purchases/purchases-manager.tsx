"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, PackageCheck, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { currency, formatPakistanDate, formatPakistanDateInput, pakistanTodayKey, parsePakistanDateInput } from "@/lib/utils";
import { PaymentAccountSelect } from "@/components/payment/payment-method-account-select";
import { aggregatePurchaseLines, calcPurchaseLineAmounts, type PurchaseDiscountType } from "@/lib/purchase-line-math";
import { validateWalletLastFourDigits } from "@/features/pos/pos-utils";
import type { BankAccountInput, ProductInput, SupplierInput } from "@/types";

type Supplier = SupplierInput & { _id: string; supplierName: string; phone?: string };
type Product = ProductInput & { _id: string; productName: string; sku: string };
type Purchase = {
  _id: string;
  supplier?: { supplierName: string; phone?: string };
  invoiceNumber?: string;
  orderDate?: string;
  grandTotal: number;
  paidAmount: number;
  paymentMethod?: string;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string;
  status: string;
  createdAt?: string;
};
type LineItem = {
  productId: string;
  name: string;
  quantity: number;
  cost: number;
  taxRate: number;
  discountType: PurchaseDiscountType;
  discountValue: number;
  salesTaxType: "flat" | "percentage";
  salesTaxValue: number;
  grossAmount: number;
  discountAmount: number;
  salesTaxAmount: number;
  netAmount: number;
};

type ReceiveLineDraft = {
  productId: string;
  name: string;
  orderedQuantity: number;
  orderedCost: number;
  orderedDiscountType: PurchaseDiscountType;
  orderedDiscountValue: number;
  orderedSalesTaxType: "flat" | "percentage";
  orderedSalesTaxValue: number;
  receivedQuantity: number;
  receivedCost: number;
  discountType: PurchaseDiscountType;
  discountValue: number;
  salesTaxType: "flat" | "percentage";
  salesTaxValue: number;
};

type PurchaseDetailItem = {
  product: string | { _id: string };
  name: string;
  quantity: number;
  cost: number;
  orderedQuantity?: number;
  orderedCost?: number;
  orderedDiscountType?: PurchaseDiscountType;
  orderedDiscountValue?: number;
  orderedSalesTaxType?: "flat" | "percentage";
  orderedSalesTaxValue?: number;
  discountType?: PurchaseDiscountType;
  discountValue?: number;
  salesTaxType?: "flat" | "percentage";
  salesTaxValue?: number;
  taxRate?: number;
  netAmount?: number;
};

function statusVariant(status: string) {
  if (status === "received") return "success" as const;
  if (status === "ordered") return "warning" as const;
  return "default" as const;
}

function todayInput() {
  return pakistanTodayKey();
}

function scaleLineDiscountValue(
  orderedQuantity: number,
  receivedQuantity: number,
  discountType: PurchaseDiscountType,
  orderedDiscountValue: number,
) {
  if (discountType === "flat_per_piece" || discountType === "percentage") return orderedDiscountValue;
  if (discountType !== "flat" || orderedQuantity <= 0) return orderedDiscountValue;
  return Number(((orderedDiscountValue * receivedQuantity) / orderedQuantity).toFixed(2));
}

function formatPurchaseDiscount(type: PurchaseDiscountType, value: number) {
  if (type === "percentage") return `${value}%`;
  if (type === "flat_per_piece") return `${currency(value)}/pc`;
  return currency(value);
}

type PurchasePaymentMethod = "cash" | "cheque" | "credit" | "easypaisa" | "jazzcash";
type RegisteredBankAccount = BankAccountInput & { _id: string };

export function PurchasesManager({ variant = "order" }: { variant?: "order" | "spot" }) {
  const isSpot = variant === "spot";
  const queryClient = useQueryClient();
  const vendorPickerRef = useRef<HTMLDivElement>(null);
  const productPickerRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorPickerOpen, setVendorPickerOpen] = useState(false);
  const [orderDate, setOrderDate] = useState(todayInput());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>("cash");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBankAccountId, setChequeBankAccountId] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [walletAccountId, setWalletAccountId] = useState("");
  const [walletLastFour, setWalletLastFour] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [selectedProductData, setSelectedProductData] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productPickerQuery, setProductPickerQuery] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0);
  const [lineDiscountType, setLineDiscountType] = useState<PurchaseDiscountType>("flat");
  const [lineDiscountValue, setLineDiscountValue] = useState(0);
  const [lineSalesTaxType, setLineSalesTaxType] = useState<"flat" | "percentage">("percentage");
  const [lineSalesTaxValue, setLineSalesTaxValue] = useState(0);
  const [deleteLineIndex, setDeleteLineIndex] = useState<number | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivePurchaseId, setReceivePurchaseId] = useState<string | null>(null);
  const [receiveLines, setReceiveLines] = useState<ReceiveLineDraft[]>([]);
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);
  const [receiveAdvancePaid, setReceiveAdvancePaid] = useState(0);
  const [receivePayNow, setReceivePayNow] = useState(0);
  const [receivePaymentMethod, setReceivePaymentMethod] = useState<PurchasePaymentMethod>("cash");
  const [receiveChequeNumber, setReceiveChequeNumber] = useState("");
  const [receiveChequeDate, setReceiveChequeDate] = useState("");
  const [receiveChequeBankAccountId, setReceiveChequeBankAccountId] = useState("");
  const [receiveSavedBankName, setReceiveSavedBankName] = useState("");
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteSpotTarget, setDeleteSpotTarget] = useState<Purchase | null>(null);
  const [deleteSpotSubmitting, setDeleteSpotSubmitting] = useState(false);
  const [pendingEditBankName, setPendingEditBankName] = useState("");
  const [pendingEditWalletBankName, setPendingEditWalletBankName] = useState("");

  const purchases = useQuery({
    queryKey: [isSpot ? "spot-purchases" : "purchases", page],
    queryFn: async () => {
      const endpoint = isSpot ? `/api/spot-purchases?page=${page}&limit=20` : `/api/purchases?page=${page}&limit=20&kind=order`;
      const response = await fetch(endpoint);
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

  const vendorOptions = useQuery({
    queryKey: ["purchase-vendor-picker", vendorSearch],
    enabled: createOpen,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", status: "active" });
      if (vendorSearch.trim()) params.set("q", vendorSearch.trim());
      const response = await fetch(`/api/suppliers?${params.toString()}`);
      if (!response.ok) throw new Error("Unable to load vendors");
      return response.json() as Promise<{ items: Supplier[] }>;
    },
  });

  const productOptions = useQuery({
    queryKey: ["purchase-product-picker", productPickerQuery],
    enabled: createOpen,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", status: "active" });
      if (productPickerQuery.trim()) params.set("q", productPickerQuery.trim());
      const response = await fetch(`/api/products?${params.toString()}`);
      if (!response.ok) throw new Error("Unable to load products");
      return response.json() as Promise<{ items: Product[] }>;
    },
  });

  const bankAccounts = useQuery({
    queryKey: ["bank-accounts", "purchase-create"],
    enabled: createOpen || receiveOpen,
    queryFn: async () => {
      const response = await fetch("/api/bank-accounts?status=active&limit=100&accountType=bank");
      if (!response.ok) throw new Error("Unable to load bank accounts");
      return response.json() as Promise<{ items: RegisteredBankAccount[] }>;
    },
  });

  const paymentAccounts = useQuery({
    queryKey: ["bank-accounts", "spot-wallet"],
    enabled: createOpen && isSpot,
    queryFn: async () => {
      const response = await fetch("/api/bank-accounts?status=active&limit=100");
      if (!response.ok) throw new Error("Unable to load payment accounts");
      return response.json() as Promise<{ items: RegisteredBankAccount[] }>;
    },
  });

  const activeBankAccounts = bankAccounts.data?.items ?? [];
  const activePaymentAccounts = paymentAccounts.data?.items ?? [];
  const isWalletPayment = paymentMethod === "easypaisa" || paymentMethod === "jazzcash";
  const walletAccounts = activePaymentAccounts.filter((account) => account.accountType === paymentMethod);
  const selectedWalletAccount = walletAccounts.find((account) => account._id === walletAccountId);
  const walletBankName = selectedWalletAccount?.name ?? "";
  const selectedChequeBank = activeBankAccounts.find((account) => account._id === chequeBankAccountId);
  const chequeBankName = selectedChequeBank?.name ?? "";
  const selectedReceiveChequeBank = activeBankAccounts.find((account) => account._id === receiveChequeBankAccountId);
  const receiveChequeBankName = selectedReceiveChequeBank?.name ?? "";

  const pickerVendors = vendorOptions.data?.items ?? [];
  const pickerProducts = productOptions.data?.items ?? [];
  const selectedVendorRecord = pickerVendors.find((v) => v._id === supplierId);

  const { subtotal, discountAmount, salesTaxAmount, grandTotal } = useMemo(
    () => aggregatePurchaseLines(lines),
    [lines],
  );

  const draftAmounts = useMemo(
    () =>
      calcPurchaseLineAmounts({
        quantity: qty,
        cost,
        discountType: lineDiscountType,
        discountValue: lineDiscountValue,
        salesTaxType: lineSalesTaxType,
        salesTaxValue: lineSalesTaxValue,
      }),
    [qty, cost, lineDiscountType, lineDiscountValue, lineSalesTaxType, lineSalesTaxValue],
  );

  const receiveTotals = useMemo(() => {
    const normalized = receiveLines.map((line) =>
      calcPurchaseLineAmounts({
        quantity: line.receivedQuantity,
        cost: line.receivedCost,
        discountType: line.discountType,
        discountValue: line.discountValue,
        salesTaxType: line.salesTaxType,
        salesTaxValue: line.salesTaxValue,
      }),
    );
    return aggregatePurchaseLines(normalized);
  }, [receiveLines]);

  const orderedReceiveTotals = useMemo(() => {
    const normalized = receiveLines.map((line) =>
      calcPurchaseLineAmounts({
        quantity: line.orderedQuantity,
        cost: line.orderedCost,
        discountType: line.orderedDiscountType,
        discountValue: line.orderedDiscountValue,
        salesTaxType: line.orderedSalesTaxType,
        salesTaxValue: line.orderedSalesTaxValue,
      }),
    );
    return aggregatePurchaseLines(normalized);
  }, [receiveLines]);

  const receiveAmountDue = Math.max(receiveTotals.grandTotal - receiveAdvancePaid, 0);

  useEffect(() => {
    setReceivePayNow(receiveAmountDue);
  }, [receiveAmountDue]);

  useEffect(() => {
    if (!createOpen || paymentMethod !== "cheque" || activeBankAccounts.length === 0) return;
    if (pendingEditBankName) return;
    if (!chequeBankAccountId || !activeBankAccounts.some((account) => account._id === chequeBankAccountId)) {
      if (!editingId) setChequeBankAccountId(activeBankAccounts[0]._id);
    }
  }, [activeBankAccounts, chequeBankAccountId, createOpen, paymentMethod, pendingEditBankName, editingId]);

  useEffect(() => {
    if (!pendingEditBankName || activeBankAccounts.length === 0) return;
    const bank = activeBankAccounts.find((account) => account.name === pendingEditBankName);
    if (bank) {
      setChequeBankAccountId(bank._id);
      setPendingEditBankName("");
    }
  }, [activeBankAccounts, pendingEditBankName]);

  useEffect(() => {
    if (!pendingEditWalletBankName || walletAccounts.length === 0) return;
    const account = walletAccounts.find((item) => item.name === pendingEditWalletBankName);
    if (account) {
      setWalletAccountId(account._id);
      setPendingEditWalletBankName("");
    }
  }, [pendingEditWalletBankName, walletAccounts]);

  useEffect(() => {
    if (!createOpen || !isWalletPayment || walletAccounts.length === 0) return;
    if (pendingEditWalletBankName) return;
    if (!walletAccountId || !walletAccounts.some((account) => account._id === walletAccountId)) {
      if (!editingId) setWalletAccountId(walletAccounts[0]._id);
    }
  }, [createOpen, editingId, isWalletPayment, pendingEditWalletBankName, walletAccountId, walletAccounts]);

  useEffect(() => {
    if (!createOpen || !isWalletPayment || grandTotal <= 0) return;
    setPaidAmount((current) => (current <= 0 ? grandTotal : current));
  }, [createOpen, grandTotal, isWalletPayment]);

  useEffect(() => {
    if (!createOpen || paymentMethod !== "cheque" || grandTotal <= 0) return;
    setPaidAmount((current) => (current <= 0 ? grandTotal : current));
  }, [createOpen, grandTotal, paymentMethod]);

  useEffect(() => {
    if (!receiveOpen || receivePaymentMethod !== "cheque" || activeBankAccounts.length === 0) return;
    if (receiveChequeBankAccountId && activeBankAccounts.some((account) => account._id === receiveChequeBankAccountId)) {
      return;
    }
    const matchedAccount = receiveSavedBankName
      ? activeBankAccounts.find((account) => account.name === receiveSavedBankName)
      : undefined;
    setReceiveChequeBankAccountId(matchedAccount?._id ?? activeBankAccounts[0]._id);
  }, [activeBankAccounts, receiveChequeBankAccountId, receiveOpen, receivePaymentMethod, receiveSavedBankName]);

  useEffect(() => {
    if (!createOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!vendorPickerRef.current?.contains(event.target as Node)) {
        setVendorPickerOpen(false);
      }
      if (!productPickerRef.current?.contains(event.target as Node)) {
        setProductPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [createOpen]);

  const resetCreateForm = () => {
    setSupplierId("");
    setVendorSearch("");
    setVendorPickerOpen(false);
    setOrderDate(todayInput());
    setInvoiceNumber("");
    setPaymentMethod("cash");
    setChequeNumber("");
    setChequeBankAccountId("");
    setChequeDate("");
    setWalletAccountId("");
    setWalletLastFour("");
    setPaidAmount(0);
    setLines([]);
    setSelectedProductData(null);
    setProductSearch("");
    setProductPickerQuery("");
    setProductPickerOpen(false);
    setQty(1);
    setCost(0);
    setLineDiscountType("flat");
    setLineDiscountValue(0);
    setLineSalesTaxType("percentage");
    setLineSalesTaxValue(0);
    setEditingId(null);
    setPendingEditBankName("");
    setPendingEditWalletBankName("");
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const selectVendor = (vendor: Supplier) => {
    setSupplierId(vendor._id);
    setVendorSearch(vendor.phone ? `${vendor.supplierName} (${vendor.phone})` : vendor.supplierName);
    setVendorPickerOpen(false);
  };

  const selectProduct = (product: Product) => {
    setSelectedProductData(product);
    setProductSearch(`${product.productName} (${product.sku})`);
    setCost(product.purchasePrice ?? 0);
    setLineSalesTaxType("percentage");
    setLineSalesTaxValue(product.taxRate ?? 0);
    setProductPickerOpen(false);
  };

  const clearLineDraft = () => {
    setSelectedProductData(null);
    setProductSearch("");
    setProductPickerQuery("");
    setQty(1);
    setCost(0);
    setLineDiscountType("flat");
    setLineDiscountValue(0);
    setLineSalesTaxType("percentage");
    setLineSalesTaxValue(0);
  };

  const addLine = () => {
    if (!selectedProductData || qty <= 0 || cost < 0) {
      toast.error("Select a product with valid quantity and cost.");
      return;
    }
    const amounts = calcPurchaseLineAmounts({
      quantity: qty,
      cost,
      discountType: lineDiscountType,
      discountValue: lineDiscountValue,
      salesTaxType: lineSalesTaxType,
      salesTaxValue: lineSalesTaxValue,
    });
    setLines((prev) => [
      ...prev,
      {
        productId: selectedProductData._id,
        name: selectedProductData.productName,
        quantity: qty,
        cost,
        taxRate: lineSalesTaxType === "percentage" ? lineSalesTaxValue : 0,
        discountType: lineDiscountType,
        discountValue: lineDiscountValue,
        salesTaxType: lineSalesTaxType,
        salesTaxValue: lineSalesTaxValue,
        ...amounts,
      },
    ]);
    clearLineDraft();
  };

  const buildPurchasePayload = () => ({
    supplier: supplierId,
    orderDate: orderDate ? new Date(orderDate).toISOString() : undefined,
    invoiceNumber: invoiceNumber.trim(),
    products: lines.map((l) => ({
      product: l.productId,
      name: l.name,
      quantity: l.quantity,
      cost: l.cost,
      taxRate: l.taxRate,
      discountType: l.discountType,
      discountValue: l.discountValue,
      salesTaxType: l.salesTaxType,
      salesTaxValue: l.salesTaxValue,
      grossAmount: l.grossAmount,
      netAmount: l.netAmount,
      lineTotal: l.netAmount,
    })),
    subtotal,
    taxes: salesTaxAmount,
    grandTotal,
    paidAmount,
    paymentMethod,
    chequeNumber:
      paymentMethod === "cheque"
        ? chequeNumber.trim()
        : isWalletPayment
          ? walletLastFour.trim()
          : "",
    bankName: paymentMethod === "cheque" ? chequeBankName.trim() : isWalletPayment ? walletBankName.trim() : "",
    chequeDate: paymentMethod === "cheque" && chequeDate ? parsePakistanDateInput(chequeDate).toISOString() : null,
    status: isSpot ? "received" : "ordered",
    purchaseKind: isSpot ? "spot" : "order",
  });

  const openEditSpotPurchase = async (id: string) => {
    try {
      const response = await fetch(`/api/purchases/${id}/detail`);
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Unable to load spot purchase.");
        return;
      }

      const purchase = data.purchase ?? {};
      const items = (data.items ?? []) as PurchaseDetailItem[];
      const supplier = purchase.supplier ?? {};
      const supplierIdValue = typeof supplier === "string" ? supplier : String(supplier._id ?? purchase.supplier ?? "");
      const supplierName =
        typeof supplier === "object" && supplier && "supplierName" in supplier ? String(supplier.supplierName) : "";
      const supplierPhone =
        typeof supplier === "object" && supplier && "phone" in supplier ? String(supplier.phone ?? "") : "";

      resetCreateForm();
      setEditingId(id);
      setSupplierId(supplierIdValue);
      setVendorSearch(supplierPhone ? `${supplierName} (${supplierPhone})` : supplierName);
      setOrderDate(
        purchase.orderDate
          ? formatPakistanDateInput(purchase.orderDate)
          : purchase.createdAt
            ? formatPakistanDateInput(purchase.createdAt)
            : todayInput(),
      );
      setInvoiceNumber(purchase.invoiceNumber ?? "");
      setPaymentMethod(
        purchase.paymentMethod === "cheque"
          ? "cheque"
          : purchase.paymentMethod === "credit"
            ? "credit"
            : purchase.paymentMethod === "easypaisa"
              ? "easypaisa"
              : purchase.paymentMethod === "jazzcash"
                ? "jazzcash"
                : "cash",
      );
      setChequeNumber(purchase.paymentMethod === "cheque" ? (purchase.chequeNumber ?? "") : "");
      setWalletLastFour(
        purchase.paymentMethod === "easypaisa" || purchase.paymentMethod === "jazzcash" ? (purchase.chequeNumber ?? "") : "",
      );
      setChequeDate(purchase.chequeDate ? formatPakistanDateInput(purchase.chequeDate) : "");
      setPaidAmount(purchase.paidAmount ?? 0);
      setLines(
        items.map((item) => {
          const discountType = item.discountType ?? item.orderedDiscountType ?? "flat";
          const discountValue = item.discountValue ?? item.orderedDiscountValue ?? 0;
          const salesTaxType = item.salesTaxType ?? item.orderedSalesTaxType ?? "percentage";
          const salesTaxValue = item.salesTaxValue ?? item.orderedSalesTaxValue ?? item.taxRate ?? 0;
          const amounts = calcPurchaseLineAmounts({
            quantity: item.quantity,
            cost: item.cost,
            discountType,
            discountValue,
            salesTaxType,
            salesTaxValue,
          });
          return {
            productId: productIdFromDetail(item.product),
            name: item.name,
            quantity: item.quantity,
            cost: item.cost,
            taxRate: salesTaxType === "percentage" ? salesTaxValue : 0,
            discountType,
            discountValue,
            salesTaxType,
            salesTaxValue,
            ...amounts,
          };
        }),
      );
      setCreateOpen(true);

      if (purchase.paymentMethod === "cheque" && purchase.bankName) {
        setPendingEditBankName(purchase.bankName);
      }
      if ((purchase.paymentMethod === "easypaisa" || purchase.paymentMethod === "jazzcash") && purchase.bankName) {
        setPendingEditWalletBankName(purchase.bankName);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load spot purchase.");
    }
  };

  const createPurchase = async () => {
    if (!supplierId || lines.length === 0) {
      toast.error("Select a vendor and add at least one product.");
      return;
    }
    const requiresChequeDetails = paymentMethod === "cheque" && paidAmount > 0;
    if (requiresChequeDetails && !chequeBankName.trim()) {
      toast.error("Select a registered bank account for cheque payment.");
      return;
    }
    if (requiresChequeDetails && !chequeNumber.trim()) {
      toast.error("Enter cheque number for cheque payment.");
      return;
    }
    if (requiresChequeDetails && !chequeDate) {
      toast.error("Select cheque date for cheque payment.");
      return;
    }
    const requiresWalletDetails = isSpot && isWalletPayment;
    if (requiresWalletDetails && !walletBankName.trim()) {
      toast.error(`Select a registered ${paymentMethod === "easypaisa" ? "EasyPaisa" : "JazzCash"} account.`);
      return;
    }
    if (requiresWalletDetails) {
      const walletError = validateWalletLastFourDigits(walletLastFour);
      if (walletError) {
        toast.error(walletError);
        return;
      }
    }

    const response = await fetch(
      isSpot && editingId ? `/api/spot-purchases/${editingId}` : isSpot ? "/api/spot-purchases" : "/api/purchases",
      {
        method: isSpot && editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPurchasePayload()),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      const fieldError = data.fieldErrors
        ? Object.values(data.fieldErrors as Record<string, string[]>)
            .flat()
            .find(Boolean)
        : undefined;
      toast.error(fieldError ?? data.error ?? (editingId ? "Unable to update spot purchase." : "Unable to create purchase order."));
      return;
    }
    toast.success(
      isSpot
        ? editingId
          ? "Spot purchase updated."
          : "Spot purchase recorded. Stock updated."
        : "Purchase order created.",
    );
    setCreateOpen(false);
    resetCreateForm();
    queryClient.invalidateQueries({ queryKey: [isSpot ? "spot-purchases" : "purchases"] });
    if (isSpot) {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    }
  };

  const receiveGoods = async () => {
    if (!receivePurchaseId || receiveLines.length === 0) return;
    if (receiveLines.every((line) => line.receivedQuantity <= 0)) {
      toast.error("Enter a received quantity greater than zero for at least one product.");
      return;
    }
    for (const line of receiveLines) {
      if (line.receivedQuantity < 0 || line.receivedQuantity > line.orderedQuantity) {
        toast.error(`Received quantity for ${line.name} must be between 0 and ${line.orderedQuantity}.`);
        return;
      }
      if (line.receivedCost < 0) {
        toast.error(`Received cost for ${line.name} cannot be negative.`);
        return;
      }
    }

    if (receivePaymentMethod === "cheque" && receivePayNow > 0) {
      if (!receiveChequeBankName.trim()) {
        toast.error("Select a registered bank account for cheque payment.");
        return;
      }
      if (!receiveChequeNumber.trim()) {
        toast.error("Enter cheque number for cheque payment.");
        return;
      }
      if (!receiveChequeDate) {
        toast.error("Select cheque date for cheque payment.");
        return;
      }
    }

    const totalPaid = receiveAdvancePaid + receivePayNow;
    const receiveChequeBank =
      receivePaymentMethod === "cheque" ? receiveChequeBankName.trim() || receiveSavedBankName.trim() : "";

    setReceiveSubmitting(true);
    try {
      const response = await fetch(`/api/purchases/${receivePurchaseId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: receiveLines.map((line) => ({
            productId: line.productId,
            receivedQuantity: line.receivedQuantity,
            receivedCost: line.receivedCost,
            discountType: line.discountType,
            discountValue: line.discountValue,
            salesTaxType: line.salesTaxType,
            salesTaxValue: line.salesTaxValue,
          })),
          paidAmount: totalPaid,
          advancePaid: receiveAdvancePaid,
          paymentMethod: receivePaymentMethod,
          chequeNumber: receivePaymentMethod === "cheque" ? receiveChequeNumber.trim() : "",
          bankName: receiveChequeBank,
          chequeDate:
            receivePaymentMethod === "cheque" && receiveChequeDate
              ? parsePakistanDateInput(receiveChequeDate).toISOString()
              : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Unable to receive goods.");
        return;
      }
      toast.success("Goods received with adjustments applied.");
      setReceiveOpen(false);
      setReceivePurchaseId(null);
      setReceiveLines([]);
      setReceiveAdvancePaid(0);
      setReceivePayNow(0);
      setReceivePaymentMethod("cash");
      setReceiveChequeNumber("");
      setReceiveChequeDate("");
      setReceiveChequeBankAccountId("");
      setReceiveSavedBankName("");
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-detail"] });
    } finally {
      setReceiveSubmitting(false);
    }
  };

  const productIdFromDetail = (product: PurchaseDetailItem["product"]) =>
    typeof product === "string" ? product : String(product._id);

  const openReceiveDialog = async (id: string) => {
    const response = await fetch(`/api/purchases/${id}/detail`);
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error ?? "Unable to load purchase for receiving.");
      return;
    }

    const purchase = data.purchase ?? {};
    setReceiveAdvancePaid(purchase.paidAmount ?? 0);
    setReceivePaymentMethod(
      purchase.paymentMethod === "cheque" ? "cheque" : purchase.paymentMethod === "credit" ? "credit" : "cash",
    );
    setReceiveChequeNumber(purchase.chequeNumber ?? "");
    setReceiveChequeDate(purchase.chequeDate ? String(purchase.chequeDate).slice(0, 10) : "");
    setReceiveSavedBankName(purchase.bankName ?? "");
    setReceiveChequeBankAccountId("");

    const items = (data.items ?? []) as PurchaseDetailItem[];
    setReceiveLines(
      items.map((item) => {
        const orderedQuantity = item.orderedQuantity ?? item.quantity ?? 0;
        const orderedCost = item.orderedCost ?? item.cost ?? 0;
        const orderedDiscountType = item.orderedDiscountType ?? item.discountType ?? "flat";
        const orderedDiscountValue = item.orderedDiscountValue ?? item.discountValue ?? 0;
        const orderedSalesTaxType = item.orderedSalesTaxType ?? item.salesTaxType ?? "percentage";
        const orderedSalesTaxValue = item.orderedSalesTaxValue ?? item.salesTaxValue ?? item.taxRate ?? 0;
        const receivedQuantity = orderedQuantity;
        return {
          productId: productIdFromDetail(item.product),
          name: item.name,
          orderedQuantity,
          orderedCost,
          orderedDiscountType,
          orderedDiscountValue,
          orderedSalesTaxType,
          orderedSalesTaxValue,
          receivedQuantity,
          receivedCost: orderedCost,
          discountType: orderedDiscountType,
          discountValue: scaleLineDiscountValue(orderedQuantity, receivedQuantity, orderedDiscountType, orderedDiscountValue),
          salesTaxType: orderedSalesTaxType,
          salesTaxValue: orderedSalesTaxValue,
        };
      }),
    );
    setReceivePurchaseId(id);
    setReceiveOpen(true);
  };

  const updateReceiveLine = (
    productId: string,
    patch: Partial<
      Pick<
        ReceiveLineDraft,
        | "receivedQuantity"
        | "receivedCost"
        | "discountType"
        | "discountValue"
        | "salesTaxType"
        | "salesTaxValue"
      >
    >,
  ) => {
    setReceiveLines((prev) =>
      prev.map((line) => {
        if (line.productId !== productId) return line;
        const next = { ...line, ...patch };
        if (patch.receivedQuantity !== undefined && patch.discountValue === undefined) {
          next.discountValue = scaleLineDiscountValue(
            line.orderedQuantity,
            next.receivedQuantity,
            next.discountType,
            line.orderedDiscountValue,
          );
        }
        if (patch.discountType === "percentage" && patch.discountValue === undefined) {
          next.discountValue = line.orderedDiscountValue;
        }
        if (patch.discountType === "flat_per_piece" && patch.discountValue === undefined) {
          next.discountValue = line.orderedDiscountValue;
        }
        if (patch.discountType === "flat" && patch.discountValue === undefined) {
          next.discountValue = scaleLineDiscountValue(
            line.orderedQuantity,
            next.receivedQuantity,
            "flat",
            line.orderedDiscountValue,
          );
        }
        return next;
      }),
    );
  };

  const returnableItems = (items: PurchaseDetailItem[]) =>
    items
      .filter((item) => (item.quantity ?? 0) > 0)
      .map((item) => ({
        productId: productIdFromDetail(item.product),
        quantity: item.quantity,
      }));

  const deleteSpotPurchase = async () => {
    if (!deleteSpotTarget) return;
    setDeleteSpotSubmitting(true);
    try {
      const response = await fetch(`/api/spot-purchases/${deleteSpotTarget._id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Unable to delete spot purchase.");
        return;
      }
      toast.success("Spot purchase deleted.");
      setDeleteSpotTarget(null);
      queryClient.invalidateQueries({ queryKey: ["spot-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete spot purchase.");
    } finally {
      setDeleteSpotSubmitting(false);
    }
  };

  const returnAllGoods = async () => {
    if (!selectedId || !detail.data) return;
    const items = returnableItems(detail.data.items as PurchaseDetailItem[]);
    if (items.length === 0) {
      toast.error("No received stock left to return on this purchase.");
      return;
    }

    setReturnSubmitting(true);
    try {
      const response = await fetch(`/api/purchases/${selectedId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Return failed.");
        return;
      }
      toast.success(`Purchase return recorded: ${currency(data.returnTotal)}`);
      setReturnConfirmOpen(false);
      setDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["spot-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-detail", selectedId] });
    } finally {
      setReturnSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">{isSpot ? "Spot Purchases" : "Purchases"}</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {isSpot
              ? "Buy stock directly from vendors and add to inventory immediately."
              : "Create purchase orders and receive goods into inventory."}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {isSpot ? "New Spot Purchase" : "New Purchase Order"}
        </Button>
      </div>

      <Surface>
        <div className="responsive-table-shell responsive-table-shell--lg">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchases.isLoading ? (
                <TableLoader colSpan={8} label={isSpot ? "Loading spot purchases..." : "Loading purchases..."} />
              ) : (purchases.data?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    {isSpot ? "No spot purchases yet." : "No purchase orders yet."}
                  </td>
                </tr>
              ) : (
                purchases.data!.items.map((po) => (
                  <tr key={po._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                    <td className="px-4 py-3 font-medium">{po.supplier?.supplierName ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{po.invoiceNumber || "—"}</td>
                    <td className="px-4 py-3">{currency(po.grandTotal)}</td>
                    <td className="px-4 py-3">{currency(po.paidAmount ?? 0)}</td>
                    <td className="px-4 py-3 capitalize">{po.paymentMethod ?? "cash"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={isSpot ? "success" : statusVariant(po.status)}>{isSpot ? "spot" : po.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {po.orderDate
                        ? formatPakistanDate(po.orderDate, "")
                        : po.createdAt
                          ? formatPakistanDate(po.createdAt, "")
                          : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedId(po._id);
                            setDetailOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!isSpot && po.status === "ordered" ? (
                          <Button size="sm" variant="secondary" onClick={() => void openReceiveDialog(po._id)}>
                            <PackageCheck className="h-4 w-4" />
                            Receive
                          </Button>
                        ) : null}
                        {isSpot ? (
                          <>
                            <Button size="sm" variant="ghost" title="Edit" onClick={() => void openEditSpotPurchase(po._id)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="danger" title="Delete" onClick={() => setDeleteSpotTarget(po)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
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

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent
          title={editingId ? "Edit Spot Purchase" : isSpot ? "New Spot Purchase" : "New Purchase Order"}
          description={
            isSpot
              ? "Record an immediate vendor purchase. Stock is added to inventory as soon as you save."
              : "Add vendor invoice details, products, tax, discount, and payment."
          }
          className="max-w-[min(96vw,1400px)]"
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-zinc-700">Vendor</Label>
                <div ref={vendorPickerRef} className="relative mt-1.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                    <Input
                      className="pl-9"
                      placeholder="Type vendor name or phone to search..."
                      value={vendorSearch}
                      onChange={(e) => {
                        setVendorSearch(e.target.value);
                        setSupplierId("");
                        setVendorPickerOpen(true);
                      }}
                      onFocus={() => setVendorPickerOpen(true)}
                    />
                  </div>
                  {vendorPickerOpen ? (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white text-zinc-950 shadow-lg">
                      {vendorOptions.isLoading ? (
                        <p className="px-3 py-2 text-sm text-zinc-500">Searching vendors...</p>
                      ) : pickerVendors.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-zinc-500">No vendors match your search.</p>
                      ) : (
                        pickerVendors.map((vendor) => (
                          <button
                            key={vendor._id}
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-emerald-50"
                            onClick={() => selectVendor(vendor)}
                          >
                            <span className="font-medium">{vendor.supplierName}</span>
                            {vendor.phone ? <span className="text-xs text-zinc-500">{vendor.phone}</span> : null}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
                {selectedVendorRecord ? (
                  <p className="mt-2 text-xs text-emerald-700">Selected: {selectedVendorRecord.supplierName}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="po-date">Date</Label>
                <Input id="po-date" type="date" className="mt-1.5" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="po-invoice">Invoice Number</Label>
                <Input
                  id="po-invoice"
                  className="mt-1.5"
                  placeholder="Vendor invoice / bill number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 p-4">
              <Label className="text-zinc-700">Product</Label>
              <div ref={productPickerRef} className="relative mt-1.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <Input
                    className="pl-9"
                    placeholder="Type product name or SKU to search..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setProductPickerQuery(e.target.value);
                      setSelectedProductData(null);
                      setProductPickerOpen(true);
                    }}
                    onFocus={() => setProductPickerOpen(true)}
                  />
                </div>
                {productPickerOpen ? (
                  <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white text-zinc-950 shadow-lg">
                    {productOptions.isLoading ? (
                      <p className="px-3 py-2 text-sm text-zinc-500">Searching products...</p>
                    ) : pickerProducts.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-zinc-500">No products match your search.</p>
                    ) : (
                      pickerProducts.map((p) => (
                        <button
                          key={p._id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-emerald-50"
                          onClick={() => selectProduct(p)}
                        >
                          <span className="font-medium">{p.productName}</span>
                          <span className="text-xs text-zinc-500">{p.sku}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              {selectedProductData ? (
                <p className="mt-2 text-xs text-emerald-700">Selected: {selectedProductData.productName}</p>
              ) : null}

              <div className="mt-3 overflow-x-auto">
                <div className="grid min-w-[1000px] grid-cols-[72px_88px_108px_88px_108px_88px_96px_96px_108px] items-end gap-2">
                  <div>
                    <Label className="text-xs text-zinc-600">Qty</Label>
                    <Input className="mt-1 h-9 text-sm" type="number" min={1} value={qty || ""} onChange={(e) => setQty(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-600">Cost</Label>
                    <Input className="mt-1 h-9 text-sm" type="number" min={0} step="0.01" value={cost || ""} onChange={(e) => setCost(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-600">Discount Type</Label>
                    <Select className="mt-1 h-9 text-sm" value={lineDiscountType} onChange={(e) => setLineDiscountType(e.target.value as PurchaseDiscountType)}>
                      <option value="flat">Flat (Rs) line</option>
                      <option value="flat_per_piece">Flat (Rs) per piece</option>
                      <option value="percentage">Percentage (%)</option>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-600">
                      {lineDiscountType === "flat_per_piece" ? "Discount / piece" : "Discount Value"}
                    </Label>
                    <Input className="mt-1 h-9 text-sm" type="number" min={0} value={lineDiscountValue || ""} onChange={(e) => setLineDiscountValue(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-600">Sales Tax Type</Label>
                    <Select className="mt-1 h-9 text-sm" value={lineSalesTaxType} onChange={(e) => setLineSalesTaxType(e.target.value as "flat" | "percentage")}>
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat (Rs)</option>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-600">Sales Tax Value</Label>
                    <Input className="mt-1 h-9 text-sm" type="number" min={0} value={lineSalesTaxValue || ""} onChange={(e) => setLineSalesTaxValue(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-600">Gross Amount</Label>
                    <Input className="mt-1 h-9 bg-zinc-50 text-sm" readOnly value={currency(draftAmounts.grossAmount)} />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-600">Net Amount</Label>
                    <Input className="mt-1 h-9 bg-zinc-50 text-sm font-medium" readOnly value={currency(draftAmounts.netAmount)} />
                  </div>
                  <div>
                    <Button type="button" className="h-9 w-full text-sm" variant="secondary" onClick={addLine}>
                      Add Line
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {lines.length > 0 ? (
              <div className="responsive-table-shell">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-100 bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Cost</th>
                      <th className="px-3 py-2">Discount</th>
                      <th className="px-3 py-2">Sales Tax</th>
                      <th className="px-3 py-2">Gross</th>
                      <th className="px-3 py-2">Net</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={`${line.productId}-${index}`} className="border-t border-zinc-100">
                        <td className="px-3 py-2 font-medium">{line.name}</td>
                        <td className="px-3 py-2">{line.quantity}</td>
                        <td className="px-3 py-2">{currency(line.cost)}</td>
                        <td className="px-3 py-2">
                          {formatPurchaseDiscount(line.discountType, line.discountValue)}
                          <span className="block text-xs text-zinc-500">-{currency(line.discountAmount)}</span>
                        </td>
                        <td className="px-3 py-2">
                          {line.salesTaxType === "percentage" ? `${line.salesTaxValue}%` : currency(line.salesTaxValue)}
                          <span className="block text-xs text-zinc-500">{currency(line.salesTaxAmount)}</span>
                        </td>
                        <td className="px-3 py-2">{currency(line.grossAmount)}</td>
                        <td className="px-3 py-2 font-medium">{currency(line.netAmount)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="danger" onClick={() => setDeleteLineIndex(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Payment Method</Label>
                <Select
                  className="mt-1.5"
                  value={paymentMethod}
                  onChange={(e) => {
                    const method = e.target.value as PurchasePaymentMethod;
                    setPaymentMethod(method);
                    if (method === "credit") setPaidAmount(0);
                    if (method !== "cheque") {
                      setChequeNumber("");
                      setChequeBankAccountId("");
                      setChequeDate("");
                    }
                    if (method !== "easypaisa" && method !== "jazzcash") {
                      setWalletAccountId("");
                      setWalletLastFour("");
                    } else {
                      if (paidAmount <= 0 && grandTotal > 0) setPaidAmount(grandTotal);
                      const accounts = activePaymentAccounts.filter((account) => account.accountType === method);
                      if (accounts.length > 0 && !walletAccountId) {
                        setWalletAccountId(accounts[0]._id);
                      }
                    }
                    if (method === "cheque") {
                      if (paidAmount <= 0 && grandTotal > 0) setPaidAmount(grandTotal);
                      if (activeBankAccounts.length > 0 && !chequeBankAccountId) {
                        setChequeBankAccountId(activeBankAccounts[0]._id);
                      }
                    }
                  }}
                >
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="credit">Credit</option>
                  {isSpot ? (
                    <>
                      <option value="easypaisa">EasyPaisa</option>
                      <option value="jazzcash">JazzCash</option>
                    </>
                  ) : null}
                </Select>
              </div>
              <div>
                <Label>{paymentMethod === "cheque" ? "Paid Amount" : isSpot ? "Paid Amount" : "Advance paid (optional)"}</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min={0}
                  max={grandTotal}
                  value={paidAmount || ""}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  disabled={paymentMethod === "credit"}
                />
                {paymentMethod === "credit" ? (
                  <p className="mt-1 text-xs text-zinc-500">Full amount will be posted to the vendor credit account.</p>
                ) : !isSpot ? (
                  <p className="mt-1 text-xs text-zinc-500">Remaining balance can be paid when goods are received.</p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-500">Unpaid balance is added to the vendor account.</p>
                )}
              </div>
              {paymentMethod === "cheque" ? (
                <>
                  <div>
                    <Label htmlFor="purchase-cheque-bank">Bank</Label>
                    <PaymentAccountSelect
                      id="purchase-cheque-bank"
                      className="mt-1.5"
                      value={chequeBankAccountId}
                      onChange={setChequeBankAccountId}
                      accounts={activeBankAccounts}
                      allowEmpty
                      emptyLabel="Select bank account"
                      emptyAccountsHint={
                        bankAccounts.isError
                          ? "Unable to load bank accounts. Check your access or add accounts under Finance → Bank."
                          : "No bank accounts registered. Add accounts under Finance → Bank."
                      }
                    />
                    {paymentMethod === "cheque" ? (
                      <p className="mt-1 text-xs text-zinc-500">Select the bank account this cheque is drawn on.</p>
                    ) : !isSpot && paidAmount <= 0 ? (
                      <p className="mt-1 text-xs text-zinc-500">Enter an advance amount to pay now, or pay the balance when goods are received.</p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="cheque-number">Cheque Number</Label>
                    <Input id="cheque-number" className="mt-1.5" placeholder="Cheque #" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="cheque-date">Cheque Date</Label>
                    <Input id="cheque-date" type="date" className="mt-1.5" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
                  </div>
                </>
              ) : null}
              {isSpot && isWalletPayment ? (
                <>
                  <div>
                    <Label htmlFor="spot-wallet-account">
                      {paymentMethod === "easypaisa" ? "EasyPaisa" : "JazzCash"} account
                    </Label>
                    <PaymentAccountSelect
                      id="spot-wallet-account"
                      className="mt-1.5"
                      value={walletAccountId}
                      onChange={setWalletAccountId}
                      accounts={walletAccounts}
                      allowEmpty
                      emptyLabel={`Select ${paymentMethod === "easypaisa" ? "EasyPaisa" : "JazzCash"} account`}
                      emptyAccountsHint={
                        paymentAccounts.isError
                          ? "Unable to load payment accounts. Add accounts under Finance → Bank."
                          : `No ${paymentMethod === "easypaisa" ? "EasyPaisa" : "JazzCash"} accounts registered. Add one under Finance → Bank.`
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="spot-wallet-last-four">
                      Last 4 digits <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="spot-wallet-last-four"
                      className="mt-1.5 font-mono tracking-widest"
                      placeholder="e.g. 4829"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={4}
                      value={walletLastFour}
                      onChange={(e) => setWalletLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    />
                    <p className="mt-1 text-xs text-zinc-500">Enter the last 4 digits of the wallet transaction ID.</p>
                  </div>
                </>
              ) : null}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{currency(subtotal)}</span>
              </div>
              {discountAmount > 0 ? (
                <div className="mt-1 flex justify-between text-emerald-700">
                  <span>Discount</span>
                  <span>-{currency(discountAmount)}</span>
                </div>
              ) : null}
              {salesTaxAmount > 0 ? (
                <div className="mt-1 flex justify-between">
                  <span>Sales tax</span>
                  <span>{currency(salesTaxAmount)}</span>
                </div>
              ) : null}
              <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
                <span>Grand Total</span>
                <span>{currency(grandTotal)}</span>
              </div>
              {grandTotal - paidAmount > 0 ? (
                <p className="mt-2 text-xs text-zinc-500">{currency(grandTotal - paidAmount)} due on vendor account.</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void createPurchase()}>
                {isSpot ? (editingId ? "Update Spot Purchase" : "Save Spot Purchase") : "Create PO"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {!isSpot ? (
      <Dialog
        open={receiveOpen}
        onOpenChange={(open) => {
          setReceiveOpen(open);
          if (!open) {
            setReceivePurchaseId(null);
            setReceiveLines([]);
            setReceiveAdvancePaid(0);
            setReceivePayNow(0);
            setReceivePaymentMethod("cash");
            setReceiveChequeNumber("");
            setReceiveChequeDate("");
          }
        }}
      >
        <DialogContent
          title="Receive Purchase Order"
          description="Adjust received quantity or cost if the vendor delivered less stock or prices changed."
          className="max-w-[min(96vw,1400px)]"
        >
          {receiveLines.length === 0 ? (
            <BlockLoader label="Loading purchase lines..." />
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-[1200px] w-full text-left text-sm">
                  <thead className="border-b border-zinc-100 bg-zinc-50 text-xs text-zinc-600">
                    <tr>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Ord Qty</th>
                      <th className="px-3 py-2">Ord Cost</th>
                      <th className="px-3 py-2">Rec Qty</th>
                      <th className="px-3 py-2">Rec Cost</th>
                      <th className="px-3 py-2">Discount Type</th>
                      <th className="px-3 py-2">Discount Value</th>
                      <th className="px-3 py-2">Sales Tax Type</th>
                      <th className="px-3 py-2">Sales Tax Value</th>
                      <th className="px-3 py-2">Net Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiveLines.map((line) => {
                      const lineNet = calcPurchaseLineAmounts({
                        quantity: line.receivedQuantity,
                        cost: line.receivedCost,
                        discountType: line.discountType,
                        discountValue: line.discountValue,
                        salesTaxType: line.salesTaxType,
                        salesTaxValue: line.salesTaxValue,
                      }).netAmount;
                      const adjusted =
                        line.receivedQuantity !== line.orderedQuantity ||
                        line.receivedCost !== line.orderedCost ||
                        line.discountType !== line.orderedDiscountType ||
                        line.discountValue !== line.orderedDiscountValue ||
                        line.salesTaxType !== line.orderedSalesTaxType ||
                        line.salesTaxValue !== line.orderedSalesTaxValue;
                      return (
                        <tr key={line.productId} className="border-t border-zinc-100">
                          <td className="px-3 py-2">
                            <div className="font-medium">{line.name}</div>
                            {adjusted ? <span className="text-xs text-amber-700">Adjusted</span> : null}
                          </td>
                          <td className="px-3 py-2">{line.orderedQuantity}</td>
                          <td className="px-3 py-2">{currency(line.orderedCost)}</td>
                          <td className="px-3 py-2">
                            <Input
                              className="h-9 w-20"
                              type="number"
                              min={0}
                              max={line.orderedQuantity}
                              value={line.receivedQuantity}
                              onChange={(e) => updateReceiveLine(line.productId, { receivedQuantity: Number(e.target.value) })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              className="h-9 w-24"
                              type="number"
                              min={0}
                              step="0.01"
                              value={line.receivedCost}
                              onChange={(e) => updateReceiveLine(line.productId, { receivedCost: Number(e.target.value) })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              className="h-9 min-w-[128px] text-xs"
                              value={line.discountType}
                              onChange={(e) => updateReceiveLine(line.productId, { discountType: e.target.value as PurchaseDiscountType })}
                            >
                              <option value="flat">Flat (Rs) line</option>
                              <option value="flat_per_piece">Flat (Rs) per piece</option>
                              <option value="percentage">Percentage (%)</option>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              className="h-9 w-20"
                              type="number"
                              min={0}
                              value={line.discountValue}
                              onChange={(e) => updateReceiveLine(line.productId, { discountValue: Number(e.target.value) })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              className="h-9 min-w-[108px] text-xs"
                              value={line.salesTaxType}
                              onChange={(e) => updateReceiveLine(line.productId, { salesTaxType: e.target.value as "flat" | "percentage" })}
                            >
                              <option value="percentage">Percentage (%)</option>
                              <option value="flat">Flat (Rs)</option>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              className="h-9 w-20"
                              type="number"
                              min={0}
                              value={line.salesTaxValue}
                              onChange={(e) => updateReceiveLine(line.productId, { salesTaxValue: Number(e.target.value) })}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{currency(lineNet)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
                <div className="flex justify-between">
                  <span>Ordered total</span>
                  <span>{currency(orderedReceiveTotals.grandTotal)}</span>
                </div>
                <div className="mt-1 flex justify-between font-medium">
                  <span>Net after delivery</span>
                  <span>{currency(receiveTotals.grandTotal)}</span>
                </div>
                {receiveTotals.grandTotal !== orderedReceiveTotals.grandTotal ? (
                  <div className="mt-1 flex justify-between text-amber-700">
                    <span>Adjustment difference</span>
                    <span>{currency(receiveTotals.grandTotal - orderedReceiveTotals.grandTotal)}</span>
                  </div>
                ) : null}
                {receiveAdvancePaid > 0 ? (
                  <div className="mt-1 flex justify-between text-zinc-600">
                    <span>Advance already paid</span>
                    <span>-{currency(receiveAdvancePaid)}</span>
                  </div>
                ) : null}
                <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
                  <span>Amount due now</span>
                  <span>{currency(receiveAmountDue)}</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Payment Method</Label>
                  <Select
                    className="mt-1.5"
                    value={receivePaymentMethod}
                    onChange={(e) => {
                      const method = e.target.value as PurchasePaymentMethod;
                      setReceivePaymentMethod(method);
                      if (method === "credit") {
                        setReceivePayNow(0);
                        return;
                      }
                      if (method !== "cheque") {
                        setReceiveChequeNumber("");
                        setReceiveChequeBankAccountId("");
                        setReceiveChequeDate("");
                        return;
                      }
                      if (receivePayNow <= 0 && receiveAmountDue > 0) {
                        setReceivePayNow(receiveAmountDue);
                      }
                      if (activeBankAccounts.length > 0 && !receiveChequeBankAccountId) {
                        const matchedAccount = receiveSavedBankName
                          ? activeBankAccounts.find((account) => account.name === receiveSavedBankName)
                          : undefined;
                        setReceiveChequeBankAccountId(matchedAccount?._id ?? activeBankAccounts[0]._id);
                      }
                    }}
                  >
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="credit">Credit</option>
                  </Select>
                </div>
                <div>
                  <Label>Pay on delivery</Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min={0}
                    max={receiveTotals.grandTotal}
                    value={receivePayNow || ""}
                    onChange={(e) => setReceivePayNow(Number(e.target.value))}
                    disabled={receivePaymentMethod === "credit"}
                  />
                  {receivePaymentMethod === "credit" ? (
                    <p className="mt-1 text-xs text-zinc-500">Amount due will be added to the vendor credit account.</p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-500">
                      Total paid after receive: {currency(receiveAdvancePaid + receivePayNow)}
                    </p>
                  )}
                </div>
                {receivePaymentMethod === "cheque" ? (
                  <>
                    <div className="md:col-span-2">
                      <Label htmlFor="receive-cheque-bank">Bank</Label>
                      <PaymentAccountSelect
                        id="receive-cheque-bank"
                        className="mt-1.5"
                        value={receiveChequeBankAccountId}
                        onChange={setReceiveChequeBankAccountId}
                        accounts={activeBankAccounts}
                        allowEmpty
                        emptyLabel="Select bank account"
                        emptyAccountsHint={
                          bankAccounts.isError
                            ? "Unable to load bank accounts. Check your access or add accounts under Finance → Bank."
                            : "No bank accounts registered. Add accounts under Finance → Bank."
                        }
                      />
                      <p className="mt-1 text-xs text-zinc-500">Select the bank account this cheque is drawn on.</p>
                    </div>
                    <div>
                      <Label htmlFor="receive-cheque-number">Cheque Number</Label>
                      <Input
                        id="receive-cheque-number"
                        className="mt-1.5"
                        placeholder="Cheque #"
                        value={receiveChequeNumber}
                        onChange={(e) => setReceiveChequeNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="receive-cheque-date">Cheque Date</Label>
                      <Input
                        id="receive-cheque-date"
                        type="date"
                        className="mt-1.5"
                        value={receiveChequeDate}
                        onChange={(e) => setReceiveChequeDate(e.target.value)}
                      />
                    </div>
                  </>
                ) : null}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setReceiveOpen(false)}>
                  Cancel
                </Button>
                <Button loading={receiveSubmitting} onClick={() => void receiveGoods()}>
                  Receive into stock
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      ) : null}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent title={isSpot ? "Spot Purchase Details" : "Purchase Details"}>
          {detail.data ? (
            <div className="space-y-3 text-sm">
              <div>Vendor: {detail.data.purchase.supplier?.supplierName}</div>
              <div>Invoice: {detail.data.purchase.invoiceNumber || "—"}</div>
              <div>
                Date:{" "}
                {detail.data.purchase.orderDate
                  ? formatPakistanDate(detail.data.purchase.orderDate, "")
                  : detail.data.purchase.createdAt
                    ? formatPakistanDate(detail.data.purchase.createdAt, "")
                    : "—"}
              </div>
              <div>Status: {detail.data.purchase.status}</div>
              <div>Payment: {detail.data.purchase.paymentMethod ?? "cash"}</div>
              {detail.data.purchase.paymentMethod === "cheque" ? (
                <div>
                  Bank: {detail.data.purchase.bankName || "—"}
                  <br />
                  Cheque: {detail.data.purchase.chequeNumber || "—"}
                  {detail.data.purchase.chequeDate ? ` · ${formatPakistanDate(detail.data.purchase.chequeDate, "")}` : ""}
                </div>
              ) : null}
              <div>Subtotal: {currency(detail.data.purchase.subtotal ?? 0)}</div>
              {(detail.data.purchase.orderedGrandTotal ?? 0) > 0 &&
              detail.data.purchase.orderedGrandTotal !== detail.data.purchase.grandTotal ? (
                <>
                  <div>Ordered total: {currency(detail.data.purchase.orderedGrandTotal)}</div>
                  <div className="text-amber-700">
                    Adjustment: {currency(detail.data.purchase.adjustmentAmount ?? 0)}
                  </div>
                </>
              ) : null}
              {(detail.data.purchase.discountAmount ?? 0) > 0 ? (
                <div>Discount: -{currency(detail.data.purchase.discountAmount)}</div>
              ) : null}
              {(detail.data.purchase.salesTaxAmount ?? detail.data.purchase.taxes ?? 0) > 0 ? (
                <div>Sales tax: {currency(detail.data.purchase.salesTaxAmount ?? detail.data.purchase.taxes ?? 0)}</div>
              ) : null}
              <div className="font-semibold">Net total: {currency(detail.data.purchase.grandTotal)}</div>
              <div>Paid: {currency(detail.data.purchase.paidAmount ?? 0)}</div>
              {Math.max((detail.data.purchase.grandTotal ?? 0) - (detail.data.purchase.paidAmount ?? 0), 0) > 0 ? (
                <div className="text-zinc-600">
                  Due on vendor account:{" "}
                  {currency(Math.max((detail.data.purchase.grandTotal ?? 0) - (detail.data.purchase.paidAmount ?? 0), 0))}
                </div>
              ) : null}
              {detail.data.purchase.status === "received" && returnableItems(detail.data.items as PurchaseDetailItem[]).length > 0 ? (
                <Button type="button" variant="danger" onClick={() => setReturnConfirmOpen(true)}>
                  Return all goods
                </Button>
              ) : null}
              {detail.data.items.map((item: PurchaseDetailItem & { _id: string }) => {
                const orderedQty = item.orderedQuantity ?? item.quantity;
                const orderedCost = item.orderedCost ?? item.cost;
                const adjusted = orderedQty !== item.quantity || orderedCost !== item.cost;
                return (
                  <div key={item._id} className="border-b py-2">
                    <div className="flex justify-between">
                      <span>{item.name}</span>
                      <span>
                        {item.quantity} x {currency(item.cost)}
                      </span>
                    </div>
                    {adjusted ? (
                      <p className="mt-1 text-xs text-amber-700">
                        Ordered {orderedQty} x {currency(orderedCost)} · Received {item.quantity} x {currency(item.cost)}
                      </p>
                    ) : null}
                    {(item.netAmount ?? 0) > 0 ? (
                      <p className="text-xs text-zinc-500">Line net: {currency(item.netAmount ?? 0)}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <BlockLoader label="Loading..." />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteSpotTarget}
        title="Delete Spot Purchase"
        description={`Permanently delete this spot purchase from ${deleteSpotTarget?.supplier?.supplierName ?? "vendor"}? Stock will be reversed and this cannot be undone.`}
        confirmLabel="Delete"
        isPending={deleteSpotSubmitting}
        onOpenChange={(open) => {
          if (!open) setDeleteSpotTarget(null);
        }}
        onConfirm={() => void deleteSpotPurchase()}
      />

      <ConfirmDialog
        open={returnConfirmOpen}
        title="Return all goods"
        description="This will remove received stock from inventory and credit the vendor account for the returned amount."
        confirmLabel="Return goods"
        isPending={returnSubmitting}
        onOpenChange={setReturnConfirmOpen}
        onConfirm={() => void returnAllGoods()}
      />
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
