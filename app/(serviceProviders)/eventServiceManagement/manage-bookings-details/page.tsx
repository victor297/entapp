import BookingDetails from "@/components/operations/BookingDetails";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) { const query=await searchParams; return <BookingDetails id={query.id || query.bookingId || ""} role="provider" />; }
