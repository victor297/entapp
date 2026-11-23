export interface QuoteDetails {
  version: 1; minBudget: number; maxBudget: number; currency: "NGN"; eventDate: string; guests: number;
  eventType: string; menu: string; dietary: string; allergies: string; drinks: string; staffing: string; equipment: string; notes: string;
}
export function parseQuoteDetails(notes: unknown): QuoteDetails | null {
  if (typeof notes !== "string") return null;
  try { const parsed = JSON.parse(notes); return parsed.version === 1 && Number.isFinite(parsed.minBudget) && Number.isFinite(parsed.maxBudget) ? parsed : null; } catch { return null; }
}
export function rememberQuote(userId: string, quoteId: string) {
  try { const key = `quote-ids:${userId}`; const raw = JSON.parse(localStorage.getItem(key) || "[]"); localStorage.setItem(key, JSON.stringify([...new Set([...(Array.isArray(raw) ? raw : []), quoteId])])); } catch { /* The direct quote link remains available without browser storage. */ }
}
export function knownQuoteIds(userId: string): string[] {
  try { const ids = JSON.parse(localStorage.getItem(`quote-ids:${userId}`) || "[]"); return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []; } catch { return []; }
}
export function quoteStatus(status: string) {
  return ({ GENERATED: "Quote requested", PENDING: "Pending", PAID: "Paid", PARTIALLY_PAID: "Partially paid", OVERDUE: "Overdue" } as Record<string,string>)[status] || status.replaceAll("_", " ");
}
