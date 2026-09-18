import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_ACCESS, COOKIE_WHO } from "@/lib/session";

/**
 * Gate every page except the public auth screens behind the presence of a session cookie.
 * This is a cheap client-facing check only — it just avoids flashing the dashboard shell
 * before a redirect. The real authorization check is SuperAdminOnlyGuard on the backend,
 * re-verified on every single API call; a stolen/expired cookie still can't do anything
 * once it hits the API.
 */
const PUBLIC_PATHS = new Set(["/login", "/forgot-password", "/reset-password"]);

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(COOKIE_ACCESS);
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === "/login" && hasSession) {
      return NextResponse.redirect(new URL(defaultLandingPath(request), request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/** Dashboard is SUPER_ADMIN-only (SuperAdminOnlyGuard on /admin/stats/**) — send that
 *  role there by default and everyone else to Users (open to both roles), so a plain
 *  ADMIN visiting /login while already signed in never lands on a page that just 403s.
 *  Reads the readable (non-httpOnly) "who" cookie — display-only, not a security
 *  boundary, same as everywhere else it's used (see lib/session.ts). */
function defaultLandingPath(request: NextRequest): string {
  const raw = request.cookies.get(COOKIE_WHO)?.value;
  if (!raw) return "/users";
  try {
    const who = JSON.parse(raw) as { role?: string };
    return who.role === "SUPER_ADMIN" ? "/dashboard" : "/users";
  } catch {
    return "/users";
  }
}

export const config = {
  // Excludes `api`, Next internals, and — generically — any path with a file extension
  // (icons, the manifest, the service worker, images under public/, …), rather than
  // naming each static asset one by one. Static files need to be fetchable with no
  // session — a browser/OS checking PWA installability, an <img> on the logged-out login
  // page, etc. never sends cookies for that first request, and shouldn't be bounced to
  // /login for trying. Safe here because no actual app route in this project has a dot in
  // its path (check that still holds before adding one).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
