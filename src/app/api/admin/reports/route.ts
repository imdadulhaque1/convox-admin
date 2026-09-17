import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend";

/** GET /api/admin/reports?status=&cursor=&limit= → GET /admin/reports (global moderation queue) */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return proxyToBackend("/admin/reports", {
    method: "GET",
    query: {
      status: params.get("status") ?? undefined,
      cursor: params.get("cursor") ?? undefined,
      limit: params.get("limit") ?? undefined,
    },
  });
}
