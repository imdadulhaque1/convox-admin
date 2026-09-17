import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend";

/** GET /api/admin/users/:id/login-history?cursor=&limit= → GET /admin/users/:id/login-history */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const params = request.nextUrl.searchParams;
  return proxyToBackend(`/admin/users/${id}/login-history`, {
    method: "GET",
    query: {
      cursor: params.get("cursor") ?? undefined,
      limit: params.get("limit") ?? undefined,
    },
  });
}
