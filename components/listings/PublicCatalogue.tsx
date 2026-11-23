import Navbar from "@/components/layouts/Navbar";
import PublicListingFilters from "./PublicListingFilters";
import PublicListingResults from "./PublicListingResults";
import { getPublicCaterings, getPublicEventCenters, getPublicStates } from "@/lib/public-listings";
import { parseListingFilters, type ListingSearchParams } from "@/lib/listing-filters";

export default async function PublicCatalogue({ kind, raw }: { kind: "eventcenter" | "catering"; raw: ListingSearchParams }) {
  const filters = parseListingFilters(raw);
  const isVenue = kind === "eventcenter";
  const path = isVenue ? "/event-center" : "/cateringServices/allPost";
  const [results, geography] = await Promise.all([
    isVenue ? getPublicEventCenters(filters, filters.page) : getPublicCaterings(filters, filters.page),
    getPublicStates().then((states) => ({ states, error: false })).catch(() => ({ states: [], error: true })),
  ]);
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white"><Navbar /></div>
      <header className="relative overflow-hidden bg-[#003e91] bg-cover bg-center px-6 py-16 text-white" style={{ backgroundImage: `linear-gradient(90deg, rgba(0,40,95,.88), rgba(0,40,95,.45)), url('${isVenue ? "/eventHeroImage.png" : "/cateringHeroImage.png"}')` }}>
        <div className="relative mx-auto max-w-7xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-100">Plan your next event</p>
          <h1 className="text-4xl font-bold sm:text-5xl">{isVenue ? "Event centers" : "Catering services"}</h1>
          <p className="mt-4 max-w-2xl text-lg text-blue-50">{isVenue ? "Discover the right venue for your occasion, guest list and budget." : "Find catering services that bring your celebration to life."}</p>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside><PublicListingFilters action={path} filters={filters} states={geography.states} locationsUnavailable={geography.error} category={isVenue ? "EVENTCENTERS" : "CATERING"} /></aside>
        <PublicListingResults kind={kind} results={results} path={path} raw={raw} page={filters.page} />
      </div>
    </main>
  );
}
