import ListingEditor from "@/components/operations/ListingEditor";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const q=await searchParams;return <ListingEditor role="provider" kind="catering" id={q.id || q.serviceId}/>;}
