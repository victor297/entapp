"use client";
import Link from "next/link";
import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOperationListQuery, useOperationRecordQuery } from "@/redux/services/operationsApi";
import { knownQuoteIds, parseQuoteDetails, quoteStatus } from "@/lib/quote-details";
import { filterRecords, money } from "@/lib/operations";
import { Workspace, Message, ApiError, Pager, buttonClass } from "./Workspace";
import RecordFilters, { emptyFilters } from "./RecordFilters";

export default function QuotesPage({ role, serviceType }: { role: "customer" | "provider"; serviceType?: string }) {
  const { user, userId } = useCurrentUser(); const [filters, setFilters] = useState(emptyFilters); const [page, setPage] = useState(1);
  const result = useOperationListQuery({ resource: "/requestQuote", params: { serviceProvider: userId } }, { skip: role !== "provider" || user?.userType !== "SERVICE_PROVIDER" || !userId });
  const rows = filterRecords((result.data || []).filter(row => row.serviceProvider === userId && (!serviceType || row.serviceType === serviceType)), filters);
  return <Workspace role={role} title="Quotes">
    {role === "customer" ? <><Message>Your recent quote links from this browser appear below. Earlier requests cannot be listed safely until the customer quote history API is available.</Message><div className="space-y-3">{userId && knownQuoteIds(userId).map(id => <Link className="block rounded-xl border bg-white p-4 text-blue-800 underline" href={`/quotes/${id}`} key={id}>View quote {id}</Link>)}</div><Link href="/cateringServices/allPost" className={`${buttonClass} mt-5`}>Find a caterer</Link></> : <>
      <RecordFilters filters={filters} rows={result.data || []} onChange={next => { setFilters(next); setPage(1); }} statuses={["GENERATED", "PENDING", "PAID", "PARTIALLY_PAID", "OVERDUE"]} />
      {result.isFetching && <Message>Loading quotes…</Message>}{result.error && <ApiError error={result.error} retry={result.refetch} />}
      {!result.isFetching && !rows.length && !result.error && <Message>No quotes match these filters.</Message>}
      <div className="grid gap-4 sm:grid-cols-2">{rows.slice((page - 1) * 12, page * 12).map(row => { const details = parseQuoteDetails(row.customerNotes); return <article className="rounded-xl border bg-white p-5" key={row.id}><h2 className="text-lg font-semibold">{row.serviceName || row.quoteReference || row.id}</h2><p>{quoteStatus(row.status)}</p><p>Customer reference: {row.customerId}</p><p>Budget: {details ? `${money(details.minBudget)} – ${money(details.maxBudget)}` : row.budget || "Not provided"}</p>{details && <p>{details.guests} guests · {details.eventType} · {details.eventDate}</p>}<Link className="mt-3 inline-block text-blue-800 underline" href={`/provider/quotes/${row.id}`}>Review quote</Link></article>; })}</div><Pager page={page} count={rows.length} onChange={setPage} />
    </>}
  </Workspace>;
}
export function QuoteDetailsPage({ id, role }: { id: string; role: "customer" | "provider" }) {
  const { user, userId } = useCurrentUser(); const result = useOperationRecordQuery(`/requestQuote/${encodeURIComponent(id)}`, { skip: !userId || !user }); const quote = result.data;
  const allowed = quote && (role === "customer" ? quote.customerId === userId : quote.serviceProvider === userId);
  const details = parseQuoteDetails(quote?.customerNotes);
  return <Workspace role={role} title="Quote details">{result.isFetching && <Message>Loading quote…</Message>}{result.error && <ApiError error={result.error} retry={result.refetch} />}{quote && !allowed && <Message error>This quote does not belong to your account.</Message>}{allowed && <>
    <article className="rounded-xl border bg-white p-6"><h2 className="mb-4 text-xl font-semibold">{quote.serviceName || quote.quoteReference || quote.id}</h2><p>Status: {quoteStatus(quote.status)}</p><p>Customer: {role === "customer" ? `${user?.firstName} ${user?.lastName}` : quote.customer?.firstName ? `${quote.customer.firstName} ${quote.customer.lastName || ""}` : `Account ${quote.customerId}`}</p><p>Email: {role === "customer" ? user?.email : quote.customer?.email || "Not supplied by the quote service"}</p><p>Budget: {details ? `${money(details.minBudget)} – ${money(details.maxBudget)}` : quote.budget || "Not provided"}</p><dl className="mt-5 grid gap-4 sm:grid-cols-2">{details ? Object.entries(details).filter(([key]) => !["version", "currency", "minBudget", "maxBudget"].includes(key)).map(([key, value]) => <div key={key}><dt className="font-semibold capitalize">{key.replace(/([A-Z])/g, " $1")}</dt><dd className="whitespace-pre-wrap">{String(value || "Not provided")}</dd></div>) : <div><dt className="font-semibold">Customer notes</dt><dd className="whitespace-pre-wrap">{quote.customerNotes || "Not provided"}</dd></div>}</dl></article>
    {quote.booking?.id ? <Link className={`${buttonClass} mt-5`} href={`/${role === "customer" ? "bookings" : "provider/bookings"}/${quote.booking.id}`}>View booking and invoices</Link> : <><Message>Acceptance, rejection and negotiation will be available when the quote response workflow is enabled. No booking has been created for this quote.</Message>{role === "provider" && <Link className={buttonClass} href={`/provider/manual-booking?quoteId=${quote.id}`}>Prepare booking</Link>}</>}
  </>}</Workspace>;
}
