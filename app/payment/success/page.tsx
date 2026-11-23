import PaymentStatusPage from "@/components/operations/PaymentStatusPage";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {const query=await searchParams;return <PaymentStatusPage invoiceId={query.invoiceId || ""}/>;}
