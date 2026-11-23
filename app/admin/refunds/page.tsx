"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  ApiError,
  buttonClass,
  fieldClass,
  Message,
  Pager,
  Workspace,
} from "@/components/operations/Workspace";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { money, type ApiRecord } from "@/lib/operations";
import {
  useOperationListQuery,
  useOperationMutationMutation,
} from "@/redux/services/operationsApi";

interface RefundRecord extends ApiRecord {
  createdAt?: string;
  customerId?: string;
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
  serviceProviderId?: string;
  status?: string;
}

type RefundStatus =
  | "REQUESTED"
  | "APPROVED"
  | "DECLINED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

const PAGE_SIZE = 10;
const statusTransitions: Record<string, RefundStatus[]> = {
  REQUESTED: ["APPROVED", "DECLINED"],
  APPROVED: ["PROCESSING", "FAILED"],
  PROCESSING: ["COMPLETED", "FAILED"],
};
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

export default function AdminRefundsPage() {
  const { user, userId } = useCurrentUser();
  const isAdmin = Boolean(userId && user?.userType === "ADMIN");
  const refunds = useOperationListQuery(
    { resource: "/refunds" },
    { skip: !isAdmin }
  );
  const [updateRefund, updateState] = useOperationMutationMutation();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRefund, setSelectedRefund] = useState<RefundRecord | null>(
    null
  );
  const [nextStatus, setNextStatus] = useState<RefundStatus | "">("");
  const [requestError, setRequestError] = useState<unknown>();
  const [success, setSuccess] = useState("");

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
      [
        refund.id,
        refund.paymentId,
        refund.invoiceId,
        refund.customerId,
        refund.serviceProviderId,
        refund.refundReason,
      ].some((value) => String(value ?? "").toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });
  const visibleRows = filteredRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  function openStatusEditor(refund: RefundRecord) {
    const choices = statusTransitions[refund.status ?? ""] ?? [];
    setSelectedRefund(refund);
    setNextStatus(choices[0] ?? "");
    setRequestError(undefined);
  }

  async function saveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRefund || !nextStatus || !userId) return;

    setRequestError(undefined);
    setSuccess("");
    try {
      await updateRefund({
        url: `/refunds/${encodeURIComponent(selectedRefund.id)}`,
        method: "PATCH",
        body: { status: nextStatus, updatedBy: userId },
      }).unwrap();
      setSuccess(`Refund ${selectedRefund.id} updated to ${nextStatus}.`);
      setSelectedRefund(null);
      setNextStatus("");
    } catch (error) {
      setRequestError(error);
    }
  }

  const currentChoices = selectedRefund
    ? statusTransitions[selectedRefund.status ?? ""] ?? []
    : [];

  return (
    <Workspace role="admin" title="Refund management">
      <nav className="mb-6 flex flex-wrap gap-4 text-blue-800 underline">
        <Link href="/admin/payments">Payments</Link>
        <Link href="/admin/invoices">Invoices</Link>
        <Link href="/admin/withdrawals">Withdrawals</Link>
      </nav>

      <p className="mb-5 text-sm text-gray-600">
        Update refund workflow status. Each status transition is presented
        separately so requests can’t be reopened from a terminal state.
      </p>
      {success && <Message>{success}</Message>}
      {Boolean(requestError) && <ApiError error={requestError} />}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Refund requests</h2>
          <p className="mt-1 text-sm text-gray-600">
            {rows.length} request{rows.length === 1 ? "" : "s"}
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
              placeholder="Payment, customer, provider, or reason"
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

      {refunds.isFetching && <Message>Loading refunds…</Message>}
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
                  {[
                    "Refund",
                    "Customer",
                    "Provider",
                    "Payment",
                    "Requested",
                    "Amount",
                    "Status",
                    "Action",
                  ].map((heading) => (
                    <th className="whitespace-nowrap p-4" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((refund) => (
                  <tr className="border-t" key={refund.id}>
                    <td className="whitespace-nowrap p-4">{refund.id}</td>
                    <td className="whitespace-nowrap p-4">
                      {refund.customerId || "—"}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      {refund.serviceProviderId || "—"}
                    </td>
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
                      {(statusTransitions[refund.status ?? ""] ?? []).length >
                      0 ? (
                        <button
                          className="text-blue-800 underline"
                          disabled={updateState.isLoading}
                          onClick={() => openStatusEditor(refund)}
                        >
                          Update status
                        </button>
                      ) : (
                        <span className="text-gray-500">Final</span>
                      )}
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
          aria-labelledby="refund-status-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedRefund(null)}
        >
          <form
            className="w-full max-w-lg rounded-xl bg-white p-6"
            onSubmit={saveStatus}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="refund-status-title" className="text-xl font-semibold">
              Update refund status
            </h2>
            <p className="mt-2 break-all text-sm text-gray-600">
              {selectedRefund.id}
            </p>
            <label className="mt-5 block text-sm font-medium">
              New status
              <select
                className={fieldClass}
                value={nextStatus}
                onChange={(event) =>
                  setNextStatus(event.target.value as RefundStatus)
                }
                required
              >
                {currentChoices.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border px-4 py-2.5"
                disabled={updateState.isLoading}
                onClick={() => setSelectedRefund(null)}
              >
                Cancel
              </button>
              <button
                className={buttonClass}
                disabled={updateState.isLoading || !nextStatus}
              >
                {updateState.isLoading ? "Saving…" : "Save status"}
              </button>
            </div>
          </form>
        </div>
      )}
    </Workspace>
  );
}
