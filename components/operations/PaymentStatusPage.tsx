"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOperationRecordQuery } from "@/redux/services/operationsApi";
import { Workspace, Message, ApiError, buttonClass } from "./Workspace";
import { isPaymentConfirmed } from "@/lib/payment-status";
export default function PaymentStatusPage({ invoiceId }: { invoiceId: string }) {
  const { userId, user } = useCurrentUser(); const result = useOperationRecordQuery(`/invoice/${encodeURIComponent(invoiceId)}`, { skip: !invoiceId || !userId || !user, pollingInterval: 4000, skipPollingIfUnfocused: true });
  const confirmed = isPaymentConfirmed(result.data, userId); const [waiting, setWaiting] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setWaiting(false), 45000); return () => clearTimeout(timer); }, []);
  useEffect(() => { if (confirmed) sessionStorage.removeItem("pendingPayment"); }, [confirmed]);
  return <Workspace role="any" title={confirmed ? "Payment confirmed" : "Checking your payment"}>
    {!invoiceId ? <Message error>No invoice reference was provided. Open your invoices to check the payment.</Message> : result.error ? <ApiError error={result.error} retry={result.refetch} /> : result.data && result.data.userId !== userId ? <Message error>This invoice does not belong to your account.</Message> : confirmed ? <Message>Your invoice is marked paid by the server.</Message> : <Message>{waiting ? "Waiting for the server to confirm payment. A payment reference alone does not confirm that the invoice is paid." : "The server has not confirmed full payment yet. Refresh the invoice or contact support before trying another payment."}</Message>}
    <div className="mt-5 flex flex-wrap gap-4"><Link className={buttonClass} href={`/${user?.userType === "SERVICE_PROVIDER" ? "provider/invoices" : "customer/payments"}${invoiceId ? `?invoiceId=${encodeURIComponent(invoiceId)}` : ""}`}>View invoice</Link>{invoiceId && <button className="text-blue-800 underline" onClick={() => result.refetch()}>Check again</button>}<Link className="text-blue-800 underline" href="/support">Support options</Link></div>
  </Workspace>;
}
