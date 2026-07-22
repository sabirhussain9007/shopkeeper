"use client";

import { useMemo } from "react";
import { TableLoader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currency, formatPakistanDate, formatPakistanTime, resolvePakistanTimestamp } from "@/lib/utils";
import { vendorPaymentMethods } from "@/schemas/domain";

export type VendorPaymentMethod = (typeof vendorPaymentMethods)[number];

export type VendorLedgerPurchase = {
  _id: string;
  invoiceNumber?: string;
  grandTotal?: number;
  orderDate?: string;
  purchaseKind?: "order" | "spot";
  status?: string;
  paidAmount?: number;
  paymentMethod?: string;
  chequeNumber?: string;
  chequeDate?: string;
};

export type VendorLedgerEntry = {
  _id: string;
  type: "purchase" | "payment" | "adjustment" | "return" | "cheque_bounce";
  debit: number;
  credit: number;
  balance: number;
  description: string;
  entryDate: string;
  createdAt?: string;
  relatedEntry?: string;
  paymentMethod?: VendorPaymentMethod;
  reference?: string;
  bankName?: string;
  chequeDate?: string;
  purchase?: VendorLedgerPurchase | string | null;
};

export type LedgerFilter = "all" | VendorLedgerEntry["type"];

const VENDOR_PAYMENT_LABELS: Record<VendorPaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  bank: "Bank transfer",
  card: "Card",
};

const LEGACY_PAYMENT_LABELS: Record<string, string> = {
  easypaisa: "Digital wallet",
  jazzcash: "Digital wallet",
  credit: "Credit",
};

const FILTER_OPTIONS: Array<[LedgerFilter, string]> = [
  ["all", "All"],
  ["purchase", "Purchases"],
  ["payment", "Payments"],
  ["cheque_bounce", "Cheque bounces"],
  ["return", "Returns"],
  ["adjustment", "Adjustments"],
];

function paymentMethodLabel(method?: string | null) {
  if (!method) return null;
  if (method in VENDOR_PAYMENT_LABELS) return VENDOR_PAYMENT_LABELS[method as VendorPaymentMethod];
  if (method in LEGACY_PAYMENT_LABELS) return LEGACY_PAYMENT_LABELS[method];
  return method.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLedgerDate(value?: string | null) {
  if (!value) return "";
  return formatPakistanDate(value, "");
}

function normalizePurchase(purchase: VendorLedgerEntry["purchase"]): VendorLedgerPurchase | null {
  if (!purchase || typeof purchase !== "object") return null;
  return purchase;
}

function resolvePaymentMethod(entry: VendorLedgerEntry): VendorPaymentMethod | null {
  if (entry.paymentMethod) return entry.paymentMethod;
  if (entry.type !== "payment" && entry.type !== "cheque_bounce") return null;
  if (entry.chequeDate) return "cheque";
  if (entry.bankName) return entry.reference ? "cheque" : "bank";
  if (entry.reference) return "card";
  return "cash";
}

export function canBounceChequePayment(entry: VendorLedgerEntry, bouncedPaymentIds: Set<string>) {
  return (
    entry.type === "payment" &&
    resolvePaymentMethod(entry) === "cheque" &&
    entry.credit > 0 &&
    !bouncedPaymentIds.has(entry._id)
  );
}

function previousBalanceForEntry(entry: VendorLedgerEntry) {
  return entry.balance - entry.debit + entry.credit;
}

function ledgerTypeLabel(type: VendorLedgerEntry["type"]) {
  if (type === "purchase") return "Purchase";
  if (type === "payment") return "Payment";
  if (type === "cheque_bounce") return "Cheque bounce";
  if (type === "return") return "Return";
  return "Adjustment";
}

function ledgerTypeVariant(type: VendorLedgerEntry["type"]): "success" | "warning" | "default" | "danger" {
  if (type === "cheque_bounce") return "danger";
  if (type === "payment" || type === "return") return "success";
  if (type === "purchase") return "warning";
  return "default";
}

function paymentMethodBadgeVariant(method?: string | null): "default" | "success" | "warning" {
  if (method === "cash") return "success";
  if (method === "credit") return "warning";
  return "default";
}

function ReferenceLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-zinc-500">{label}:</span> {value}
    </div>
  );
}

function PaymentReferenceDetails({ entry }: { entry: VendorLedgerEntry }) {
  const method = resolvePaymentMethod(entry);

  if (!method) {
    return (
      <div className="space-y-0.5 text-xs">
        {entry.bankName ? <ReferenceLine label="Bank" value={entry.bankName} /> : null}
        {entry.reference ? <ReferenceLine label="Ref" value={entry.reference} /> : null}
        {entry.credit > 0 ? <div className="font-medium text-emerald-700">Paid {currency(entry.credit)}</div> : null}
        {!entry.bankName && !entry.reference && entry.credit <= 0 ? <span>—</span> : null}
      </div>
    );
  }

  if (method === "bank") {
    return (
      <div className="space-y-0.5 text-xs">
        {entry.bankName ? <ReferenceLine label="Bank" value={entry.bankName} /> : null}
        {entry.reference ? <ReferenceLine label="Ref" value={entry.reference} /> : null}
        {entry.credit > 0 ? <div className="font-medium text-emerald-700">Paid {currency(entry.credit)}</div> : null}
      </div>
    );
  }

  if (method === "cheque") {
    return (
      <div className="space-y-0.5 text-xs">
        {entry.bankName ? <ReferenceLine label="Bank" value={entry.bankName} /> : null}
        {entry.reference ? <ReferenceLine label="Cheque #" value={entry.reference} /> : null}
        {formatLedgerDate(entry.chequeDate) ? <ReferenceLine label="Cheque date" value={formatLedgerDate(entry.chequeDate)} /> : null}
        {entry.credit > 0 ? <div className="font-medium text-emerald-700">Paid {currency(entry.credit)}</div> : null}
      </div>
    );
  }

  if (method === "card") {
    return (
      <div className="space-y-0.5 text-xs">
        {entry.reference ? <ReferenceLine label="Card ref" value={entry.reference} /> : <span>—</span>}
        {entry.credit > 0 ? <div className="font-medium text-emerald-700">Paid {currency(entry.credit)}</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-0.5 text-xs">
      <div className="text-zinc-500">Cash payment</div>
      {entry.credit > 0 ? <div className="font-medium text-emerald-700">Paid {currency(entry.credit)}</div> : null}
    </div>
  );
}

function PurchaseReferenceDetails({ purchase }: { purchase: VendorLedgerPurchase }) {
  const paid = purchase.paidAmount ?? 0;
  const method = purchase.paymentMethod;

  if (method === "cheque") {
    return (
      <div className="space-y-0.5 text-xs">
        {paid > 0 ? <div className="font-medium text-emerald-700">Paid {currency(paid)}</div> : <div className="text-zinc-500">On credit</div>}
        {purchase.chequeNumber ? <ReferenceLine label="Cheque #" value={purchase.chequeNumber} /> : null}
        {formatLedgerDate(purchase.chequeDate) ? <ReferenceLine label="Cheque date" value={formatLedgerDate(purchase.chequeDate)} /> : null}
      </div>
    );
  }

  if (method === "cash") {
    return paid > 0 ? (
      <div className="text-xs font-medium text-emerald-700">Paid {currency(paid)} at purchase</div>
    ) : (
      <span className="text-xs text-zinc-500">No advance paid</span>
    );
  }

  if (method === "credit") {
    return (
      <div className="space-y-0.5 text-xs">
        <div className="text-zinc-500">Billed on credit</div>
        {paid > 0 ? <div className="font-medium text-emerald-700">Advance {currency(paid)}</div> : null}
      </div>
    );
  }

  return paid > 0 ? <div className="text-xs font-medium text-emerald-700">Paid {currency(paid)}</div> : <span>—</span>;
}

function PaymentMethodCell({
  entry,
  purchase,
}: {
  entry: VendorLedgerEntry;
  purchase: VendorLedgerPurchase | null;
}) {
  if (entry.type === "payment") {
    const method = resolvePaymentMethod(entry);
    const label = method ? paymentMethodLabel(method) : "Payment";
    return <Badge variant={paymentMethodBadgeVariant(method)}>{label}</Badge>;
  }
  if (entry.type === "cheque_bounce") {
    return <Badge variant="danger">Cheque</Badge>;
  }
  if (purchase?.paymentMethod) {
    return <Badge variant={paymentMethodBadgeVariant(purchase.paymentMethod)}>{paymentMethodLabel(purchase.paymentMethod)}</Badge>;
  }
  if (entry.type === "return") return <Badge variant="success">Return</Badge>;
  if (entry.type === "adjustment") return <Badge variant="default">Adjustment</Badge>;
  if (purchase) return <Badge variant="warning">On account</Badge>;
  return <span>—</span>;
}

function ReferenceCell({
  entry,
  purchase,
}: {
  entry: VendorLedgerEntry;
  purchase: VendorLedgerPurchase | null;
}) {
  if (entry.type === "cheque_bounce") {
    return (
      <div className="space-y-0.5 text-xs">
        <div className="font-medium text-red-700">Bounced {currency(entry.debit)}</div>
        {entry.bankName ? <ReferenceLine label="Bank" value={entry.bankName} /> : null}
        {entry.reference ? <ReferenceLine label="Cheque #" value={entry.reference} /> : null}
        {formatLedgerDate(entry.chequeDate) ? <ReferenceLine label="Cheque date" value={formatLedgerDate(entry.chequeDate)} /> : null}
      </div>
    );
  }
  if (entry.type === "payment") {
    if (entry.relatedEntry) {
      return (
        <div className="space-y-0.5 text-xs">
          <div className="font-medium text-emerald-700">Repayment after bounce</div>
          <PaymentReferenceDetails entry={entry} />
        </div>
      );
    }
    return <PaymentReferenceDetails entry={entry} />;
  }
  if (purchase) return <PurchaseReferenceDetails purchase={purchase} />;
  if (entry.type === "return") {
    return <div className="text-xs font-medium text-emerald-700">Returned {currency(entry.credit)}</div>;
  }
  if (entry.type === "adjustment") {
    if (entry.credit > 0) return <div className="text-xs font-medium text-emerald-700">Credit {currency(entry.credit)}</div>;
    if (entry.debit > 0) return <div className="text-xs font-medium text-amber-700">Debit {currency(entry.debit)}</div>;
  }
  return <span>—</span>;
}

type VendorTransactionTableProps = {
  entries: VendorLedgerEntry[];
  openingBalance: number;
  closingBalance: number;
  ledgerFilter: LedgerFilter;
  onFilterChange: (filter: LedgerFilter) => void;
  onBounceCheque?: (entry: VendorLedgerEntry) => void;
  isLoading?: boolean;
  isError?: boolean;
};

export function VendorTransactionTable({
  entries,
  openingBalance,
  closingBalance,
  ledgerFilter,
  onFilterChange,
  onBounceCheque,
  isLoading,
  isError,
}: VendorTransactionTableProps) {
  const bouncedPaymentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of entries) {
      if (entry.type === "cheque_bounce" && entry.relatedEntry) {
        ids.add(entry.relatedEntry);
      }
    }
    return ids;
  }, [entries]);
  const filteredEntries = useMemo(() => {
    if (ledgerFilter === "all") return entries;
    return entries.filter((entry) => entry.type === ledgerFilter);
  }, [entries, ledgerFilter]);

  const filteredSummary = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const entry of filteredEntries) {
      totalDebit += entry.debit ?? 0;
      totalCredit += entry.credit ?? 0;
    }
    return { totalDebit, totalCredit, count: filteredEntries.length };
  }, [filteredEntries]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Transaction history</h4>
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_OPTIONS.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={ledgerFilter === value ? "primary" : "ghost"}
              onClick={() => onFilterChange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="responsive-table-shell responsive-table-shell--xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-[var(--panel)] text-xs uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Invoice / PO</th>
              <th className="px-4 py-3">Payment method</th>
              <th className="px-4 py-3">Bank / reference</th>
              <th className="px-4 py-3 text-right">Previous balance</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Credit</th>
              <th className="px-4 py-3 text-right">Closing balance</th>
              <th className="px-4 py-3">Description</th>
              {onBounceCheque ? <th className="px-4 py-3">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableLoader colSpan={onBounceCheque ? 11 : 10} label="Loading vendor details..." />
            ) : isError ? (
              <tr>
                <td colSpan={onBounceCheque ? 11 : 10} className="px-4 py-12 text-center text-red-600">
                  Unable to load ledger entries.
                </td>
              </tr>
            ) : filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={onBounceCheque ? 11 : 10} className="px-4 py-12 text-center text-zinc-500">
                  {entries.length === 0 ? "No transactions for this vendor yet." : "No transactions match this filter."}
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => {
                const purchase = normalizePurchase(entry.purchase);
                const displayAt = resolvePakistanTimestamp(entry.entryDate, entry.createdAt);
                const isBouncedCheque = entry.type === "payment" && bouncedPaymentIds.has(entry._id);
                const bounceable = onBounceCheque && canBounceChequePayment(entry, bouncedPaymentIds);
                return (
                  <tr key={entry._id} className="border-t border-zinc-100 hover:bg-emerald-50/40">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>{formatPakistanDate(displayAt)}</div>
                      <div className="text-xs text-zinc-500">{formatPakistanTime(displayAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={ledgerTypeVariant(entry.type)}>{ledgerTypeLabel(entry.type)}</Badge>
                        {isBouncedCheque ? <Badge variant="danger">Bounced</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {purchase ? (
                        <div>
                          <div className="font-medium">{purchase.invoiceNumber?.trim() || "Purchase"}</div>
                          <div className="text-xs capitalize text-zinc-500">
                            {purchase.purchaseKind === "spot" ? "Spot purchase" : "Purchase order"}
                            {purchase.status ? ` · ${purchase.status}` : ""}
                          </div>
                          {purchase.grandTotal != null ? (
                            <div className="text-xs text-zinc-500">Total {currency(purchase.grandTotal)}</div>
                          ) : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentMethodCell entry={entry} purchase={purchase} />
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      <ReferenceCell entry={entry} purchase={purchase} />
                    </td>
                    <td className="px-4 py-3 text-right">{currency(previousBalanceForEntry(entry))}</td>
                    <td className="px-4 py-3 text-right">{entry.debit > 0 ? currency(entry.debit) : "—"}</td>
                    <td className="px-4 py-3 text-right">{entry.credit > 0 ? currency(entry.credit) : "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{currency(entry.balance)}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{entry.description}</td>
                    {onBounceCheque ? (
                      <td className="px-4 py-3">
                        {bounceable ? (
                          <Button size="sm" variant="danger" onClick={() => onBounceCheque(entry)}>
                            Bounce
                          </Button>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
            {!isLoading && !isError && ledgerFilter === "all" ? (
              <tr className="border-t border-zinc-200 bg-zinc-50/80 text-zinc-600 dark:bg-zinc-900/30">
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">
                  <Badge variant="default">Opening</Badge>
                </td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right font-medium">{currency(openingBalance)}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">Opening balance</td>
                {onBounceCheque ? <td className="px-4 py-3" /> : null}
              </tr>
            ) : null}
          </tbody>
          {filteredEntries.length > 0 ? (
            <tfoot className="border-t border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
              <tr>
                <td className="px-4 py-3 font-medium" colSpan={5}>
                  {ledgerFilter === "all" ? "Totals" : `${ledgerTypeLabel(ledgerFilter)} totals`} ({filteredSummary.count})
                </td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right font-semibold">{currency(filteredSummary.totalDebit)}</td>
                <td className="px-4 py-3 text-right font-semibold">{currency(filteredSummary.totalCredit)}</td>
                <td className="px-4 py-3 text-right font-semibold">{currency(closingBalance)}</td>
                <td className="px-4 py-3" />
                {onBounceCheque ? <td className="px-4 py-3" /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </>
  );
}
