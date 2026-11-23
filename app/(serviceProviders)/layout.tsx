import GlobalSuspense from "@/components/layouts/GlobalSuspense";

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return <GlobalSuspense>{children}</GlobalSuspense>;
}
