import { NextResponse } from "next/server";
import type { ApiEnvelope } from "./types";
import { clearSessionCookies, readSession, setSessionCookies } from "./session";

const BASE_URL = process.env.BACKEND_BASE_URL;

// Deliberately not thrown at module scope: Next's build step imports every route handler
// to bundle it ("Collecting page data"), so a top-level throw here fails the *entire
// build* the moment this env var is missing anywhere (e.g. not yet set in a fresh Vercel
// project) — even though it's only actually needed once a request comes in. Checked
// inside backendFetch instead, so a misconfigured deploy fails the one request that needs
// it, with a clear message, rather than refusing to build at all.

export interface BackendResult<T> {
  status: number;
  body: ApiEnvelope<T> | null;
  /** Present whenever the backend's silent-refresh interceptor rotated the pair on this
   *  call — see connectx_api's NetworkModule-equivalent contract (ChatApp.md §3.3). Any
   *  authenticated request can carry this, not just /auth/refresh. */
  rotated: { accessToken: string; refreshToken: string } | null;
  /** A hard 401 with a token sent and no rotated pair back — the session is dead (revoked,
   *  expired refresh token, logged out elsewhere). Mirrors the mobile client's
   *  NetworkModule.authInterceptor logic exactly. */
  sessionDead: boolean;
}

/**
 * Talks directly to the connectx_api backend. Server-only (uses fetch with an absolute
 * URL and reads response headers Next's client fetch wouldn't need) — call this only from
 * Route Handlers, never from a Client Component.
 */
export async function backendFetch<T = unknown>(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
    body?: unknown;
    accessToken?: string | null;
    refreshToken?: string | null;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<BackendResult<T>> {
  if (!BASE_URL) {
    return {
      status: 500,
      body: { success: false, statusCode: 500, message: "Server misconfigured: BACKEND_BASE_URL is not set.", data: null as T },
      rotated: null,
      sessionDead: false,
    };
  }

  const url = new URL(`${BASE_URL}${path}`);
  if (opts.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;
  if (opts.refreshToken) headers["x-refresh-token"] = opts.refreshToken;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch {
    // Backend unreachable (VM down, network blip) — surface as a clean 502 rather than
    // an uncaught exception in the Route Handler.
    return { status: 502, body: { success: false, statusCode: 502, message: "Could not reach the ConvoX backend.", data: null as T }, rotated: null, sessionDead: false };
  }

  const newAccess = res.headers.get("x-access-token");
  const newRefresh = res.headers.get("x-refresh-token");
  const rotated = newAccess && newRefresh ? { accessToken: newAccess, refreshToken: newRefresh } : null;

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    body = null;
  }

  const sessionDead = res.status === 401 && Boolean(opts.accessToken) && !rotated;

  return { status: res.status, body, rotated, sessionDead };
}

/**
 * The shared shape behind every /api/admin/** Route Handler in this app: read the
 * session cookies, forward the call to the real backend, and reflect any token rotation
 * (or session death) back onto the outgoing response. Cuts every proxy route down to a
 * couple of lines — see app/api/admin/users/route.ts for the simplest example.
 *
 * Unlike the ConnectX user JwtAuthGuard, AdminJwtAuthGuard does *not* silently rotate an
 * expired access token via the x-refresh-token header — it's a plain passport guard, so
 * an expired token is just a flat 401 (see AdminJwtStrategy / AdminJwtAuthGuard). This
 * does the refresh ourselves: on a 401, call POST /admin/auth/refresh once, retry the
 * original request with the new access token, and persist whatever pair comes back.
 */
export async function proxyToBackend<T = unknown>(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<NextResponse> {
  const { accessToken, refreshToken } = await readSession();
  if (!accessToken) {
    return NextResponse.json(
      { success: false, statusCode: 401, message: "Not signed in.", data: null },
      { status: 401 },
    );
  }

  let result = await backendFetch<T>(path, { ...opts, accessToken });

  if (result.status === 401 && refreshToken) {
    const refreshed = await backendFetch<{ accessToken: string; refreshToken: string }>(
      "/admin/auth/refresh",
      { method: "POST", body: { refreshToken } },
    );

    if (refreshed.status === 200 && refreshed.body?.success && refreshed.body.data) {
      const tokens = refreshed.body.data;
      result = await backendFetch<T>(path, { ...opts, accessToken: tokens.accessToken });

      const response = NextResponse.json(
        result.body ?? { success: false, statusCode: result.status, message: "Unexpected response from backend.", data: null },
        { status: result.status },
      );
      if (result.status === 401) {
        clearSessionCookies(response);
      } else {
        setSessionCookies(response, tokens);
      }
      return response;
    }

    // Refresh token is dead too (expired, revoked, or logged in elsewhere) — the session
    // is over, sign out locally rather than leaving a signed-in-looking dead state.
    const response = NextResponse.json(
      { success: false, statusCode: 401, message: refreshed.body?.message ?? "Session expired. Please sign in again.", data: null },
      { status: 401 },
    );
    clearSessionCookies(response);
    return response;
  }

  return NextResponse.json(
    result.body ?? { success: false, statusCode: result.status, message: "Unexpected response from backend.", data: null },
    { status: result.status },
  );
}
