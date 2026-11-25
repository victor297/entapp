"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRequestQuoteMutation } from "@/redux/services/quoteApi";
import { useOperationListQuery, useOperationRecordQuery } from "@/redux/services/operationsApi";
import { ApiError, Message, fieldClass, buttonClass } from "./Workspace";
import { serializeQuoteRequestNotes } from "@/lib/quote-details";
import Link from "next/link";

export default function QuoteRequestForm({ isOpen, onClose, serviceId, serviceName, serviceType }: { isOpen: boolean; onClose: () => void; serviceId: string; serviceName: string; serviceType: "EVENTCENTER" | "CATERING" }) {
  const { userId } = useCurrentUser(); const [request, action] = useRequestQuoteMutation(); const [error, setError] = useState<unknown>(); const [quoteId, setQuoteId] = useState("");
  const slots = useOperationListQuery({ resource: "/timeslot", params: { serviceId } }, { skip: !isOpen || !serviceId });
  const listing = useOperationRecordQuery(`/${serviceType === "CATERING" ? "catering" : "event-centers"}/${serviceId}`, { skip: !isOpen });
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [currentMonth, setCurrentMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [budget, setBudget] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [eventDetails, setEventDetails] = useState({
    eventName: "",
    eventType: "",
    eventTheme: "",
    noOfGuest: "",
    description: "",
    cuisine: "",
    dishTypes: "",
    dietaryRequirements: "",
    specialRequests: "",
  });
  const [address, setAddress] = useState({ street: "", city: "", state: "", country: "Nigeria", postal: "" }); const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    setSelected([]);
    setSelectedDate("");
    setBudget("");
    setCustomerNotes("");
    setEventDetails({
      eventName: "",
      eventType: "",
      eventTheme: "",
      noOfGuest: "",
      description: "",
      cuisine: "",
      dishTypes: "",
      dietaryRequirements: "",
      specialRequests: "",
    });
    setAddress({ street: "", city: "", state: "", country: "Nigeria", postal: "" });
    setAccepted(false);
    setQuoteId("");
    setError(undefined);
  }, [isOpen, serviceId]);
  const available = (slots.data || []).filter(slot => slot.isAvailable && !slot.bookingId && Date.parse(slot.startTime) > Date.now());
  const availableDates = [...new Set(available.map(slot => new Date(slot.startTime).toISOString().slice(0, 10)))].sort();
  const availableOnSelectedDate = available.filter(slot => new Date(slot.startTime).toISOString().slice(0, 10) === selectedDate);
  const rawCapacity = listing.data?.sittingCapacity;
  const capacity = typeof rawCapacity === "number" || (typeof rawCapacity === "string" && rawCapacity.trim())
    ? Number(rawCapacity)
    : NaN;

  useEffect(() => {
    const dates = [...new Set((slots.data || [])
      .filter(slot => slot.isAvailable && !slot.bookingId && Date.parse(slot.startTime) > Date.now())
      .map(slot => new Date(slot.startTime).toISOString().slice(0, 10)))].sort();
    if (!isOpen || !dates.length) return;
    const first = new Date(`${dates[0]}T00:00:00`);
    setCurrentMonth(new Date(first.getFullYear(), first.getMonth(), 1));
  }, [isOpen, serviceId, slots.data]);

  function changeMonth(amount: number) {
    setCurrentMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  function toggleSlot(id: string, checked: boolean) {
    setSelected(current => checked ? [...new Set([...current, id])] : current.filter(slotId => slotId !== id));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(undefined);
    try {
      if (!userId) throw new Error("Please sign in to request a quote.");
      if (!selected.length || !accepted) throw new Error("Select available time slots and accept the listing terms.");
      const numericBudget = Number(budget);
      if (!Number.isFinite(numericBudget) || numericBudget <= 0) throw new Error("Enter a valid budget.");
      const noOfGuest = Number(eventDetails.noOfGuest);
      if (!Number.isInteger(noOfGuest) || noOfGuest < 1) throw new Error("Enter the expected number of guests.");
      if (serviceType === "EVENTCENTER" && Number.isFinite(capacity) && noOfGuest > capacity) {
        throw new Error(`This event center can accommodate up to ${capacity} guests.`);
      }
      if (!eventDetails.eventName.trim() || !eventDetails.eventType.trim()) {
        throw new Error("Enter the event name and event type.");
      }
      const response = await request({
        customerId: userId,
        serviceId,
        serviceType,
        timeslotId: selected,
        budget: budget.trim(),
        customerNotes: serializeQuoteRequestNotes(customerNotes.trim(), {
          eventName: eventDetails.eventName.trim(),
          eventType: eventDetails.eventType.trim(),
          eventTheme: eventDetails.eventTheme.trim() || undefined,
          noOfGuest,
          description: eventDetails.description.trim() || undefined,
          cuisine: eventDetails.cuisine.trim() || undefined,
          dishTypes: eventDetails.dishTypes.trim() || undefined,
          dietaryRequirements: eventDetails.dietaryRequirements.trim() || undefined,
          specialRequests: eventDetails.specialRequests.trim() || undefined,
        }),
        billingAddress: address,
        isTermsAccepted: true,
        isCancellationPolicyAccepted: true,
        isLiabilityWaiverSigned: true,
        source: "WEB",
      }).unwrap();
      setQuoteId(response.id);
    } catch (caught) { setError(caught); }
  }
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="quote-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 text-gray-900"><div className="mb-5 flex items-center justify-between gap-4"><h2 id="quote-title" className="text-2xl font-bold">Request a Quote · {serviceName}</h2><button aria-label="Close quote request" disabled={action.isLoading} onClick={onClose}>Close</button></div>{quoteId ? <><Message>Your quote request was submitted.</Message><Link className={buttonClass} href={`/quotes/${quoteId}`}>View request</Link></> : <form onSubmit={submit} className="space-y-5">
    {!userId && <Message error>Please sign in before submitting a request.</Message>}
    <label className="block">Your budget (NGN)
      <input className={`${fieldClass} mt-1`} required type="number" min="0.01" step="0.01" value={budget} onChange={event => setBudget(event.target.value)} />
    </label>
    <fieldset className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
      <legend className="px-1 font-semibold">Event details</legend>
      <label className="block">Event name
        <input className={`${fieldClass} mt-1`} required maxLength={160} value={eventDetails.eventName} onChange={event => setEventDetails({ ...eventDetails, eventName: event.target.value })} placeholder="e.g. Ama's wedding" />
      </label>
      <label className="block">Event type / occasion
        <input className={`${fieldClass} mt-1`} required maxLength={120} value={eventDetails.eventType} onChange={event => setEventDetails({ ...eventDetails, eventType: event.target.value })} placeholder="e.g. wedding, birthday, conference" />
      </label>
      <label className="block">Expected guests
        <input className={`${fieldClass} mt-1`} required type="number" min="1" max={serviceType === "EVENTCENTER" && Number.isFinite(capacity) && capacity > 0 ? capacity : undefined} step="1" value={eventDetails.noOfGuest} onChange={event => setEventDetails({ ...eventDetails, noOfGuest: event.target.value })} />
        {serviceType === "EVENTCENTER" && listing.data?.sittingCapacity && <span className="text-sm text-gray-600">Capacity: {listing.data.sittingCapacity} guests</span>}
      </label>
      <label className="block">Event theme (optional)
        <input className={`${fieldClass} mt-1`} maxLength={160} value={eventDetails.eventTheme} onChange={event => setEventDetails({ ...eventDetails, eventTheme: event.target.value })} />
      </label>
      {serviceType === "CATERING" && <>
        <label className="block">Cuisine preference (optional)
          <input className={`${fieldClass} mt-1`} maxLength={300} value={eventDetails.cuisine} onChange={event => setEventDetails({ ...eventDetails, cuisine: event.target.value })} placeholder="e.g. Nigerian, continental" />
        </label>
        <label className="block">Dishes / menu requested (optional)
          <input className={`${fieldClass} mt-1`} maxLength={500} value={eventDetails.dishTypes} onChange={event => setEventDetails({ ...eventDetails, dishTypes: event.target.value })} placeholder="Tell the caterer what you have in mind" />
        </label>
        <label className="block sm:col-span-2">Dietary needs or allergies (optional)
          <textarea className={`${fieldClass} mt-1 min-h-20`} maxLength={1000} value={eventDetails.dietaryRequirements} onChange={event => setEventDetails({ ...eventDetails, dietaryRequirements: event.target.value })} />
        </label>
      </>}
      <label className="block sm:col-span-2">Describe what you need (optional)
        <textarea className={`${fieldClass} mt-1 min-h-24`} maxLength={2000} value={eventDetails.description} onChange={event => setEventDetails({ ...eventDetails, description: event.target.value })} placeholder="Share event plans or service details the provider should consider." />
      </label>
      <label className="block sm:col-span-2">Other special requests (optional)
        <textarea className={`${fieldClass} mt-1 min-h-20`} maxLength={1000} value={eventDetails.specialRequests} onChange={event => setEventDetails({ ...eventDetails, specialRequests: event.target.value })} placeholder="For example, staffing, equipment, accessibility or setup needs." />
      </label>
    </fieldset>
    <label className="block">
      Additional message to the provider (optional)
      <textarea
        className={`${fieldClass} mt-1 min-h-28`}
        maxLength={2000}
        placeholder="Share any other details that will help the provider prepare a quote."
        value={customerNotes}
        onChange={event => setCustomerNotes(event.target.value)}
      />
    </label>
    <fieldset className="rounded-xl border p-4">
      <legend className="px-1 font-semibold">Available dates and time slots</legend>
      {slots.isFetching && <Message>Loading available dates…</Message>}
      {slots.error && <ApiError error={slots.error} retry={slots.refetch} />}
      {!slots.isFetching && !slots.error && !available.length && <Message>No future time slots are currently available.</Message>}
      {available.length > 0 && <>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" className="rounded border px-3 py-1" aria-label="Previous month" onClick={() => changeMonth(-1)}>Previous</button>
          <span className="font-medium">{currentMonth.toLocaleString("en", { month: "long", year: "numeric" })}</span>
          <button type="button" className="rounded border px-3 py-1" aria-label="Next month" onClick={() => changeMonth(1)}>Next</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-gray-500" aria-hidden="true">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => <span className="py-0.5" key={day}>{day}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }, (_, index) => <span key={`empty-${index}`} />)}
          {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }, (_, index) => {
            const day = index + 1;
            const dateKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasAvailability = availableDates.includes(dateKey);
            const isSelected = selectedDate === dateKey;
            return <button key={dateKey} type="button" disabled={!hasAvailability} aria-pressed={isSelected} aria-label={`${dateKey}${hasAvailability ? ", available" : ", unavailable"}`} onClick={() => setSelectedDate(dateKey)} className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-sm ${isSelected ? "bg-blue-700 text-white" : hasAvailability ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100" : "cursor-not-allowed text-gray-300"}`}>
              {day}{hasAvailability && !isSelected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-600" />}
            </button>;
          })}
        </div>
        {selectedDate && <div className="mt-4 border-t pt-4">
          <h3 className="font-medium">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {availableOnSelectedDate.map(slot => <label key={slot.id} className="flex items-start gap-2 rounded-lg border p-2 text-sm">
            <input type="checkbox" checked={selected.includes(slot.id)} onChange={event => toggleSlot(slot.id, event.target.checked)} />
            <span>{new Date(slot.startTime).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })} – {new Date(slot.endTime).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}</span>
          </label>)}
          </div>
        </div>}
        <p className="mt-3 text-sm text-gray-600" aria-live="polite">{selected.length} time slot{selected.length === 1 ? "" : "s"} selected</p>
      </>}
    </fieldset>
    <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="mb-3 font-semibold">Billing address</legend>{Object.entries(address).map(([key,value]) => <label className="capitalize" key={key}>{key}<input className={fieldClass} required maxLength={200} value={value} onChange={e => setAddress({ ...address, [key]: e.target.value })} /></label>)}</fieldset>
    <section className="rounded-lg bg-gray-50 p-4"><h3 className="font-semibold">Terms and cancellation policy</h3><p className="whitespace-pre-wrap">{listing.data?.termsOfUse || "Terms were not returned for this listing."}</p><p className="mt-3 whitespace-pre-wrap">{listing.data?.cancellationPolicy || "Ask the provider for their cancellation policy."}</p></section>
    <label className="flex items-start gap-3"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} />I accept the listing terms, cancellation policy and liability waiver.</label>
    {Boolean(error) && <ApiError error={error} />}<button className={buttonClass} disabled={action.isLoading || !userId || !selected.length}>{action.isLoading ? "Submitting…" : "Submit quote request"}</button>
  </form>}</section></div>;
}
