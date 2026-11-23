import { recordPage, type ApiRecord } from "./operations";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

type Query = { url: string; params?: Record<string, string | number | undefined> } | string;
type ReadResult = { data?: unknown; error?: unknown };
type Read = (query: Query) => ReadResult | PromiseLike<ReadResult>;

export async function fetchScopedRecords(read: Read, resource: string, params: Record<string, string | number | undefined> = {}) {
  const rows: ApiRecord[] = [];
  const seen = new Set<string>();
  while (true) {
    const response = await read({ url: resource, params: { ...params, limit: 100, offset: rows.length } });
    if (response.error) throw response.error;
    const page = recordPage(response.data);
    if (!page.data.length && rows.length < page.count) throw new Error("The server returned an incomplete list. Please retry.");
    for (const row of page.data) {
      if (!row.id || seen.has(row.id)) throw new Error("The server did not paginate this list correctly.");
      seen.add(row.id);
      rows.push(row);
    }
    if (Array.isArray(response.data) ? page.data.length < 100 : rows.length >= page.count) return rows;
  }
}

export async function fetchCustomerBookings(read: Read, userId: string) {
  if (!userId) throw new Error("Please sign in.");
  // The booking service drops customerId. Discover IDs through scoped invoices;
  // never fetch the platform-wide booking list to filter it in the browser.
  const invoices = await fetchScopedRecords(read, "/invoice", { userId });
  const ids = new Set(invoices.filter(row => row.userId === userId && row.bookingId).map(row => String(row.bookingId)));
  const bookings: ApiRecord[] = [];
  for (const id of ids) {
    const result = await read(`/booking/${encodeURIComponent(id)}`);
    if (result.error) throw result.error;
    const booking = result.data as ApiRecord | undefined;
    if (booking?.customerId === userId) bookings.push(booking);
  }
  return bookings;
}

export function operationError(error: unknown): FetchBaseQueryError {
  if (error && typeof error === "object" && "status" in error) return error as FetchBaseQueryError;
  return { status: "CUSTOM_ERROR" as const, error: error instanceof Error ? error.message : "Unable to load records. Please retry." };
}
