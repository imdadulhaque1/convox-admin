import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend";

/** GET /api/admin/users/:id/reports?status=&cursor=&limit= → GET /admin/users/:id/reports */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const params = request.nextUrl.searchParams;
  return proxyToBackend(`/admin/users/${id}/reports`, {
    method: "GET",
    query: {
      status: params.get("status") ?? undefined,
      cursor: params.get("cursor") ?? undefined,
      limit: params.get("limit") ?? undefined,
    },
  });
}
