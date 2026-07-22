import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "onjguvlozsqxkurgqgbl.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    localPatterns: [
      {
        pathname: "/current-supply-logo.png",
      },
      {
        pathname: "/api/media/**",
      },
      {
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;
