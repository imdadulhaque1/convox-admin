import { NextResponse } from "next/server";

const MEDIA_BASE_URL = process.env.BACKEND_MEDIA_URL;

/**
 * GET /api/media/<uploads/avatars/x.jpg> → streams the same file from the backend's own
 * static file server (BACKEND_MEDIA_URL + /<path>). Uploaded files need no auth on the
 * backend (they're plain static serving), so this is a pass-through fetch, not a
 * proxyToBackend call — the only reason it exists is so the browser's Network tab (and
 * the page's own HTML/JS) never has to reference the backend's host directly, the same
 * way every other /api/** route already hides it for JSON calls. See <Avatar>/lib/media.ts.
 */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (!MEDIA_BASE_URL) {
    return NextResponse.json(
      { success: false, message: "Server misconfigured: BACKEND_MEDIA_URL is not set." },
      { status: 500 },
    );
  }

  const { path } = await context.params;

  if (path.some((segment) => segment === "..")) {
    return NextResponse.json({ success: false, message: "Invalid path." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${MEDIA_BASE_URL}/${path.join("/")}`, { cache: "no-store" });
  } catch {
    return NextResponse.json(
      { success: false, message: "Could not reach the ConvoX backend." },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    return new NextResponse(null, { status: upstream.status || 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      // Uploaded avatars are content-addressed-ish (new upload = new filename), so a long
      // cache is safe and saves re-fetching the same image through this proxy every time.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
