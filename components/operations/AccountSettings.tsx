"use client";
import { useState, useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { persistCurrentUser } from "@/lib/current-user";
import { useUpdateUserMutation, type UserResponse } from "@/redux/services/authApi";
import { Workspace, Message, ApiError, buttonClass, fieldClass } from "./Workspace";
export default function AccountSettings() {
  const { userId, user } = useCurrentUser(); const [firstName, setFirstName] = useState(""); const [lastName, setLastName] = useState(""); const [error, setError] = useState<unknown>(); const [message, setMessage] = useState(""); const [update, action] = useUpdateUserMutation();
  useEffect(() => { if (user) { setFirstName(user.firstName || ""); setLastName(user.lastName || ""); } }, [user?.firstName, user?.lastName]);
  return <Workspace role="provider" title="Account settings"><form className="grid gap-4 rounded-xl border bg-white p-6 sm:grid-cols-2" onSubmit={async event => { event.preventDefault(); if (!userId || !user) return; setError(undefined); setMessage(""); try { const response = await update({ id: userId, body: { firstName, lastName } }).unwrap(); persistCurrentUser({ ...user, ...response } as UserResponse); setMessage("Account details saved."); } catch (caught) { setError(caught); } }}><label>First name<input className={fieldClass} required value={firstName} onChange={e => setFirstName(e.target.value)} /></label><label>Last name<input className={fieldClass} required value={lastName} onChange={e => setLastName(e.target.value)} /></label><p className="sm:col-span-2">Email: {user?.email || "Not available"}</p><button className={buttonClass} disabled={action.isLoading}>Save account details</button></form>{message && <Message>{message}</Message>}{Boolean(error) && <ApiError error={error} />}<Message>Saved cards, default payment methods and saved payout bank accounts are not currently available.</Message></Workspace>;
}
