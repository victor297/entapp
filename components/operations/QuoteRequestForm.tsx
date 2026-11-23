"use client";
import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRequestQuoteMutation } from "@/redux/services/quoteApi";
import { useOperationListQuery, useOperationRecordQuery } from "@/redux/services/operationsApi";
import { rememberQuote, type QuoteDetails } from "@/lib/quote-details";
import { ApiError, Message, fieldClass, buttonClass } from "./Workspace";
import Link from "next/link";

export default function QuoteRequestForm({ isOpen, onClose, serviceId, serviceName, serviceType }: { isOpen: boolean; onClose: () => void; serviceId: string; serviceName: string; serviceType: "EVENTCENTER" | "CATERING" }) {
  const { userId } = useCurrentUser(); const [request, action] = useRequestQuoteMutation(); const [error, setError] = useState<unknown>(); const [quoteId, setQuoteId] = useState("");
  const slots = useOperationListQuery({ resource: "/timeslot", params: { serviceId } }, { skip: !isOpen || !serviceId });
  const listing = useOperationRecordQuery(`/${serviceType === "CATERING" ? "catering" : "event-centers"}/${serviceId}`, { skip: !isOpen });
  const [selected, setSelected] = useState<string[]>([]);
  const [details, setDetails] = useState<QuoteDetails>({ version: 1, minBudget: 0, maxBudget: 0, currency: "NGN", eventDate: "", guests: 1, eventType: "", menu: "", dietary: "", allergies: "", drinks: "", staffing: "", equipment: "", notes: "" });
  const [address, setAddress] = useState({ street: "", city: "", state: "", country: "Nigeria", postal: "" }); const [accepted, setAccepted] = useState(false);
  const available = (slots.data || []).filter(slot => slot.isAvailable && !slot.bookingId && Date.parse(slot.startTime) > Date.now());
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(undefined);
    try {
      if (!userId) throw new Error("Please sign in to request a quote.");
      if (!selected.length || !accepted) throw new Error("Select available time slots and accept the listing terms.");
      if (details.minBudget < 0 || details.maxBudget <= 0 || details.maxBudget < details.minBudget) throw new Error("Enter a valid minimum and maximum budget.");
      const response = await request({ customerId: userId, serviceId, serviceType, timeslotId: selected, budget: `${details.minBudget}-${details.maxBudget}`, customerNotes: JSON.stringify(details), billingAddress: address, isTermsAccepted: true, isCancellationPolicyAccepted: true, isLiabilityWaiverSigned: true, source: "WEB" }).unwrap();
      rememberQuote(userId, response.id); setQuoteId(response.id);
    } catch (caught) { setError(caught); }
  }
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="quote-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 text-gray-900"><div className="mb-5 flex items-center justify-between gap-4"><h2 id="quote-title" className="text-2xl font-bold">Request a Quote · {serviceName}</h2><button aria-label="Close quote request" disabled={action.isLoading} onClick={onClose}>Close</button></div>{quoteId ? <><Message>Your quote request was submitted.</Message><Link className={buttonClass} href={`/quotes/${quoteId}`}>View request</Link></> : <form onSubmit={submit} className="space-y-5">
    {!userId && <Message error>Please sign in before submitting a request.</Message>}
    <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="mb-3 font-semibold">Event and budget</legend>{([['minBudget','Minimum budget (NGN)','number'],['maxBudget','Maximum budget (NGN)','number'],['eventDate','Event date','date'],['guests','Number of guests','number'],['eventType','Event type','text']] as const).map(([key,label,type]) => <label key={key}>{label}<input className={fieldClass} required type={type} min={key === 'guests' ? 1 : type === 'number' ? 0 : type === 'date' ? new Date().toISOString().slice(0,10) : undefined} step={key === 'guests' ? 1 : type === 'number' ? '0.01' : undefined} value={details[key]} onChange={e => setDetails({ ...details, [key]: type === 'number' ? Number(e.target.value) : e.target.value })} /></label>)}</fieldset>
    <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="mb-3 font-semibold">Service requirements</legend>{([['menu','Menu / food requirements'],['dietary','Dietary restrictions'],['allergies','Allergies'],['drinks','Drinks'],['staffing','Staffing requirements'],['equipment','Equipment'],['notes','Other details']] as const).map(([key,label]) => <label key={key}>{label}<textarea maxLength={1500} className={fieldClass} value={details[key]} onChange={e => setDetails({ ...details, [key]: e.target.value })} /></label>)}</fieldset>
    <fieldset><legend className="mb-3 font-semibold">Available time slots</legend>{slots.isFetching && <Message>Loading available dates…</Message>}{slots.error && <ApiError error={slots.error} retry={slots.refetch} />}<div className="max-h-52 space-y-2 overflow-y-auto">{available.map(slot => <label key={slot.id} className="flex gap-3"><input type="checkbox" checked={selected.includes(slot.id)} onChange={e => setSelected(e.target.checked ? [...selected, slot.id] : selected.filter(id => id !== slot.id))} />{new Date(slot.startTime).toLocaleString("en-GB")} – {new Date(slot.endTime).toLocaleString("en-GB")}</label>)}</div>{!slots.isFetching && !slots.error && !available.length && <Message>No future time slots are currently available.</Message>}</fieldset>
    <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="mb-3 font-semibold">Billing address</legend>{Object.entries(address).map(([key,value]) => <label className="capitalize" key={key}>{key}<input className={fieldClass} required maxLength={200} value={value} onChange={e => setAddress({ ...address, [key]: e.target.value })} /></label>)}</fieldset>
    <section className="rounded-lg bg-gray-50 p-4"><h3 className="font-semibold">Terms and cancellation policy</h3><p className="whitespace-pre-wrap">{listing.data?.termsOfUse || "Terms were not returned for this listing."}</p><p className="mt-3 whitespace-pre-wrap">{listing.data?.cancellationPolicy || "Ask the provider for their cancellation policy."}</p></section>
    <label className="flex items-start gap-3"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} />I accept the listing terms, cancellation policy and liability waiver.</label>
    {Boolean(error) && <ApiError error={error} />}<button className={buttonClass} disabled={action.isLoading || !userId || !selected.length}>{action.isLoading ? "Submitting…" : "Submit quote request"}</button>
  </form>}</section></div>;
}
