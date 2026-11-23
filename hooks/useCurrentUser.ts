"use client";
import { useSyncExternalStore } from "react";
import { currentUserSnapshot, type CurrentUser } from "@/lib/current-user";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback); window.addEventListener("auth-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("auth-change", callback); };
}
export function useCurrentUser() {
  const raw = useSyncExternalStore(subscribe, currentUserSnapshot, () => null);
  let userId = ""; let user: CurrentUser | undefined;
  if (raw) {
    try { const snapshot = JSON.parse(raw); userId = snapshot.id; const profile = JSON.parse(snapshot.profile); if (profile?.id === userId) user = profile; } catch { /* Existing sessions can sign in to load their profile. */ }
  }
  return { userId, user, isLoggedIn: Boolean(userId), isCheckingAuth: raw === null };
}
