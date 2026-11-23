"use client";
import { fieldClass } from "./Workspace";
import type { ApiRecord } from "@/lib/operations";
export interface Filters { search: string; status: string; serviceId: string; start: string; end: string }
export const emptyFilters: Filters = { search: "", status: "", serviceId: "", start: "", end: "" };
export default function RecordFilters({ filters, onChange, rows, statuses = [], listing = true }: { filters: Filters; onChange: (next: Filters) => void; rows: ApiRecord[]; statuses?: string[]; listing?: boolean }) {
  const listings = [...new Map(rows.filter(row => row.serviceId).map(row => [row.serviceId, row.serviceName || row.serviceId])).entries()];
  function update(key: keyof Filters, value: string) { onChange({ ...filters, [key]: value }); }
  return <form onSubmit={event => event.preventDefault()} className="mb-6 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
    <label className="text-sm">Search<input type="search" className={fieldClass} value={filters.search} onChange={e => update("search", e.target.value)} /></label>
    <label className="text-sm">Status<select className={fieldClass} value={filters.status} onChange={e => update("status", e.target.value)}><option value="">All statuses</option>{statuses.map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
    {listing && <label className="text-sm">Listing<select className={fieldClass} value={filters.serviceId} onChange={e => update("serviceId", e.target.value)}><option value="">All listings</option>{listings.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
    <label className="text-sm">Created from<input type="date" className={fieldClass} value={filters.start} onChange={e => update("start", e.target.value)} max={filters.end || undefined} /></label>
    <label className="text-sm">Created through<input type="date" className={fieldClass} value={filters.end} onChange={e => update("end", e.target.value)} min={filters.start || undefined} /></label>
  </form>;
}
