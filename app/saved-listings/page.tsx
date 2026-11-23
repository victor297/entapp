import type { Metadata } from "next";
import SavedListings from "./SavedListings";

export const metadata: Metadata = {
  title: "Saved Listings",
  description: "Find your saved event centers and catering services in one place.",
  robots: { index: false, follow: false },
};

export default function SavedListingsPage() {
  return <SavedListings />;
}
