"use client";
import { useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOperationRecordQuery, useOperationListQuery, useOperationMutationMutation } from "@/redux/services/operationsApi";
import { bookingPaymentSummary, bookingStatus, paymentStatus, money } from "@/lib/operations";
import { Workspace, Message, ApiError, fieldClass, buttonClass } from "./Workspace";
export default function BookingDetails({ id, role }: { id: string; role: "admin" | "provider" | "customer" }) {
  const { userId, user } = useCurrentUser(); const ready = Boolean(userId && user);
  const booking = useOperationRecordQuery(`/booking/${encodeURIComponent(id)}`, { skip: !ready });
  const row = booking.data; const allowed = row && (role === "admin" ? user?.userType === "ADMIN" : role === "provider" ? user?.userType === "SERVICE_PROVIDER" && row.serviceProvider === userId : row.customerId === userId);
  const invoices = useOperationListQuery({ resource: "/invoice", params: { bookingId: id } }, { skip: !allowed });
  const listing = useOperationRecordQuery(`/${row?.serviceType === "CATERING" ? "catering" : "event-centers"}/${row?.serviceId}`, { skip: !allowed });
  const policy = useOperationRecordQuery(`/${row?.serviceType === "CATERING" ? "catering" : "event-centers"}/${row?.serviceId}/refund-policy`, { skip: !allowed });
  const [mutate, action] = useOperationMutationMutation(); const [confirm, setConfirm] = useState(false); const [notes, setNotes] = useState<string | null>(null); const [message, setMessage] = useState(""); const [error, setError] = useState<unknown>();
  const paymentSummary = row ? bookingPaymentSummary(row, invoices.data ?? []) : undefined;
  async function update(body: unknown) { setError(undefined); setMessage(""); try { await mutate({ url: `/booking/${id}`, method: "PATCH", body }).unwrap(); setConfirm(false); setNotes(null); setMessage("Booking updated."); booking.refetch(); } catch (caught) { setError(caught); } }
  const mutable = row && !["CANCELED", "CANCELLED", "COMPLETED"].includes(row.status);
  return <Workspace role={role} title="Booking details">
    {booking.isFetching && <Message>Loading booking…</Message>}{booking.error && <ApiError error={booking.error} retry={booking.refetch} />}
    {row && !allowed && <Message error>This booking does not belong to your account.</Message>}
    {allowed && <>
      <div className="grid gap-4 rounded-xl border bg-white p-6 sm:grid-cols-2"><p>Reference: <strong>{row.bookingReference || row.id}</strong></p><p>Listing: {row.serviceName || row.serviceId}</p><p>Status: <strong>{bookingStatus(row.status)}</strong></p><p>Payment: {paymentStatus(paymentSummary?.paymentStatus)}</p><p>Total: <strong>{money(row.total, row.currency)}</strong></p><p className="sm:col-span-2">{role === "customer" ? row.customerNotes : row.serviceNotes}</p><p className="sm:col-span-2">Dates: {[...(row.confirmedTimeSlots ?? []), ...(row.requestedTimeSlots ?? [])].map(slot => `${new Date(slot.startTime).toLocaleString("en-GB")} – ${new Date(slot.endTime).toLocaleTimeString("en-GB")}`).join("; ") || "No dates returned by the server."}</p></div>
      {message && <Message>{message}</Message>}{Boolean(error) && <ApiError error={error} />}
      <section className="my-6 rounded-xl border bg-white p-6"><h2 className="mb-3 text-xl font-semibold">Invoices and outstanding payments</h2>{invoices.isFetching && <Message>Loading invoices…</Message>}{invoices.error && <ApiError error={invoices.error} retry={invoices.refetch} />}{invoices.data?.map(invoice => <div className="flex flex-wrap items-center justify-between gap-3 border-b py-4" key={invoice.id}><div><strong>{invoice.reference || invoice.id}</strong><p>{paymentStatus(invoice.status)} · Invoice amount: {money(invoice.amountDue, invoice.currency)}</p></div>{role === "customer" && !["PAID", "OVER_PAID"].includes(invoice.status) && <Link className={buttonClass} href={`/customer/payments?invoiceId=${invoice.id}`}>Pay invoice</Link>}</div>)}{invoices.data?.length === 0 && <Message>No invoices returned for this booking.</Message>}{role === "customer" && paymentSummary?.allInvoicesPaid && paymentSummary.balance > 0 && <Message>All current invoices are paid. The remaining booking balance is {money(paymentSummary.balance, row.currency)}. Your provider must issue a balance invoice before you can pay it; it will appear here with a Pay invoice button.</Message>}{role === "provider" && paymentSummary?.allInvoicesPaid && paymentSummary.balance > 0 ? <BalanceInvoice bookingId={id} balance={paymentSummary.balance} currency={row.currency} /> : role === "provider" && paymentSummary?.allInvoicesPaid && paymentSummary.balance === 0 ? <Message>The booking total is fully paid.</Message> : role === "provider" ? <p className="mt-4 text-sm text-gray-600">The customer must pay all current invoices before a balance invoice can be issued.</p> : null}</section>
      <section className="my-6 rounded-xl border bg-white p-6">
        <h2 className="mb-3 text-xl font-semibold">Cancellation and refund policy</h2>
        {listing.isFetching && <Message>Loading cancellation terms…</Message>}
        {listing.error && <ApiError error={listing.error} retry={listing.refetch} />}
        {listing.data && (
          <p className="whitespace-pre-line">
            {listing.data.cancellationPolicy || "No cancellation terms were provided. Contact the provider."}
          </p>
        )}
        {policy.isFetching && <Message>Loading refund policy…</Message>}
        {policy.error && <ApiError error={policy.error} retry={policy.refetch} />}
        {policy.data && (
          policy.data.allowRefunds ? (
            <div className="mt-3">
              <p>
                Refunds must be requested at least {policy.data.refundWindowDays} days before the event.
              </p>
              {policy.data.tiers?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  {policy.data.tiers.map((tier: {
                    id?: string;
                    minDaysBeforeEvent: number;
                    deductionPercentage: number;
                    description?: string;
                  }, index: number) => (
                    <li key={tier.id ?? index}>
                      At least {tier.minDaysBeforeEvent} days before the event: {tier.deductionPercentage}% deducted.
                      {tier.description ? ` ${tier.description}` : ""}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2">No tiered refund deductions are specified.</p>}
            </div>
          ) : (
            <p className="mt-3">Refunds are not offered for this service.</p>
          )
        )}
        {!policy.isFetching && !policy.error && !policy.data && (
          <p className="mt-3">No refund policy has been published for this service.</p>
        )}
        <p className="mt-3 text-sm text-gray-600">
          A refund amount must be confirmed by the provider. Cancelling here does not confirm a refund or reschedule availability.
        </p>
      </section>
      {mutable && <div className="flex flex-wrap gap-3"><button className={buttonClass} onClick={() => setNotes(role === "customer" ? row.customerNotes || "" : row.serviceNotes || "")}>Edit notes</button><button className="rounded-lg border border-red-300 px-4 py-2 text-red-800" disabled={listing.isFetching || Boolean(listing.error) || !listing.data} onClick={() => setConfirm(true)}>Cancel booking</button></div>}
      {notes !== null && <form className="my-5 rounded-xl border bg-white p-5" onSubmit={event => { event.preventDefault(); update({ [role === "customer" ? "customerNotes" : "serviceNotes"]: notes }); }}><label>Booking notes<textarea className={fieldClass} value={notes} onChange={event => setNotes(event.target.value)} maxLength={5000} /></label><div className="mt-3 flex gap-3"><button disabled={action.isLoading} className={buttonClass}>Save notes</button><button type="button" onClick={() => setNotes(null)}>Close</button></div></form>}
      {confirm && <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-w-lg rounded-xl bg-white p-6"><h2 id="cancel-title" className="text-xl font-semibold">Cancel this booking?</h2><p className="my-4 whitespace-pre-line">{listing.data?.cancellationPolicy || "Contact the provider about cancellation terms."}</p><p className="my-4">This changes the booking to Cancelled. Any refund needs a separate review.</p><div className="flex gap-4"><button disabled={action.isLoading} className={buttonClass} onClick={() => update({ status: "CANCELED", cancelledBy: userId })}>Confirm cancellation</button><button disabled={action.isLoading} onClick={() => setConfirm(false)}>Keep booking</button></div></div></div>}
      <Message>Date rescheduling is currently unavailable. Contact the provider to arrange a change.</Message>
      {role === "customer" && <Link className="font-medium text-blue-800 underline" href={`/customer/disputes?bookingId=${id}`}>Get help with a payment dispute</Link>}
    </>}
  </Workspace>;
}
function BalanceInvoice({ bookingId, balance, currency }: { bookingId: string; balance: number; currency: string }) {
  const [date, setDate] = useState(""); const [confirm, setConfirm] = useState(false); const [error, setError] = useState<unknown>(); const [message, setMessage] = useState(""); const [mutate, action] = useOperationMutationMutation();
  return <form className="mt-5 space-y-3" onSubmit={async event => { event.preventDefault(); if (!confirm) { setConfirm(true); return; } try { const response = await mutate({ url: "/invoice/create-invoice", method: "POST", body: { bookingId, dueDate: new Date(`${date}T12:00:00Z`).toISOString(), note: "Outstanding booking balance" } }).unwrap(); setConfirm(false); setMessage(`Balance invoice created for ${money(response.amountDue, response.currency)}. It is now listed above for the customer to pay.`); } catch (caught) { setError(caught); } }}><h3 className="font-semibold">Create balance invoice</h3><p>Remaining balance: {money(balance, currency)}</p><label>Due date<input type="date" required min={new Date().toISOString().slice(0,10)} value={date} onChange={e => { setDate(e.target.value); setConfirm(false); }} className={fieldClass} /></label>{confirm && <Message>Create a balance invoice using the amount calculated by the server?</Message>}<button className={buttonClass} disabled={action.isLoading}>{confirm ? "Confirm balance invoice" : "Create balance invoice"}</button>{Boolean(error) && <ApiError error={error} />}{message && <Message>{message}</Message>}</form>;
}
