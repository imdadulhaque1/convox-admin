import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { AdminWhoAmI } from "./types";

/**
 * Session cookies. The two tokens are httpOnly — no client-side JS ever sees them, only
 * this app's own Route Handlers (see lib/backend.ts). `cx_admin_who` is deliberately
 * readable (not httpOnly) so the topbar can render the signed-in admin's name without an
 * extra round trip; it carries no authority — the backend re-checks isSuperAdmin on every
 * request regardless of what this cookie says.
 */
export const COOKIE_ACCESS = "cx_admin_at";
export const COOKIE_REFRESH = "cx_admin_rt";
export const COOKIE_WHO = "cx_admin_who";

const isSecure = process.env.COOKIES_SECURE === "true";

const baseCookie = {
  httpOnly: true,
  secure: isSecure,
  sameSite: "lax" as const,
  path: "/",
};

export async function readSession() {
  const store = await cookies();
  return {
    accessToken: store.get(COOKIE_ACCESS)?.value ?? null,
    refreshToken: store.get(COOKIE_REFRESH)?.value ?? null,
  };
}

export async function readWhoAmI(): Promise<AdminWhoAmI | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_WHO)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminWhoAmI;
  } catch {
    return null;
  }
}

/** Applies a fresh token pair (and optionally the "who am I" info, on login) to an
 *  outgoing NextResponse. Used by every Route Handler that talks to the backend, since
 *  the silent-refresh contract can rotate the pair on *any* authenticated call. */
export function setSessionCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
  who?: AdminWhoAmI,
) {
  response.cookies.set(COOKIE_ACCESS, tokens.accessToken, {
    ...baseCookie,
    maxAge: 60 * 60 * 24 * 7, // access token TTL is short server-side; this just bounds the cookie's own life
  });
  response.cookies.set(COOKIE_REFRESH, tokens.refreshToken, {
    ...baseCookie,
    maxAge: 60 * 60 * 24 * 30,
  });
  if (who) {
    response.cookies.set(COOKIE_WHO, JSON.stringify(who), {
      httpOnly: false,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.delete(COOKIE_ACCESS);
  response.cookies.delete(COOKIE_REFRESH);
  response.cookies.delete(COOKIE_WHO);
}
