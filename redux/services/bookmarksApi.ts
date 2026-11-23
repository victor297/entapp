import { api, type UserResponse } from "./authApi";
import type { EventCenter } from "./eventsApi";
import type { Catering } from "./cateringApi";
import { persistBookmarkState, readBookmarkState, type BookmarkState } from "../../lib/bookmark-state";

// These values are BookMarkType, which differs from the provider ServiceType enum.
export type BookmarkServiceType = "eventcenter" | "catering";

interface BookmarkRequest {
  userId: string;
  id: string;
  serviceType: BookmarkServiceType;
}

interface SavedListingsRequest {
  // Keep cached private lists separate when accounts change in the same browser.
  userId: string;
  ids: string[];
}

function bookmarksUrl(path: string, ids: string[]) {
  const params = new URLSearchParams();
  for (const id of ids) params.append("ids", id);
  // The existing endpoint expects an array and does not normalize a single string.
  // Repeating one ID makes Express parse it as an array; Prisma returns it once.
  if (ids.length === 1) params.append("ids", ids[0]);
  return `${path}/bookmarks?${params}`;
}

export const bookmarksApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBookmarkState: builder.query<BookmarkState | null, string>({
      queryFn: (userId) => ({ data: readBookmarkState(userId) }),
      providesTags: (_result, _error, userId) => [{ type: "Bookmarks", id: userId }],
    }),
    toggleBookmark: builder.mutation<BookmarkState, BookmarkRequest>({
      query: ({ id, serviceType }) => ({
        url: "/users/bookmark",
        method: "POST",
        body: { id, serviceType },
      }),
      transformResponse: (response: UserResponse) => persistBookmarkState(response),
      async onQueryStarted({ userId }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Preserve any profile relations; bookmark responses omit those relations.
          dispatch(api.util.updateQueryData("getUserById", userId, (draft) => {
            draft.eventCenter = data.eventCenter;
            draft.catering = data.catering;
          }));
        } catch {
          // Keep the previous bookmark state when the request fails.
        }
      },
      invalidatesTags: (_result, error, { userId }) =>
        error ? [] : [{ type: "Bookmarks", id: userId }],
    }),
    getSavedEventCenters: builder.query<EventCenter[], SavedListingsRequest>({
      query: ({ ids }) => bookmarksUrl("/event-centers", ids),
      providesTags: (_result, _error, { userId }) => [{ type: "Bookmarks", id: userId }],
    }),
    getSavedCaterings: builder.query<Catering[], SavedListingsRequest>({
      query: ({ ids }) => bookmarksUrl("/catering", ids),
      providesTags: (_result, _error, { userId }) => [{ type: "Bookmarks", id: userId }],
    }),
  }),
});

export const {
  useGetBookmarkStateQuery,
  useToggleBookmarkMutation,
  useGetSavedEventCentersQuery,
  useGetSavedCateringsQuery,
} = bookmarksApi;
