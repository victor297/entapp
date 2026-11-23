import Navbar from "@/components/layouts/Navbar";
import PublicListingFilters from "@/components/listings/PublicListingFilters";
import PublicListingResults from "@/components/listings/PublicListingResults";
import { getPublicCaterings, getPublicEventCenters, getPublicStates, getPublicFilterContext } from "@/lib/public-listings";
import { listingHref, parseListingFilters, type ListingSearchParams } from "@/lib/listing-filters";
import { buildMetadata } from "@/lib/seo";

type Props = { searchParams: Promise<ListingSearchParams> };

export async function generateMetadata({ searchParams }: Props) {
  const raw = await searchParams;
  const filters = parseListingFilters(raw);
  const category = filters.category === "EVENTCENTERS" ? "Event centers" : filters.category === "CATERING" ? "Catering services" : "Event venues and catering";
  const context = await getPublicFilterContext(filters);
  return buildMetadata({
    title: `${category}${context ? ` — ${context}` : " — Search"}`,
    description: `Search ${category.toLowerCase()}${context ? ` for ${context}` : " for your event"}. Discover, compare and save listings across all available results.`,
    path: listingHref("/search", raw),
    noIndex: true,
  });
}

export default async function SearchPage({ searchParams }: Props) {
  const raw = await searchParams;
  const filters = parseListingFilters(raw);
  const needsState = Boolean(filters.country && !filters.location);
  const [venues, caterings, geography] = await Promise.all([
    !needsState && filters.category !== "CATERING" ? getPublicEventCenters(filters, filters.venuePage) : null,
    !needsState && filters.category !== "EVENTCENTERS" ? getPublicCaterings(filters, filters.cateringPage) : null,
    getPublicStates().then((states) => ({ states, error: false })).catch(() => ({ states: [], error: true })),
  ]);
  const location = geography.states.find((state) => state.id === filters.location)?.name || filters.stateName;
  const total = (venues?.count || 0) + (caterings?.count || 0);
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white"><Navbar /></div>
      <header className="border-y border-blue-100 bg-blue-50 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-700">Discover your next event</p>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{filters.search ? `Search results for “${filters.search}”` : "Find venues and catering"}</h1>
          {(location || filters.city) && <p className="mt-3 text-gray-600">{[filters.city, location].filter(Boolean).join(", ")}</p>}
          {!needsState && <p className="mt-2 text-sm text-gray-600">{total.toLocaleString()} results{venues?.error || caterings?.error ? " from available services" : ""}</p>}
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside><PublicListingFilters action="/search" filters={filters} states={geography.states} locationsUnavailable={geography.error} /></aside>
        <div className="min-w-0 space-y-12">
          {needsState && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">Please choose a state to search within {filters.country}. You can also search all locations by leaving the state blank and applying your filters.</div>}
          {venues && <PublicListingResults kind="eventcenter" results={venues} path="/search" raw={raw} page={filters.venuePage} pageKey="venuePage" />}
          {caterings && <PublicListingResults kind="catering" results={caterings} path="/search" raw={raw} page={filters.cateringPage} pageKey="cateringPage" />}
        </div>
      </div>
    </main>
  );
}
