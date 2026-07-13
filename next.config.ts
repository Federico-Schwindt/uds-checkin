import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships its own wasm and loads it relative to import.meta.url;
  // bundling it breaks that resolution, so keep it external.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
