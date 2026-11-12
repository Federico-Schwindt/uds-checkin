import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for self-hosting (Hostinger VPS / Node hosting):
  // produces .next/standalone with a minimal node_modules + server.js.
  output: "standalone",
  // PGlite ships its own wasm and loads it relative to import.meta.url;
  // bundling it breaks that resolution, so keep it external.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Hostinger's build machine has 64 cores, so Next starts 61 build workers; since Next 16.4 each one opens its own
  // thread pool and the shared hosting refuses new threads ("OS can't spawn worker thread"), failing the build.
  experimental: { cpus: 4 },
};

export default nextConfig;
