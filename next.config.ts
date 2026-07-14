import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for self-hosting (Hostinger VPS / Node hosting):
  // produces .next/standalone with a minimal node_modules + server.js.
  output: "standalone",
  // PGlite ships its own wasm and loads it relative to import.meta.url;
  // bundling it breaks that resolution, so keep it external.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
