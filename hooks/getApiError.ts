const connectionMessage = "Unable to connect to the server. Check your connection and try again.";

function messageText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const text = value.trim();
    // Proxy error pages are not useful form validation messages.
    return text && !/^\s*</.test(text) ? text : undefined;
  }
  if (Array.isArray(value)) {
    const messages = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
    return messages.length ? messages.join(" ") : undefined;
  }
}

/** Keep transport failures separate from a rejection returned by the API. */
export function getApiError(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const e = error as { status?: string | number; originalStatus?: number; data?: unknown; message?: unknown; error?: unknown };
    // Browsers report CORS, offline and DNS failures as an opaque fetch error;
    // JavaScript cannot reliably distinguish their individual causes.
    if (e.status === "FETCH_ERROR") return connectionMessage;
    if (e.status === "TIMEOUT_ERROR") return "The server took too long to respond. Please try again.";
    if (e.status === "PARSING_ERROR") return "The server returned an unexpected response. Please try again.";
    if (e.status === "CUSTOM_ERROR" && typeof e.error === "string") return e.error;
    const technicalMessage = messageText(e.error) || messageText(e.message);
    if (technicalMessage && /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(technicalMessage)) return connectionMessage;
    if (e.data && typeof e.data === "object" && "message" in e.data) {
      const message = messageText(e.data.message);
      if (message) return message;
    }
    const text = messageText(e.data);
    if (text) return text;
    if (typeof e.status === "number" && e.status >= 500) return "The server is temporarily unavailable. Please try again later.";
    const message = messageText(e.message);
    if (message) return message;
  }
  return fallback;
}
