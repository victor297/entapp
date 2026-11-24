"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useOperationListQuery,
  useOperationMutationMutation,
} from "@/redux/services/operationsApi";
import {
  ApiError,
  buttonClass,
  fieldClass,
  Message,
  Workspace,
} from "./Workspace";
import type { ApiRecord } from "@/lib/operations";
import {
  addCalendarMonths,
  findOverlappingSlots,
  generateWeeklySlots,
  WEEKDAYS,
  type DayAvailability,
} from "@/lib/time-slot-schedule";

type ServiceListing = ApiRecord & { type: "EVENTCENTER" | "CATERING" };

function currentLocalDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function AvailabilityPage({
  initialServiceId = "",
}: {
  initialServiceId?: string;
}) {
  const { userId, user } = useCurrentUser();
  const ready = Boolean(
    userId && user?.userType === "SERVICE_PROVIDER",
  );
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [editing, setEditing] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [createMode, setCreateMode] = useState<"single" | "weekly">("weekly");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [useSharedHours, setUseSharedHours] = useState(true);
  const [sharedHours, setSharedHours] = useState({ start: "09:00", end: "17:00" });
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(60);
  const [gapMinutes, setGapMinutes] = useState(0);
  const [days, setDays] = useState<Record<number, DayAvailability>>(
    Object.fromEntries(WEEKDAYS.map(({ day }) => [day, { enabled: false, start: "09:00", end: "17:00" }]))
  );
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<ApiRecord | null>(null);
  const [slotToDelete, setSlotToDelete] = useState<ApiRecord | null>(null);

  const venues = useOperationListQuery(
    { resource: "/event-centers", params: { serviceProvider: userId } },
    { skip: !ready },
  );
  const catering = useOperationListQuery(
    { resource: "/catering", params: { serviceProvider: userId } },
    { skip: !ready },
  );
  const services: ServiceListing[] = [
    ...(venues.data || [])
      .filter((row) => row.serviceProviderId === userId)
      .map((row) => ({ ...row, type: "EVENTCENTER" as const })),
    ...(catering.data || [])
      .filter((row) => row.serviceProviderId === userId)
      .map((row) => ({ ...row, type: "CATERING" as const })),
  ];
  const listingCreationLinks = [
    {
      label: "Create an event center",
      href: "/eventServiceManagement/add-event-center",
    },
    {
      label: "Create a catering service",
      href: "/cateringServiceManagement/add-catering-services",
    },
  ];
  const service = services.find((row) => row.id === serviceId);
  const slots = useOperationListQuery(
    { resource: "/timeslot", params: { serviceId } },
    { skip: !ready || !service },
  );
  const [mutate, action] = useOperationMutationMutation();
  const visibleSlots = (slots.data || []).filter((slot) => !slot.deletedAt);
  const latestPeriodDate = periodStart ? addCalendarMonths(periodStart, 6) : "";
  const generatedSlots = useMemo(() => {
    if (!periodStart || !periodEnd) return [];
    try {
      return generateWeeklySlots({
        startDate: periodStart,
        endDate: periodEnd,
        days,
        sharedHours,
        useSharedHours,
        slotDurationMinutes,
        gapMinutes,
      });
    } catch {
      return [];
    }
  }, [periodStart, periodEnd, days, sharedHours, useSharedHours, slotDurationMinutes, gapMinutes]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setNotice("");

    try {
      if (!service) throw new Error("Select a listing you own.");
      if (!editing && createMode === "weekly") {
        const toCreate = generateWeeklySlots({
          startDate: periodStart,
          endDate: periodEnd,
          days,
          sharedHours,
          useSharedHours,
          slotDurationMinutes,
          gapMinutes,
        });
        const existingSlots = (slots.data || []).map((slot) => ({
          startTime: String(slot.startTime),
          endTime: String(slot.endTime),
          deletedAt: typeof slot.deletedAt === "string" ? slot.deletedAt : null,
        }));
        const overlaps = findOverlappingSlots(toCreate, existingSlots);
        if (overlaps.length) {
          throw new Error(`${overlaps.length} generated slot${overlaps.length === 1 ? "" : "s"} overlap existing availability. Change the schedule or remove the conflicting slots first.`);
        }
        await mutate({
          url: "/timeslot",
          method: "POST",
          body: {
            serviceId,
            serviceType: service.type,
            createdBy: userId,
            slots: toCreate,
          },
        }).unwrap();
        await slots.refetch();
        setPeriodStart("");
        setPeriodEnd("");
        setNotice(`${toCreate.length} time slot${toCreate.length === 1 ? "" : "s"} created.`);
        return;
      }

      const startTime = new Date(start).toISOString();
      const endTime = new Date(end).toISOString();
      if (
        Date.parse(startTime) <= Date.now() ||
        Date.parse(endTime) <= Date.parse(startTime)
      ) {
        throw new Error(
          "Choose a future start and an end after the start.",
        );
      }
      if (
        (slots.data || []).some(
          (slot) =>
            slot.id !== editing &&
            !slot.deletedAt &&
            Date.parse(slot.startTime) < Date.parse(endTime) &&
            Date.parse(slot.endTime) > Date.parse(startTime),
        )
      ) {
        throw new Error("This time overlaps an existing slot.");
      }

      await mutate({
        url: editing ? `/timeslot/${editing}` : "/timeslot",
        method: editing ? "PATCH" : "POST",
        body: editing
          ? { startTime, endTime, updatedBy: userId }
          : {
              serviceId,
              serviceType: service.type,
              createdBy: userId,
              slots: [{ startTime, endTime }],
            },
      }).unwrap();
      await slots.refetch();
      setEditing("");
      setStart("");
      setEnd("");
      setNotice(editing ? "Time slot updated." : "Availability saved.");
    } catch (caught) {
      setError(caught);
    }
  }

  async function confirmDelete() {
    if (!slotToDelete) return;
    setError(undefined);
    setNotice("");

    try {
      await mutate({
        url: `/timeslot/${slotToDelete.id}`,
        method: "DELETE",
      }).unwrap();
      await slots.refetch();
      if (selectedSlot?.id === slotToDelete.id) setSelectedSlot(null);
      setNotice("Time slot deleted.");
      setSlotToDelete(null);
    } catch (caught) {
      setError(caught);
    }
  }

  function localDate(value: string) {
    const date = new Date(value);
    return new Date(
      date.getTime() - date.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 16);
  }

  function editSlot(slot: ApiRecord) {
    setEditing(slot.id);
    setStart(localDate(slot.startTime));
    setEnd(localDate(slot.endTime));
    setSelectedSlot(null);
    setError(undefined);
    setNotice("");
  }

  return (
    <Workspace role="provider" title="Create and manage time slots">
      <p className="mb-5 text-gray-600">
        Choose a listing to create a weekly schedule for a date range or add a
        single slot. Weekly schedules can cover up to six months.
      </p>

      {(venues.error || catering.error) && (
        <ApiError error={venues.error || catering.error} />
      )}

      {!venues.error &&
        !catering.error &&
        !venues.isFetching &&
        !catering.isFetching &&
        services.length === 0 && (
          <Message>
            <span className="block font-semibold">
              Create a listing before adding time slots.
            </span>
            <span className="mt-1 block">
              Time slots belong to a listing, so first add your event center or
              catering service. Once it’s created, come back here to set its
              availability.
            </span>
            <span className="mt-4 flex flex-wrap gap-3">
              {listingCreationLinks.map((link) => (
                <Link
                  className={buttonClass}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </span>
          </Message>
        )}

      {services.length > 0 && (
        <>
          <label>
            Select your listing
            <select
              className={fieldClass}
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
                setEditing("");
                setStart("");
                setEnd("");
                setPeriodStart("");
                setPeriodEnd("");
                setError(undefined);
                setNotice("");
              }}
            >
              <option value="">Select a listing</option>
              {services.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name || row.id} · {row.type}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {service && (
        <>
          {!editing && (
            <div className="my-6 flex flex-wrap gap-2" aria-label="Availability creation mode">
              <button type="button" className={`${createMode === "weekly" ? buttonClass : "rounded-lg border px-4 py-2.5 text-sm"}`} onClick={() => { setCreateMode("weekly"); setError(undefined); setNotice(""); }}>Weekly schedule</button>
              <button type="button" className={`${createMode === "single" ? buttonClass : "rounded-lg border px-4 py-2.5 text-sm"}`} onClick={() => { setCreateMode("single"); setError(undefined); setNotice(""); }}>Single slot</button>
            </div>
          )}

          {(editing || createMode === "single") && <form
            className="my-6 grid gap-4 rounded-xl border bg-white p-6 sm:grid-cols-2"
            onSubmit={submit}
          >
            <h2 className="text-xl font-semibold sm:col-span-2">
              {editing ? "Edit available slot" : "Add availability"}
            </h2>
            <label>
              Start (your local time)
              <input
                required
                className={fieldClass}
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </label>
            <label>
              End (your local time)
              <input
                required
                className={fieldClass}
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </label>
            <div className="flex gap-4">
              <button
                className={buttonClass}
                disabled={
                  action.isLoading ||
                  slots.isFetching ||
                  Boolean(slots.error)
                }
              >
                {action.isLoading
                  ? "Saving…"
                  : editing
                    ? "Update slot"
                    : "Save slot"}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing("");
                    setStart("");
                    setEnd("");
                  }}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>}

          {!editing && createMode === "weekly" && <form className="my-6 space-y-5 rounded-xl border bg-white p-6" onSubmit={submit}>
            <div>
              <h2 className="text-xl font-semibold">Create a weekly availability schedule</h2>
              <p className="mt-1 text-sm text-gray-600">Choose a date range (up to six months), select the days and hours you’re available, and we’ll create the individual slots.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>Start date
                <input required type="date" className={fieldClass} value={periodStart} min={currentLocalDate()} onChange={(event) => {
                  const value = event.target.value;
                  setPeriodStart(value);
                  if (periodEnd && value && periodEnd > addCalendarMonths(value, 6)) setPeriodEnd("");
                }} />
              </label>
              <label>End date (inclusive)
                <input required type="date" className={fieldClass} value={periodEnd} min={periodStart || undefined} max={latestPeriodDate || undefined} onChange={(event) => setPeriodEnd(event.target.value)} />
              </label>
            </div>
            <fieldset>
              <legend className="mb-2 font-semibold">Hours for selected days</legend>
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2"><input type="radio" name="hours-mode" checked={useSharedHours} onChange={() => setUseSharedHours(true)} /> Same hours for all selected days</label>
                <label className="flex items-center gap-2"><input type="radio" name="hours-mode" checked={!useSharedHours} onChange={() => setUseSharedHours(false)} /> Different hours for each day</label>
              </div>
            </fieldset>
            {useSharedHours && <div className="grid gap-4 sm:grid-cols-2">
              <label>Daily start time<input required type="time" className={fieldClass} value={sharedHours.start} onChange={(event) => setSharedHours({ ...sharedHours, start: event.target.value })} /></label>
              <label>Daily end time<input required type="time" className={fieldClass} value={sharedHours.end} onChange={(event) => setSharedHours({ ...sharedHours, end: event.target.value })} /></label>
            </div>}
            <fieldset className="space-y-3">
              <legend className="mb-2 font-semibold">Available days</legend>
              {WEEKDAYS.map(({ label, day }) => <div key={day} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(150px,1fr)_1fr_1fr] sm:items-center">
                <label className="flex items-center gap-2"><input type="checkbox" checked={days[day].enabled} onChange={(event) => setDays({ ...days, [day]: { ...days[day], enabled: event.target.checked } })} />{label}</label>
                {!useSharedHours && <>
                  <label className="text-sm">From<input disabled={!days[day].enabled} type="time" className={fieldClass} value={days[day].start} onChange={(event) => setDays({ ...days, [day]: { ...days[day], start: event.target.value } })} /></label>
                  <label className="text-sm">To<input disabled={!days[day].enabled} type="time" className={fieldClass} value={days[day].end} onChange={(event) => setDays({ ...days, [day]: { ...days[day], end: event.target.value } })} /></label>
                </>}
              </div>)}
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>Slot length (minutes)<input required type="number" min="1" step="1" className={fieldClass} value={slotDurationMinutes} onChange={(event) => setSlotDurationMinutes(Number(event.target.value))} /></label>
              <label>Gap between slots (minutes)<input required type="number" min="0" step="1" className={fieldClass} value={gapMinutes} onChange={(event) => setGapMinutes(Number(event.target.value))} /></label>
            </div>
            <p className="text-sm text-gray-600" aria-live="polite">
              {generatedSlots.length
                ? `${generatedSlots.length} slot${generatedSlots.length === 1 ? "" : "s"} will be created.`
                : "Select your dates, days, and valid hours to preview the number of slots."}
            </p>
            <button className={buttonClass} disabled={action.isLoading || slots.isFetching || Boolean(slots.error) || generatedSlots.length === 0}>
              {action.isLoading ? "Creating slots…" : "Create weekly availability"}
            </button>
          </form>}

          {Boolean(error) && <ApiError error={error} />}
          {notice && <Message>{notice}</Message>}
          {slots.isFetching && <Message>Loading availability…</Message>}
          {slots.error && (
            <ApiError error={slots.error} retry={slots.refetch} />
          )}

          <div className="space-y-3">
            {visibleSlots.map((slot) => {
              const isAvailable = slot.isAvailable && !slot.bookingId;
              const canChange =
                isAvailable && Date.parse(slot.startTime) > Date.now();

              return (
                <article
                  key={slot.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"
                >
                  <div>
                    <p className="font-medium">
                      {new Date(slot.startTime).toLocaleString("en-GB")} –{" "}
                      {new Date(slot.endTime).toLocaleString("en-GB")}
                    </p>
                    <span
                      className={
                        isAvailable
                          ? "text-sm font-medium text-green-700"
                          : "text-sm font-medium text-amber-700"
                      }
                    >
                      {isAvailable ? "Available" : "Reserved"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="text-blue-800 underline"
                      onClick={() => setSelectedSlot(slot)}
                    >
                      View details
                    </button>
                    {canChange && (
                      <>
                        <button
                          type="button"
                          className="text-blue-800 underline"
                          onClick={() => editSlot(slot)}
                        >
                          Edit
                        </button>
                      </>
                    )}
                    {isAvailable && (
                      <button
                        type="button"
                        className="text-red-700 underline"
                        onClick={() => setSlotToDelete(slot)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!slots.isFetching && !slots.error && visibleSlots.length === 0 && (
            <Message>No availability has been added.</Message>
          )}
        </>
      )}

      {selectedSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedSlot(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="slot-details-title"
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                id="slot-details-title"
                className="text-xl font-semibold text-gray-900"
              >
                Time slot details
              </h2>
              <button
                type="button"
                className="text-gray-600 underline"
                onClick={() => setSelectedSlot(null)}
              >
                Close
              </button>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <Detail label="Listing" value={service?.name || service?.id} />
              <Detail
                label="Service type"
                value={selectedSlot.serviceType}
              />
              <Detail label="Slot ID" value={selectedSlot.id} />
              <Detail
                label="Start"
                value={new Date(selectedSlot.startTime).toLocaleString("en-GB")}
              />
              <Detail
                label="End"
                value={new Date(selectedSlot.endTime).toLocaleString("en-GB")}
              />
              <Detail
                label="Status"
                value={
                  selectedSlot.isAvailable && !selectedSlot.bookingId
                    ? "Available"
                    : "Reserved"
                }
              />
              <Detail
                label="Booking ID"
                value={selectedSlot.bookingId || "Not booked"}
              />
              <Detail
                label="Created"
                value={
                  selectedSlot.createdAt
                    ? new Date(selectedSlot.createdAt).toLocaleString("en-GB")
                    : "Not available"
                }
              />
              <Detail
                label="Last updated"
                value={
                  selectedSlot.updatedAt
                    ? new Date(selectedSlot.updatedAt).toLocaleString("en-GB")
                    : "Not updated"
                }
              />
            </dl>
            {selectedSlot.isAvailable &&
              !selectedSlot.bookingId &&
              Date.parse(selectedSlot.startTime) > Date.now() && (
                <button
                  type="button"
                  className={`${buttonClass} mt-6`}
                  onClick={() => editSlot(selectedSlot)}
                >
                  Edit time slot
                </button>
              )}
          </section>
        </div>
      )}

      {slotToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !action.isLoading)
              setSlotToDelete(null);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-slot-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2
              id="delete-slot-title"
              className="text-lg font-semibold text-gray-900"
            >
              Delete this time slot?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              This will remove the available slot on{" "}
              {new Date(slotToDelete.startTime).toLocaleString("en-GB")}.
            </p>
            {Boolean(error) && <ApiError error={error} />}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border px-4 py-2 text-gray-800"
                disabled={action.isLoading}
                onClick={() => setSlotToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-700 px-4 py-2 font-medium text-white disabled:opacity-50"
                disabled={action.isLoading}
                onClick={confirmDelete}
              >
                {action.isLoading ? "Deleting…" : "Delete slot"}
              </button>
            </div>
          </section>
        </div>
      )}
    </Workspace>
  );
}

function Detail({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3">
      <dt className="font-medium text-gray-600">{label}</dt>
      <dd className="break-all text-gray-900">{String(value || "Not available")}</dd>
    </div>
  );
}
