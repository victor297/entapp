import AvailabilityPage from "@/components/operations/AvailabilityPage";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const q=await searchParams;return <AvailabilityPage initialServiceId={q.serviceId}/>;}
