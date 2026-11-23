"use client";
import Link from "next/link";
import { Bell, Menu, Settings } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
export default function AccountHeader({ setIsSidebarOpen }: { setIsSidebarOpen: (open: boolean) => void }) {
  const { user } = useCurrentUser(); const admin = user?.userType === "ADMIN"; const catering = user?.serviceProvider?.serviceType === "CATERING";
  return <header className="flex items-center justify-between gap-4 border-b bg-white px-4 py-4 text-gray-900 sm:px-6"><div className="flex items-center gap-3"><button aria-label="Open navigation" className="rounded-lg border p-2 md:hidden" onClick={() => setIsSidebarOpen(true)}><Menu size={20} /></button><div><p className="font-semibold">Welcome back{user?.firstName ? `, ${user.firstName}` : ""}</p><p className="text-sm text-gray-500">Manage your account and event services.</p></div></div><div className="flex gap-4">{!admin && <Link className="hidden text-sm font-medium text-blue-800 sm:block" href="/provider/subscriptions">Subscriptions</Link>}<Link aria-label="Account settings" href={admin ? "/admin/settings" : `/${catering ? "cateringServiceManagement" : "eventServiceManagement"}/settings`}><Settings size={21} /></Link><Link aria-label="Notification centre" href="/notifications"><Bell size={21} /></Link></div></header>;
}
