"use client";
import Link from "next/link";
import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOperationListQuery, useOperationRecordQuery } from "@/redux/services/operationsApi";
import { formatQuoteBudget, parseQuoteDetails, quoteStatus } from "@/lib/quote-details";
import { filterRecords, money } from "@/lib/operations";
import { Workspace, Message, ApiError, Pager, buttonClass } from "./Workspace";
import RecordFilters, { emptyFilters } from "./RecordFilters";

export default function QuotesPage({ role, serviceType }: { role: "customer" | "provider" | "auto"; serviceType?: string }) {
  const { user, userId } = useCurrentUser(); const [filters, setFilters] = useState(emptyFilters); const [page, setPage] = useState(1);
  const activeRole = role === "auto"
    ? user?.userType === "SERVICE_PROVIDER" ? "provider" : user?.userType === "CUSTOMER" ? "customer" : null
    : role;
  const result = useOperationListQuery({ resource: "/requestQuote", params: activeRole === "provider" ? { serviceProvider: userId } : { customerId: userId } }, { skip: !activeRole || !userId });
  const rows = filterRecords((result.data || []).filter(row => (activeRole === "provider" ? row.serviceProvider === userId : row.customerId === userId) && (!serviceType || row.serviceType === serviceType)), filters);
  return <Workspace role={role === "auto" ? "any" : role} title="Quotes">
    {role === "auto" && !activeRole ? <Message error>Quotes are available to customers and service providers.</Message> : <>
      {activeRole === "customer" && <div className="mb-5"><Link href="/cateringServices/allPost" className="text-blue-800 underline">Find a caterer</Link></div>}
      <RecordFilters filters={filters} rows={result.data || []} onChange={next => { setFilters(next); setPage(1); }} statuses={["GENERATED", "PENDING", "PAID", "PARTIALLY_PAID", "OVERDUE"]} />
      {result.isFetching && <Message>Loading quotes…</Message>}{result.error && <ApiError error={result.error} retry={result.refetch} />}
      {!result.isFetching && !rows.length && !result.error && <Message>{activeRole === "customer" ? "You have not requested any quotes yet." : "No quotes match these filters."}</Message>}
      <div className="grid gap-4 sm:grid-cols-2">{rows.slice((page - 1) * 12, page * 12).map(row => { const details = parseQuoteDetails(row.customerNotes); return <article className="rounded-xl border bg-white p-5" key={row.id}><h2 className="text-lg font-semibold">{row.serviceName || row.quoteReference || row.id}</h2><p>{quoteStatus(row.status)}</p>{activeRole === "provider" && <p>Customer reference: {row.customerId}</p>}<p>Budget: {details ? `${money(details.minBudget)} – ${money(details.maxBudget)}` : formatQuoteBudget(row.budget)}</p>{details && <p>{details.guests} guests · {details.eventType} · {details.eventDate}</p>}{row.customerNotes && !details && <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-gray-600">{row.customerNotes}</p>}<Link className="mt-3 inline-block text-blue-800 underline" href={activeRole === "customer" ? `/quotes/${row.id}` : `/provider/quotes/${row.id}`}>{activeRole === "customer" ? "View request" : "Review quote"}</Link></article>; })}</div><Pager page={page} count={rows.length} onChange={setPage} />
    </>}
  </Workspace>;
}
export function QuoteDetailsPage({ id }: { id: string; role: "customer" | "provider" }) {
  const { user, userId } = useCurrentUser(); const result = useOperationRecordQuery(`/requestQuote/${encodeURIComponent(id)}`, { skip: !userId || !user }); const quote = result.data;
  const viewerRole = quote?.customerId === userId ? "customer" : quote?.serviceProvider === userId ? "provider" : null;
  const allowed = Boolean(viewerRole);
  const details = parseQuoteDetails(quote?.customerNotes);
  return <Workspace role="any" title="Quote details">{result.isFetching && <Message>Loading quote…</Message>}{result.error && <ApiError error={result.error} retry={result.refetch} />}{quote && !allowed && <Message error>This quote does not belong to your account.</Message>}{allowed && quote && viewerRole && <>
    <article className="rounded-xl border bg-white p-6"><h2 className="mb-4 text-xl font-semibold">{quote.serviceName || quote.quoteReference || quote.id}</h2><p>Status: {quoteStatus(quote.status)}</p><p>Customer: {viewerRole === "customer" ? `${user?.firstName} ${user?.lastName}` : quote.customer?.firstName ? `${quote.customer.firstName} ${quote.customer.lastName || ""}` : `Account ${quote.customerId}`}</p><p>Email: {viewerRole === "customer" ? user?.email : quote.customer?.email || "Not supplied by the quote service"}</p><p>Budget: {details ? `${money(details.minBudget)} – ${money(details.maxBudget)}` : formatQuoteBudget(quote.budget)}</p><dl className="mt-5 grid gap-4 sm:grid-cols-2">{details ? Object.entries(details).filter(([key]) => !["version", "currency", "minBudget", "maxBudget"].includes(key)).map(([key, value]) => <div key={key}><dt className="font-semibold capitalize">{key.replace(/([A-Z])/g, " $1")}</dt><dd className="whitespace-pre-wrap">{String(value || "Not provided")}</dd></div>) : <div className="sm:col-span-2"><dt className="font-semibold">Customer notes</dt><dd className="whitespace-pre-wrap">{quote.customerNotes || "Not provided"}</dd></div>}</dl></article>
    {quote.booking?.id ? <Link className={`${buttonClass} mt-5`} href={`/${viewerRole === "customer" ? "bookings" : "provider/bookings"}/${quote.booking.id}`}>View booking and invoices</Link> : <><Message>Acceptance, rejection and negotiation will be available when the quote response workflow is enabled. No booking has been created for this quote.</Message>{viewerRole === "provider" && <Link className={buttonClass} href={`/provider/manual-booking?quoteId=${quote.id}`}>Prepare booking</Link>}</>}
  </>}</Workspace>;
}
