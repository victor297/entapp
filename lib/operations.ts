export interface ApiRecord { id: string; [key: string]: any }
export interface RecordPage { data: ApiRecord[]; count: number }
export function recordPage(value: unknown): RecordPage {
  if (Array.isArray(value)) return { data: value, count: value.length };
  if (!value || typeof value !== "object") throw new Error("The server returned an invalid list.");
  const raw = value as { data?: ApiRecord[]; docs?: ApiRecord[]; count?: number; total?: number };
  const rows = raw.data ?? raw.docs;
  if (!Array.isArray(rows)) throw new Error("The server returned an invalid list.");
  const count = Number(raw.count ?? raw.total ?? rows.length);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("The server returned an invalid result count.");
  return { data: rows, count };
}
export function money(value: unknown, currency = "NGN") {
  if (value === null || value === undefined || value === "") return "Unavailable";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Unavailable";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "NGN" }).format(amount);
}
export function bookingStatus(value: unknown) {
  const status = String(value || "UNKNOWN").toUpperCase();
  return ({ BOOKED: "Confirmed", CONFIRMED: "Confirmed", RESERVED: "Reserved", PENDING: "Pending", POSTPONED: "Postponed", CANCELED: "Cancelled", CANCELLED: "Cancelled", COMPLETED: "Completed" } as Record<string,string>)[status] ?? status.replaceAll("_", " ");
}
export function paymentStatus(value: unknown) {
  const status = String(value || "UNKNOWN").toUpperCase();
  return ({ PAID: "Paid", PARTIALLY_PAID: "Deposit / partial payment received", UNPAID: "Unpaid", PENDING: "Pending payment", GENERATED: "Awaiting payment", OVERDUE: "Overdue", OVER_PAID: "Overpaid" } as Record<string,string>)[status] ?? status.replaceAll("_", " ");
}
export function bookingPaymentSummary(booking: ApiRecord, invoices: ApiRecord[]) {
  const total = Number(booking.total);
  const paidInvoices = invoices.filter(invoice => ["PAID", "OVER_PAID"].includes(String(invoice.status).toUpperCase()));
  const amountPaid = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.amountDue || 0), 0);
  const hasPartialInvoice = invoices.some(invoice => String(invoice.status).toUpperCase() === "PARTIALLY_PAID");
  const allInvoicesPaid = invoices.length > 0 && paidInvoices.length === invoices.length;
  const paymentStatus = Number.isFinite(total) && invoices.length > 0
    ? amountPaid >= total
      ? "PAID"
      : amountPaid > 0 || hasPartialInvoice
        ? "PARTIALLY_PAID"
        : booking.paymentStatus
    : booking.paymentStatus;

  return {
    paymentStatus,
    amountPaid,
    balance: Number.isFinite(total) ? Math.max(0, total - amountPaid) : 0,
    allInvoicesPaid,
  };
}
export function filterRecords(rows: ApiRecord[], filters: { search?: string; status?: string; serviceId?: string; start?: string; end?: string; serviceType?: string }) {
  return rows.filter(row => {
    const text = [row.reference, row.bookingReference, row.quoteReference, row.serviceName, row.name, row.reason, row.description, row.note, row.id, row.customerId].filter(Boolean).join(" ").toLowerCase();
    const time = new Date(row.createdAt).getTime();
    return (!filters.search || text.includes(filters.search.toLowerCase())) && (!filters.status || String(row.status ?? row.type).toUpperCase() === filters.status) && (!filters.serviceId || row.serviceId === filters.serviceId) && (!filters.serviceType || row.serviceType === filters.serviceType) && (!filters.start || time >= Date.parse(`${filters.start}T00:00:00`)) && (!filters.end || time <= Date.parse(`${filters.end}T23:59:59.999`));
  });
}
