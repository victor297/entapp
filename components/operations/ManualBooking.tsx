"use client";
import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOperationListQuery, useOperationRecordQuery } from "@/redux/services/operationsApi";
import { Workspace, Message, ApiError, fieldClass } from "./Workspace";
export default function ManualBooking({ quoteId = "" }: { quoteId?: string }) {
  const { user, userId } = useCurrentUser(); const ready = Boolean(userId && user?.userType === "SERVICE_PROVIDER"); const bookings = useOperationListQuery({ resource: "/booking", params: { serviceProvider: userId } }, { skip: !ready }); const quotes = useOperationListQuery({ resource: "/requestQuote", params: { serviceProvider: userId } }, { skip: !ready });
  const quote = useOperationRecordQuery(`/requestQuote/${quoteId}`, { skip: !ready || !quoteId }); const [customerId, setCustomerId] = useState("");
  const customers = [...new Set([...(bookings.data || []), ...(quotes.data || [])].filter(row => row.serviceProvider === userId && row.customerId).map(row => String(row.customerId)))];
  const customer = quote.data?.serviceProvider === userId ? quote.data.customerId : customerId;
  return <Workspace role="provider" title="Prepare a booking"><Message>New booking confirmation is temporarily unavailable because the configured service fee cannot be read by provider accounts. Existing bookings and invoices can still be managed.</Message><section className="rounded-xl border bg-white p-6"><h2 className="mb-4 text-xl font-semibold">Authorized customer selection</h2><label>Customer<select className={fieldClass} value={customer || ""} disabled={Boolean(quoteId)} onChange={event => setCustomerId(event.target.value)}><option value="">Select a customer from your existing bookings or quotes</option>{customers.map(id => <option key={id} value={id}>{id}</option>)}{customer && !customers.includes(customer) && <option value={customer}>{customer}</option>}</select></label><p className="mt-3 text-sm text-gray-600">Only customer references already associated with your bookings or quotes are shown. External-customer booking is not available.</p>{(bookings.error || quotes.error || quote.error) && <ApiError error={bookings.error || quotes.error || quote.error} />}</section></Workspace>;
}
