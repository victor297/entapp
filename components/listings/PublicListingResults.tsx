import Link from "next/link";
import Card from "@/components/ui/card";
import type { EventCenter } from "@/redux/services/eventsApi";
import type { Catering } from "@/redux/services/cateringApi";
import { listingHref, type ListingSearchParams } from "@/lib/listing-filters";
import { LISTINGS_PAGE_SIZE, type PublicListingResults as Results } from "@/lib/public-listings";

interface Props {
  kind: "eventcenter" | "catering";
  results: Results<EventCenter> | Results<Catering>;
  path: string;
  raw: ListingSearchParams;
  page: number;
  pageKey?: "page" | "venuePage" | "cateringPage";
}

export default function PublicListingResults({ kind, results, path, raw, page, pageKey = "page" }: Props) {
  const totalPages = Math.max(1, Math.ceil(results.count / LISTINGS_PAGE_SIZE));
  const title = kind === "eventcenter" ? "Event centers" : "Catering services";
  const start = results.data.length ? (page - 1) * LISTINGS_PAGE_SIZE + 1 : 0;
  const end = results.data.length ? start + results.data.length - 1 : 0;
  return (
    <section aria-label={title} className="min-w-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
        {!results.error && <p className="text-sm text-gray-600">{start ? `${start}–${end}` : "0"} of {results.count.toLocaleString()} results</p>}
      </div>
      {results.error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          <p>{results.error}</p>
          <Link href={listingHref(path, raw)} className="mt-2 inline-block font-semibold underline">Try again</Link>
        </div>
      ) : results.data.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-600">
          <p>{results.count ? "There are no listings on this page." : "No listings match your search. Try another location or adjust your filters."}</p>
          {page > 1 && <Link href={listingHref(path, raw, { [pageKey]: 1 })} className="mt-3 inline-block font-medium text-blue-700 underline">Return to the first page</Link>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {results.data.map((listing) => {
            const venue = kind === "eventcenter" ? listing as EventCenter : undefined;
            const catering = kind === "catering" ? listing as Catering : undefined;
            return <Card
              key={listing.id}
              href={`/${venue ? "event-center" : "cateringServices"}/${listing.id}`}
              listingId={listing.id}
              serviceType={kind}
              name={listing.name || (venue ? "Event center" : "Catering service")}
              imageSrc={listing.images?.[0]}
              label={catering?.isFeatured && (!catering.featureExpiringAt || Date.parse(catering.featureExpiringAt) > Date.now()) ? "Featured" : listing.discountPercentage > 0 ? `Save ${listing.discountPercentage}%` : ""}
              title={listing.description || catering?.tagLine || "View listing details"}
              location={listing.city || "Location available on request"}
              rating={listing.rating ?? undefined}
              pricingPerSlot={venue?.pricingPerSlot ?? catering?.startPrice}
              priceLabel={venue ? "Pricing per slot:" : "Starting price:"}
              discountPercentage={listing.discountPercentage}
              depositPercentage={listing.depositPercentage}
              eventTypes={listing.eventTypes}
              sittingCapacity={venue?.sittingCapacity}
            />;
          })}
        </div>
      )}
      {!results.error && results.count > 0 && (
        <nav aria-label={`${title} pages`} className="mt-8 flex items-center justify-between gap-4">
          {page > 1 ? <Link rel="prev" href={listingHref(path, raw, { [pageKey]: Math.min(page - 1, totalPages) })} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-blue-700">Previous</Link> : <span className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-400" aria-disabled="true">Previous</span>}
          <p className="text-center text-sm text-gray-600">Page {page} of {totalPages}</p>
          {page < totalPages ? <Link rel="next" href={listingHref(path, raw, { [pageKey]: page + 1 })} className="rounded-lg bg-[#0047AB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">Next</Link> : <span className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-400" aria-disabled="true">Next</span>}
        </nav>
      )}
    </section>
  );
}
