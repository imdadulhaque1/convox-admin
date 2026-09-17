import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { clearSessionCookies, readSession } from "@/lib/session";

/** POST /api/auth/logout — best-effort: revoke the refresh token server-side, then clear
 *  the local session regardless of whether that call succeeded (a dead/unreachable
 *  backend must never trap an admin in a signed-in-looking state). */
export async function POST() {
  const { accessToken, refreshToken } = await readSession();

  if (refreshToken) {
    await backendFetch("/admin/auth/logout", {
      method: "POST",
      body: { refreshToken },
      accessToken,
    });
  }

  const response = NextResponse.json({ success: true, message: "Signed out" });
  clearSessionCookies(response);
  return response;
}
