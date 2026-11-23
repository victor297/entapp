"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ApiError,
  fieldClass,
  Message,
  Pager,
  Workspace,
} from "@/components/operations/Workspace";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { money, type ApiRecord } from "@/lib/operations";
import { useOperationListQuery } from "@/redux/services/operationsApi";

interface RefundRecord extends ApiRecord {
  createdAt?: string;
  deductionAmount?: number | string;
  deductionPercentage?: number | string;
  payment?: {
    currency?: string;
    reference?: string;
  };
  paymentId?: string;
  processAt?: string;
  refundAmount?: number | string;
  refundReason?: string;
  status?: string;
}

const PAGE_SIZE = 10;
const statuses = [
  "REQUESTED",
  "APPROVED",
  "PROCESSING",
  "COMPLETED",
  "DECLINED",
  "FAILED",
];

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-GB");
}

function statusStyle(status?: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    case "DECLINED":
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "APPROVED":
    case "PROCESSING":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-blue-100 text-blue-800";
  }
}

export default function CustomerRefundsPage() {
  const { user, userId } = useCurrentUser();
  const isCustomer = Boolean(userId && user?.userType === "CUSTOMER");
  const refunds = useOperationListQuery(
    { resource: "/refunds", params: { customerId: userId } },
    { skip: !isCustomer }
  );
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRefund, setSelectedRefund] = useState<RefundRecord | null>(
    null
  );

  const rows = useMemo<RefundRecord[]>(
    () => refunds.data ?? [],
    [refunds.data]
  );
  const filteredRows = rows.filter((refund) => {
    const matchesStatus =
      statusFilter === "ALL" || refund.status === statusFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [refund.id, refund.paymentId, refund.refundReason].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );
    return matchesStatus && matchesSearch;
  });
  const visibleRows = filteredRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <Workspace role="customer" title="Refund requests">
      <nav className="mb-6 flex flex-wrap gap-4 text-blue-800 underline">
        <Link href="/customer/invoices">Invoices</Link>
        <Link href="/customer/wallet">Wallet</Link>
        <Link href="/customer/disputes">Disputes</Link>
      </nav>

      <Message>
        This page shows refund requests already submitted for your payments.
        Refund requests cannot be started here because the API does not expose
        a customer request endpoint.
      </Message>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Refund history</h2>
          <p className="mt-1 text-sm text-gray-600">
            Track refund status and the amount associated with each request.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Search
            <input
              className={fieldClass}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Payment or reason"
            />
          </label>
          <label className="text-sm">
            Status
            <select
              className={fieldClass}
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {refunds.isFetching && <Message>Loading refund history…</Message>}
      {refunds.error && (
        <ApiError error={refunds.error} retry={refunds.refetch} />
      )}
      {!refunds.isFetching && !refunds.error && !filteredRows.length && (
        <Message>No refund requests match your search.</Message>
      )}
      {!refunds.error && filteredRows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {["Refund", "Payment", "Requested", "Amount", "Status", ""].map(
                    (heading) => (
                      <th className="whitespace-nowrap p-4" key={heading}>
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((refund) => (
                  <tr className="border-t" key={refund.id}>
                    <td className="whitespace-nowrap p-4">{refund.id}</td>
                    <td className="whitespace-nowrap p-4">
                      {refund.payment?.reference || refund.paymentId || "—"}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      {formatDate(refund.createdAt)}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      {money(
                        refund.refundAmount,
                        refund.payment?.currency || "NGN"
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle(refund.status)}`}
                      >
                        {refund.status || "UNKNOWN"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-4">
                      <button
                        className="text-blue-800 underline"
                        onClick={() => setSelectedRefund(refund)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            page={page}
            count={filteredRows.length}
            size={PAGE_SIZE}
            onChange={setPage}
          />
        </>
      )}

      {selectedRefund && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-details-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedRefund(null)}
        >
          <section
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="refund-details-title" className="text-xl font-semibold">
              Refund request details
            </h2>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-600">Status</dt>
                <dd>{selectedRefund.status || "UNKNOWN"}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Payment</dt>
                <dd className="break-all">
                  {selectedRefund.payment?.reference ||
                    selectedRefund.paymentId ||
                    "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-600">Refund amount</dt>
                <dd>
                  {money(
                    selectedRefund.refundAmount,
                    selectedRefund.payment?.currency || "NGN"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-gray-600">Requested</dt>
                <dd>{formatDate(selectedRefund.createdAt)}</dd>
              </div>
              {selectedRefund.deductionPercentage !== undefined && (
                <div>
                  <dt className="text-gray-600">Policy deduction</dt>
                  <dd>{selectedRefund.deductionPercentage}%</dd>
                </div>
              )}
              {selectedRefund.deductionAmount !== undefined && (
                <div>
                  <dt className="text-gray-600">Deducted amount</dt>
                  <dd>
                    {money(
                      selectedRefund.deductionAmount,
                      selectedRefund.payment?.currency || "NGN"
                    )}
                  </dd>
                </div>
              )}
              {selectedRefund.processAt && (
                <div>
                  <dt className="text-gray-600">Scheduled processing</dt>
                  <dd>{formatDate(selectedRefund.processAt)}</dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-gray-600">Reason</dt>
                <dd className="mt-1 whitespace-pre-wrap">
                  {selectedRefund.refundReason || "No reason provided"}
                </dd>
              </div>
            </dl>
            <button
              className="mt-6 rounded-lg border px-4 py-2.5"
              onClick={() => setSelectedRefund(null)}
            >
              Close
            </button>
          </section>
        </div>
      )}
    </Workspace>
  );
}
