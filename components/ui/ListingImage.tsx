"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export const LISTING_FALLBACK_IMAGE = "/listing-placeholder.svg";

type ListingImageProps = Omit<ImageProps, "src"> & {
  src?: ImageProps["src"] | null;
};

export default function ListingImage({ src, alt, onError, ...props }: ListingImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps["src"] | null>(null);
  const imageSource = typeof src === "string" ? src.trim() : src;
  const showFallback = !imageSource || failedSource === imageSource;

  return (
    <Image
      {...props}
      src={showFallback ? LISTING_FALLBACK_IMAGE : imageSource}
      alt={alt}
      unoptimized={showFallback || props.unoptimized}
      onError={(event) => {
        if (!showFallback && imageSource) setFailedSource(imageSource);
        onError?.(event);
      }}
    />
  );
}
