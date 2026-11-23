"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8 text-center text-gray-900"><Link href="/" className="mb-8"><img src="/logo-footer.png" width="150" height="50" alt="Ent App home" /></Link><h1 className="text-3xl font-bold">We couldn&apos;t load this page</h1><p className="my-4 max-w-md text-gray-600">Please try again. If the problem continues, open support for help.</p><div className="flex flex-wrap justify-center gap-4"><button onClick={reset} className="rounded-lg bg-blue-800 px-5 py-3 text-white">Try again</button><Link className="rounded-lg border px-5 py-3" href="/">Return home</Link><Link className="px-5 py-3 text-blue-800 underline" href="/support">Support</Link></div></main>;
}
