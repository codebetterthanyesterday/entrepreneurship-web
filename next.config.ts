import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The site opens on the menu now; links and QR codes to the old address
      // keep working.
      { source: "/menu", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
