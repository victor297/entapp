// Clear authenticated query data before a different account can reuse URLs such
// as /wallet. Tokens are compared in memory only; they are never logged.
export function watchSessionCache(reset: () => void) {
  const key = () => `${localStorage.getItem("user_id") || sessionStorage.getItem("user_id") || ""}:${localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || ""}`;
  let previous = key();
  const changed = () => { const next = key(); if (next !== previous) { previous = next; reset(); } };
  window.addEventListener("storage", changed);
  window.addEventListener("auth-change", changed);
  return () => { window.removeEventListener("storage", changed); window.removeEventListener("auth-change", changed); };
}
