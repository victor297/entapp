import type { Metadata } from "next";

// Set the public frontend origin in production so canonical and social URLs
// resolve to the deployed website rather than the backend API.
const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
export const siteOrigin = configuredOrigin ? new URL(configuredOrigin) : undefined;

interface PageMetadata {
  title: string;
  description: string;
  path: string;
  images?: string[];
  noIndex?: boolean;
}

export function buildMetadata({ title, description, path, images, noIndex }: PageMetadata): Metadata {
  const summary = description.replace(/\s+/g, " ").trim().slice(0, 160);
  const socialImages = images?.filter(Boolean).length ? images.filter(Boolean) : ["/eventHeroImage.png"];
  return {
    title,
    description: summary,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | Ent App`,
      description: summary,
      url: path,
      siteName: "Ent App",
      type: "website",
      images: socialImages,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Ent App`,
      description: summary,
      images: socialImages,
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
