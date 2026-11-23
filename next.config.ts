import type { NextConfig } from "next";

const imageHostnames = (process.env.NEXT_IMAGE_HOSTS ?? "")
  .split(",")
  .map((hostname) => hostname.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/cateringServices", destination: "/cateringServices/allPost", permanent: true }];
  },
  images: {
    remotePatterns: imageHostnames.map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
};

export default nextConfig;
