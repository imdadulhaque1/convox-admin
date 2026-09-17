import { proxyToBackend } from "@/lib/backend";

/** PATCH /api/admin/users/:id/reactivate → PATCH /admin/users/:id/reactivate */
export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyToBackend(`/admin/users/${id}/reactivate`, { method: "PATCH" });
}
