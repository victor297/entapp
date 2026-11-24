"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useOperationRecordQuery,
  useOperationListQuery,
  useOperationMutationMutation,
} from "@/redux/services/operationsApi";
import { EVENT_TYPES, VENUE_AMENITIES } from "@/lib/listing-filters";
import {
  Workspace,
  Message,
  ApiError,
  fieldClass,
  buttonClass,
} from "./Workspace";
import type { ApiRecord } from "@/lib/operations";
const defaults = {
  name: "",
  tagLine: "",
  description: "",
  price: "",
  capacity: "",
  minCapacity: "",
  maxCapacity: "",
  depositPercentage: "",
  discountPercentage: "0",
  streetAddress: "",
  streetAddress2: "",
  city: "",
  postal: "",
  contact: "",
  venueLayout: "",
  termsOfUse: "",
  cancellationPolicy: "",
  cuisine: "",
  dishTypes: "",
  status: "ACTIVE",
};
export default function ListingEditor({
  kind,
  role,
  id,
}: {
  kind: "eventcenter" | "catering";
  role: "admin" | "provider";
  id?: string;
}) {
  const { userId, user } = useCurrentUser();
  const ready = Boolean(
    user &&
    userId &&
    user.userType === (role === "admin" ? "ADMIN" : "SERVICE_PROVIDER"),
  );
  const router = useRouter();
  const venue = kind === "eventcenter";
  const resource = venue ? "/event-centers" : "/catering";
  const existing = useOperationRecordQuery(`${resource}/${id}`, {
    skip: !ready || !id,
  });
  const states = useOperationListQuery(
    { resource: "/admin/state" },
    { skip: !ready },
  );
  const providers = useOperationListQuery(
    { resource: "/users" },
    { skip: !ready || role !== "admin" },
  );
  const [values, setValues] = useState(defaults);
  const [owner, setOwner] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState("");
  const [mutate, action] = useOperationMutationMutation();
  useEffect(() => {
    const row = existing.data;
    if (!row) return;
    const next = { ...defaults };
    for (const key of Object.keys(next) as (keyof typeof defaults)[])
      if (row[key] !== undefined && row[key] !== null)
        next[key] = Array.isArray(row[key])
          ? row[key].join(", ")
          : String(row[key]);
    next.price = String(row.pricingPerSlot ?? row.startPrice ?? "");
    next.capacity = String(row.sittingCapacity ?? "");
    setValues(next);
    setOwner(row.serviceProviderId);
    setLocations(
      Array.isArray(row.location)
        ? row.location
        : [row.location].filter(Boolean),
    );
    setEvents(row.eventTypes || []);
    setAmenities(row.amenities || []);
    setExistingImages(
      Array.isArray(row.images)
        ? row.images.filter(
            (image: unknown): image is string => typeof image === "string",
          )
        : [],
    );
  }, [existing.data]);
  const allowed =
    !id ||
    !existing.data ||
    role === "admin" ||
    existing.data.serviceProviderId === userId;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      if (!allowed)
        throw new Error("This listing does not belong to your account.");
      if (!locations.length || !events.length)
        throw new Error("Select a location and at least one event type.");
      if (!venue && Number(values.minCapacity) > Number(values.maxCapacity))
        throw new Error(
          "Maximum capacity must be at least the minimum capacity.",
        );
      const common = {
        name: values.name,
        serviceProviderId: role === "provider" ? userId : owner,
        description: values.description,
        eventTypes: events,
        depositPercentage: Number(values.depositPercentage),
        discountPercentage: Number(values.discountPercentage),
        streetAddress: values.streetAddress,
        streetAddress2: values.streetAddress2,
        city: values.city,
        postal: values.postal,
        contact: values.contact,
        termsOfUse: values.termsOfUse,
        cancellationPolicy: values.cancellationPolicy,
      };
      const body = venue
        ? {
            ...common,
            location: locations[0],
            pricingPerSlot: Number(values.price),
            sittingCapacity: Number(values.capacity),
            venueLayout: values.venueLayout,
            amenities,
            status: values.status,
          }
        : {
            ...common,
            location: locations,
            startPrice: Number(values.price),
            minCapacity: Number(values.minCapacity),
            maxCapacity: Number(values.maxCapacity),
            tagLine: values.tagLine,
            dishTypes: values.dishTypes
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
            cuisine: values.cuisine
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          };
      const targetId = id || saved;
      const response = await mutate({
        url: targetId
          ? `${resource}/${targetId}`
          : venue
            ? `${resource}/create`
            : resource,
        method: targetId ? "PATCH" : "POST",
        body: targetId ? { ...body, images: existingImages } : body,
      }).unwrap();
      const listingId = response.id || targetId;
      setSaved(listingId || "");
      if (photos.length && listingId) {
        const form = new FormData();
        photos.forEach((photo) => form.append("imagefiles", photo));
        await mutate({
          url: `${resource}/${listingId}`,
          method: "POST",
          body: form,
        }).unwrap();
      }
      router.push(
        role === "admin"
          ? venue
            ? "/admin/manage-event-center"
            : "/admin/manage-catering-services"
          : venue
            ? "/eventServiceManagement/manage-event-center"
            : "/cateringServiceManagement/manage-catering-services",
      );
    } catch (caught) {
      setError(caught);
    }
  }
  function field(
    key: keyof typeof defaults,
    label: string,
    type = "text",
    required = true,
  ) {
    return (
      <label key={key}>
        {label}
        <input
          className={fieldClass}
          type={type}
          required={required}
          min={type === "number" ? 0 : undefined}
          max={key.endsWith("Percentage") ? 100 : undefined}
          step={key === "price" ? "0.01" : type === "number" ? "1" : undefined}
          value={values[key]}
          onChange={(event) =>
            setValues({ ...values, [key]: event.target.value })
          }
        />
      </label>
    );
  }
  return (
    <Workspace
      role={role}
      title={`${id ? "Edit" : "Add"} ${venue ? "event center" : "catering service"}`}
    >
      {existing.isFetching && <Message>Loading listing…</Message>}
      {existing.error && (
        <ApiError error={existing.error} retry={existing.refetch} />
      )}
      {!allowed ? (
        <Message error>This listing does not belong to your account.</Message>
      ) : (
        <form
          className="grid gap-5 rounded-xl border bg-white p-6 sm:grid-cols-2"
          onSubmit={submit}
        >
          {role === "admin" && (
            <label>
              Provider
              <select
                className={fieldClass}
                value={owner}
                required
                onChange={(event) => setOwner(event.target.value)}
              >
                <option value="">Select provider</option>
                {providers.data
                  ?.filter((row) => row.userType === "SERVICE_PROVIDER")
                  .map((row) => (
                    <option value={row.id} key={row.id}>
                      {row.serviceProvider?.businessName ||
                        `${row.firstName || ""} ${row.lastName || ""}`}{" "}
                      · {row.email}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {field("name", "Listing name")}
          {!venue && (
            <div>
              {field("tagLine", "Tagline")}
              <p className="mt-1 text-sm text-gray-500">
                Example: Fresh, flavorful catering for every occasion.
              </p>
            </div>
          )}
          {field(
            "price",
            venue ? "Price per slot (NGN)" : "Starting price (NGN)",
            "number",
          )}
          {venue ? (
            field("capacity", "Seated capacity", "number")
          ) : (
            <>
              {field("minCapacity", "Minimum guests", "number")}
              {field("maxCapacity", "Maximum guests", "number")}
            </>
          )}
          {field("depositPercentage", "(%) Deposit percentage", "number")}
          {field("discountPercentage", "(%) Discount percentage", "number")}
          {venue ? (
            <label>
              Location
              <select
                className={fieldClass}
                value={locations[0] || ""}
                required
                onChange={(event) =>
                  setLocations(event.target.value ? [event.target.value] : [])
                }
              >
                <option value="">Select state</option>
                {states.data
                  ?.filter((row) => !row.deletedAt)
                  .map((row) => (
                    <option value={row.id} key={row.id}>
                      {row.name} ({row.code})
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <fieldset className="rounded-lg border border-gray-300 p-4">
              <legend className="px-1 font-medium">Service locations *</legend>
              <p className="mb-3 text-sm text-gray-600">
                Select every state where your catering service operates.
              </p>
              <div className="grid max-h-60 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {states.data
                  ?.filter((row) => !row.deletedAt)
                  .map((row) => (
                    <label
                      className="flex items-center gap-2 rounded-md p-2 hover:bg-gray-50"
                      key={row.id}
                    >
                      <input
                        type="checkbox"
                        checked={locations.includes(row.id)}
                        onChange={(event) =>
                          setLocations(
                            event.target.checked
                              ? [...locations, row.id]
                              : locations.filter(
                                  (location) => location !== row.id,
                                ),
                          )
                        }
                      />
                      <span>
                        {row.name} ({row.code})
                      </span>
                    </label>
                  ))}
              </div>
              {locations.length > 0 && (
                <p className="mt-3 text-sm text-gray-600">
                  {locations.length}{" "}
                  {locations.length === 1 ? "location" : "locations"} selected
                </p>
              )}
            </fieldset>
          )}
          {field("streetAddress", "Street address")}
          {field("streetAddress2", "Additional address", "text", false)}
          {field("city", "City")}
          {field("postal", "Postal code")}
          {field("contact", "Contact telephone", "tel", false)}
          {venue ? (
            <div>
              {field("venueLayout", "Venue layout", "text", false)}
              <p className="mt-1 text-sm text-gray-500">
                Examples: Banquet style, theatre style, classroom style, etc.
              </p>
            </div>
          ) : (
            <>
              <div>
                {field("dishTypes", "Dish types (comma separated)")}
                <p className="mt-1 text-sm text-gray-500">
                  Examples: Vegetarian, Non-Vegetarian, Vegan.
                </p>
              </div>
              <div>
                {field("cuisine", "Cuisines (comma separated)", "text", false)}
                <p className="mt-1 text-sm text-gray-500">
                  Examples: Italian, Mexican, Indian.
                </p>
              </div>
            </>
          )}
          <fieldset>
            <legend className="font-medium">Event types</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              {EVENT_TYPES.map((value) => (
                <label key={value} className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={events.includes(value)}
                    onChange={(e) =>
                      setEvents(
                        e.target.checked
                          ? [...events, value]
                          : events.filter((item) => item !== value),
                      )
                    }
                  />
                  {value}
                </label>
              ))}
            </div>
          </fieldset>
          {venue && (
            <fieldset>
              <legend className="font-medium">Amenities</legend>
              {VENUE_AMENITIES.map((value) => (
                <label className="mt-2 flex gap-2" key={value}>
                  <input
                    type="checkbox"
                    checked={amenities.includes(value)}
                    onChange={(e) =>
                      setAmenities(
                        e.target.checked
                          ? [...amenities, value]
                          : amenities.filter((item) => item !== value),
                      )
                    }
                  />
                  {value}
                </label>
              ))}
              <label>
                Status
                <select
                  className={fieldClass}
                  value={values.status}
                  onChange={(e) =>
                    setValues({ ...values, status: e.target.value })
                  }
                >
                  <option>ACTIVE</option>
                  <option>INACTIVE</option>
                </select>
              </label>
            </fieldset>
          )}
          {(
            [
              ["description", "Description"],
              ["termsOfUse", "Terms of use"],
              ["cancellationPolicy", "Cancellation policy"],
            ] as const
          ).map(([key, label]) => (
            <label className="sm:col-span-2" key={key}>
              {label}
              <textarea
                className={fieldClass}
                required={key !== "description"}
                maxLength={10000}
                value={values[key]}
                onChange={(event) =>
                  setValues({ ...values, [key]: event.target.value })
                }
              />
            </label>
          ))}
          <div className="sm:col-span-2">
            <label className="block">
              Listing photographs
              <span className="mt-1 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-gray-600 hover:border-blue-500 hover:bg-blue-50">
                <span className="font-medium text-blue-800">
                  Choose images to upload
                </span>
                <span className="mt-1">
                  Select one or more JPEG, PNG, or WebP images.
                </span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) => {
                    const selected = Array.from(event.target.files || []);
                    setPhotos((current) => {
                      const existing = new Set(
                        current.map(
                          (photo) =>
                            `${photo.name}:${photo.size}:${photo.lastModified}`,
                        ),
                      );
                      return [
                        ...current,
                        ...selected.filter(
                          (photo) =>
                            !existing.has(
                              `${photo.name}:${photo.size}:${photo.lastModified}`,
                            ),
                        ),
                      ];
                    });
                    event.target.value = "";
                  }}
                />
              </span>
            </label>
            {(existingImages.length > 0 || photos.length > 0) && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {existingImages.map((image, index) => (
                  <ListingImagePreview
                    key={`existing-${image}-${index}`}
                    src={image}
                    name={`Listing image ${index + 1}`}
                    onRemove={() =>
                      setExistingImages((current) =>
                        current.filter((_, imageIndex) => imageIndex !== index),
                      )
                    }
                  />
                ))}
                {photos.map((photo, index) => (
                  <PhotoPreview
                    key={`${photo.name}:${photo.size}:${photo.lastModified}`}
                    photo={photo}
                    onRemove={() =>
                      setPhotos((current) =>
                        current.filter((_, photoIndex) => photoIndex !== index),
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
          {saved && Boolean(error) && (
            <Message>
              The listing was saved, but the image upload may have failed. Retry
              saving to upload the photographs. Listing reference: {saved}
            </Message>
          )}
          {Boolean(error || providers.error || states.error) && (
            <ApiError error={error || providers.error || states.error} />
          )}
          <button
            className={buttonClass}
            disabled={
              action.isLoading ||
              existing.isFetching ||
              Boolean(id && !existing.data)
            }
          >
            {action.isLoading ? "Saving…" : "Save listing"}
          </button>
        </form>
      )}
    </Workspace>
  );
}

function PhotoPreview({
  photo,
  onRemove,
}: {
  photo: File;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  return (
    <ListingImagePreview
      src={previewUrl}
      name={photo.name}
      onRemove={onRemove}
    />
  );
}

function ListingImagePreview({
  src,
  name,
  onRemove,
}: {
  src: string;
  name: string;
  onRemove: () => void;
}) {
  return (
    <figure className="relative overflow-hidden rounded-lg border border-gray-200 bg-white">
      {src && (
        <img
          src={src}
          alt={`Preview of ${name}`}
          className="aspect-square w-full object-cover"
        />
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-sm font-medium text-white hover:bg-black"
      >
        Remove
      </button>
      <figcaption className="truncate px-2 py-1.5 text-xs text-gray-700">
        {name}
      </figcaption>
    </figure>
  );
}
