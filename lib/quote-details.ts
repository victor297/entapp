import type { ApiRecord } from "./operations";

export interface QuoteDetails {
  version: 1; minBudget: number; maxBudget: number; eventDate: string; guests: number;
  eventType: string; menu: string; dietary: string; allergies: string; drinks: string; staffing: string; equipment: string; notes: string;
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
