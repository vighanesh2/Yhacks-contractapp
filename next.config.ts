import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: ["pdf-parse", "mammoth", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
