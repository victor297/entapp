import {QuoteDetailsPage} from "@/components/operations/QuotesPage";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {const query=await searchParams;return <QuoteDetailsPage role="provider" id={query.id || query.quoteId || ""} />;}
