import type { ApiRecord } from "./operations";

export function isPaymentConfirmed(invoice: ApiRecord | undefined, userId: string) {
  return Boolean(userId && invoice?.userId === userId && ["PAID", "OVER_PAID"].includes(invoice.status));
}

export function invoiceRemaining(invoice: ApiRecord, transactions: ApiRecord[]) {
  if (["PAID", "OVER_PAID"].includes(invoice.status)) return 0;
  const debits = transactions.filter(row => row.invoiceId === invoice.id && row.type === "DEBIT" && row.reason === "INVOICE_PAYMENT").reduce((sum, row) => sum + Number(row.amount), 0);
  return Math.max(0, Math.round((Number(invoice.amountDue) - debits) * 100) / 100);
}

export function isInvoicePayable(invoice: ApiRecord) {
  return ["GENERATED", "PENDING", "OVERDUE", "PARTIALLY_PAID"].includes(invoice.status);
}
