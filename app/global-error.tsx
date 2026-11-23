"use client";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body style={{ fontFamily: "sans-serif", padding: "4rem 1rem", textAlign: "center", color: "#172554" }}><img src="/logo-footer.png" alt="Ent App" width="150" /><h1>We couldn&apos;t open the app</h1><p>Please try again or return to the homepage.</p><button onClick={reset}>Try again</button> <a href="/">Return home</a></body></html>;
}
