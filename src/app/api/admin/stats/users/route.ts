import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend";

/** GET /api/admin/stats/users?days= → GET /admin/stats/users */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return proxyToBackend("/admin/stats/users", {
    method: "GET",
    query: { days: params.get("days") ?? undefined },
  });
}
