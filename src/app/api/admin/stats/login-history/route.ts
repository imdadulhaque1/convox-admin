import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend";

/** GET /api/admin/stats/login-history?cursor=&limit= → GET /admin/stats/login-history.
 *  Every sign-in across every user, newest first — the global counterpart to
 *  /api/admin/users/:id/login-history. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return proxyToBackend("/admin/stats/login-history", {
    method: "GET",
    query: {
      cursor: params.get("cursor") ?? undefined,
      limit: params.get("limit") ?? undefined,
    },
  });
}
