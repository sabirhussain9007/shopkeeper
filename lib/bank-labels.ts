const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank: "Bank",
  easypaisa: "EasyPaisa",
  jazzcash: "JazzCash",
};

export function shopAccountTypeLabel(accountType?: string) {
  if (!accountType) return "Bank";
  return ACCOUNT_TYPE_LABELS[accountType] ?? accountType;
}

const SOURCE_LABELS: Record<string, string> = {
  sale: "POS Sale",
  purchase: "Purchase",
  expense: "Expense",
  salary: "Salary",
  customer_payment: "Customer Payment",
  vendor_payment: "Vendor Payment",
  deposit: "Bank Deposit",
  cheque_bounce_repay: "Cheque Repayment",
  manual: "Manual",
  refund: "Refund",
};

export function sourceTypeLabel(sourceType?: string) {
  if (!sourceType) return "—";
  return SOURCE_LABELS[sourceType] ?? sourceType;
}
