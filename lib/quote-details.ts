import type { ApiRecord } from "./operations";

export interface QuoteDetails {
  version: 1; minBudget: number; maxBudget: number; eventDate: string; guests: number;
  eventType: string; menu: string; dietary: string; allergies: string; drinks: string; staffing: string; equipment: string; notes: string;
}
export interface QuoteEventDetails {
  eventName: string;
  eventType: string;
  noOfGuest: number;
  eventTheme?: string;
  description?: string;
  cuisine?: string;
  dishTypes?: string;
  dietaryRequirements?: string;
  specialRequests?: string;
}
interface QuoteRequestNotes {
  version: 2;
  message?: string;
  eventDetails: QuoteEventDetails;
}

export function serializeQuoteRequestNotes(message: string, eventDetails: QuoteEventDetails): string {
  return JSON.stringify({
    version: 2,
    message: message || undefined,
    eventDetails,
  } satisfies QuoteRequestNotes);
}

export function parseQuoteRequestNotes(notes: unknown): QuoteRequestNotes | null {
  if (typeof notes !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(notes);
    if (!parsed || typeof parsed !== "object" || !("version" in parsed) || parsed.version !== 2 ||
      !("eventDetails" in parsed) || !parsed.eventDetails || typeof parsed.eventDetails !== "object") return null;
    const detailsValue = parsed.eventDetails;
    if (!detailsValue || typeof detailsValue !== "object") return null;
    const details = detailsValue as Record<string, unknown>;
    const eventName = details.eventName;
    const eventType = details.eventType;
    const noOfGuest = details.noOfGuest;
    if (typeof eventName !== "string" || typeof eventType !== "string" ||
      typeof noOfGuest !== "number" || !Number.isInteger(noOfGuest) || noOfGuest < 1) return null;
    const optionalString = (key: string) =>
      typeof details[key] === "string" ? details[key] as string : undefined;
    return {
      version: 2,
      message: "message" in parsed && typeof parsed.message === "string" ? parsed.message : undefined,
      eventDetails: {
        eventName,
        eventType,
        noOfGuest,
        eventTheme: optionalString("eventTheme"),
        description: optionalString("description"),
        cuisine: optionalString("cuisine"),
        dishTypes: optionalString("dishTypes"),
        dietaryRequirements: optionalString("dietaryRequirements"),
        specialRequests: optionalString("specialRequests"),
      },
    };
  } catch {
    return null;
  }
}

export function parseQuoteDetails(notes: unknown): QuoteDetails | null {
  if (typeof notes !== "string") return null;
  try { const parsed = JSON.parse(notes); return parsed.version === 1 && Number.isFinite(parsed.minBudget) && Number.isFinite(parsed.maxBudget) ? parsed : null; } catch { return null; }
}
export function formatQuoteBudget(value: unknown): string {
  if (typeof value !== "string") return "Not provided";
  const match = value.match(/^\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*$/);
  return match ? `${match[1]} – ${match[2]} NGN` : value || "Not provided";
}
export function filterOwnedQuotes(rows: ApiRecord[], role: "customer" | "provider" | null, customerId: string, providerId: string) {
  if (!role) return [];
  const ownerId = role === "provider" ? providerId : customerId;
  const ownerField = role === "provider" ? "serviceProvider" : "customerId";
  return rows.filter(row => String(row[ownerField]) === ownerId);
}
export function quoteStatus(status: string) {
  return ({ GENERATED: "Quote requested", PENDING: "Pending", PAID: "Paid", PARTIALLY_PAID: "Partially paid", OVERDUE: "Overdue" } as Record<string,string>)[status] || status.replaceAll("_", " ");
}
