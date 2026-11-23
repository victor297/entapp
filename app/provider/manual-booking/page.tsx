import ManualBooking from "@/components/operations/ManualBooking";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const q=await searchParams;return <ManualBooking quoteId={q.quoteId}/>;}
