"use client";

import Link from "next/link";

export default function VenueError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">We couldn&apos;t load this venue</h1>
      <p className="text-gray-600">Please try again in a moment.</p>
      <button onClick={reset} className="rounded-lg bg-[#0047AB] px-5 py-3 text-white">Try again</button>
      <Link href="/event-center" className="text-blue-700 underline">Browse event venues</Link>
    </main>
  );
}
