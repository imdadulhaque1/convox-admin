import type { NextConfig } from "next";

// No custom `images.remotePatterns` needed — avatars/uploads are proxied same-origin
// through /api/media/** (see that route + lib/media.ts), never loaded directly from the
// backend's own host, so the default same-origin-only image config already covers it.
const nextConfig: NextConfig = {};

export default nextConfig;
