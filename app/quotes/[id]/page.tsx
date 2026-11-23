import {QuoteDetailsPage} from "@/components/operations/QuotesPage";
export default async function Page({params}:{params:Promise<{id:string}>}) { const {id}=await params; return <QuoteDetailsPage id={id} role="customer" />; }
