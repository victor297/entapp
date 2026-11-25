"use client";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOperationListQuery, useOperationRecordQuery } from "@/redux/services/operationsApi";
import GenerateInvoiceModal, { type InvoicePreparationQuote } from "@/components/layouts/GenerateInvoiceModal";
import { Workspace, Message, ApiError, fieldClass, buttonClass } from "./Workspace";
import type { ApiRecord } from "@/lib/operations";
import { parseQuoteRequestNotes } from "@/lib/quote-details";

function invoiceQuoteFromRecord(row: ApiRecord): { quote: InvoicePreparationQuote; timeslotIds: string[] } | null {
  const serviceType = row.serviceType;
  if (serviceType !== "EVENTCENTER" && serviceType !== "CATERING") return null;
  const billingAddress = row.billingAddress;
  if (!billingAddress || typeof billingAddress !== "object") return null;
  const address = billingAddress as Record<string, unknown>;
  const street = address.street;
  const city = address.city;
  const state = address.state;
  const country = address.country;
  const postal = address.postal;
  if (
    typeof street !== "string" || !street ||
    typeof city !== "string" || !city ||
    typeof state !== "string" || !state ||
    typeof country !== "string" || !country ||
    typeof postal !== "string" || !postal
  ) return null;
  if (typeof row.id !== "string" || typeof row.customerId !== "string" || typeof row.serviceId !== "string") return null;
  if (typeof row.isTermsAccepted !== "boolean" || typeof row.isCancellationPolicyAccepted !== "boolean" || typeof row.isLiabilityWaiverSigned !== "boolean") return null;
  if (typeof row.source !== "string") return null;
  if (!Array.isArray(row.requestedTimeSlots)) return null;
  const timeslotIds = row.requestedTimeSlots
    .map((slot: unknown) => slot && typeof slot === "object" &&
      "id" in slot && typeof slot.id === "string" &&
      "startTime" in slot && typeof slot.startTime === "string" &&
      "endTime" in slot && typeof slot.endTime === "string"
      ? { id: slot.id, startTime: slot.startTime, endTime: slot.endTime }
      : null)
    .filter((slot: { id: string; startTime: string; endTime: string } | null): slot is { id: string; startTime: string; endTime: string } => slot !== null);
  if (!timeslotIds.length || timeslotIds.length !== row.requestedTimeSlots.length) return null;
  const parsedNotes = parseQuoteRequestNotes(row.customerNotes);

  return {
    quote: {
      id: row.id,
      customerId: row.customerId,
      serviceId: row.serviceId,
      serviceType,
      billingAddress: {
        street,
        city,
        state,
        country,
        postal,
      },
      isTermsAccepted: row.isTermsAccepted,
      isCancellationPolicyAccepted: row.isCancellationPolicyAccepted,
      isLiabilityWaiverSigned: row.isLiabilityWaiverSigned,
      source: row.source,
      customerNotes: parsedNotes?.message || (typeof row.customerNotes === "string" ? row.customerNotes : ""),
      timeslotIds: timeslotIds.map(slot => slot.id),
      requestedTimeSlots: timeslotIds.map(({ startTime, endTime }) => ({ startTime, endTime })),
      eventDetails: parsedNotes?.eventDetails,
    },
    timeslotIds: timeslotIds.map(slot => slot.id),
  };
}

export default function ManualBooking({ quoteId = "" }: { quoteId?: string }) {
  const { user, userId } = useCurrentUser();
  const ready = Boolean(userId && user?.userType === "SERVICE_PROVIDER");
  const [selectedQuoteId, setSelectedQuoteId] = useState(quoteId);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const quotes = useOperationListQuery({ resource: "/requestQuote", params: { serviceProvider: userId } }, { skip: !ready });
  const activeQuoteId = quoteId || selectedQuoteId;
  const quote = useOperationRecordQuery(`/requestQuote/${encodeURIComponent(activeQuoteId)}`, { skip: !ready || !activeQuoteId });
  const ownedQuote = quote.data && quote.data.serviceProvider === userId ? quote.data : undefined;
  const invoiceData = useMemo(() => ownedQuote ? invoiceQuoteFromRecord(ownedQuote) : null, [ownedQuote]);

  useEffect(() => {
    if (quoteId && invoiceData) setIsInvoiceOpen(true);
  }, [quoteId, invoiceData]);
  return <Workspace role="provider" title="Prepare an invoice">
    <Message>The platform fee is validated by the server when you submit. If it is unavailable to your account, the server may reject the submission and will return an error.</Message>
    {!quoteId && <section className="mb-5 rounded-xl border bg-white p-6">
      <label className="block font-medium">Quote request
        <select className={`${fieldClass} mt-1`} value={selectedQuoteId} onChange={event => { setSelectedQuoteId(event.target.value); setIsInvoiceOpen(false); }}>
          <option value="">Select a quote request</option>
          {(quotes.data || []).filter(row => row.serviceProvider === userId && !row.booking?.id).map(row => <option key={row.id} value={row.id}>{row.serviceName || row.quoteReference || row.id} · {row.customerId}</option>)}
        </select>
      </label>
      {quotes.isFetching && <Message>Loading quote requests…</Message>}
      {quotes.error && <ApiError error={quotes.error} retry={quotes.refetch} />}
      {!quotes.isFetching && !quotes.error && !(quotes.data || []).some(row => row.serviceProvider === userId && !row.booking?.id) && <Message>No unbooked quote requests are available to prepare an invoice for.</Message>}
    </section>}
    {quote.isFetching && <Message>Loading quote request…</Message>}
    {quote.error && <ApiError error={quote.error} retry={quote.refetch} />}
    {quote.data && !ownedQuote && <Message error>This quote request does not belong to your provider account.</Message>}
    {ownedQuote && !invoiceData && <Message error>This quote is missing required billing address or time-slot details, so an invoice cannot be prepared from it.</Message>}
    {invoiceData && <section className="rounded-xl border bg-white p-6">
      <h2 className="text-xl font-semibold">{ownedQuote?.serviceName || ownedQuote?.quoteReference || "Quote request"}</h2>
      <p className="mt-2 text-sm text-gray-600">Customer: {invoiceData.quote.customerId}</p>
      <p className="text-sm text-gray-600">Requested time slots: {invoiceData.timeslotIds.length}</p>
      <button className={`${buttonClass} mt-4`} onClick={() => setIsInvoiceOpen(true)}>Prepare invoice</button>
    </section>}
    {(quote.error || quotes.error) && <ApiError error={quote.error || quotes.error} />}
    {invoiceData && <GenerateInvoiceModal key={invoiceData.quote.id} isOpen={isInvoiceOpen} onClose={() => setIsInvoiceOpen(false)} initialQuote={invoiceData.quote} timeslotIds={invoiceData.timeslotIds} />}
  </Workspace>;
}
