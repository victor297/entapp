import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCatering } from "@/lib/public-listings";
import { buildMetadata } from "@/lib/seo";
import CateringDetailsClient from "./CateringDetailsClient";

type DetailPageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await getPublicCatering(id);
  if (!listing) notFound();
  return buildMetadata({
    title: `${listing.name || listing.tagLine || "Catering service"}${listing.city ? ` in ${listing.city}` : ""}`,
    description: listing?.description || listing?.tagLine || "Discover catering services and menus for your next event.",
    path: `/cateringServices/${encodeURIComponent(id)}`,
    images: listing?.images,
    noIndex: !listing,
  });
}

export default async function CateringDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const listing = await getPublicCatering(id);
  if (!listing) notFound();
  return <CateringDetailsClient cateringService={listing} />;
}
