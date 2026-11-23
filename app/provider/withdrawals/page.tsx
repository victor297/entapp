"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
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
  useOperationRecordQuery,
} from "@/redux/services/operationsApi";

interface BankDetails {
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
}

interface WithdrawalRecord extends ApiRecord {
  amount?: number | string;
  bankDetails?: BankDetails;
  createdAt?: string;
  currency?: string;
  reference?: string;
  status?: string;
}

const PAGE_SIZE = 10;
const statuses = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"];

function getBankDetails(value: unknown): BankDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const details = value as Record<string, unknown>;
  return {
    accountName:
      typeof details.accountName === "string" ? details.accountName : undefined,
    accountNumber:
      typeof details.accountNumber === "string"
        ? details.accountNumber
        : undefined,
    bankName: typeof details.bankName === "string" ? details.bankName : undefined,
  };
}

function maskAccountNumber(accountNumber?: string) {
  if (!accountNumber) return "Not provided";
  return `${"*".repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-GB");
}

function statusStyle(status?: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "PROCESSING":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-blue-100 text-blue-800";
  }
}

export default function ProviderWithdrawalsPage() {
  const { user, userId } = useCurrentUser();
  const isProvider = Boolean(userId && user?.userType === "SERVICE_PROVIDER");
  const wallet = useOperationRecordQuery("/wallet", { skip: !isProvider });
  const withdrawals = useOperationListQuery(
    { resource: "/withdrawals" },
    { skip: !isProvider }
  );
  const [createWithdrawal, createState] = useOperationMutationMutation();
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [requestError, setRequestError] = useState<unknown>();
  const balance = Number(wallet.data?.balance);
  const currency =
    typeof wallet.data?.currency === "string" ? wallet.data.currency : "NGN";

  const rows = useMemo<WithdrawalRecord[]>(
    () =>
      (withdrawals.data ?? []).map((row) => ({
        ...row,
        bankDetails: getBankDetails(row.bankDetails),
      })),
    [withdrawals.data]
  );
  const filteredRows = rows.filter((row) => {
    const matchesStatus =
      statusFilter === "ALL" || row.status === statusFilter;
    const query = search.trim().toLowerCase();
    const details = row.bankDetails ?? {};
    const matchesSearch =
      !query ||
      [row.reference, row.id, details.bankName, details.accountName]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });
  const visibleRows = filteredRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  const expandedRow = rows.find((row) => row.id === expandedId);

  async function submitWithdrawal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    setRequestError(undefined);

    const requestedAmount = Number(amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      setFormError("Enter a withdrawal amount greater than zero.");
      return;
    }
    if (!Number.isFinite(balance) || requestedAmount > balance) {
      setFormError("The withdrawal amount exceeds your available wallet balance.");
      return;
    }
    if (!userId || !accountName.trim() || !accountNumber.trim() || !bankName.trim()) {
      setFormError("Enter the account holder name, account number, and bank name.");
      return;
    }

    try {
      await createWithdrawal({
        url: "/withdrawals",
        method: "POST",
        body: {
          userId,
          amount: requestedAmount,
          currency,
          bankDetails: {
            accountName: accountName.trim(),
            accountNumber: accountNumber.trim(),
            bankName: bankName.trim(),
          },
        },
      }).unwrap();
      setAmount("");
      setAccountName("");
      setAccountNumber("");
      setBankName("");
      setSuccess("Your withdrawal request was submitted.");
    } catch (error) {
      setRequestError(error);
    }
  }

  return (
    <Workspace role="provider" title="Withdrawals">
      <div className="mb-6 flex flex-wrap gap-4 text-blue-800 underline">
        <Link href="/provider/wallet">Wallet</Link>
        <Link href="/provider/invoices">Invoices</Link>
      </div>

      <section className="mb-8 rounded-xl border bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Available wallet balance</h2>
        {wallet.isFetching && <Message>Loading wallet…</Message>}
        {wallet.error && <ApiError error={wallet.error} retry={wallet.refetch} />}
        {!wallet.isFetching && !wallet.error && wallet.data && (
          <p className="mt-2 text-3xl font-semibold">
            {money(wallet.data.balance, currency)}
          </p>
        )}
        {!wallet.isFetching && !wallet.error && !wallet.data && (
          <Message>No wallet was returned for your account.</Message>
        )}
      </section>

      <section className="mb-10 rounded-xl border bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Request a withdrawal</h2>
        <p className="mt-2 text-sm text-gray-600">
          Your payout details are submitted with this request and aren’t saved as a reusable account.
        </p>
        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={submitWithdrawal}>
          <label className="block text-sm font-medium">
            Amount ({currency})
            <input
              className={fieldClass}
              type="number"
              min="0.01"
              step="0.01"
              max={Number.isFinite(balance) ? balance : undefined}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Account holder name
            <input
              className={fieldClass}
              autoComplete="name"
              maxLength={100}
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Account number
            <input
              className={fieldClass}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={34}
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Bank name
            <input
              className={fieldClass}
              autoComplete="off"
              maxLength={100}
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              required
            />
          </label>
          {formError && (
            <p className="text-sm text-red-700 md:col-span-2" role="alert">
              {formError}
            </p>
          )}
          {success && (
            <div className="md:col-span-2">
              <Message>{success}</Message>
            </div>
          )}
          {Boolean(requestError) && (
            <div className="md:col-span-2">
              <ApiError error={requestError} />
            </div>
          )}
          <div className="md:col-span-2">
            <button
              className={buttonClass}
              disabled={
                createState.isLoading ||
                wallet.isFetching ||
                Boolean(wallet.error) ||
                !wallet.data ||
                !Number.isFinite(balance) ||
                balance <= 0
              }
            >
              {createState.isLoading ? "Submitting…" : "Submit withdrawal request"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Withdrawal history</h2>
            <p className="mt-1 text-sm text-gray-600">
              Requests and status updates for your account.
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
                placeholder="Reference or bank"
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

        {withdrawals.isFetching && <Message>Loading withdrawal history…</Message>}
        {withdrawals.error && (
          <ApiError error={withdrawals.error} retry={withdrawals.refetch} />
        )}
        {!withdrawals.isFetching && !withdrawals.error && !filteredRows.length && (
          <Message>No withdrawal requests match your search.</Message>
        )}
        {!withdrawals.error && filteredRows.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    {["Reference", "Requested", "Payout account", "Status", "Amount", ""].map(
                      (heading) => (
                        <th className="whitespace-nowrap p-4" key={heading}>
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const details = row.bankDetails ?? {};
                    return (
                      <tr className="border-t" key={row.id}>
                        <td className="whitespace-nowrap p-4">
                          {row.reference || row.id}
                        </td>
                        <td className="whitespace-nowrap p-4">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="p-4">
                          <span>{details.bankName || "—"}</span>
                          <span className="block text-xs text-gray-600">
                            {maskAccountNumber(details.accountNumber)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle(row.status)}`}
                          >
                            {row.status || "UNKNOWN"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap p-4">
                          {money(row.amount, row.currency || currency)}
                        </td>
                        <td className="whitespace-nowrap p-4">
                          <button
                            className="text-blue-800 underline"
                            onClick={() =>
                              setExpandedId(expandedId === row.id ? "" : row.id)
                            }
                            aria-expanded={expandedId === row.id}
                          >
                            {expandedId === row.id ? "Hide details" : "Details"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {expandedId && (
              <div className="mt-3 rounded-xl border bg-white p-5">
                {expandedRow && (
                  <>
                    <h3 className="font-semibold">
                      Withdrawal {expandedRow.reference || expandedRow.id}
                    </h3>
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-gray-600">Account holder</dt>
                        <dd>{expandedRow.bankDetails?.accountName || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-600">Bank</dt>
                        <dd>{expandedRow.bankDetails?.bankName || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-600">Account number</dt>
                        <dd>
                          {maskAccountNumber(
                            expandedRow.bankDetails?.accountNumber
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-600">Status</dt>
                        <dd>{expandedRow.status || "UNKNOWN"}</dd>
                      </div>
                    </dl>
                  </>
                )}
              </div>
            )}
            <Pager
              page={page}
              count={filteredRows.length}
              size={PAGE_SIZE}
              onChange={setPage}
            />
          </>
        )}
      </section>
    </Workspace>
  );
}
