import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_ACCESS } from "@/lib/session";

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
      return NextResponse.redirect(new URL("/users", request.url));
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

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
