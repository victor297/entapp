"use client";
import Link from "next/link";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOperationListQuery, useOperationRecordQuery } from "@/redux/services/operationsApi";
import { filterRecords, money } from "@/lib/operations";
import { Workspace, Message, ApiError, fieldClass } from "./Workspace";
export default function Dashboard({ role }: { role: "admin" | "provider" }) {
  const { user, userId } = useCurrentUser(); const ready = Boolean(userId && user?.userType === (role === "admin" ? "ADMIN" : "SERVICE_PROVIDER"));
  const bookings = useOperationListQuery({ resource: "/booking", params: role === "provider" ? { serviceProvider: userId } : {} }, { skip: !ready });
  const ledger = useOperationListQuery({ resource: role === "admin" ? "/wallet/platform-transactions" : "/wallet/transactions" }, { skip: !ready });
  const wallet = useOperationRecordQuery("/wallet", { skip: !ready || role !== "provider" });
  const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const rows = filterRecords((bookings.data || []).filter(row => role === "admin" || row.serviceProvider === userId), { start, end });
  const credits = filterRecords(ledger.data || [], { start, end }).filter(row => row.type === "CREDIT" && (row.reason === (role === "admin" ? "SERVICE_CHARGE" : "ESCROW_RELEASE")));
  const total = credits.reduce((sum, row) => sum + Number(row.amount), 0);
  const months = new Map<string, { month: string; bookings: number }>();
  rows.forEach(row => { const key = String(row.createdAt).slice(0, 7); const month = months.get(key) || { month: key, bookings: 0 }; month.bookings++; months.set(key, month); });
  const revenueMonths = new Map<string, { month: string; amount: number }>();
  credits.forEach(row => { const key = String(row.createdAt).slice(0, 7); const month = revenueMonths.get(key) || { month: key, amount: 0 }; month.amount += Number(row.amount); revenueMonths.set(key, month); });
  const revenue = [...revenueMonths.values()].sort((a, b) => a.month.localeCompare(b.month));
  const data = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
  return <Workspace role={role} title="Overview">{role === "provider" && <section className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-5"><div className="mb-4"><h2 className="font-semibold text-blue-950">Manage your listings and availability</h2><p className="mt-1 text-sm text-blue-900">Add an event center or catering service listing, then create time slots for it.</p></div><div className="flex flex-wrap gap-3"><Link href="/eventServiceManagement/add-event-center" className="inline-flex items-center rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-900">Add event center</Link><Link href="/cateringServiceManagement/add-catering-services" className="inline-flex items-center rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-900">Add catering service</Link><Link href="/provider/availability" className="inline-flex items-center rounded-lg border border-blue-800 px-4 py-2.5 text-sm font-medium text-blue-900 hover:bg-blue-100">Create time slots</Link></div></section>}<div className="mb-6 flex flex-wrap gap-4"><label>Created from<input className={fieldClass} type="date" value={start} max={end || undefined} onChange={event => setStart(event.target.value)} /></label><label>Created through<input className={fieldClass} type="date" value={end} min={start || undefined} onChange={event => setEnd(event.target.value)} /></label></div>
    {(bookings.isFetching || ledger.isFetching) && <Message>Loading account statistics…</Message>}{bookings.error && <ApiError error={bookings.error} retry={bookings.refetch} />}{ledger.error && <ApiError error={ledger.error} retry={ledger.refetch} />}
    <div className="grid gap-4 sm:grid-cols-3">{[["Bookings in selected period", bookings.error ? "Unavailable" : bookings.isFetching ? "Loading?" : rows.length], ["Confirmed bookings", bookings.error ? "Unavailable" : rows.filter(row => row.status === "CONFIRMED").length], [role === "admin" ? "Service fees received (NGN)" : "Booking earnings received", ledger.error || ledger.isFetching || (role === "provider" && !wallet.data) ? "Unavailable" : money(total, role === "admin" ? "NGN" : wallet.data?.currency)]].map(([label, value]) => <div className="rounded-xl border bg-white p-6" key={label}><p className="text-sm text-gray-600">{label}</p><strong className="text-3xl">{value}</strong></div>)}</div>
    <section className="mt-6 rounded-xl border bg-white p-6"><h2 className="mb-5 text-xl font-semibold">Bookings by month</h2>{data.length ? <ResponsiveContainer height={260} width="100%"><BarChart data={data}><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="bookings" fill="#0047AB" /></BarChart></ResponsiveContainer> : <p>No bookings returned for this period.</p>}</section><section className="mt-6 rounded-xl border bg-white p-6"><h2 className="mb-5 text-xl font-semibold">{role === "admin" ? "Service fees received by month" : "Booking earnings received by month"}</h2>{revenue.length ? <ResponsiveContainer height={260} width="100%"><BarChart data={revenue}><XAxis dataKey="month" /><YAxis /><Tooltip formatter={value => money(value, role === "admin" ? "NGN" : wallet.data?.currency)} /><Bar dataKey="amount" fill="#15803D" /></BarChart></ResponsiveContainer> : <p>No earnings returned for this period.</p>}</section><p className="mt-4 text-sm text-gray-600">Dates filter the creation date of bookings and wallet transactions. Figures are calculated from the account records returned by the server.</p>
  </Workspace>;
}
