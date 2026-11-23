import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientProvider from "./ClientProvider";
import { siteOrigin } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: siteOrigin,
  title: { default: "Event Venues & Catering | Ent App", template: "%s | Ent App" },
  description: "Discover event venues and catering services. Compare options, save your favourites, and plan your next event with Ent App.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientProvider>
          {children}
        </ClientProvider>
      </body>
    </html>
  );
}
