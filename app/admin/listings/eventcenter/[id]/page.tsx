import ListingEditor from "@/components/operations/ListingEditor";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ListingEditor role="admin" kind="eventcenter" id={id}/>;}
