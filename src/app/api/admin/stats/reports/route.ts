import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend";

/** GET /api/admin/stats/reports?days= → GET /admin/stats/reports */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return proxyToBackend("/admin/stats/reports", {
    method: "GET",
    query: { days: params.get("days") ?? undefined },
  });
}
