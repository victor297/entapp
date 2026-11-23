import BookingDetails from "@/components/operations/BookingDetails";
export default async function Page({params}:{params:Promise<{id:string}>}) { const {id}=await params; return <BookingDetails id={id} role="provider" />; }
