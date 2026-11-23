import PublicCatalogue from "@/components/listings/PublicCatalogue";
import { listingHref, parseListingFilters, type ListingSearchParams } from "@/lib/listing-filters";
import { buildMetadata } from "@/lib/seo";
import { getPublicFilterContext } from "@/lib/public-listings";

type Props = { searchParams: Promise<ListingSearchParams> };

export async function generateMetadata({ searchParams }: Props) {
  const raw = await searchParams;
  const filters = parseListingFilters(raw);
  const context = await getPublicFilterContext(filters);
  return buildMetadata({
    title: `${context ? `${context} — ` : ""}Event Centers${filters.page > 1 ? ` — Page ${filters.page}` : ""}`,
    description: `Discover event venues${context ? ` for ${context}` : " for weddings, birthdays and corporate events"}. Search by location, price, seated capacity, event type and amenities.`,
    path: listingHref("/event-center", raw),
    images: ["/eventHeroImage.png"],
    noIndex: Boolean(filters.search),
  });
}

export default async function EventCenters({ searchParams }: Props) {
  return <PublicCatalogue kind="eventcenter" raw={await searchParams} />;
}
