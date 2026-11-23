"use client";
import { useCurrentUser } from "./useCurrentUser";

export function useAuthGuard(options: { requireAdmin?: boolean } = {}) {
  const session = useCurrentUser();
  return { user: session.user, isLoading: session.isCheckingAuth, isAuthorized: Boolean(session.isLoggedIn && session.user && (!options.requireAdmin || session.user.userType === "ADMIN")) };
}
