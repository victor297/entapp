"use client";

import { Heart, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { getApiError } from "@/hooks/getApiError";
import { rememberLoginReturn, useListingSession } from "@/hooks/useListingSession";
import { useGetBookmarkStateQuery, useToggleBookmarkMutation, type BookmarkServiceType } from "@/redux/services/bookmarksApi";

interface BookmarkButtonProps {
  listingId: string;
  serviceType: BookmarkServiceType;
  className?: string;
  showLabel?: boolean;
}

export default function BookmarkButton({ listingId, serviceType, className = "", showLabel = false }: BookmarkButtonProps) {
  const router = useRouter();
  const { userId, isCheckingAuth } = useListingSession();
  const [message, setMessage] = useState("");
  const { currentData: bookmarkState, isLoading, isFetching } = useGetBookmarkStateQuery(userId, {
    skip: !userId,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  const [toggleBookmark, { isLoading: isSaving }] = useToggleBookmarkMutation({
    // The backend toggles arrays by reading and rewriting the whole user record.
    // Share pending state across this user's controls to prevent overlapping writes.
    fixedCacheKey: `bookmarks:${userId}`,
  });
  const ids = serviceType === "eventcenter" ? bookmarkState?.eventCenter : bookmarkState?.catering;
  const isSaved = Boolean(ids?.includes(listingId));
  const label = userId && !bookmarkState && !isFetching ? "Log in to sync saved listings" : isSaved ? "Remove from saved listings" : "Save listing";

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMessage("");
    if (!userId || !bookmarkState) {
      router.push(rememberLoginReturn());
      return;
    }
    try {
      await toggleBookmark({ userId, id: listingId, serviceType }).unwrap();
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 401) {
        router.push(rememberLoginReturn());
        return;
      }
      setMessage(getApiError(error, "Unable to update saved listings. Please try again."));
    }
  }

  return (
    <span className={`z-20 inline-flex flex-col items-end ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={isSaved}
        disabled={isCheckingAuth || isSaving || Boolean(userId && (isLoading || isFetching))}
        onClick={handleClick}
        title={label}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white p-2.5 text-blue-800 shadow-sm transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-60"
      >
        {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Heart size={20} fill={isSaved ? "currentColor" : "none"} />}
        {showLabel && <span className="pr-1 text-sm font-medium">{isSaved ? "Saved" : "Save listing"}</span>}
      </button>
      {message && <span role="alert" className="mt-2 max-w-60 rounded bg-white p-2 text-xs text-red-700 shadow">{message}</span>}
    </span>
  );
}
