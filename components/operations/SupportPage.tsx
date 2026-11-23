"use client";
import { useState } from "react";
import Navbar from "@/components/layouts/Navbar";
import Link from "next/link";
import { buttonClass, fieldClass, Message } from "./Workspace";
export default function SupportPage() {
  const configured = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  const email =
    configured && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configured)
      ? configured
      : "";
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar />
      <section className="mx-auto max-w-3xl p-6 sm:p-10">
        <h1 className="mb-6 text-3xl font-bold">Contact and support</h1>
        <p className="mb-4">
          For questions about an event or service, use the contact details on
          the provider&apos;s listing.
        </p>
        {email ? (
          <form
            className="space-y-4 rounded-xl border bg-white p-6"
            onSubmit={(event) => {
              event.preventDefault();
              window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
            }}
          >
            <label className="block">
              Subject
              <input
                className={fieldClass}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
                maxLength={150}
              />
            </label>
            <label className="block">
              Message
              <textarea
                className={fieldClass}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
                minLength={10}
                maxLength={4000}
              />
            </label>
            <p className="text-sm text-gray-600">
              This opens your email app. Your message is sent only when you send
              it there.
            </p>
            <button className={buttonClass}>Open email app</button>
          </form>
        ) : (
          <Message>
            General support contact details are not currently available.
          </Message>
        )}
        <Link
          className="mt-6 inline-block text-blue-800 underline"
          href="/customer/disputes"
        >
          Help with a payment dispute
        </Link>
      </section>
    </main>
  );
}
