"use client";

import { Suspense } from "react";

interface GlobalSuspenseProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wraps children in a Suspense boundary to avoid
 * "useSearchParams() should be wrapped in a suspense boundary" errors.
 * Apply to the client route groups that use search params. Public listing
 * routes wait for their server data before headers are sent, including 404s.
 */
export default function GlobalSuspense({
  children,
  fallback = <div role="status" className="p-10 text-gray-700">Loading page…</div>,
}: GlobalSuspenseProps) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
