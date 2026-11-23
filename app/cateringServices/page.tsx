import { redirect } from "next/navigation";
import { listingHref, type ListingSearchParams } from "@/lib/listing-filters";

export default async function CateringServicePage({ searchParams }: { searchParams: Promise<ListingSearchParams> }) {
  redirect(listingHref("/cateringServices/allPost", await searchParams));
}
