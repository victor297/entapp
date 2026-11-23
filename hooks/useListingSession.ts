"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("auth-change", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("auth-change", onChange);
    window.removeEventListener("focus", onChange);
  };
}

function getSnapshot() {
  const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
  const userId = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
  return token && userId ? userId : "";
}

export function useListingSession() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const userId = snapshot ?? "";
  return { userId, isLoggedIn: Boolean(userId), isCheckingAuth: snapshot === null };
}

export function rememberLoginReturn() {
  const currentPath = window.location.pathname + window.location.search;
  sessionStorage.setItem("redirectAfterLogin", currentPath);
  return `/login?reauth=1&returnTo=${encodeURIComponent(currentPath)}`;
}
