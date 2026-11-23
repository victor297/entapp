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
    title: `${context ? `${context} — ` : ""}Catering Services${filters.page > 1 ? ` — Page ${filters.page}` : ""}`,
    description: `Find catering services${context ? ` for ${context}` : " for your next celebration"}. Search caterers by name, description, city and state, and save your favourites.`,
    path: listingHref("/cateringServices/allPost", raw),
    images: ["/cateringHeroImage.png"],
    noIndex: Boolean(filters.search),
  });
}

export default async function CateringServicesAllPost({ searchParams }: Props) {
  return <PublicCatalogue kind="catering" raw={await searchParams} />;
}
