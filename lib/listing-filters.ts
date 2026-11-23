export type ListingSearchParams = Record<string, string | string[] | undefined>;
export type ListingCategory = "all" | "EVENTCENTERS" | "CATERING";

export const EVENT_TYPES = ["WEDDING", "BIRTHDAY", "CONFERENCE", "CORPORATE", "CONCERT", "EXHIBITION", "FUNERAL", "GRADUATION", "NETWORKING", "OTHER"] as const;
export const VENUE_AMENITIES = ["WIFI", "PACKINGSPACE", "SECURITY"] as const;

export interface ListingFilters {
  category: ListingCategory;
  search: string;
  city: string;
  location: string;
  country: string;
  stateName: string;
  eventTypes: string[];
  amenities: string[];
  minCapacity?: number;
  maxPrice?: number;
  page: number;
  venuePage: number;
  cateringPage: number;
}

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function positiveNumber(value: string | string[] | undefined) {
  const number = Number(first(value));
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function pageNumber(value: string | string[] | undefined) {
  return Math.min(100000, Math.max(1, Math.floor(positiveNumber(value) ?? 1)));
}

function enumValues(value: string | string[] | undefined, allowed: readonly string[]) {
  return [...new Set((Array.isArray(value) ? value : [value ?? ""])
    .flatMap((item) => item.split(","))
    .map((item) => item.trim().toUpperCase())
    .filter((item) => allowed.includes(item)))];
}

export function parseListingFilters(raw: ListingSearchParams): ListingFilters {
  const category = first(raw.category).toUpperCase();
  const minCapacity = positiveNumber(raw.minCapacity);
  return {
    category: category === "EVENTCENTERS" || category === "CATERING" ? category : "all",
    search: first(raw.search || raw.q).slice(0, 200),
    city: first(raw.city).slice(0, 100),
    location: first(raw.location || raw.stateId),
    country: first(raw.countryName || raw.country),
    stateName: first(raw.stateName || raw.state),
    eventTypes: enumValues(raw.eventTypes, EVENT_TYPES),
    amenities: enumValues(raw.amenities, VENUE_AMENITIES),
    minCapacity: minCapacity ? Math.ceil(minCapacity) : undefined,
    maxPrice: positiveNumber(raw.maxPrice),
    page: pageNumber(raw.page),
    venuePage: pageNumber(raw.venuePage || raw.page),
    cateringPage: pageNumber(raw.cateringPage || raw.page),
  };
}

export function toVenueQuery(filters: ListingFilters, limit = 12, offset = 0) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters.search) params.set("search", filters.search);
  if (filters.city) params.set("city", filters.city);
  if (filters.location) params.set("location", filters.location);
  if (filters.eventTypes.length) params.set("eventTypes", filters.eventTypes.join(","));
  if (filters.amenities.length) params.set("amenities", filters.amenities.join(","));
  if (filters.minCapacity) params.set("minCapacity", String(filters.minCapacity));
  if (filters.maxPrice) params.set("maxPrice", String(filters.maxPrice));
  return params;
}

export function toCateringQuery(filters: ListingFilters, limit = 12, offset = 0) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters.search) params.set("search", filters.search);
  if (filters.city) params.set("city", filters.city);
  // Catering expects a state ID in `state`; the venue endpoint calls it `location`.
  if (filters.location) params.set("state", filters.location);
  return params;
}

export function listingHref(path: string, raw: ListingSearchParams, updates: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries(raw).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value) params.set(key, value);
  });
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || value === "") params.delete(key);
    else params.set(key, String(value));
  });
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

export function readableFilter(value: string) {
  if (value === "WIFI") return "Wi-Fi";
  if (value === "PACKINGSPACE") return "Parking space";
  return value.charAt(0) + value.slice(1).toLowerCase();
}
