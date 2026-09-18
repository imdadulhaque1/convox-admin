import type { MetadataRoute } from "next";

/** Next.js App Router convention — served automatically at /manifest.webmanifest and
 *  linked from every page's <head>, no explicit <link rel="manifest"> needed. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ConvoX Admin",
    short_name: "ConvoX Admin",
    description: "Super-admin console for ConvoX",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F7FB",
    theme_color: "#4F46E5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
