import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});

const nextConfig: NextConfig = {
  // Dev server only: lets a phone reach `next dev` through a Cloudflare
  // quick tunnel (HTTPS is required for camera access and the PWA).
  allowedDevOrigins: ["*.trycloudflare.com"],
  experimental: {
    serverActions: {
      // Data Master accepts list uploads up to 3 MB (see master-data/actions.ts).
      bodySizeLimit: "4mb",
    },
  },
};

export default withSerwist(nextConfig);
