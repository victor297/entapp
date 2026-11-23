"use client";

import Link from "next/link";
import Navbar from "@/components/layouts/Navbar";
import Footer from "@/components/layouts/Footer";
import Card from "@/components/ui/card";
import CardSkeleton from "@/components/ui/card-skeleton";
import BookmarkButton from "@/components/ui/BookmarkButton";
import { useListingSession } from "@/hooks/useListingSession";
import { useGetBookmarkStateQuery, useGetSavedEventCentersQuery, useGetSavedCateringsQuery } from "@/redux/services/bookmarksApi";

const loginHref = "/login?reauth=1&returnTo=%2Fsaved-listings";

export default function SavedListings() {
  const { userId, isCheckingAuth } = useListingSession();
  const { currentData: user, isFetching: isFetchingUser, error: userError, refetch: refetchUser } = useGetBookmarkStateQuery(userId, {
    skip: !userId,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  const eventCenterIds = user?.eventCenter ?? [];
  const cateringIds = user?.catering ?? [];
  const venues = useGetSavedEventCentersQuery({ userId, ids: eventCenterIds }, {
    skip: !userId || !eventCenterIds.length,
    refetchOnMountOrArgChange: true,
  });
  const caterings = useGetSavedCateringsQuery({ userId, ids: cateringIds }, {
    skip: !userId || !cateringIds.length,
    refetchOnMountOrArgChange: true,
  });
  const venueListings = eventCenterIds.length ? venues.currentData ?? [] : [];
  const cateringListings = cateringIds.length ? caterings.currentData ?? [] : [];
  const loading = Boolean(userId) && ((!user && isFetchingUser) || (eventCenterIds.length > 0 && venues.isFetching && !venues.currentData) || (cateringIds.length > 0 && caterings.isFetching && !caterings.currentData));
  const savedCount = eventCenterIds.length + cateringIds.length;
  const unavailableVenues = venues.currentData && !venues.isFetching && !venues.isError ? eventCenterIds.filter((id) => !venueListings.some((venue) => venue.id === id)) : [];
  const unavailableCaterings = caterings.currentData && !caterings.isFetching && !caterings.isError ? cateringIds.filter((id) => !cateringListings.some((service) => service.id === id)) : [];

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900">Saved Listings</h1>
        <p className="mt-2 text-gray-600">Your favourite event centers and catering services, ready when you are.</p>

        {isCheckingAuth ? (
          <p role="status" className="mt-8 text-gray-600">Loading saved listings…</p>
        ) : !userId ? (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p className="mb-5 text-gray-700">Log in to access your saved listings.</p>
            <Link href={loginHref} className="inline-block rounded-md bg-blue-800 px-5 py-2.5 font-medium text-white">Log in</Link>
          </div>
        ) : userError ? (
          <div role="alert" className="mt-8 rounded-xl border border-red-200 bg-white p-6 text-red-800">
            <p>We could not load your saved listings.</p>
            <button onClick={() => refetchUser()} className="mr-5 mt-3 font-medium underline">Try again</button>
            <Link href={loginHref} className="font-medium underline">Log in again</Link>
          </div>
        ) : loading ? (
          <div role="status" aria-label="Loading saved listings" className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[1, 2, 3].map((id) => <CardSkeleton key={id} />)}
          </div>
        ) : !user ? (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-700">Log in again to sync your saved listings from your account.</p>
            <Link href={loginHref} className="mt-5 inline-block rounded-md bg-blue-800 px-5 py-2.5 font-medium text-white">Sync saved listings</Link>
          </div>
        ) : savedCount === 0 ? (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900">No saved listings yet</h2>
            <p className="mt-2 text-gray-600">Tap the heart on a listing to keep it here.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-4">
              <Link href="/event-center" className="rounded-md bg-blue-800 px-5 py-2.5 font-medium text-white">Explore venues</Link>
              <Link href="/cateringServices/allPost" className="rounded-md border border-blue-800 px-5 py-2.5 font-medium text-blue-800">Explore catering</Link>
            </div>
          </div>
        ) : (
          <>
            {eventCenterIds.length > 0 && (
              <section className="mt-10" aria-labelledby="saved-venues">
                <h2 id="saved-venues" className="mb-5 text-2xl font-semibold text-gray-900">Event centers</h2>
                {venues.isError && <p role="alert" className="mb-4 text-red-700">Unable to load saved venues. <button onClick={() => venues.refetch()} className="font-medium underline">Try again</button></p>}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {venueListings.map((venue) => (
                    <Card key={venue.id} href={`/event-center/${venue.id}`} listingId={venue.id} serviceType="eventcenter" imageSrc={venue.images?.[0]} label="" name={venue.name} title={venue.description} location={venue.city} pricingPerSlot={venue.pricingPerSlot} discountPercentage={venue.discountPercentage} depositPercentage={venue.depositPercentage} eventTypes={venue.eventTypes} sittingCapacity={venue.sittingCapacity} />
                  ))}
                  {unavailableVenues.map((id) => <UnavailableListing key={id} id={id} serviceType="eventcenter" />)}
                </div>
              </section>
            )}
            {cateringIds.length > 0 && (
              <section className="mt-10" aria-labelledby="saved-catering">
                <h2 id="saved-catering" className="mb-5 text-2xl font-semibold text-gray-900">Catering services</h2>
                {caterings.isError && <p role="alert" className="mb-4 text-red-700">Unable to load saved catering services. <button onClick={() => caterings.refetch()} className="font-medium underline">Try again</button></p>}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {cateringListings.map((service) => (
                    <Card key={service.id} href={`/cateringServices/${service.id}`} listingId={service.id} serviceType="catering" imageSrc={service.images?.[0]} label="" name={service.name} title={service.tagLine} location={service.city} pricingPerSlot={service.startPrice} priceLabel="Starting price:" discountPercentage={service.discountPercentage} depositPercentage={service.depositPercentage} eventTypes={service.eventTypes} />
                  ))}
                  {unavailableCaterings.map((id) => <UnavailableListing key={id} id={id} serviceType="catering" />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <Footer />
    </main>
  );
}

function UnavailableListing({ id, serviceType }: { id: string; serviceType: "eventcenter" | "catering" }) {
  return (
    <article className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-600">This saved listing is no longer available. You can remove it from your saved listings.</p>
      <BookmarkButton listingId={id} serviceType={serviceType} />
    </article>
  );
}
