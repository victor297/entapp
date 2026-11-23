import GlobalSuspense from "@/components/layouts/GlobalSuspense";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <GlobalSuspense>{children}</GlobalSuspense>;
}
