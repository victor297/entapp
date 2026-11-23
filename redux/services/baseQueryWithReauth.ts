import { fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { API_BASE_URL } from "./apiConfig";

type QueryArgs = string | FetchArgs;
type RefreshResponse = { access_token?: string };

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  timeout: 20000,
  credentials: "include",
  prepareHeaders: (headers) => {
    if (typeof window === "undefined") return headers;
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

let refreshPromise: Promise<string | null> | null = null;

function currentAccessToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
}

function isAuthRequest(args: QueryArgs) {
  const url = typeof args === "string" ? args : args.url;
  return /^\/?users\/(login|refresh-login)(?:[/?]|$)/.test(url);
}

async function refreshAccessToken(api: Parameters<typeof rawBaseQuery>[1], extraOptions: Parameters<typeof rawBaseQuery>[2]) {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await rawBaseQuery(
        { url: "/users/refresh-login", method: "POST", credentials: "include" },
        api,
        extraOptions
      );
      const token = (response.data as RefreshResponse | undefined)?.access_token;
      if (!token || typeof window === "undefined") {
        if (response.error?.status === 401) {
          for (const storage of [localStorage, sessionStorage]) {
            for (const key of ["access_token", "refresh_token", "token_expiry", "user_id"]) storage.removeItem(key);
          }
          window.dispatchEvent(new Event("auth-change"));
        }
        return null;
      }

      const storage = localStorage.getItem("access_token") ? localStorage : sessionStorage;
      storage.setItem("access_token", token);
      window.dispatchEvent(new Event("auth-change"));
      return token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export const baseQueryWithReauth: BaseQueryFn<QueryArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  const tokenUsed = currentAccessToken();
  let result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status !== 401 || isAuthRequest(args) || !tokenUsed || typeof window === "undefined") return result;

  const tokenNow = currentAccessToken();
  const refreshedToken = tokenNow !== tokenUsed ? tokenNow : await refreshAccessToken(api, extraOptions);
  if (!refreshedToken) return result;

  result = await rawBaseQuery(args, api, extraOptions);
  return result;
};
