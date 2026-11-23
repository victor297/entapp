"use client";

import { useAuthGuard } from "@/hooks/useAuthGuard";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isAuthorized } = useAuthGuard({ requireAdmin: true });

  // Block everything while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthorized) return <main className="mx-auto max-w-xl p-10 text-gray-900"><h1 className="mb-4 text-2xl font-semibold">Admin access required</h1><p className="mb-5">Sign in with an administrator account to continue.</p><Link href="/login?reauth=1&returnTo=%2Fadmin" className="text-blue-800 underline">Sign in</Link></main>;
  return <>{children}</>;
}
