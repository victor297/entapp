"use client";

import { Provider } from "react-redux";
import { store, resetSessionQueries } from "@/redux/store";
import { ReactNode, useEffect } from "react";
import { watchSessionCache } from "@/lib/session-cache";

export default function ClientProvider({ children }: { children: ReactNode }) {
  useEffect(() => watchSessionCache(resetSessionQueries), []);
  return <Provider store={store}>{children}</Provider>;
}
