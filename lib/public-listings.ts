import { cache } from "react";
import type { EventCenter, State } from "@/redux/services/eventsApi";
import type { Catering } from "@/redux/services/cateringApi";
import { toCateringQuery, toVenueQuery, type ListingFilters } from "./listing-filters";

export const LISTINGS_PAGE_SIZE = 12;

export interface PublicListingResults<T> {
  data: T[];
  count: number;
  error?: string;
}

async function publicFetch<T>(path: string): Promise<T | null> {
  const baseUrl = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL)?.trim().replace(/\/+$/, "");
  if (!baseUrl) throw new Error("The listing API is not configured.");
  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The listing API returned ${response.status}.`);
  return response.json() as Promise<T>;
}

async function getListings<T>(path: string): Promise<PublicListingResults<T>> {
  try {
    const response = await publicFetch<PublicListingResults<T>>(path);
    if (!response || !Array.isArray(response.data) || !Number.isFinite(Number(response.count))) {
      throw new Error("Invalid listing response.");
    }
    return { data: response.data, count: Math.max(0, Number(response.count)) };
  } catch {
    return { data: [], count: 0, error: "We couldn't load these listings. Please try again." };
  }
}

export function getPublicEventCenters(filters: ListingFilters, page = 1) {
  return getListings<EventCenter>(`/event-centers?${toVenueQuery(filters, LISTINGS_PAGE_SIZE, (page - 1) * LISTINGS_PAGE_SIZE)}`);
}

export function getPublicCaterings(filters: ListingFilters, page = 1) {
  return getListings<Catering>(`/catering?${toCateringQuery(filters, LISTINGS_PAGE_SIZE, (page - 1) * LISTINGS_PAGE_SIZE)}`);
}

export const getPublicEventCenter = cache((id: string) => publicFetch<EventCenter>(`/event-centers/${encodeURIComponent(id)}`));
export const getPublicCatering = cache((id: string) => publicFetch<Catering>(`/catering/${encodeURIComponent(id)}`));

// Geography is paginated too. Fetch every page so filters do not hide states beyond
// the first response, and keep the public request free of customer credentials.
export const getPublicStates = cache(async (): Promise<State[]> => {
  const states: State[] = [];
  const seen = new Set<string>();
  let count = Infinity;
  while (states.length < count) {
    const response = await publicFetch<{ docs: State[]; count: number }>(`/admin/state?limit=250&offset=${states.length}`);
    if (!response || !Array.isArray(response.docs)) throw new Error("Couldn't load locations.");
    count = Number(response.count);
    if (!Number.isSafeInteger(count) || count < 0 || (response.docs.length === 0 && states.length < count)) throw new Error("Couldn't load locations.");
    for (const state of response.docs) {
      if (seen.has(state.id)) throw new Error("Couldn't load all locations.");
      seen.add(state.id);
      states.push(state);
    }
    if (!response.docs.length) break;
  }
  return states.filter(state => !state.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
});

export async function getPublicFilterContext(filters: ListingFilters) {
  let location = filters.city || filters.stateName;
  if (!location && filters.location) {
    try {
      location = (await getPublicStates()).find((state) => state.id === filters.location)?.name || "";
    } catch {
      // A failed geography lookup must not prevent a listing from being rendered.
    }
  }
  return [filters.search ? `“${filters.search}”` : "", location].filter(Boolean).join(" in ");
}
