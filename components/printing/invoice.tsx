"use client";

import { forwardRef } from "react";
import { currency } from "@/lib/utils";

type InvoiceItem = {
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type InvoiceProps = {
  invoiceNumber: string;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  gstVatNumber?: string;
  ntn?: string;
  logo?: string;
  date: string;
  cashierName?: string;
  customerName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount?: number;
  changeDue?: number;
  paymentMethod: string;
  status: string;
  ledgerSummary?: {
    previousBalance: number;
    cashPortion: number;
    nowClosingBalance: number;
  };
};

export const Invoice = forwardRef<HTMLDivElement, InvoiceProps>(function Invoice(
  { invoiceNumber, businessName, businessAddress, businessPhone, businessEmail, gstVatNumber, ntn, logo, date, cashierName, customerName, items, subtotal, discount, tax, grandTotal, paidAmount, changeDue, paymentMethod, status, ledgerSummary },
  ref,
) {
  return (
    <div ref={ref} className="invoice-print bg-white p-8 text-black">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .invoice-print, .invoice-print * { visibility: visible; }
          .invoice-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-3">
          {logo ? <img src={logo} alt={`${businessName} logo`} className="h-14 w-14 object-contain" /> : null}
          <div>
            <h1 className="text-2xl font-bold">{businessName}</h1>
            <p className="text-sm text-zinc-600">Tax Invoice</p>
            {businessAddress ? <p className="text-sm text-zinc-600">{businessAddress}</p> : null}
            {businessPhone ? <p className="text-sm text-zinc-600">Phone: {businessPhone}</p> : null}
            {businessEmail ? <p className="text-sm text-zinc-600">Email: {businessEmail}</p> : null}
            {gstVatNumber ? <p className="text-sm text-zinc-600">GST/VAT: {gstVatNumber}</p> : null}
            {ntn ? <p className="text-sm text-zinc-600">NTN: {ntn}</p> : null}
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold">{invoiceNumber}</div>
          <div>{date}</div>
          <div className="mt-1 uppercase">{status}</div>
        </div>
      </div>
      <div className="mb-6 grid gap-1 text-sm">
        {cashierName ? <div>Cashier: {cashierName}</div> : null}
        {customerName ? <div>Customer: {customerName}</div> : null}
        <div>Payment: {paymentMethod.toUpperCase()}</div>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-2 text-left">Item</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.name}-${index}`} className="border-b border-zinc-300">
              <td className="py-2">
                <div>{item.name}</div>
                {item.sku ? <div className="text-xs text-zinc-500">{item.sku}</div> : null}
              </td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right">{currency(item.unitPrice)}</td>
              <td className="py-2 text-right">{currency(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-6 flex items-start justify-between gap-8 text-sm">
        {ledgerSummary ? (
          <div className="w-72 space-y-2">
            <div className="flex justify-between">
              <span>Previous Balance</span>
              <span>{currency(ledgerSummary.previousBalance)}</span>
            </div>
            <div className="flex justify-between">
              <span>Invoice Subtotal</span>
              <span>{currency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>{currency(discount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{currency(tax)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cash Paid</span>
              <span>{currency(ledgerSummary.cashPortion)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-400 pt-2 font-semibold">
              <span>Now Closing Balance</span>
              <span>{currency(ledgerSummary.nowClosingBalance)}</span>
            </div>
          </div>
        ) : <div />}

        <div className="w-64 space-y-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{currency(subtotal)}</span>
          </div>
          {discount > 0 ? (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{currency(discount)}</span>
          </div>
          ) : null}
          {tax > 0 ? (
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{currency(tax)}</span>
          </div>
          ) : null}
          <div className="flex justify-between border-t-2 border-black pt-2 text-lg font-bold">
            <span>Total</span>
            <span>{currency(grandTotal)}</span>
          </div>
          {paidAmount != null ? (
            <div className="flex justify-between">
              <span>Paid</span>
              <span>{currency(paidAmount)}</span>
            </div>
          ) : null}
          {changeDue != null ? (
            <div className="flex justify-between">
              <span>Change</span>
              <span>{currency(changeDue)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});
