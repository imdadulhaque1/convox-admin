import type { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend";

/** GET /api/admin/admins?cursor=&limit= → GET /admin/admins (SUPER_ADMIN only, enforced
 *  server-side). Managing panel-admin accounts themselves — separate from ConnectX users. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return proxyToBackend("/admin/admins", {
    method: "GET",
    query: {
      cursor: params.get("cursor") ?? undefined,
      limit: params.get("limit") ?? undefined,
    },
  });
}

/** POST /api/admin/admins { username, email, password, role } → POST /admin/admins.
 *  The only way a new admin account is ever created — no self-registration. */
export async function POST(request: Request) {
  const body = await request.json();
  return proxyToBackend("/admin/admins", { method: "POST", body });
}
