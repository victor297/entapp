import FinancePage from "@/components/operations/FinancePage";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {const query=await searchParams;return <FinancePage role="customer" mode="invoices" invoiceId={query.invoiceId}/>;}
