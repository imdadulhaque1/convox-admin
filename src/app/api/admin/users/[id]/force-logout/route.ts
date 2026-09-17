import { proxyToBackend } from "@/lib/backend";

/** POST /api/admin/users/:id/force-logout → POST /admin/users/:id/force-logout */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyToBackend(`/admin/users/${id}/force-logout`, { method: "POST" });
}
