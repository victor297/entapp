import {redirect} from "next/navigation";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const query=await searchParams;redirect("/customer/payments"+(query.invoiceId?"?invoiceId="+encodeURIComponent(query.invoiceId):""));}
