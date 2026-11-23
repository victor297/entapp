"use client";
import Link from "next/link";
import { Workspace, Message } from "./Workspace";
export default function UnavailablePage({ title, role = "any", message }: { title: string; role?: "admin" | "provider" | "customer" | "any"; message: string }) {
  return <Workspace role={role} title={title}><Message>{message}</Message><Link className="text-blue-800 underline" href="/support">Contact and support options</Link></Workspace>;
}
