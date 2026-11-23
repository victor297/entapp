"use client";

import Link from "next/link";
import { useState } from "react";
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

type ServiceListing = ApiRecord & { type: "EVENTCENTER" | "CATERING" };

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setNotice("");

    try {
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
      if (!service) throw new Error("Select a listing you own.");
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
        Choose a listing, set a start and end time, then save to make a slot
        available for booking.
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
          <form
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
          </form>

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
