"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import Header from "@/components/layouts/Header";
import SideBar from "@/components/layouts/SideBar";
import ServiceProviderSideBar from "@/components/layouts/ServiceProviderSideBar";
import Navbar from "@/components/layouts/Navbar";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getApiError } from "@/hooks/getApiError";

export const fieldClass = "w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-600";
export const buttonClass = "inline-flex items-center justify-center rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50";
export function Message({ children, error = false }: { children: ReactNode; error?: boolean }) { return <div role={error ? "alert" : "status"} className={`my-4 rounded-xl border p-4 ${error ? "border-red-200 bg-red-50 text-red-800" : "border-blue-100 bg-blue-50 text-blue-900"}`}>{children}</div>; }
export function ApiError({ error, retry }: { error: unknown; retry?: () => void }) { return <Message error>{getApiError(error, "We couldn't load this information. Please try again.")} {retry && <button onClick={retry} className="ml-3 underline">Try again</button>}</Message>; }
export function Workspace({ title, role, children }: { title: string; role: "admin" | "provider" | "customer" | "any"; children: ReactNode }) {
  const session = useCurrentUser(); const [open, setOpen] = useState(false);
  if (session.isCheckingAuth) return <div role="status" className="p-10 text-gray-700">Loading your account…</div>;
  if (!session.isLoggedIn || !session.user) return <main className="mx-auto max-w-xl p-10 text-gray-900"><h1 className="text-2xl font-semibold">{title}</h1><Message>Please sign in to load your account details.</Message><Link className={buttonClass} href={`/login?reauth=1&returnTo=${typeof window !== "undefined" ? encodeURIComponent(window.location.pathname + window.location.search) : "/"}`}>Sign in</Link></main>;
  const allowed = role === "any" || session.user.userType === (role === "admin" ? "ADMIN" : role === "provider" ? "SERVICE_PROVIDER" : "CUSTOMER");
  if (!allowed) return <main className="p-10"><Message error>This page is not available for your account.</Message><Link href="/">Return home</Link></main>;
  const dashboard = role === "admin" || role === "provider";
  return <div className="min-h-screen bg-gray-50 text-gray-900">{role === "admin" ? <SideBar isOpen={open} toggleSidebar={() => setOpen(!open)} /> : role === "provider" ? <ServiceProviderSideBar isOpen={open} toggleSidebar={() => setOpen(!open)} /> : <Navbar />}<div className={dashboard ? "md:ml-72" : ""}>{dashboard && <Header setIsSidebarOpen={setOpen} />}<main className="mx-auto max-w-7xl p-4 sm:p-8"><h1 className="mb-6 text-3xl font-bold">{title}</h1>{children}</main></div></div>;
}
export function Pager({ page, count, size = 12, onChange }: { page: number; count: number; size?: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / size));
  return <nav aria-label="Results pages" className="mt-6 flex items-center justify-between gap-4"><button className={buttonClass} disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button><span>Page {page} of {pages} · {count} results</span><button className={buttonClass} disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button></nav>;
}
