import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend";

/** GET /api/admin/users?search=&status=&cursor=&limit= → GET /admin/users */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return proxyToBackend("/admin/users", {
    method: "GET",
    query: {
      search: params.get("search") ?? undefined,
      status: params.get("status") ?? undefined,
      cursor: params.get("cursor") ?? undefined,
      limit: params.get("limit") ?? undefined,
    },
  });
}
