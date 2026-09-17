/**
 * Turns a relative path the API returns (e.g. "/uploads/avatars/x.jpg") into a loadable
 * <img> URL — routed through this app's own /api/media/** proxy (see that route) rather
 * than the backend's host directly, so the raw backend IP never appears in the browser's
 * Network tab or page source, same as every JSON call already going through /api/admin/**.
 * No env var needed here — unlike the JSON proxy this needs no server secret, so nothing
 * client-safe has to be inlined into the bundle.
 */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `/api/media${path.startsWith("/") ? path : `/${path}`}`;
}
