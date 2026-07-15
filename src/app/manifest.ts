import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UDS Check-In",
    short_name: "UDS Check-In",
    description: "Universal Driveshafts customer check-in station",
    start_url: "/",
    id: "/",
    // Fullscreen kiosk experience on tablets; falls back to standalone.
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    orientation: "any",
    background_color: "#0a0f1c",
    theme_color: "#1246ab",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
