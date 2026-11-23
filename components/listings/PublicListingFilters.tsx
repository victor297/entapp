import Link from "next/link";
import type { State } from "@/redux/services/eventsApi";
import { EVENT_TYPES, VENUE_AMENITIES, readableFilter, type ListingFilters } from "@/lib/listing-filters";

const fieldClass = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

interface Props {
  action: string;
  filters: ListingFilters;
  states: State[];
  category?: "EVENTCENTERS" | "CATERING";
  locationsUnavailable?: boolean;
}

export default function PublicListingFilters({ action, filters, states, category, locationsUnavailable }: Props) {
  const venueFilters = category !== "CATERING" && (category === "EVENTCENTERS" || filters.category !== "CATERING");
  const knownLocation = states.some((state) => state.id === filters.location);
  return (
    <form action={action} method="get" className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Search &amp; filter</h2>
        <Link href={action} className="text-sm font-medium text-blue-700 hover:underline">Reset</Link>
      </div>
      {!category && (
        <label className="block text-sm font-medium text-gray-700">
          Category
          <select name="category" defaultValue={filters.category} className={fieldClass}>
            <option value="all">All services</option>
            <option value="EVENTCENTERS">Event centers</option>
            <option value="CATERING">Catering services</option>
          </select>
        </label>
      )}
      <label className="block text-sm font-medium text-gray-700">
        Search listings
        <input type="search" name="search" maxLength={200} defaultValue={filters.search} placeholder={category === "CATERING" ? "Name or service description" : "Name, venue or description"} className={fieldClass} />
      </label>
      <label className="block text-sm font-medium text-gray-700">
        State / location
        <select name="location" defaultValue={filters.location} className={fieldClass}>
          <option value="">All locations</option>
          {filters.location && !knownLocation && <option value={filters.location}>{filters.stateName || "Selected location"}</option>}
          {states.map((state) => <option key={state.id} value={state.id}>{state.name} ({state.code})</option>)}
        </select>
      </label>
      {locationsUnavailable && <p className="text-xs text-amber-800">Location options are temporarily unavailable. You can still search by city.</p>}
      <label className="block text-sm font-medium text-gray-700">
        City
        <input name="city" maxLength={100} defaultValue={filters.city} placeholder="e.g. Lagos" className={fieldClass} />
      </label>
      {venueFilters && (
        <>
          {!category && <p className="text-xs text-gray-500">Price, capacity, event types and amenities below apply to event centers.</p>}
          <label className="block text-sm font-medium text-gray-700">
            Maximum venue price (₦ per slot)
            <input name="maxPrice" type="number" min="1" step="any" defaultValue={filters.maxPrice ?? ""} placeholder="Any price" className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Minimum seated capacity
            <input name="minCapacity" type="number" min="1" step="1" defaultValue={filters.minCapacity ?? ""} placeholder="Any capacity" className={fieldClass} />
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">Event type (any selected)</legend>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              {EVENT_TYPES.map((type) => <label key={type} className="flex items-center gap-2"><input name="eventTypes" type="checkbox" value={type} defaultChecked={filters.eventTypes.includes(type)} className="accent-blue-700" />{readableFilter(type)}</label>)}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">Amenities (any selected)</legend>
            <div className="space-y-2 text-sm text-gray-600">
              {VENUE_AMENITIES.map((amenity) => <label key={amenity} className="flex items-center gap-2"><input name="amenities" type="checkbox" value={amenity} defaultChecked={filters.amenities.includes(amenity)} className="accent-blue-700" />{readableFilter(amenity)}</label>)}
            </div>
          </fieldset>
        </>
      )}
      {category === "CATERING" && <p className="text-xs leading-5 text-gray-500">Search catering by name or description, then narrow results by city or state.</p>}
      <button type="submit" className="w-full rounded-lg bg-[#0047AB] px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800">Apply filters</button>
    </form>
  );
}
