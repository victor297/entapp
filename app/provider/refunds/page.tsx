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
  bookingId?: string;
  createdAt?: string;
  customerId?: string;
  deductionAmount?: number | string;
  deductionPercentage?: number | string;
  invoiceId?: string;
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

type Decision = {
  action: "approve" | "decline";
  refund: RefundRecord;
} | null;

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

export default function ProviderRefundsPage() {
  const { user, userId } = useCurrentUser();
  const isProvider = Boolean(userId && user?.userType === "SERVICE_PROVIDER");
  const refunds = useOperationListQuery(
    { resource: "/refunds", params: { serviceProviderId: userId } },
    { skip: !isProvider }
  );
  const [sendDecision, decisionState] = useOperationMutationMutation();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRefund, setSelectedRefund] = useState<RefundRecord | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [formError, setFormError] = useState("");
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
        refund.bookingId,
        refund.customerId,
        refund.refundReason,
      ].some((value) => String(value ?? "").toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });
  const visibleRows = filteredRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  const pendingCount = rows.filter(
    (refund) => refund.status === "REQUESTED"
  ).length;

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision) return;

    const reason = declineReason.trim();
    if (decision.action === "decline" && reason.length < 3) {
      setFormError("Enter a decline reason of at least 3 characters.");
      return;
    }

    setFormError("");
    setRequestError(undefined);
    setSuccess("");
    try {
      const approve = decision.action === "approve";
      await sendDecision({
        url: `/refunds/${encodeURIComponent(decision.refund.id)}/${approve ? "approve" : "decline"}`,
        method: "POST",
        ...(approve ? {} : { body: { reason } }),
      }).unwrap();
      setSuccess(
        approve
          ? "Refund approved. It will proceed through the configured processing flow."
          : "Refund request declined."
      );
      setDecision(null);
      setDeclineReason("");
      setSelectedRefund(null);
    } catch (error) {
      setRequestError(error);
    }
  }

  return (
    <Workspace role="provider" title="Refund requests">
      <nav className="mb-6 flex flex-wrap gap-4 text-blue-800 underline">
        <Link href="/provider/invoices">Invoices</Link>
        <Link href="/provider/wallet">Wallet</Link>
      </nav>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-600">Requests awaiting your review</p>
          <p className="mt-1 text-3xl font-semibold">{pendingCount}</p>
        </section>
        <section className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-600">Total refund requests</p>
          <p className="mt-1 text-3xl font-semibold">{rows.length}</p>
        </section>
      </div>

      {success && <Message>{success}</Message>}
      {Boolean(requestError) && <ApiError error={requestError} />}

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Refund history</h2>
            <p className="mt-1 text-sm text-gray-600">
              Review requests for services linked to your account.
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
                placeholder="Payment, customer, or reason"
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

        {refunds.isFetching && <Message>Loading refund requests…</Message>}
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
                      "Payment",
                      "Customer",
                      "Requested",
                      "Amount",
                      "Status",
                      "Actions",
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
                      <td className="whitespace-nowrap p-4">
                        {refund.id}
                      </td>
                      <td className="whitespace-nowrap p-4">
                        {refund.payment?.reference || refund.paymentId || "—"}
                      </td>
                      <td className="whitespace-nowrap p-4">
                        {refund.customerId || "—"}
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
                        <div className="flex items-center gap-3">
                          <button
                            className="text-blue-800 underline"
                            onClick={() => setSelectedRefund(refund)}
                          >
                            Details
                          </button>
                          {refund.status === "REQUESTED" && (
                            <>
                              <button
                                className="text-green-800 underline disabled:opacity-50"
                                disabled={decisionState.isLoading}
                                onClick={() => {
                                  setFormError("");
                                  setRequestError(undefined);
                                  setDecision({ action: "approve", refund });
                                }}
                              >
                                Approve
                              </button>
                              <button
                                className="text-red-800 underline disabled:opacity-50"
                                disabled={decisionState.isLoading}
                                onClick={() => {
                                  setFormError("");
                                  setRequestError(undefined);
                                  setDeclineReason("");
                                  setDecision({ action: "decline", refund });
                                }}
                              >
                                Decline
                              </button>
                            </>
                          )}
                        </div>
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
      </section>

      {selectedRefund && !decision && (
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
                <dt className="text-gray-600">Refund ID</dt>
                <dd className="break-all">{selectedRefund.id}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Status</dt>
                <dd>{selectedRefund.status || "UNKNOWN"}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Requested amount</dt>
                <dd>
                  {money(
                    selectedRefund.refundAmount,
                    selectedRefund.payment?.currency || "NGN"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-gray-600">Requested on</dt>
                <dd>{formatDate(selectedRefund.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Customer ID</dt>
                <dd className="break-all">{selectedRefund.customerId || "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Payment ID</dt>
                <dd className="break-all">{selectedRefund.paymentId || "—"}</dd>
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
                <dt className="text-gray-600">Customer’s reason</dt>
                <dd className="mt-1 whitespace-pre-wrap">
                  {selectedRefund.refundReason || "No reason provided"}
                </dd>
              </div>
            </dl>
            <button
              className={`${buttonClass} mt-6`}
              onClick={() => setSelectedRefund(null)}
            >
              Close
            </button>
          </section>
        </div>
      )}

      {decision && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-decision-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <form
            className="w-full max-w-lg rounded-xl bg-white p-6"
            onSubmit={submitDecision}
          >
            <h2 id="refund-decision-title" className="text-xl font-semibold">
              {decision.action === "approve" ? "Approve" : "Decline"} refund?
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              Refund {decision.refund.id} ·{" "}
              {money(
                decision.refund.refundAmount,
                decision.refund.payment?.currency || "NGN"
              )}
            </p>
            {decision.action === "approve" ? (
              <p className="my-4 text-sm text-gray-600">
                The customer refund request will be approved for processing.
              </p>
            ) : (
              <label className="mt-4 block text-sm font-medium">
                Reason for declining
                <textarea
                  className={fieldClass}
                  minLength={3}
                  maxLength={1000}
                  required
                  value={declineReason}
                  onChange={(event) => setDeclineReason(event.target.value)}
                />
              </label>
            )}
            {formError && (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {formError}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border px-4 py-2.5"
                disabled={decisionState.isLoading}
                onClick={() => setDecision(null)}
              >
                Cancel
              </button>
              <button
                className={buttonClass}
                disabled={decisionState.isLoading}
              >
                {decisionState.isLoading
                  ? "Saving…"
                  : decision.action === "approve"
                    ? "Confirm approval"
                    : "Confirm decline"}
              </button>
            </div>
          </form>
        </div>
      )}
    </Workspace>
  );
}
