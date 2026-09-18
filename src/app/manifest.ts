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
    // The source (src/image/convox.png) already has generous padding around the glyph on
    // a full-bleed background, so the same two files safely cover both purposes — no
    // separate maskable image needed. (The spec allows one icon entry to declare
    // `purpose: "any maskable"` as a single space-separated value, but Next's manifest
    // type only accepts one literal — so it's listed twice instead.)
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
