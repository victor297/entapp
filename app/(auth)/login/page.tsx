"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Lock, Mail, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useLoginMutation,
  useRefreshTokenMutation,
  useResendVerificationMutation,
  UserType,
  ServiceType,
  UserResponse,
} from "../../../redux/services/authApi";
import Notification from "../../../components/ui/Notification";
import { getApiError } from "../../../hooks/getApiError";
import { persistBookmarkState } from "../../../lib/bookmark-state";
import { currentUserSnapshot } from "../../../lib/current-user";

// Token storage with expiration
const TOKEN_EXPIRY_DAYS = 7;
const TOKEN_EXPIRY_MS = TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours for non-remember-me

const storeTokens = (
  accessToken: string,
  refreshToken: string | undefined,
  userId: string,
  rememberMe: boolean
) => {
  // Always use localStorage so tokens persist across new tabs.
  // rememberMe controls the expiry: 7 days vs 24 hours.
  const expiry = Date.now() + (rememberMe ? TOKEN_EXPIRY_MS : SESSION_EXPIRY_MS);
  localStorage.setItem("access_token", accessToken);
  if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
  else localStorage.removeItem("refresh_token");
  localStorage.setItem("token_expiry", expiry.toString());
  localStorage.setItem("user_id", userId);
  // Clear any stale sessionStorage entries
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("refresh_token");
  sessionStorage.removeItem("user_id");
  window.dispatchEvent(new Event("auth-change"));
};

const clearTokens = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("token_expiry");
  localStorage.removeItem("user_id");
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("refresh_token");
  sessionStorage.removeItem("user_id");
  window.dispatchEvent(new Event("auth-change"));
};

const isTokenValid = () => {
  const expiry = localStorage.getItem("token_expiry");
  if (!expiry) return false;
  return Date.now() < parseInt(expiry, 10);
};

// Reusable redirect logic based on user type
const getRedirectRoute = (user: Pick<UserResponse, "userType" | "serviceProvider">): string => {
  // Only accept local, same-origin destinations for post-login navigation.
  const requested = new URLSearchParams(window.location.search).get("returnTo")
    || sessionStorage.getItem("redirectAfterLogin");
  sessionStorage.removeItem("redirectAfterLogin");
  if (requested?.startsWith("/") && !requested.startsWith("//")) {
    try {
      const destination = new URL(requested, window.location.origin);
      if (destination.origin === window.location.origin && destination.pathname !== "/login") {
        return destination.pathname + destination.search + destination.hash;
      }
    } catch {
      // Fall through to the user's usual home page for malformed destinations.
    }
  }
  let targetRoute = "";
  switch (user.userType) {
    case UserType.CUSTOMER:
      targetRoute = "/";
      break;
    case UserType.ADMIN:
      targetRoute = "/admin";
      break;
    case UserType.STAFF:
      targetRoute = "/support";
      break;
    case UserType.SERVICE_PROVIDER:
      const serviceType = user.serviceProvider?.serviceType;
      if (serviceType === ServiceType.CATERING) {
        targetRoute = "/cateringServiceManagement/cateringServiceDashboard";
      } else {
        // EVENTCENTERS and ALL both land on the event dashboard;
        // AllServiceSideBar gives ALL users access to catering from there
        targetRoute = "/eventServiceManagement/eventServiceDashboard";
      }
      break;
    default:
      return "";
  }
  return targetRoute;
};

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
});

type FormData = z.infer<typeof schema>;
interface CustomError {
  status?: number;
  data?: {
    message?: string;
    userId?: string;
  };
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // New state for auth check

  const [login, { isLoading: isLoggingIn, error: loginError }] =
    useLoginMutation();
  const [refreshToken, { isLoading: isRefreshing }] = useRefreshTokenMutation();
  const [resendVerification, { isLoading: isResending }] =
    useResendVerificationMutation();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rememberMe: false },
  });

  // The individual-user read endpoint is admin-only. Existing customers and
  // providers use the sanitized identity supplied by their successful login.
  useEffect(() => {
    let active = true;
    async function checkAuth() {
      if (new URLSearchParams(window.location.search).get("reauth") === "1") { setIsCheckingAuth(false); return; }
      const userId = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
      const accessToken = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
      if (!userId || !accessToken) { setIsCheckingAuth(false); return; }
      if (localStorage.getItem("access_token") && !isTokenValid()) {
        try {
          const response = await refreshToken({ refresh_token: localStorage.getItem("refresh_token") || sessionStorage.getItem("refresh_token") || undefined }).unwrap();
          if (!active) return;
          storeTokens(response.access_token, response.refresh_token, userId, true);
        } catch (error) {
          if (!active) return;
          if ((error as CustomError).status === 401) clearTokens();
          setNotification({ message: getApiError(error, "Unable to refresh your session. Please sign in again."), type: "error" });
          setIsCheckingAuth(false);
          return;
        }
      }
      try {
        const snapshot = JSON.parse(currentUserSnapshot() || "null");
        const profile = snapshot?.profile ? JSON.parse(snapshot.profile) : null;
        if (profile?.id === userId && profile.isEmailVerified) {
          const route = getRedirectRoute(profile);
          if (route && active) { router.replace(route); return; }
        }
      } catch { /* Legacy sessions can sign in again to refresh their identity. */ }
      if (active) setIsCheckingAuth(false);
    }
    checkAuth();
    return () => { active = false; };
  }, [refreshToken, router]);

  // Reset navigation state if login fails
  useEffect(() => {
    if (loginError && isNavigating) {
      setIsNavigating(false);
    }
  }, [loginError, isNavigating]);

  const onSubmit = async (data: FormData) => {
    setNotification(null);
    setIsNavigating(true);
    try {
      const response = await login({
        email: data.email,
        password: data.password,
      }).unwrap();

      const { user, access_token, refresh_token } = response;

      if (!user.isEmailVerified) {
        clearTokens();
        localStorage.setItem("userId", user.id);
        try {
          await resendVerification({ id: user.id }).unwrap();
        } catch (error) {
          setNotification({
            message: getApiError(error, "Unable to send a verification code. Please try again."),
            type: "error",
          });
          setIsNavigating(false);
          return;
        }
        router.replace(`/verify-email?email=${encodeURIComponent(user.email || data.email)}`);
        return;
      }

      // Store tokens and user ID based on rememberMe
      storeTokens(access_token, refresh_token, user.id, data.rememberMe);
      persistBookmarkState(user);
      localStorage.removeItem("userId");

      // Redirect based on userType
      const targetRoute = getRedirectRoute(user);
      if (targetRoute) {
        router.replace(targetRoute); 
        setTimeout(() => setIsNavigating(false), 5000);
      } else {
        setNotification({ message: "Invalid user type", type: "error" });
        setIsNavigating(false);
      }
    } catch (error: unknown) {
      const err = error as CustomError;
      if (
        err.status === 401 &&
        err.data?.message === "Verification error!, kindly verifify your email before logging in."
      ) {
        const userId = localStorage.getItem("userId") || err.data?.userId; 
        if (userId) {
          localStorage.setItem("userId", userId);
          try {
            await resendVerification({ id: userId }).unwrap();
            setNotification({
              message: "Verification error!, kindly verify your email before logging in.",
              type: "error",
            });
            await new Promise((resolve) => setTimeout(resolve, 2000));
            router.replace(`/verify-email?email=${encodeURIComponent(data.email)}`);
          } catch {
            setNotification({
              message: "Failed to resend verification email.",
              type: "error",
            });
            setIsNavigating(false);
          }
        } else {
          setNotification({
            message: "User ID not found. Please sign up again.",
            type: "error",
          });
          setIsNavigating(false);
        }
      } else {
        setNotification({
          message: getApiError(error, "Unable to log in. Please try again."),
          type: "error",
        });
        setIsNavigating(false);
      }
    }
  };

  const isFormDisabled = isLoggingIn || isResending || isNavigating || isRefreshing;

  // Show loading spinner while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="max-w-md w-full space-y-4">
        <div className="text-center">
          <div className="flex items-center justify-center mb-6">
            <Image
              width={100}
              height={100}
              src="/logoSignup.png"
              alt="logoSignup.png"
            />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            Login to Your Account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Welcome back! Please enter your details.
          </p>
        </div>
        <form
          className="space-y-4 items-center justify-center flex flex-col"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="space-y-4 w-full">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email*
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                  <Mail className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  disabled={isFormDisabled}
                  className={`text-sm text-gray-500 block w-full pl-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50`}
                  placeholder="Enter your email"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password*
              </label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                  <Lock className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  disabled={isFormDisabled}
                  className={`text-sm text-gray-500 block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50`}
                  placeholder="Type your password"
                  {...register("password")}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-2"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isFormDisabled}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="checkbox"
                  type="checkbox"
                  disabled={isFormDisabled}
                  className={`w-4 h-4 border-gray-300 rounded-md text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50`}
                  {...register("rememberMe")}
                />
                <label
                  htmlFor="checkbox"
                  className="block ml-2 text-sm font-medium text-gray-700"
                >
                  Remember me for 7 days
                </label>
              </div>
              <div className="text-sm font-medium text-blue-600 hover:text-blue-400">
                <Link href="/forgotpassword">Forgot password?</Link>
              </div>
            </div>
          </div>

          {loginError && !notification && (
            <p className="text-sm text-red-500 text-center">
              {getApiError(loginError, "Unable to log in. Please try again.")}
            </p>
          )}

          <div className="w-full">
            <button
              type="submit"
              disabled={isFormDisabled}
              className={`w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md border border-transparent shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isNavigating || isRefreshing ? (
                <>
                  <Loader2 className="mr-2 animate-spin h-5 w-5" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </form>

        <p className="mt-2 text-sm text-center text-gray-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
