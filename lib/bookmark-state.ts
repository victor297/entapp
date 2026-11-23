export interface BookmarkState {
  userId: string;
  eventCenter: string[];
  catering: string[];
}

const storageKey = (userId: string) => `listing-bookmarks:${userId}`;
const memory = new Map<string, BookmarkState>();

function stringIds(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];
}

// The existing customer API exposes bookmark arrays on login and bookmark updates,
// while GET /users/:id is admin-only. Persist only listing IDs, never the raw user.
export function persistBookmarkState(user: { id: string; eventCenter?: unknown; catering?: unknown }): BookmarkState {
  const state = { userId: user.id, eventCenter: stringIds(user.eventCenter), catering: stringIds(user.catering) };
  memory.set(user.id, state);
  if (typeof window !== "undefined") {
    try {
      const storage = localStorage.getItem("access_token") ? localStorage : sessionStorage;
      storage.setItem(storageKey(user.id), JSON.stringify(state));
    } catch {
      // A browser that denies storage can still use the in-memory query result.
    }
  }
  return state;
}

export function readBookmarkState(userId: string): BookmarkState | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(userId)) || sessionStorage.getItem(storageKey(userId));
    if (!raw) return memory.get(userId) ?? null;
    const state = JSON.parse(raw);
    if (state.userId !== userId || !Array.isArray(state.eventCenter) || !Array.isArray(state.catering)) return null;
    return { userId, eventCenter: stringIds(state.eventCenter), catering: stringIds(state.catering) };
  } catch {
    return memory.get(userId) ?? null;
  }
}

export function clearBookmarkState(userId: string | null) {
  if (typeof window === "undefined" || !userId) return;
  memory.delete(userId);
  localStorage.removeItem(storageKey(userId));
  sessionStorage.removeItem(storageKey(userId));
}
