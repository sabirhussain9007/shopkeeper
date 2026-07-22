"use client";

import { forwardRef } from "react";
import { currency } from "@/lib/utils";
import type { CartItem, PaymentMethod, ReceiptSize } from "@/types";

type ReceiptAlign = "left" | "center" | "right";

type ReceiptProps = {
  items: CartItem[];
  size: ReceiptSize;
  invoiceNumber: string;
  businessName: string;
  logo?: string;
  logoAlign?: ReceiptAlign;
  address?: string;
  phone?: string;
  email?: string;
  gstVatNumber?: string;
  ntn?: string;
  receiptTitle?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  thankYouMessage: string;
  cashierName?: string;
  customerName?: string;
  subtotal: number;
  discount: number;
  tax: number;
  taxLabel?: string;
  grandTotal: number;
  paidAmount: number;
  changeDue: number;
  paymentMethod: PaymentMethod;
  outstandingBalance?: number;
  issuedAt?: string;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string;
  showReceiptLogo?: boolean;
  showReceiptBarcode?: boolean;
  showCashier?: boolean;
  showCustomer?: boolean;
  showSku?: boolean;
  showTaxNumbers?: boolean;
  showEmail?: boolean;
  showTax?: boolean;
};

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(function Receipt(
  {
    items,
    size,
    invoiceNumber,
    businessName,
    logo,
    logoAlign = "center",
    address,
    phone,
    email,
    gstVatNumber,
    ntn,
    receiptTitle,
    receiptHeader,
    receiptFooter,
    thankYouMessage,
    cashierName,
    customerName,
    subtotal,
    discount,
    tax,
    taxLabel = "Tax",
    grandTotal,
    paidAmount,
    changeDue,
    paymentMethod,
    outstandingBalance,
    issuedAt,
    chequeNumber,
    bankName,
    chequeDate,
    showReceiptLogo = true,
    showReceiptBarcode = true,
    showCashier = true,
    showCustomer = true,
    showSku = false,
    showTaxNumbers = true,
    showEmail = false,
    showTax = true,
  },
  ref,
) {
  const receiptDate = issuedAt ?? "";
  const brandJustify = logoAlign === "left" ? "flex-start" : logoAlign === "right" ? "flex-end" : "center";
  const brandDirection = logoAlign === "right" ? "row-reverse" : "row";
  const textAlign = "center";
  const displayLogo = showReceiptLogo && logo;

  return (
    <div ref={ref} className={`receipt receipt-${size}`}>
      <style>{`
        @page receipt-58mm-page { size: 58mm auto; margin: 0; }
        @page receipt-80mm-page { size: 80mm auto; margin: 0; }
        @page receipt-a4-page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { margin: 0; padding: 0; background: #fff; }
          body * { visibility: hidden; }
          .receipt, .receipt * { visibility: visible; }
          .receipt { position: absolute; left: 0; top: 0; box-shadow: none; color: #000; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .receipt-58mm { page: receipt-58mm-page; width: 58mm; }
          .receipt-80mm { page: receipt-80mm-page; width: 80mm; }
          .receipt-a4 { page: receipt-a4-page; position: static; width: 210mm; min-height: 297mm; margin: 0 auto; padding: 12mm; border: 0; }
          .receipt-a4 h1 { font-size: 24px !important; }
          .receipt-a4 .receipt-meta { font-size: 13px; }
          .receipt-a4 .row { font-size: 14px; padding: 3px 0; }
          .receipt-a4 .dash { margin: 14px 0; }
        }
        .receipt { box-sizing: border-box; max-width: 100%; margin: 0 auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 8px; color: #000; background: #fff; }
        .receipt-58mm { width: 219px; }
        .receipt-80mm { width: 302px; }
        .receipt-a4 { width: min(794px, 100%); min-height: 1123px; padding: 46px; border: 1px solid #e4e4e7; }
        .receipt-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .receipt-brand-text { min-width: 0; }
        .receipt-logo { display: block; flex: 0 0 auto; width: 42px; height: 42px; object-fit: contain; }
        .receipt-a4 .receipt-logo { width: 72px; height: 72px; margin-bottom: 10px; }
        .receipt-meta { font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; }
        .receipt-invoice-meta { margin-top: 4px; text-align: right; font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; }
        .receipt-text { white-space: pre-wrap; font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; }
        .dash { border-top: 2px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
        .item { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: baseline; column-gap: 14px; row-gap: 2px; margin-bottom: 4px; font-size: 12px; }
        .item-header { margin-bottom: 6px; padding-bottom: 3px; border-bottom: 1px solid #000; font-weight: 700; }
        .item-name { min-width: 0; font-weight: 600; overflow-wrap: anywhere; }
        .item-qty, .item-price { color: #333; white-space: nowrap; text-align: right; }
        .item-total { font-weight: 600; text-align: right; white-space: nowrap; }
        .receipt-58mm .item { column-gap: 8px; }
        .barcode { height: 36px; background: repeating-linear-gradient(90deg,#000 0 2px,#fff 2px 4px,#000 4px 5px,#fff 5px 8px); margin-top: 8px; }
      `}</style>
      <div className="receipt-brand" style={{ justifyContent: brandJustify, flexDirection: brandDirection }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Receipts must support printable data URLs and external logo URLs. */}
        {displayLogo ? <img className="receipt-logo" src={logo} alt={`${businessName} logo`} /> : null}
        <div className="receipt-brand-text">
          <h1 style={{ textAlign, fontSize: 16, margin: 0 }}>{businessName}</h1>
          {address ? <div className="receipt-meta" style={{ textAlign }}>{address}</div> : null}
          {phone ? <div className="receipt-meta" style={{ textAlign }}>Phone: {phone}</div> : null}
          {showEmail && email ? <div className="receipt-meta" style={{ textAlign }}>Email: {email}</div> : null}
          {showTaxNumbers && gstVatNumber ? <div className="receipt-meta" style={{ textAlign }}>GST/VAT: {gstVatNumber}</div> : null}
          {showTaxNumbers && ntn ? <div className="receipt-meta" style={{ textAlign }}>NTN: {ntn}</div> : null}
        </div>
      </div>
      {receiptTitle ? <div className="receipt-text" style={{ textAlign, fontWeight: 700, marginTop: 4 }}>{receiptTitle}</div> : null}
      {receiptHeader ? <div className="receipt-text" style={{ textAlign }}>{receiptHeader}</div> : null}
      <div className="receipt-invoice-meta">
        <div>Invoice No: {invoiceNumber}</div>
        {receiptDate ? <div>Date/Time: {receiptDate}</div> : null}
      </div>
      {showCashier && cashierName ? <div style={{ textAlign, fontSize: 11 }}>Cashier: {cashierName}</div> : null}
      {showCustomer && customerName ? <div style={{ textAlign, fontSize: 11 }}>Customer: {customerName}</div> : null}
      <div className="dash" />
      <div className="item item-header">
        <div>Item Name</div>
        <div className="item-qty">Quantity</div>
        <div className="item-price">Price</div>
        <div className="item-total">Total</div>
      </div>
      {items.map((item) => (
        <div key={item.productId} className="item">
          <div className="item-name">
            {item.name}
            {showSku && item.sku ? <span style={{ fontWeight: 400 }}> ({item.sku})</span> : null}
          </div>
          <div className="item-qty">{item.quantity}</div>
          <div className="item-price">{currency(item.unitPrice)}</div>
          <div className="item-total">{currency(item.quantity * item.unitPrice - item.discount)}</div>
        </div>
      ))}
      <div className="dash" />
      <div className="row">
        <span>Subtotal</span>
        <span>{currency(subtotal)}</span>
      </div>
      {discount > 0 ? (
        <div className="row">
          <span>Discount</span>
          <span>-{currency(discount)}</span>
        </div>
      ) : null}
      {showTax && tax > 0 ? (
        <div className="row">
          <span>{taxLabel}</span>
          <span>{currency(tax)}</span>
        </div>
      ) : null}
      <div className="row" style={{ fontWeight: 700, fontSize: 14 }}>
        <span>Total</span>
        <span>{currency(grandTotal)}</span>
      </div>
      <div className="row">
        <span>Payment</span>
        <span>{paymentMethod.toUpperCase()}</span>
      </div>
      {paymentMethod === "cheque" ? (
        <>
          {chequeNumber ? (
            <div className="row">
              <span>Cheque #</span>
              <span>{chequeNumber}</span>
            </div>
          ) : null}
          {chequeDate ? (
            <div className="row">
              <span>Cheque date</span>
              <span>{chequeDate}</span>
            </div>
          ) : null}
          {bankName ? (
            <div className="row">
              <span>Bank</span>
              <span>{bankName}</span>
            </div>
          ) : null}
        </>
      ) : null}
      {paymentMethod !== "credit" ? (
        <div className="row">
          <span>Paid</span>
          <span>{currency(paidAmount)}</span>
        </div>
      ) : null}
      {changeDue > 0 ? (
        <div className="row">
          <span>Change</span>
          <span>{currency(changeDue)}</span>
        </div>
      ) : null}
      {outstandingBalance != null && customerName ? (
        <div className="row">
          <span>Balance</span>
          <span>{currency(outstandingBalance)}</span>
        </div>
      ) : null}
      {showReceiptBarcode ? <div className="barcode" /> : null}
      {receiptFooter ? <p className="receipt-text" style={{ textAlign, margin: "8px 0 0" }}>{receiptFooter}</p> : null}
      <p style={{ textAlign: "center", fontSize: 11, margin: "8px 0 0" }}>{thankYouMessage}</p>
    </div>
  );
});
