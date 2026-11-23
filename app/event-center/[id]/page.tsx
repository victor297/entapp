import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEventCenter } from "@/lib/public-listings";
import { buildMetadata } from "@/lib/seo";
import EventCenterDetailsClient from "./EventCenterDetailsClient";

type DetailPageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await getPublicEventCenter(id);
  if (!listing) notFound();
  return buildMetadata({
    title: listing ? `${listing.name}${listing.city ? ` in ${listing.city}` : ""}` : "Venue not found",
    description: listing?.description || "Discover event venues and find a space for your next occasion.",
    path: `/event-center/${encodeURIComponent(id)}`,
    images: listing?.images,
    noIndex: !listing,
  });
}

export default async function EventCenterPage({ params }: DetailPageProps) {
  const { id } = await params;
  const listing = await getPublicEventCenter(id);
  if (!listing) notFound();
  // Server-fetched props also render the interactive detail view into the initial HTML.
  return <EventCenterDetailsClient eventCenter={listing} />;
}
