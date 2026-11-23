"use client";
import Link from "next/link";
import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOperationListQuery, useCustomerBookingsQuery } from "@/redux/services/operationsApi";
import { bookingStatus, paymentStatus, filterRecords, money } from "@/lib/operations";
import { Workspace, ApiError, Message, Pager, buttonClass } from "./Workspace";
import RecordFilters, { emptyFilters } from "./RecordFilters";
export default function BookingsPage({ role, serviceType }: { role: "admin" | "provider" | "customer"; serviceType?: string }) {
  const { userId, user } = useCurrentUser(); const [filters, setFilters] = useState(emptyFilters); const [page, setPage] = useState(1);
  const ready = Boolean(userId && user?.userType === (role === "admin" ? "ADMIN" : role === "provider" ? "SERVICE_PROVIDER" : "CUSTOMER"));
  const provider = useOperationListQuery({ resource: "/booking", params: role === "provider" ? { serviceProvider: userId } : {} }, { skip: !ready || role === "customer" });
  const customer = useCustomerBookingsQuery(userId, { skip: !ready || role !== "customer" });
  const result = role === "customer" ? customer : provider;
  const owned = (result.data ?? []).filter(row => (!serviceType || row.serviceType === serviceType) && (role !== "provider" || row.serviceProvider === userId) && (role !== "customer" || row.customerId === userId));
  const rows = filterRecords(owned, filters);
  return <Workspace role={role} title="Bookings">
    {role === "customer" && <Message>Bookings linked to your invoices appear here. If a recent booking is missing, open its confirmation link or contact the provider.</Message>}
    {role === "provider" && <Link href={`/provider/manual-booking${serviceType ? `?serviceType=${serviceType}` : ""}`} className={`${buttonClass} mb-5`}>Create a booking</Link>}
    <RecordFilters rows={owned} filters={filters} onChange={next => { setFilters(next); setPage(1); }} statuses={["PENDING", "CONFIRMED", "RESERVED", "POSTPONED", "CANCELED", "COMPLETED"]} />
    {result.isFetching && <Message>Loading bookings…</Message>}
    {result.error ? <ApiError error={result.error} retry={result.refetch} /> : !result.isFetching && !rows.length ? <Message>No bookings match these filters.</Message> : <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-gray-100"><tr>{["Reference", "Listing", "Created", "Booking status", "Payment", "Total", ""].map(text => <th className="p-4" key={text}>{text}</th>)}</tr></thead><tbody>{rows.slice((page - 1) * 12, page * 12).map(row => <tr className="border-t border-gray-100" key={row.id}><td className="p-4">{row.bookingReference || row.id}</td><td className="p-4">{row.serviceName || row.serviceId}</td><td className="p-4">{new Date(row.createdAt).toLocaleDateString("en-GB")}</td><td className="p-4">{bookingStatus(row.status)}</td><td className="p-4">{paymentStatus(row.paymentStatus)}</td><td className="p-4">{money(row.total, row.currency)}</td><td className="p-4"><Link className="font-medium text-blue-800 underline" href={`/${role === "customer" ? "bookings" : `${role}/bookings`}/${row.id}`}>View booking</Link></td></tr>)}</tbody></table></div>}
    {!result.error && <Pager page={page} count={rows.length} onChange={setPage} />}
  </Workspace>;
}
