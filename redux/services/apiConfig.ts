const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

if (!apiBaseUrl) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL must be set");
}

export const API_BASE_URL = apiBaseUrl.replace(/\/+$/, "");