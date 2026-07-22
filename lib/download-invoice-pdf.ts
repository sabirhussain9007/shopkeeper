import { currency, formatPakistanDateTime } from "@/lib/utils";

type SaleItem = { name: string; sku?: string; quantity: number; unitPrice: number; lineTotal: number };

type BusinessSettings = {
  businessName: string;
  address?: string;
  phone?: string;
  email?: string;
  gstVatNumber?: string;
  ntn?: string;
};

type SaleDetail = {
  sale: {
    invoiceNumber: string;
    paymentMethod: string;
    status: string;
    subtotal?: number;
    discountValue?: number;
    taxTotal?: number;
    grandTotal: number;
    paidAmount?: number;
    changeDue?: number;
    createdAt?: string;
    customer?: { name: string };
    cashier?: { name: string };
  };
  items: SaleItem[];
};

export async function downloadInvoicePdf(detail: SaleDetail, business: BusinessSettings) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

  const doc = new jsPDF();
  const invoiceDate = detail.sale.createdAt ? formatPakistanDateTime(detail.sale.createdAt, "") : "";
  const subtotal = detail.sale.subtotal ?? 0;
  const discount = detail.sale.discountValue ?? 0;
  const tax = detail.sale.taxTotal ?? 0;

  doc.setFontSize(18);
  doc.text(business.businessName, 14, 18);
  doc.setFontSize(11);
  doc.text("Tax Invoice", 14, 26);
  let businessY = 34;
  if (business.address) {
    doc.text(business.address, 14, businessY);
    businessY += 7;
  }
  if (business.phone) {
    doc.text(`Phone: ${business.phone}`, 14, businessY);
    businessY += 7;
  }
  if (business.email) {
    doc.text(`Email: ${business.email}`, 14, businessY);
    businessY += 7;
  }
  if (business.gstVatNumber) {
    doc.text(`GST/VAT: ${business.gstVatNumber}`, 14, businessY);
    businessY += 7;
  }
  if (business.ntn) {
    doc.text(`NTN: ${business.ntn}`, 14, businessY);
  }

  doc.text(`Invoice: ${detail.sale.invoiceNumber}`, 140, 18);
  doc.text(`Date: ${invoiceDate}`, 140, 26);
  doc.text(`Customer: ${detail.sale.customer?.name ?? "Walk-in"}`, 140, 38);
  doc.text(`Cashier: ${detail.sale.cashier?.name ?? "-"}`, 140, 46);
  doc.text(`Payment: ${detail.sale.paymentMethod.toUpperCase()}`, 140, 54);
  doc.text(`Status: ${detail.sale.status.toUpperCase()}`, 140, 62);

  autoTable(doc, {
    startY: Math.max(74, businessY + 8),
    head: [["Item", "SKU", "Qty", "Price", "Total"]],
    body: detail.items.map((item) => [item.name, item.sku ?? "", item.quantity, currency(item.unitPrice), currency(item.lineTotal)]),
  });

  const finalY = (doc as InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 58;
  autoTable(doc, {
    startY: finalY + 8,
    theme: "plain",
    styles: { halign: "right" },
    margin: { left: 120 },
    body: [
      ["Subtotal", currency(subtotal)],
      ["Discount", currency(discount)],
      ["Tax", currency(tax)],
      ["Grand Total", currency(detail.sale.grandTotal)],
      ["Paid", currency(detail.sale.paidAmount ?? 0)],
      ["Change", currency(detail.sale.changeDue ?? 0)],
    ],
  });

  doc.save(`${detail.sale.invoiceNumber}.pdf`);
}
