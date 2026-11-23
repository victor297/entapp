import GlobalSuspense from "@/components/layouts/GlobalSuspense";

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return <GlobalSuspense>{children}</GlobalSuspense>;
}
